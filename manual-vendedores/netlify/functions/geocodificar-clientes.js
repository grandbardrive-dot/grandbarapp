// ============================================================
//  GrandBar Hub · Function · geocodificar-clientes
//  Geocodifica (dirección → lat/lng) los clientes de la tabla
//  `clientes_geo` (Supabase del Hub) usando Google Geocoding API.
//  Procesa una TANDA por invocación (para no timeoutear) y devuelve
//  cuántos quedan. Se llama repetidamente hasta restantes = 0.
//
//  Env vars (Netlify del Hub, secretas):
//    GOOGLE_GEOCODE_KEY  = clave de Google (Geocoding API habilitada)
//    HUB_SERVICE_ROLE    = service_role del Supabase del Hub
//
//  Requiere la tabla clientes_geo con columnas:
//    codigo, direccion, localidad, provincia, estado, lat, lng, geo_status
//  (pendiente = geo_status IS NULL; al procesar se setea geo_status)
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const TANDA = 25; // clientes por invocación

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async () => {
  const gkey = process.env.GOOGLE_GEOCODE_KEY;
  const srole = process.env.HUB_SERVICE_ROLE;
  if (!gkey) return json(500, { error: 'Falta GOOGLE_GEOCODE_KEY en Netlify.' });
  if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE en Netlify.' });

  const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });

  // Restantes (pendientes = geo_status null)
  async function contarRestantes() {
    const r = await sb('clientes_geo?select=codigo&geo_status=is.null', { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range') || '';
    const total = cr.split('/')[1];
    return total ? parseInt(total, 10) : 0;
  }

  // Traer una tanda de pendientes
  const r = await sb('clientes_geo?select=codigo,direccion,localidad,provincia&geo_status=is.null&limit=' + TANDA);
  const rows = await r.json();
  if (!Array.isArray(rows)) return json(500, { error: 'No pude leer clientes_geo (¿existe la tabla?): ' + JSON.stringify(rows).slice(0, 200) });
  if (!rows.length) return json(200, { procesados: 0, ok: 0, sin_resultado: 0, restantes: 0, done: true });

  let ok = 0, sin = 0, reintentar = 0;
  await Promise.all(rows.map(async (row) => {
    const dir = [row.direccion, row.localidad, row.provincia, 'Argentina'].filter(Boolean).join(', ');
    let patch;
    try {
      const g = await fetch('https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(dir) + '&region=ar&key=' + gkey);
      const gj = await g.json();
      if (gj.status === 'OK' && gj.results && gj.results[0]) {
        const loc = gj.results[0].geometry.location;
        patch = { lat: loc.lat, lng: loc.lng, geo_status: gj.results[0].geometry.location_type || 'OK' };
        ok++;
      } else if (gj.status === 'OVER_QUERY_LIMIT' || gj.status === 'UNKNOWN_ERROR') {
        return; // no marcar → se reintenta en la próxima tanda
      } else {
        patch = { lat: null, lng: null, geo_status: gj.status || 'SIN_RESULTADO' }; // ZERO_RESULTS, etc.
        sin++;
      }
      await sb('clientes_geo?codigo=eq.' + encodeURIComponent(row.codigo), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    } catch (e) {
      reintentar++; // error de red → se reintenta
    }
  }));

  const restantes = await contarRestantes();
  return json(200, { procesados: rows.length, ok, sin_resultado: sin, reintentar, restantes, done: restantes === 0 });
};
