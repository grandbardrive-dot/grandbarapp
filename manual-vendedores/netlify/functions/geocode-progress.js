// ============================================================
//  GrandBar Hub · Function · geocode-progress
//  Devuelve el avance de la geocodificación de clientes_geo.
//  Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async () => {
  const srole = process.env.HUB_SERVICE_ROLE;
  if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
  const sb = (path) => fetch(HUB_URL + '/rest/v1/' + path, { method: 'HEAD', headers: { apikey: srole, Authorization: 'Bearer ' + srole, Prefer: 'count=exact', Range: '0-0' } });
  const cont = async (q) => { const r = await sb(q); const cr = r.headers.get('content-range') || ''; const n = cr.split('/')[1]; return n ? parseInt(n, 10) : 0; };
  const total = await cont('clientes_geo?select=codigo');
  const geocodificados = await cont('clientes_geo?select=codigo&lat=not.is.null');
  const pendientes = await cont('clientes_geo?select=codigo&geo_status=is.null');
  const sin_resultado = await cont('clientes_geo?select=codigo&lat=is.null&geo_status=not.is.null');
  return json(200, { total, geocodificados, pendientes, sin_resultado });
};
