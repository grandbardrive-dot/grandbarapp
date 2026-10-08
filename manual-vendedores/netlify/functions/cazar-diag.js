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
  // ?ia=1 → reproduce EXACTO la puntuación de la IA sobre 15 bares reales y
  // muestra la respuesta cruda + por qué no se lee. (test decisivo)
  if (q.ia) {
    const out = {};
    try {
      const gkey = process.env.GOOGLE_GEOCODE_KEY, akey = process.env.ANTHROPIC_API_KEY;
      const gr = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gkey, 'X-Goog-FieldMask': 'places.displayName,places.primaryType,places.rating,places.userRatingCount,places.formattedAddress' },
        body: JSON.stringify({ includedTypes: ['bar'], maxResultCount: 4, languageCode: 'es', locationRestriction: { circle: { center: { latitude: -32.8895, longitude: -68.8458 }, radius: 4000 } } }),
      });
      const gj = await gr.json();
      const cands = (gj.places || []).map((p, i) => ({ i, fuente: 'google', nombre: (p.displayName || {}).text, tipo: p.primaryType, canal: 'on', zona: 'Mendoza', direccion: p.formattedAddress || null, rating: p.rating || null, reviews: p.userRatingCount || null, caption: null }));
      out.n_cands = cands.length;
      const PROMPT = `Sos el analista comercial de GrandBar Distribuciones (distribuidora de bebidas, Mendoza y San Luis). Para cada negocio de la lista devolvé un objeto con: "i" (el índice), "descartar" (true si no es prospecto de bebidas), "categoria", "score" (0-100), "motivo" (frase corta).
Devolvé ÚNICAMENTE un array JSON, sin texto antes ni después, sin markdown.

Lista:
${JSON.stringify(cands)}`;
      const cr = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': akey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.IA_MODEL_PROSPECTOS || 'claude-sonnet-5', max_tokens: 2000, messages: [{ role: 'user', content: PROMPT }] }),
      });
      const cj = await cr.json();
      out.claude_status = cr.status;
      out.stop_reason = cj.stop_reason;
      out.usage = cj.usage;
      if (!cr.ok) { out.claude_err = JSON.stringify(cj).slice(0, 500); return json(200, out); }
      const txt = (cj.content && cj.content[0] && cj.content[0].text) || '';
      out.raw_head = txt.slice(0, 180);
      out.raw_tail = txt.slice(-180);
      const a = txt.indexOf('['); const z = txt.lastIndexOf(']');
      try { const arr = JSON.parse(txt.slice(a, z + 1)); out.parsed_len = arr.length; out.parsed = arr.slice(0, 4).map(o => ({ i: o.i, score: o.score, descartar: o.descartar, nombre: o.nombre })); }
      catch (e) { out.parse_err = e.message; }
    } catch (e) { out.error = e.message; }
    return json(200, out);
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

    // 1.5) ¿cuántos prospectos hay guardados AHORA? (lo que dejó el agente)
    const cr = await hub('prospectos?select=id', { headers: { Prefer: 'count=exact', Range: '0-0' } });
    out.prospectos_guardados = cr.headers.get('content-range');

    // 2) Discovery REAL POR TIPO (primera zona activa): status + cantidad por
    // cada tipo, y cuántos sobreviven al filtro de tipos basura + cadenas.
    const gkey = process.env.GOOGLE_GEOCODE_KEY;
    const z = (Array.isArray(zonas) ? zonas : []).find(x => x.activa) || (Array.isArray(zonas) ? zonas[0] : null);
    if (z && gkey) {
      const TIPO_BLOCK = new Set(['winery', 'stadium', 'performing_arts_theater', 'movie_theater', 'amusement_park', 'amusement_center', 'museum', 'tourist_attraction', 'shopping_mall', 'department_store', 'supermarket', 'hypermarket', 'convention_center', 'park', 'gym', 'church', 'cultural_center']);
      const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const CAD = ['carrefour', 'walmart', 'jumbo', 'vea', 'disco', 'changomas', 'chango mas', 'coto', 'la anonima', 'atomo', 'makro', 'maxiconsumo', 'toledo', 'hipermercado', 'supermercado'];
      const esCad = nn => CAD.some(c => nn.includes(c));
      const canal = (z.canal || 'ambos').toLowerCase();
      const tipos = canal === 'on' ? TIPOS.on : canal === 'off' ? TIPOS.off : [...TIPOS.on, ...TIPOS.off];
      out.google_zona = z.nombre;
      out.google_por_tipo = {};
      const surv = [];
      for (const tipo of tipos) {
        const gr = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gkey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType' },
          body: JSON.stringify({ includedTypes: [tipo], maxResultCount: 20, languageCode: 'es', locationRestriction: { circle: { center: { latitude: +z.lat, longitude: +z.lng }, radius: Math.min(Math.max(+z.radio || 3000, 300), 20000) } } }),
        });
        const gj = await gr.json().catch(() => ({}));
        const places = gj.places || [];
        out.google_por_tipo[tipo] = { status: gr.status, places: places.length, error: gr.ok ? undefined : JSON.stringify(gj).slice(0, 150) };
        for (const p of places) { const nn = norm((p.displayName || {}).text || ''); if (TIPO_BLOCK.has(p.primaryType) || esCad(nn)) continue; surv.push(((p.displayName || {}).text || '?') + ' [' + (p.primaryType || '?') + ']'); }
      }
      const uniq = [...new Set(surv)];
      out.sobreviven_total = uniq.length;
      out.sobreviven_muestra = uniq.slice(0, 15);
    } else { out.google = 'sin zona activa o sin GOOGLE_GEOCODE_KEY'; }

    // 3) ¿el INSERT funciona? (fila de prueba, se borra enseguida)
    const ins = await hub('prospectos?on_conflict=fuente,ref_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify([{ fuente: 'diag', ref_id: 'diag-test-1', nombre: 'TEST DIAG', canal: 'on', estado: 'nuevo', score: 99 }]) });
    out.insert_status = ins.status;
    if (!ins.ok) out.insert_error = (await ins.text()).slice(0, 500);
    await hub('prospectos?fuente=eq.diag', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

    // 4) ¿Claude responde? (la prueba decisiva — por qué los scores quedan en 50)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const modelo = process.env.IA_MODEL_PROSPECTOS || 'claude-sonnet-5';
        out.claude_modelo = modelo;
        const c2 = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: modelo, max_tokens: 100, messages: [{ role: 'user', content: 'Respondé SOLO con este JSON: [{"i":0,"ok":true}]' }] }),
        });
        const cj = await c2.json().catch(() => ({}));
        out.claude_status = c2.status;
        out.claude = c2.ok ? ((cj.content && cj.content[0] && cj.content[0].text) || '(sin texto)').slice(0, 150) : JSON.stringify(cj).slice(0, 400);
      } catch (e) { out.claude_error = (e && e.message) || String(e); }
    }

    // 5) últimos prospectos guardados (para ver sus scores reales)
    const lr = await hub('prospectos?select=nombre,tipo,canal,score,estado&order=created_at.desc&limit=8');
    out.ultimos = await lr.json().catch(() => null);
  } catch (e) { out.error = (e && e.message) || String(e); }
  return json(200, out);
};
