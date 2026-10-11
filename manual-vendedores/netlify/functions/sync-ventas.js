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
//  EMPRESAS: el ERP tiene DOS empresas y el WebApi lista los comprobantes
//  de la empresa con la que se pidió el token. 9999 = series internas
//  9999/1000 (no fiscal); 0001 = puntos de venta fiscales (0003, 0005…), la
//  mayor parte de la venta. Se leen las dos (diagnóstico 8/10/2026).
//  Cada día procesado deja su fila en ventas_sync_log con detalle "v2 …":
//  así sync-ventas-cron sabe qué días ya están completos.
//  Env: AIKON_* (+ AIKON_EMPRESAS opcional, default "<AIKON_EMPRESA>,0001"),
//  opcional MANUAL_ANON_KEY, SYNC_SECRET.
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

const EMPRESAS = (process.env.AIKON_EMPRESAS || `${process.env.AIKON_EMPRESA || '9999'},0001`)
  .split(',').map((e) => e.trim()).filter((e, i, a) => e && a.indexOf(e) === i);

async function login(empresa) {
  const cuenta = process.env.AIKON_CUENTA;
  if (!cuenta || !empresa) throw new Error('Faltan AIKON_CUENTA / empresa.');
  const managerUrl = process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL';
  const j1 = await aikon(managerUrl, { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
  const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
  if (!urlCuenta) throw new Error('CuentaURL no devolvió URL: ' + JSON.stringify(j1).slice(0, 160));
  const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa });
  const token = j2.token && j2.token.Codigo;
  if (!token) throw new Error(`ObtenerToken (empresa ${empresa}) falló: ` + JSON.stringify(j2).slice(0, 160));
  return { urlCuenta, cuenta, token, empresa };
}
const loginTodas = () => Promise.all(EMPRESAS.map(login));

async function enTandas(items, tam, fn) {
  for (let i = 0; i < items.length; i += tam) await Promise.all(items.slice(i, i + tam).map(fn));
}

async function sincronizarDia(ctxs, fechaStr) {
  const agg = new Map();
  const aggCli = new Map();   // cliente|sku|fecha -> unidades netas (para 11T / 6 meses)
  let renglones = 0, totalUtiles = 0;
  const porEmpresa = {};
  for (const ctx of ctxs) {
  const { urlCuenta, cuenta, token } = ctx;
  const jc = await aikon(urlCuenta + '/IS3/ListarComprobantes', { cuenta, token, FechaDesde: fechaStr, FechaHasta: fechaStr }, 40000);
  // Sin lista = error del ERP (un día sin ventas devuelve lista: []). No seguir:
  // si no, se borraría el día con datos buenos.
  if (!Array.isArray(jc.lista) && !Array.isArray(jc)) throw new Error(`ListarComprobantes (empresa ${ctx.empresa}) ${fechaStr}: ` + JSON.stringify(jc).slice(0, 160));
  const comps = Array.isArray(jc.lista) ? jc.lista : jc;
  const utiles = comps.filter((c) => /^(FA|NC)/i.test(String(c.Codigo || '')) && !c.FechaAnulacion);
  porEmpresa[ctx.empresa] = utiles.length;
  totalUtiles += utiles.length;

  let fallidos = 0;
  await enTandas(utiles, 20, async (c) => {
    const j = await aikon(urlCuenta + '/IS3/ObtenerComprobante', { cuenta, token, Codigo: c.Codigo, Sucursal: c.Sucursal, Numero: c.Numero, Tipo: c.Tipo }, 15000);
    const comp = j.Comprobante || j.comprobante || {};
    const det = comp.Detalle || comp.detalle || [];
    if (!Array.isArray(det) || !det.length) { if (j._error || j._raw || j.estado === 'ERROR') fallidos++; return; }
    const fISO = netDateToISO(c.FechaEmision) || ddmmToISO(fechaStr);
    const signo = /^NC/i.test(String(c.Codigo || '')) ? -1 : 1;
    const clienteCod = String(c.ClienteCodigo == null ? '' : c.ClienteCodigo).trim();
    for (const r of det) {
      const sku = String(val(r, 'Articulo', 'ArticuloCodigo') || '').trim();
      if (!sku) continue;
      const cant = num(val(r, 'Cantidad'));
      if (clienteCod) { const ck = clienteCod + '|' + sku + '|' + fISO; aggCli.set(ck, (aggCli.get(ck) || 0) + cant * signo); }
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
  // Si se cayeron muchos ObtenerComprobante, el día quedaría incompleto: mejor fallar y reintentar.
  if (fallidos > Math.max(2, utiles.length * 0.05)) throw new Error(`${fechaStr} empresa ${ctx.empresa}: ${fallidos}/${utiles.length} comprobantes sin leer`);
  }

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

  // Ventas POR CLIENTE del día (11T / reportes / condición 6 meses). Idempotente por día.
  const delc = await sb(`ventas_cliente?fecha=eq.${fISO}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  if (!delc.ok && delc.status !== 404) throw new Error('DELETE cliente día ' + fISO + ': ' + (await delc.text()).slice(0, 120));
  const filasCli = [...aggCli.entries()].map(([k, u]) => { const p = k.split('|'); return { cliente_codigo: p[0], sku: p[1], fecha: p[2], unidades: Math.round(u * 100) / 100 }; }).filter((x) => x.unidades !== 0);
  for (let i = 0; i < filasCli.length; i += 500) {
    const ins = await sb('ventas_cliente', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(filasCli.slice(i, i + 500)) });
    if (!ins.ok) throw new Error('INSERT cliente día ' + fISO + ': ' + (await ins.text()).slice(0, 160));
  }
  // Marca el día como completo (v2 = las dos empresas) para sync-ventas-cron.
  const res = { comprobantes: totalUtiles, renglones, skus: filas.length, clientes: filasCli.length, por_empresa: porEmpresa };
  try {
    await sb('ventas_sync_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      desde: fISO, hasta: fISO, comprobantes: totalUtiles, renglones, skus: filas.length, ok: true,
      detalle: `v2 ${Object.entries(porEmpresa).map(([e, n]) => e + ':' + n).join(' ')}`,
    }) });
  } catch (e) { /* el log no frena la sync */ }
  return res;
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
  let ctxs, dias = [], comprTot = 0, renglTot = 0, skusTot = 0, ok = true, err = null;
  try {
    ctxs = await loginTodas();
    let cur = new Date(desde.getTime());
    while (cur.getTime() <= hasta.getTime()) {
      if (dias.length && Date.now() - start > BUDGET) break; // procesamos al menos 1 día
      const f = fmtFecha(cur);
      const r = await sincronizarDia(ctxs, f);
      dias.push({ fecha: f, ...r });
      comprTot += r.comprobantes; renglTot += r.renglones; skusTot += r.skus;
      cur = new Date(cur.getTime() + 24 * 3600 * 1000);
    }
    var resto = cur.getTime() <= hasta.getTime();
    var siguiente = resto ? fmtFecha(cur) : null;
  } catch (e) { ok = false; err = (e && e.message) || String(e); }

  // Log de la corrida (solo errores: cada día completo ya dejó su fila "v2").
  if (!ok) try {
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

module.exports.sincronizarDia = sincronizarDia;
module.exports.loginTodas = loginTodas;
module.exports.fmtFecha = fmtFecha;

// Estado del sistema (11/10/2026): los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('sync-ventas', module.exports.handler);
