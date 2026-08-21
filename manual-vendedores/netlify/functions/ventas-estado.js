// ============================================================
//  GrandBar · Netlify Function · ventas-estado
//  Devuelve un resumen del estado de la sincronización de ventas:
//  últimas corridas (ventas_sync_log), rango de fechas cubierto y
//  totales en ventas_articulos. Para verificar el sync-ventas.
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const sb = (path) => fetch(SB_URL + '/rest/v1/' + path, {
  headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
});

exports.handler = async () => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    // Últimas 8 corridas.
    const logR = await sb('ventas_sync_log?select=*&order=created_at.desc&limit=8');
    const log = await logR.json().catch(() => []);

    // Totales y rango cubierto (con head + Content-Range).
    const cntR = await fetch(SB_URL + '/rest/v1/ventas_articulos?select=sku', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'count=exact', Range: '0-0' },
    });
    const total = (cntR.headers.get('content-range') || '').split('/')[1] || '0';

    const minR = await sb('ventas_articulos?select=fecha&order=fecha.asc&limit=1');
    const maxR = await sb('ventas_articulos?select=fecha&order=fecha.desc&limit=1');
    const min = (await minR.json().catch(() => []))[0];
    const max = (await maxR.json().catch(() => []))[0];

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      filas_ventas: Number(total),
      rango_cubierto: { desde: min && min.fecha, hasta: max && max.fecha },
      ultimas_corridas: log,
    }, null, 2) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
