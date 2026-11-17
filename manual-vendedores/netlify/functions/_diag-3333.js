// ============================================================
//  DIAGNÓSTICO TEMPORAL (17/11/2026) · ¿la empresa 3333 "CUBOS" trae todas las ventas?
//  El usuario pidió "tomar todas las ventas de 3333". Hoy las ventas se bajan de 9999 + 0001
//  (sync-ventas). Antes de cambiar, se compara qué devuelve ListarComprobantes con el token
//  de 3333 contra 9999 y 0001 para dos días. Solo guarda CANTIDADES (por tipo, sucursal y
//  empresa) en sistema_corridas, tarea 'diag-3333': ningún dato de clientes ni montos.
//  Corre una vez cada 6 horas desde sync-ventas-background. BORRAR cuando se decida.
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

async function diag3333({ login, aikon }) {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) return;
  const hub = (p, o) => fetch(HUB_URL + '/rest/v1/' + p, { ...(o || {}), headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', ...((o && o.headers) || {}) } });
  // Una vez cada 6 horas.
  try {
    const r = await hub('sistema_corridas?tarea=eq.diag-3333&inicio=gte.' + encodeURIComponent(new Date(Date.now() - 6 * 3600 * 1000).toISOString()) + '&select=id&limit=1');
    if (r.ok && (await r.json()).length) return;
  } catch (e) { return; }

  const t0 = new Date().toISOString();
  const out = { dias: {} };
  const ctx = {};
  for (const e of ['3333', '9999', '0001']) {
    try { ctx[e] = await login(e); out['login_' + e] = 'ok'; } catch (err) { out['login_' + e] = 'falló: ' + String((err && err.message) || err).slice(0, 140); }
  }
  const cuenta = (arr, f) => arr.reduce((m, c) => { const v = String(f(c)); m[v] = (m[v] || 0) + 1; return m; }, {});
  const k4 = (c) => [c.Codigo, c.Sucursal, c.Numero, c.Tipo].join('|');
  for (const dia of ['16/11/2026', '13/11/2026']) {
    const res = {};
    const listas = {};
    for (const e of Object.keys(ctx)) {
      const c = ctx[e];
      const j = await aikon(c.urlCuenta + '/IS3/ListarComprobantes', { cuenta: c.cuenta, token: c.token, FechaDesde: dia, FechaHasta: dia }, 40000);
      listas[e] = Array.isArray(j.lista) ? j.lista : (Array.isArray(j) ? j : null);
      // Sin el texto crudo de la respuesta: los errores del ERP pueden traer el token de la sesión.
      if (!listas[e]) res['error_' + e] = String((j && ((j.resultado && j.resultado.estado) || j.estado || j._error)) || 'sin lista').slice(0, 80);
    }
    for (const e of Object.keys(listas)) {
      const l = listas[e]; if (!l) continue;
      res[e] = { n: l.length, por_codigo: cuenta(l, (c) => c.Codigo), por_sucursal: cuenta(l, (c) => c.Sucursal) };
      if (l[0] && 'Empresa' in l[0]) res[e].por_empresa = cuenta(l, (c) => c.Empresa);
      if (e === '3333') res.campos_3333 = Object.keys(l[0] || {});
    }
    if (listas['3333']) {
      const s3 = new Set(listas['3333'].map(k4));
      const otras = new Set([].concat(listas['9999'] || [], listas['0001'] || []).map(k4));
      res.de_3333_que_estan_en_9999_o_0001 = [...s3].filter((x) => otras.has(x)).length;
      res.de_9999_y_0001_que_estan_en_3333 = [...otras].filter((x) => s3.has(x)).length;
      res.solo_en_3333_por_sucursal = cuenta(listas['3333'].filter((c) => !otras.has(k4(c))), (c) => c.Sucursal + ' ' + c.Codigo);
    }
    out.dias[dia] = res;
  }
  await hub('sistema_corridas', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ tarea: 'diag-3333', inicio: t0, fin: new Date().toISOString(), ok: true, ms: 0, detalle: JSON.stringify(out).slice(0, 60000) }) });
}

module.exports = { diag3333 };
