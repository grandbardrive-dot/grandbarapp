// ============================================================
//  DIAGNÓSTICO TEMPORAL del Cazador de clientes. BORRAR después.
//  Devuelve JSON directo (no es background) con: si están las zonas,
//  si Google Places responde, una muestra, y si el INSERT funciona.
//  Abrir:  https://portalgrandbar.com/.netlify/functions/cazar-diag
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const TIPOS = {
  on:  ['bar', 'night_club', 'restaurant', 'hotel', 'event_venue', 'banquet_hall', 'wedding_venue'],
  off: ['liquor_store', 'convenience_store', 'grocery_store'],
};
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b, null, 2) });

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const srole0 = process.env.HUB_SERVICE_ROLE;
  const hub0 = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: srole0, Authorization: 'Bearer ' + srole0, 'Content-Type': 'application/json', ...(o.headers || {}) } });
  // ?wipe=nuevos  → borra los prospectos en estado 'nuevo' (limpia la corrida de prueba, respeta lo que el supervisor ya marcó)
  // ?wipe=todos   → borra TODOS los prospectos
  if (q.wipe) {
    const filtro = q.wipe === 'todos' ? 'id=not.is.null' : 'estado=eq.nuevo';
    const r = await hub0('prospectos?' + filtro, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return json(200, { wipe: q.wipe, status: r.status, ok: r.ok });
  }
  const out = { env: {} };
  out.env.GOOGLE = !!process.env.GOOGLE_GEOCODE_KEY;
  out.env.HUB_SERVICE_ROLE = !!process.env.HUB_SERVICE_ROLE;
  out.env.COBRANZAS = !!process.env.COBRANZAS_SERVICE_ROLE;
  out.env.ANTHROPIC = !!process.env.ANTHROPIC_API_KEY;
  const srole = process.env.HUB_SERVICE_ROLE;
  const hub = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(o.headers || {}) } });
  try {
    // 1) ¿están las zonas?
    const zr = await hub('prospectos_zonas?select=nombre,lat,lng,radio,canal,activa');
    const zonas = await zr.json().catch(() => null);
    out.zonas_status = zr.status;
    out.zonas = Array.isArray(zonas) ? zonas.length : zonas;
    out.zonas_muestra = Array.isArray(zonas) ? zonas.slice(0, 6) : null;

    // 2) ¿Google Places responde? (primera zona activa)
    const z = (Array.isArray(zonas) ? zonas : []).find(x => x.activa) || (Array.isArray(zonas) ? zonas[0] : null);
    if (z && process.env.GOOGLE_GEOCODE_KEY) {
      const canal = (z.canal || 'ambos').toLowerCase();
      const tipos = canal === 'on' ? TIPOS.on : canal === 'off' ? TIPOS.off : [...TIPOS.on, ...TIPOS.off];
      const gr = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_GEOCODE_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType' },
        body: JSON.stringify({ includedTypes: tipos, maxResultCount: 10, languageCode: 'es', locationRestriction: { circle: { center: { latitude: +z.lat, longitude: +z.lng }, radius: Math.min(Math.max(+z.radio || 3000, 300), 20000) } } }),
      });
      const gj = await gr.json().catch(() => ({}));
      out.google_status = gr.status;
      out.google_places = (gj.places || []).length;
      out.google_muestra = (gj.places || []).slice(0, 6).map(p => ((p.displayName || {}).text || '?') + ' [' + (p.primaryType || '?') + ']');
      if (!gr.ok) out.google_error = JSON.stringify(gj).slice(0, 500);
    } else { out.google = 'sin zona activa o sin GOOGLE_GEOCODE_KEY'; }

    // 3) ¿el INSERT funciona? (fila de prueba, se borra enseguida)
    const ins = await hub('prospectos?on_conflict=fuente,ref_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([{ fuente: 'diag', ref_id: 'diag-test-1', nombre: 'TEST DIAG', canal: 'on', estado: 'nuevo', score: 99 }]) });
    out.insert_status = ins.status;
    if (!ins.ok) out.insert_error = (await ins.text()).slice(0, 500);
    await hub('prospectos?fuente=eq.diag', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } catch (e) { out.error = (e && e.message) || String(e); }
  return json(200, out);
};
