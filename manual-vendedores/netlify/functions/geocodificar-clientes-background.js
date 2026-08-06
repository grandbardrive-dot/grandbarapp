// ============================================================
//  GrandBar Hub · Background Function · geocodificar-clientes
//  Corre hasta ~13 min por invocación geocodificando clientes_geo
//  (dirección → lat/lng) con Google Geocoding API, en tandas.
//  Background = hasta 15 min (las regulares cortan a 10s).
//  Env vars: GOOGLE_GEOCODE_KEY, HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const TANDA = 30;
const PRESUPUESTO_MS = 13 * 60 * 1000;

exports.handler = async () => {
  const gkey = process.env.GOOGLE_GEOCODE_KEY;
  const srole = process.env.HUB_SERVICE_ROLE;
  if (!gkey || !srole) { console.log('geocode: faltan env vars'); return; }

  const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });

  const t0 = Date.now();
  let ok = 0, sin = 0, vueltas = 0;
  while (Date.now() - t0 < PRESUPUESTO_MS) {
    const r = await sb('clientes_geo?select=codigo,direccion,localidad,provincia&geo_status=is.null&limit=' + TANDA);
    let rows;
    try { rows = await r.json(); } catch (e) { console.log('geocode: error leyendo', e); break; }
    if (!Array.isArray(rows) || !rows.length) break;

    await Promise.all(rows.map(async (row) => {
      const dir = [row.direccion, row.localidad, row.provincia, 'Argentina'].filter(Boolean).join(', ');
      try {
        const g = await fetch('https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(dir) + '&region=ar&key=' + gkey);
        const gj = await g.json();
        if (gj.status === 'OK' && gj.results && gj.results[0]) {
          const loc = gj.results[0].geometry.location;
          await sb('clientes_geo?codigo=eq.' + encodeURIComponent(row.codigo), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ lat: loc.lat, lng: loc.lng, geo_status: gj.results[0].geometry.location_type || 'OK' }) });
          ok++;
        } else if (gj.status === 'OVER_QUERY_LIMIT' || gj.status === 'UNKNOWN_ERROR') {
          return; // no marcar → reintenta
        } else {
          await sb('clientes_geo?codigo=eq.' + encodeURIComponent(row.codigo), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ geo_status: gj.status || 'SIN_RESULTADO' }) });
          sin++;
        }
      } catch (e) { /* red → reintenta */ }
    }));
    vueltas++;
  }
  console.log('geocode background terminó: ok=' + ok + ' sin=' + sin + ' vueltas=' + vueltas + ' ms=' + (Date.now() - t0));
};
