// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sync-ventas-cron
//  Mantiene las VENTAS del ERP al día sin que nadie apriete nada.
//  Corre cada 15 min (ver netlify.toml) y en cada corrida sincroniza los
//  días que falten (las DOS empresas del ERP, ver sync-ventas.js), con un
//  presupuesto de ~20 s:
//    1) primero AYER (lo más útil),
//    2) después rellena hacia atrás hasta VENTAS_DESDE (default 2026-04-01,
//       6 meses: lo que pide el 11T para "no compró en 6 meses").
//  Un día está "hecho" si tiene fila en ventas_sync_log con detalle "v2 …".
//  Los últimos 3 días se vuelven a bajar una vez pasadas 48 h, por las NC
//  y facturas que se aprueban tarde.
//  Env: AIKON_* (+ AIKON_EMPRESAS), VENTAS_DESDE, VENTAS_BUDGET_MS.
// ============================================================
const { sincronizarDia, loginTodas, fmtFecha } = require('./sync-ventas');

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const DIA = 24 * 3600 * 1000;
const isoDe = (d) => d.toISOString().slice(0, 10);
const deISO = (s) => new Date(s + 'T12:00:00Z');

exports.handler = async () => {
  const start = Date.now();
  const BUDGET = Number(process.env.VENTAS_BUDGET_MS || 20000);
  const desdeMin = process.env.VENTAS_DESDE || '2026-04-01';

  // Días ya completos (v2) y cuándo se bajaron.
  const r = await fetch(`${SB_URL}/rest/v1/ventas_sync_log?select=desde,created_at&ok=eq.true&detalle=like.v2*&desde=gte.${desdeMin}&order=created_at.desc&limit=2000`,
    { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
  const logs = r.ok ? await r.json() : [];
  const ultimaBajada = new Map();
  for (const l of logs) if (!ultimaBajada.has(l.desde)) ultimaBajada.set(l.desde, l.created_at);

  // Pendientes: de ayer hacia atrás. Reciente (<3 días) = pendiente hasta tener una bajada 48 h posterior.
  const hoy = new Date(Date.now() - 3 * 3600 * 1000); // fecha ART
  const ayer = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 12) - DIA);
  const pendientes = [];
  for (let d = ayer; isoDe(d) >= desdeMin; d = new Date(d.getTime() - DIA)) {
    const iso = isoDe(d), hecho = ultimaBajada.get(iso);
    const reciente = ayer.getTime() - d.getTime() < 3 * DIA;
    if (!hecho || (reciente && new Date(hecho).getTime() < d.getTime() + 2 * DIA)) pendientes.push(d);
  }
  if (!pendientes.length) return { statusCode: 200, body: JSON.stringify({ ok: true, nota: 'al día' }) };

  const hechos = [];
  try {
    const ctxs = await loginTodas();
    for (const d of pendientes) {
      if (hechos.length && Date.now() - start > BUDGET) break;
      const res = await sincronizarDia(ctxs, fmtFecha(d));
      hechos.push({ fecha: isoDe(d), ...res });
    }
  } catch (e) {
    console.log('sync-ventas-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e), hechos }) };
  }
  console.log('sync-ventas-cron:', hechos.map((h) => `${h.fecha} ${JSON.stringify(h.por_empresa)}`).join(' | '), `· faltan ${pendientes.length - hechos.length}`);
  return { statusCode: 200, body: JSON.stringify({ ok: true, hechos, faltan: pendientes.length - hechos.length }) };
};
