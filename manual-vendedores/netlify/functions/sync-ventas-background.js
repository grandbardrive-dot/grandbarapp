// ============================================================
//  GrandBar · Netlify Function (background) · sync-ventas
//  Baja las VENTAS por artículo desde Córdoba Software (Aikon/Sinergis
//  IS3) y las agrega por SKU + día en Supabase (ventas_articulos).
//
//  Flujo:
//    1) ListarComprobantes(FechaDesde, FechaHasta)  → cabeceras
//    2) ObtenerComprobante(Codigo,Sucursal,Numero,Tipo) → renglones (SKU, cant, importe)
//    3) Agrega neto (facturas +, notas de crédito −) por (sku, fecha)
//    4) Reemplaza el rango en ventas_articulos y registra en ventas_sync_log
//
//  Es -background (hasta 15 min). Devuelve 202 al toque; el resultado
//  queda en ventas_sync_log. Verificá con /ventas-estado.
//
//  Uso:
//    (cron diario)                       → sincroniza AYER
//    /sync-ventas-background?desde=01/08/2026&hasta=07/08/2026   (backfill)
//    ?key=<SYNC_SECRET> si está seteado.
//  Env: AIKON_* (ya en el portal) + opcional MANUAL_ANON_KEY, SYNC_SECRET.
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const sb = (path, opts = {}) => fetch(SB_URL + '/rest/v1/' + path, {
  ...opts,
  headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

async function aikon(url, body, ms = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { _raw: text.slice(0, 300) }; }
  } catch (e) { return { _error: (e && e.message) || String(e) }; }
  finally { clearTimeout(t); }
}

const dd = (n) => String(n).padStart(2, '0');
const fmtFecha = (d) => dd(d.getDate()) + '/' + dd(d.getMonth() + 1) + '/' + d.getFullYear();
// dd/mm/yyyy → yyyy-mm-dd
const ddmmToISO = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
// "/Date(1787281200000-0300)/" → yyyy-mm-dd (fecha calendario AR)
function netDateToISO(s) {
  const m = String(s || '').match(/\/Date\((\d+)/);
  if (!m) return null;
  const d = new Date(Number(m[1]) - 3 * 3600 * 1000); // a hora AR y tomo la fecha UTC
  return d.toISOString().slice(0, 10);
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const val = (o, ...keys) => { for (const k of keys) { if (o && o[k] != null && String(o[k]).trim() !== '') return o[k]; } return null; };

async function login() {
  const cuenta = process.env.AIKON_CUENTA;
  if (!cuenta || !process.env.AIKON_EMPRESA) throw new Error('Faltan AIKON_CUENTA / AIKON_EMPRESA.');
  const managerUrl = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  if (!urlCuenta) throw new Error('CuentaURL no devolvió URL: ' + JSON.stringify(j1).slice(0, 160));
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA });
  const token = j2.token && j2.token.Codigo;
  if (!token) throw new Error('ObtenerToken falló: ' + JSON.stringify(j2).slice(0, 160));
  return { urlCuenta, cuenta, token };
}

// Procesa los renglones en tandas para no demorar de más.
async function enTandas(items, tam, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += tam) {
    const chunk = items.slice(i, i + tam);
    out.push(...await Promise.all(chunk.map(fn)));
  }
  return out;
}

async function sincronizar(desde, hasta) {
  const { urlCuenta, cuenta, token } = await login();

  // 1) Cabeceras de comprobantes del rango.
  const jc = await aikon(urlCuenta + '/IS3/ListarComprobantes', { cuenta, token, FechaDesde: desde, FechaHasta: hasta }, 60000);
  const comprobantes = Array.isArray(jc.lista) ? jc.lista : (Array.isArray(jc) ? jc : []);
  if (!Array.isArray(comprobantes)) throw new Error('ListarComprobantes no devolvió lista: ' + JSON.stringify(jc).slice(0, 200));

  // Solo ventas (FA*) y notas de crédito (NC*), no anuladas.
  const utiles = comprobantes.filter((c) => {
    const cod = String(c.Codigo || '');
    return /^(FA|NC)/i.test(cod) && !c.FechaAnulacion;
  });

  const MAX = Number(process.env.VENTAS_MAX_COMPROB || 2000);
  const recorte = utiles.slice(0, MAX);

  // 2) Detalle de cada comprobante (en tandas de 6 en paralelo).
  const agg = new Map(); // `${sku}|${fechaISO}` -> fila
  let renglones = 0;

  await enTandas(recorte, 6, async (c) => {
    const j = await aikon(urlCuenta + '/IS3/ObtenerComprobante', { cuenta, token, Codigo: c.Codigo, Sucursal: c.Sucursal, Numero: c.Numero, Tipo: c.Tipo }, 20000);
    const comp = j.Comprobante || j.comprobante || {};
    const det = comp.Detalle || comp.detalle || [];
    if (!Array.isArray(det) || !det.length) return;
    const fechaISO = netDateToISO(c.FechaEmision) || netDateToISO(comp.FechaEmision) || ddmmToISO(hasta);
    const signo = /^NC/i.test(String(c.Codigo || '')) ? -1 : 1;
    for (const r of det) {
      const sku = String(val(r, 'Articulo', 'ArticuloCodigo') || '').trim();
      if (!sku) continue;
      const cant = num(val(r, 'Cantidad'));
      const imp = Math.abs(num(val(r, 'TotalNeto', 'ImporteUni', 'Total'))) * signo;
      const costoU = Math.abs(num(val(r, 'ArticuloCostoNeto')) * cant) * signo;
      const key = sku + '|' + fechaISO;
      const row = agg.get(key) || {
        sku, fecha: fechaISO,
        descripcion: val(r, 'Descripcion'), marca: val(r, 'ArticuloMarca'),
        familia: val(r, 'Familia'), familia_nombre: val(r, 'ArticuloFamiliaNombre'),
        codigo_barras: val(r, 'ArticuloCodigoBarras'),
        unidades: 0, importe: 0, costo: 0, comprobantes: 0,
      };
      row.unidades += cant * signo;
      row.importe += imp;
      row.costo += costoU;
      row.comprobantes += 1;
      if (!row.descripcion) row.descripcion = val(r, 'Descripcion');
      agg.set(key, row);
      renglones++;
    }
  });

  // 3) Reemplazar el rango en ventas_articulos (idempotente).
  const desdeISO = ddmmToISO(desde), hastaISO = ddmmToISO(hasta);
  const del = await sb(`ventas_articulos?fecha=gte.${desdeISO}&fecha=lte.${hastaISO}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  if (!del.ok && del.status !== 404) throw new Error('DELETE ventas_articulos falló: ' + (await del.text()).slice(0, 160));

  const filas = [...agg.values()].map((r) => ({
    ...r,
    unidades: Math.round(r.unidades * 100) / 100,
    importe: Math.round(r.importe),
    costo: Math.round(r.costo),
    actualizado: new Date().toISOString(),
  }));
  let insertadas = 0;
  for (let i = 0; i < filas.length; i += 500) {
    const chunk = filas.slice(i, i + 500);
    const ins = await sb('ventas_articulos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(chunk) });
    if (!ins.ok) throw new Error('INSERT ventas_articulos falló: ' + (await ins.text()).slice(0, 200));
    insertadas += chunk.length;
  }

  return { comprobantes: recorte.length, totalComprobantes: comprobantes.length, renglones, skus: insertadas, truncado: utiles.length > MAX };
}

async function correr(desde, hasta) {
  let res, ok = true, detalle = '';
  try { res = await sincronizar(desde, hasta); detalle = JSON.stringify(res); }
  catch (e) { ok = false; res = { error: (e && e.message) || String(e) }; detalle = res.error; }
  try {
    await sb('ventas_sync_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      desde: ddmmToISO(desde), hasta: ddmmToISO(hasta),
      comprobantes: res.comprobantes || 0, renglones: res.renglones || 0, skus: res.skus || 0, ok, detalle: detalle.slice(0, 900),
    }) });
  } catch (e) { /* si el log falla, no importa */ }
  console.log('sync-ventas', ok ? 'OK' : 'ERROR', detalle.slice(0, 300));
  return { ok, ...res };
}

exports.handler = async (event) => {
  const secret = process.env.SYNC_SECRET;
  const q = (event && event.queryStringParameters) || {};
  const esProgramada = !!(event && event.headers && (event.headers['x-nf-event'] || event.headers['X-Nf-Event']));
  if (secret && !esProgramada && (q.key || '') !== secret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado. Falta ?key=' }) };
  }
  // Rango: por defecto AYER (para el cron). Manual con ?desde&hasta (dd/mm/yyyy).
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 3600 * 1000);
  const desde = q.desde || fmtFecha(ayer);
  const hasta = q.hasta || fmtFecha(ayer);

  await correr(desde, hasta);
  return { statusCode: 200, body: JSON.stringify({ ok: true, disparado: { desde, hasta }, nota: 'Corriendo en segundo plano. Verificá en /ventas-estado.' }) };
};
