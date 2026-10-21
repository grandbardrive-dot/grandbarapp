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
//         Además, en cada corrida baja HOY (parcial, 14/10/2026): así el panel de
//         Dirección ve la venta del día con no más de 20 min de atraso. Hoy no
//         deja fila "v2": mañana se baja completo como "ayer".
//  Responde 202 al instante; el avance se ve en ventas_sync_log.
//  Env: AIKON_* (+ AIKON_EMPRESAS), VENTAS_DESDE, VENTAS_BG_BUDGET_MS.
// ============================================================
const { sincronizarDia, loginTodas, fmtFecha } = require('./sync-ventas');

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const DIA = 24 * 3600 * 1000;
const isoDe = (d) => d.toISOString().slice(0, 10);
const parseFecha = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : null; };

const rpc = async (fn, args) => {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(fn + ' ' + r.status);
  return r.json();
};

async function diasPendientes() {
  const desdeMin = process.env.VENTAS_DESDE || '2025-01-01';
  // Una fila por día ya bajado (ventas_sync_hechos). Antes se leía el log entero con
  // limit=3000, pero Supabase corta en 1000 filas: los días viejos parecían "no bajados"
  // y se volvían a bajar sin fin (95 días por día al 14/10/2026).
  const ultima = new Map();
  try {
    for (const l of await rpc('ventas_sync_hechos', { p_desde: desdeMin })) ultima.set(l.desde, l.ultima);
  } catch (e) {
    // Respaldo: la lectura anterior (puede quedar corta, pero la sync no se frena).
    console.error('sync-ventas-background ventas_sync_hechos:', (e && e.message) || e);
    const r = await fetch(`${SB_URL}/rest/v1/ventas_sync_log?select=desde,created_at&ok=eq.true&detalle=like.v2*&desde=gte.${desdeMin}&order=created_at.desc&limit=3000`,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    for (const l of (r.ok ? await r.json() : [])) if (!ultima.has(l.desde)) ultima.set(l.desde, l.created_at);
  }
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
    // Relleno de a poco (14/10/2026): días viejos sin venta/costo por cliente, para que el
    // panel de Dirección tenga ventas por vendedor. Hasta 10 por corrida, los más nuevos primero.
    try {
      const ya = new Set(dias.map(isoDe));
      const faltan = await rpc('ventas_dias_sin_monto', { p_desde: process.env.VENTAS_DESDE || '2025-01-01', p_lim: Number(process.env.VENTAS_RELLENO_DIAS || 10) });
      for (const f of faltan) if (!ya.has(f.fecha)) dias.push(new Date(f.fecha + 'T12:00:00Z'));
    } catch (e) {
      // El relleno es opcional y se reintenta en 20 minutos: no marca la corrida como fallida
      // (21/10/2026: ya no quedan días por rellenar y la consulta a veces tarda de más → avisos falsos).
      console.warn('sync-ventas-background relleno:', (e && e.message) || e);
    }
  }
  // Modo automático: también HOY (parcial), primero, para que Dirección vea el día en curso.
  const hoyART = new Date(Date.now() - 3 * 3600 * 1000);
  const hoy = desde ? null : new Date(Date.UTC(hoyART.getUTCFullYear(), hoyART.getUTCMonth(), hoyART.getUTCDate(), 12));
  if (!dias.length && !hoy) { console.log('sync-ventas-background: al día'); return; }

  const hechos = [];
  try {
    const ctxs = await loginTodas();
    if (hoy) {
      try {
        const res = await sincronizarDia(ctxs, fmtFecha(hoy), { parcial: true });
        hechos.push(`hoy ${isoDe(hoy)} ${JSON.stringify(res.por_empresa)}`);
      } catch (e) {
        // Si falla, la próxima corrida (20 min) lo vuelve a intentar. No se anota como día fallido.
        console.error('sync-ventas-background hoy:', (e && e.message) || e);
      }
    }
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
