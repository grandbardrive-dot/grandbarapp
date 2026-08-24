// ============================================================
//  GrandBar · Netlify Function · sync-ventas  (normal, con time-box)
//  Baja las VENTAS por artículo desde Córdoba Software (Aikon/Sinergis
//  IS3) y las agrega por SKU + día en Supabase (ventas_articulos).
//
//  Como no hay funciones background en este plan, procesa DÍA POR DÍA
//  con un presupuesto de ~20s por invocación y devuelve un cursor
//  (siguiente_desde) para continuar. Cada día es idempotente.
//
//  Flujo por día:
//    1) ListarComprobantes(FechaDesde=FechaHasta=día) → cabeceras
//    2) ObtenerComprobante(...) por comprobante → renglones (SKU, cant, importe)
//    3) neto (facturas +, NC −) por (sku, día) → reemplaza el día
//
//  Uso:
//    /sync-ventas                                  → AYER
//    /sync-ventas?desde=01/08/2026&hasta=07/08/2026 → procesa lo que entre en ~20s
//    (repetí con ?desde=<siguiente_desde>&hasta=... para continuar)
//  Env: AIKON_* + opcional MANUAL_ANON_KEY, SYNC_SECRET.
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const sb = (path, opts = {}) => fetch(SB_URL + '/rest/v1/' + path, {
  ...opts,
  headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

async function aikon(url, body, ms = 40000) {
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
const fmtFecha = (d) => dd(d.getUTCDate()) + '/' + dd(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
const parseFecha = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : null; };
const ddmmToISO = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
function netDateToISO(s) { const m = String(s || '').match(/\/Date\((\d+)/); if (!m) return null; return new Date(Number(m[1]) - 3 * 3600 * 1000).toISOString().slice(0, 10); }
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

async function enTandas(items, tam, fn) {
  for (let i = 0; i < items.length; i += tam) await Promise.all(items.slice(i, i + tam).map(fn));
}

async function sincronizarDia(ctx, fechaStr) {
  const { urlCuenta, cuenta, token } = ctx;
  const jc = await aikon(urlCuenta + '/IS3/ListarComprobantes', { cuenta, token, FechaDesde: fechaStr, FechaHasta: fechaStr }, 40000);
  const comps = Array.isArray(jc.lista) ? jc.lista : (Array.isArray(jc) ? jc : []);
  const utiles = comps.filter((c) => /^(FA|NC)/i.test(String(c.Codigo || '')) && !c.FechaAnulacion);

  const agg = new Map();
  let renglones = 0;
  await enTandas(utiles, 10, async (c) => {
    const j = await aikon(urlCuenta + '/IS3/ObtenerComprobante', { cuenta, token, Codigo: c.Codigo, Sucursal: c.Sucursal, Numero: c.Numero, Tipo: c.Tipo }, 15000);
    const comp = j.Comprobante || j.comprobante || {};
    const det = comp.Detalle || comp.detalle || [];
    if (!Array.isArray(det) || !det.length) return;
    const fISO = netDateToISO(c.FechaEmision) || ddmmToISO(fechaStr);
    const signo = /^NC/i.test(String(c.Codigo || '')) ? -1 : 1;
    for (const r of det) {
      const sku = String(val(r, 'Articulo', 'ArticuloCodigo') || '').trim();
      if (!sku) continue;
      const cant = num(val(r, 'Cantidad'));
      // Venta neta (sin IVA) del renglón.
      const netoLinea = Math.abs(num(val(r, 'TotalNeto', 'ImporteUni', 'Total')));
      // Impuesto interno del renglón (0 en vinos/champagne). Destilados y cervezas lo traen.
      let impInt = Math.abs(num(val(r, 'TotalImpInt')));
      if (!impInt) impInt = Math.abs(num(val(r, 'ImporteImpIntUnitario')) * cant);
      if (!impInt) impInt = Math.abs(num(val(r, 'ImporteImpuestoInterno')));
      // Alícuota de IVA del artículo (fallback: derivar de TotalIva/neto; sino 21%).
      let iva = num(val(r, 'AlicuotaIvaPorcentaje'));
      if (!iva) { const ti = Math.abs(num(val(r, 'TotalIva'))); iva = netoLinea > 0 ? Math.round((ti / netoLinea) * 100) : 21; }
      const factor = 1 + (iva || 21) / 100;
      const costoNetoLinea = Math.abs(num(val(r, 'ArticuloCostoNeto')) * cant);
      // Costo PLENO = (costo neto + impuesto interno) con IVA. Venta comparada = neto con IVA.
      const costoPlenoLinea = (costoNetoLinea + impInt) * factor;

      const key = sku + '|' + fISO;
      const row = agg.get(key) || {
        sku, fecha: fISO, descripcion: val(r, 'Descripcion'), marca: val(r, 'ArticuloMarca'),
        familia: val(r, 'Familia'), familia_nombre: val(r, 'ArticuloFamiliaNombre'), codigo_barras: val(r, 'ArticuloCodigoBarras'),
        unidades: 0, importe: 0, importe_iva: 0, imp_interno: 0, costo: 0, costo_pleno: 0, comprobantes: 0,
      };
      row.unidades += cant * signo;
      row.importe += netoLinea * signo;                 // facturado neto (referencia)
      row.importe_iva += netoLinea * factor * signo;    // facturado con IVA
      row.imp_interno += impInt * signo;                // impuesto interno
      row.costo += costoNetoLinea * signo;              // costo neto (referencia)
      row.costo_pleno += costoPlenoLinea * signo;       // costo neto + IVA + imp. interno
      row.comprobantes += 1;
      if (!row.descripcion) row.descripcion = val(r, 'Descripcion');
      agg.set(key, row);
      renglones++;
    }
  });

  const fISO = ddmmToISO(fechaStr);
  const del = await sb(`ventas_articulos?fecha=eq.${fISO}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  if (!del.ok && del.status !== 404) throw new Error('DELETE día ' + fISO + ': ' + (await del.text()).slice(0, 140));
  const filas = [...agg.values()].map((r) => ({
    ...r,
    unidades: Math.round(r.unidades * 100) / 100,
    importe: Math.round(r.importe), importe_iva: Math.round(r.importe_iva),
    imp_interno: Math.round(r.imp_interno), costo: Math.round(r.costo), costo_pleno: Math.round(r.costo_pleno),
    actualizado: new Date().toISOString(),
  }));
  for (let i = 0; i < filas.length; i += 500) {
    const ins = await sb('ventas_articulos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(filas.slice(i, i + 500)) });
    if (!ins.ok) throw new Error('INSERT día ' + fISO + ': ' + (await ins.text()).slice(0, 160));
  }
  return { comprobantes: utiles.length, renglones, skus: filas.length };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const secret = process.env.SYNC_SECRET;
  const q = (event && event.queryStringParameters) || {};
  if (secret && (q.key || '') !== secret) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autorizado. Falta ?key=' }) };

  const ayer = new Date(Date.now() - 24 * 3600 * 1000);
  const desde = parseFecha(q.desde) || new Date(Date.UTC(ayer.getUTCFullYear(), ayer.getUTCMonth(), ayer.getUTCDate(), 12));
  const hasta = parseFecha(q.hasta) || desde;

  const start = Date.now();
  const BUDGET = Number(process.env.VENTAS_BUDGET_MS || 20000);
  let ctx, dias = [], comprTot = 0, renglTot = 0, skusTot = 0, ok = true, err = null;
  try {
    ctx = await login();
    let cur = new Date(desde.getTime());
    while (cur.getTime() <= hasta.getTime()) {
      if (dias.length && Date.now() - start > BUDGET) break; // procesamos al menos 1 día
      const f = fmtFecha(cur);
      const r = await sincronizarDia(ctx, f);
      dias.push({ fecha: f, ...r });
      comprTot += r.comprobantes; renglTot += r.renglones; skusTot += r.skus;
      cur = new Date(cur.getTime() + 24 * 3600 * 1000);
    }
    var resto = cur.getTime() <= hasta.getTime();
    var siguiente = resto ? fmtFecha(cur) : null;
  } catch (e) { ok = false; err = (e && e.message) || String(e); }

  // Log de la corrida.
  try {
    await sb('ventas_sync_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      desde: ddmmToISO(fmtFecha(desde)), hasta: ddmmToISO(fmtFecha(hasta)),
      comprobantes: comprTot, renglones: renglTot, skus: skusTot, ok,
      detalle: (err ? 'ERROR: ' + err : `días ${dias.length}` + (resto ? `, sigue en ${siguiente}` : ', completo')).slice(0, 900),
    }) });
  } catch (e) { /* ignore */ }

  return { statusCode: ok ? 200 : 500, headers, body: JSON.stringify({
    ok, error: err,
    procesadas: dias.length, comprobantes: comprTot, renglones: renglTot, skus: skusTot,
    resto: !!resto, siguiente_desde: siguiente || null,
    nota: resto ? `Faltan días. Volvé a abrir con ?desde=${siguiente}&hasta=${q.hasta || fmtFecha(hasta)}` : 'Rango completo.',
    dias,
  }, null, 2) };
};
