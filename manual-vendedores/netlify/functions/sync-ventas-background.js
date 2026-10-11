// ============================================================
//  GrandBar Hub · BACKGROUND Function · sync-ventas-background
//  El trabajo pesado de las VENTAS del ERP (hasta 15 min por corrida).
//  Un día con las dos empresas (9999 + 0001, ver sync-ventas.js) tarda
//  ~30 s: no entra en una función normal ni en una programada.
//
//  Dos modos:
//    POST ?desde=dd/mm/aaaa&hasta=dd/mm/aaaa → baja ese rango (botón
//         "Actualizar ventas" del panel de Luciana).
//    POST sin parámetros → baja lo que FALTE (lo dispara sync-ventas-cron):
//         primero AYER, después rellena hacia atrás hasta VENTAS_DESDE
//         (default 2025-01-01: el año anterior completo, para comparar contra
//         2025 en la Reunión por marca). Un día está
//         hecho si tiene fila "v2 …" en ventas_sync_log; los últimos 3 días
//         se vuelven a bajar a las 48 h (NC y facturas aprobadas tarde).
//  Responde 202 al instante; el avance se ve en ventas_sync_log.
//  Env: AIKON_* (+ AIKON_EMPRESAS), VENTAS_DESDE, VENTAS_BG_BUDGET_MS.
// ============================================================
const { sincronizarDia, loginTodas, fmtFecha } = require('./sync-ventas');

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const DIA = 24 * 3600 * 1000;
const isoDe = (d) => d.toISOString().slice(0, 10);
const parseFecha = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : null; };

async function diasPendientes() {
  const desdeMin = process.env.VENTAS_DESDE || '2025-01-01';
  const r = await fetch(`${SB_URL}/rest/v1/ventas_sync_log?select=desde,created_at&ok=eq.true&detalle=like.v2*&desde=gte.${desdeMin}&order=created_at.desc&limit=3000`,
    { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
  const logs = r.ok ? await r.json() : [];
  const ultima = new Map();
  for (const l of logs) if (!ultima.has(l.desde)) ultima.set(l.desde, l.created_at);
  const hoyART = new Date(Date.now() - 3 * 3600 * 1000);
  const ayer = new Date(Date.UTC(hoyART.getUTCFullYear(), hoyART.getUTCMonth(), hoyART.getUTCDate(), 12) - DIA);
  const out = [];
  for (let d = ayer; isoDe(d) >= desdeMin; d = new Date(d.getTime() - DIA)) {
    const hecho = ultima.get(isoDe(d));
    const reciente = ayer.getTime() - d.getTime() < 3 * DIA;
    if (!hecho || (reciente && new Date(hecho).getTime() < d.getTime() + 2 * DIA)) out.push(d);
  }
  return out;
}

exports.handler = async (event) => {
  const start = Date.now();
  const BUDGET = Number(process.env.VENTAS_BG_BUDGET_MS || 13 * 60 * 1000);
  const q = (event && event.queryStringParameters) || {};

  let dias;
  const desde = parseFecha(q.desde), hasta = parseFecha(q.hasta) || desde;
  if (desde) {
    dias = [];
    for (let d = desde; d.getTime() <= hasta.getTime() && dias.length < 62; d = new Date(d.getTime() + DIA)) dias.push(d);
  } else {
    dias = await diasPendientes();
  }
  if (!dias.length) { console.log('sync-ventas-background: al día'); return; }

  const hechos = [];
  try {
    const ctxs = await loginTodas();
    for (const [i, d] of dias.entries()) {
      if (i > 0 && Date.now() - start > BUDGET) break; // al menos 1 día por corrida
      try {
        const res = await sincronizarDia(ctxs, fmtFecha(d));
        hechos.push(`${isoDe(d)} ${JSON.stringify(res.por_empresa)}`);
      } catch (e) {
        // Un día que falla no frena el resto; queda pendiente para la próxima corrida.
        console.error('sync-ventas-background:', isoDe(d), (e && e.message) || e);
        await fetch(`${SB_URL}/rest/v1/ventas_sync_log`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ desde: isoDe(d), hasta: isoDe(d), comprobantes: 0, renglones: 0, skus: 0, ok: false, detalle: ('ERROR bg: ' + ((e && e.message) || e)).slice(0, 900) }) }).catch(() => {});
      }
    }
  } catch (e) {
    console.error('sync-ventas-background login:', (e && e.message) || e);
  }
  console.log(`sync-ventas-background: ${hechos.length}/${dias.length} días ·`, hechos.join(' | '));
};

// Estado del sistema (10/10/2026): cada corrida queda en sistema_corridas (ver _corrida.js).
exports.handler = require('./_corrida').conRegistro('sync-ventas', exports.handler);
