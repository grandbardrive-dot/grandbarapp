// ============================================================
//  GrandBar Hub · Function · nuevos-clientes
//  Busca en Google Places (New) comercios del tipo que corresponde
//  al CANAL del vendedor (ON/OFF), filtra los que YA son clientes
//  (por nombre) y devuelve los posibles nuevos clientes.
//
//  Env: GOOGLE_GEOCODE_KEY (con Places API New habilitada),
//       COBRANZAS_SERVICE_ROLE (para leer los nombres de clientes)
//  Body (POST): { lat, lng, radius }  ubicación/zona a analizar.
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';

const TIPOS = {
  on:  ['restaurant', 'cafe', 'bar', 'night_club', 'lodging'],
  off: ['liquor_store', 'supermarket', 'convenience_store', 'grocery_store'],
};

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

exports.handler = async (event) => {
  try {
    const gkey = process.env.GOOGLE_GEOCODE_KEY;
    const cobService = process.env.COBRANZAS_SERVICE_ROLE;
    if (!gkey) return json(500, { error: 'Falta GOOGLE_GEOCODE_KEY' });
    if (!cobService) return json(500, { error: 'Falta COBRANZAS_SERVICE_ROLE' });

    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=codigo_vendedor,canal', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = (await pRes.json())[0] || {};
    const canal = String(perfil.canal || '').toLowerCase();
    if (!perfil.codigo_vendedor) return json(200, { error: 'sin_codigo', sugerencias: [] });
    if (!canal) return json(200, { error: 'sin_canal', sugerencias: [] });

    const tipos = canal === 'on' ? TIPOS.on : canal === 'off' ? TIPOS.off : [...TIPOS.on, ...TIPOS.off];

    // Nombres de clientes del vendedor (para descartar los que ya lo son)
    const cRes = await fetch(COB_URL + '/rest/v1/cuentas_cubo?vendedor=eq.' + encodeURIComponent(perfil.codigo_vendedor) + '&select=nombre', { headers: { apikey: cobService, Authorization: 'Bearer ' + cobService } });
    const clientes = await cRes.json().catch(() => []);
    const setClientes = new Set((Array.isArray(clientes) ? clientes : []).map(c => norm(c.nombre)).filter(Boolean));

    let lat, lng, radius;
    try { const b = JSON.parse(event.body || '{}'); lat = +b.lat; lng = +b.lng; radius = +b.radius; } catch (e) {}
    if (!lat || !lng) return json(400, { error: 'falta_ubicacion' });
    radius = Math.min(Math.max(radius || 3000, 300), 20000);

    const pr = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': gkey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating',
      },
      body: JSON.stringify({ includedTypes: tipos, maxResultCount: 20, locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } } }),
    });
    const pj = await pr.json();
    if (!pr.ok) return json(502, { error: 'Places: ' + JSON.stringify(pj).slice(0, 300) });

    const lugares = pj.places || [];
    const sugerencias = [];
    for (const p of lugares) {
      const nombre = (p.displayName && p.displayName.text) || '';
      const nn = norm(nombre);
      if (!nn) continue;
      let esCliente = setClientes.has(nn);
      if (!esCliente) { for (const cn of setClientes) { if (cn.length > 4 && (cn.includes(nn) || nn.includes(cn))) { esCliente = true; break; } } }
      if (esCliente) continue;
      sugerencias.push({ nombre, direccion: p.formattedAddress || '', tipo: p.primaryType || '', rating: p.rating || null, lat: p.location && p.location.latitude, lng: p.location && p.location.longitude });
    }
    return json(200, { canal, total_encontrados: lugares.length, ya_clientes: lugares.length - sugerencias.length, sugerencias });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
