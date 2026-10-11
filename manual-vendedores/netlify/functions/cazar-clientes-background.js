// ============================================================
//  GrandBar Hub · BACKGROUND Function · cazar-clientes-background
//  El "Cazador de clientes": corre cada mañana (lo dispara
//  cazar-clientes-cron) y, SOLO, hace todo el trabajo que hoy
//  hacen los supervisores a mano:
//
//    1. BUSCA negocios nuevos en Google Places (zonas de
//       `prospectos_zonas`) y en Instagram por hashtags
//       (`prospectos_hashtags`, si hay token de IG).
//    2. FILTRA los que YA son clientes cruzando contra TODA la
//       base: Aikon (tabla CLIENTES) + cuentas_cubo + los
//       prospectos ya guardados. (El bug viejo comparaba solo
//       contra los clientes de UN vendedor y se colaban clientes
//       de otros, ej. "La Cañada". Acá se cruza contra todos.)
//    3. PUNTÚA con Claude (0..100 + motivo) y descarta cadenas /
//       no-gastronómicos que se hayan colado.
//    4. REDACTA el mensaje de contacto (WhatsApp + Instagram).
//    5. GUARDA los nuevos en `prospectos` → panel de supervisores.
//
//  El sufijo "-background" = hasta 15 min, sin el límite de 10s.
//  Protegida por ?key=<SYNC_SECRET>.
//
//  Env:
//    SYNC_SECRET            protección del disparo
//    GOOGLE_GEOCODE_KEY     Places API (New) habilitada
//    ANTHROPIC_API_KEY      Claude (puntaje + mensajes)
//    HUB_SERVICE_ROLE       escribir en `prospectos` (base del Hub)
//    COBRANZAS_SERVICE_ROLE leer cuentas_cubo
//    AIKON_*                leer la tabla CLIENTES del ERP
//    IG_GRANDBAR_TOKEN      (opcional) token de la cuenta IG de empresa
//    IG_GRANDBAR_USER_ID    (opcional) IG business account id
//    IG_MAX_HASHTAGS        (opcional) hashtags por corrida (def 4; límite Meta: 30/7 días)
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';

const MODELO = process.env.IA_MODEL_PROSPECTOS || 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Tipos de Places (New) por canal, según los canales reales de GrandBar:
//   ON  = bares, discos, restaurantes, hoteles, salones/eventos/sunsets.
//   OFF = vinotecas, tiendas de bebidas y autoservicios de barrio.
// A propósito NO incluimos 'supermarket' (hipermercados/cadenas); los
// autoservicios chicos entran por convenience_store/grocery_store y las
// cadenas que se cuelen las frena la lista negra CADENAS + el filtro de la IA.
const TIPOS = {
  on:  ['bar', 'night_club', 'restaurant', 'hotel', 'banquet_hall', 'wedding_venue'],
  off: ['liquor_store', 'convenience_store', 'grocery_store'],
};
// Tope de candidatos a puntuar por corrida (control de costo/tiempo de IA).
const MAX_CANDIDATOS = 300;
// Para CLASIFICAR el canal de cada resultado (no para buscar): qué cuenta como OFF.
const OFF_DETECT = new Set(['liquor_store', 'convenience_store', 'grocery_store', 'supermarket', 'market', 'food_store', 'wholesaler']);
// Tipos que NUNCA son prospecto aunque se cuelen (por tener varios types):
// bodegas (les COMPRAMOS), teatros, estadios, cines, shoppings, hipermercados,
// museos, parques, gimnasios, atracciones turísticas, peloteros/parques infantiles…
const TIPO_BLOCK = new Set([
  'winery', 'stadium', 'arena', 'performing_arts_theater', 'movie_theater', 'amusement_park',
  'amusement_center', 'water_park', 'museum', 'art_gallery', 'zoo', 'aquarium', 'tourist_attraction',
  'shopping_mall', 'department_store', 'supermarket', 'hypermarket', 'wholesaler', 'warehouse_store',
  'convention_center', 'sports_complex', 'sports_activity_location', 'park', 'national_park',
  'gym', 'fitness_center', 'casino', 'bowling_alley', 'playground', 'church', 'hospital', 'school',
]);

// Lista negra: cadenas / mayoristas que NO son prospectos de zona.
const CADENAS = [
  'carrefour', 'walmart', 'jumbo', 'vea', 'disco', 'changomas', 'chango mas',
  'dia ', 'dia%', 'coto', 'la anonima', 'makro', 'maxiconsumo', 'vital',
  'diarco', 'atomo', 'oscar david', 'libertad', 'hipermercado', 'mega',
  'yaguar', 'nini', 'blow max', 'super a', 'supermercado', 'toledo', 'chango mas',
  'cordiez', 'quijote', 'super vea', 'gran libertad',
  // Competencia (distribuidoras / cadenas de bebidas): nunca son prospecto.
  'go bar', 'gobar',
  // gastronomía de cadena
  'mcdonald', 'mostaza', 'burger king', 'starbucks', 'havanna', 'grido',
  'bonafide', 'kentucky', 'el noble', 'rapanui', 'subway',
];

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const soloNum = s => String(s || '').replace(/[^0-9]/g, '');
const STOP = new Set(['bar', 'resto', 'restaurant', 'restaurante', 'cafe', 'vinoteca', 'pub', 'grand', 'srl', 'sa', 'the', 'los', 'las', 'del', 'de', 'la', 'el', 'y', 'cerveceria', 'parrilla', 'bodega', 'almacen', 'kiosco', 'distribuidora']);
const esCadena = nn => CADENAS.some(c => nn.includes(c.replace('%', '').trim()));

// ── Supabase helpers ─────────────────────────────────────────
const hub = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: process.env.HUB_SERVICE_ROLE, Authorization: 'Bearer ' + process.env.HUB_SERVICE_ROLE, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

// Trae TODAS las filas de un endpoint REST paginando (Supabase corta en 1000).
async function traerTodo(base, path) {
  const out = []; let desde = 0; const paso = 1000;
  for (let i = 0; i < 50; i++) {
    const r = await fetch(base + '/rest/v1/' + path, { headers: { apikey: process.env[base === COB_URL ? 'COBRANZAS_SERVICE_ROLE' : 'HUB_SERVICE_ROLE'], Authorization: 'Bearer ' + process.env[base === COB_URL ? 'COBRANZAS_SERVICE_ROLE' : 'HUB_SERVICE_ROLE'], Range: `${desde}-${desde + paso - 1}` } });
    const arr = await r.json().catch(() => []);
    if (!Array.isArray(arr) || !arr.length) break;
    out.push(...arr); if (arr.length < paso) break; desde += paso;
  }
  return out;
}

// ── Aikon (ERP) ──────────────────────────────────────────────
async function aikon(url, body, ms = 40000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const x = await r.text(); try { return JSON.parse(x); } catch { return {}; }
  } catch (e) { return {}; } finally { clearTimeout(t); }
}
const val = (o, ...ks) => { for (const k of ks) if (o && o[k] != null && o[k] !== '') return o[k]; return ''; };

async function clientesAikon() {
  try {
    const cuenta = process.env.AIKON_CUENTA;
    const j1 = await aikon(process.env.AIKON_MANAGER_URL || 'http://aikonmanager.com/Manager/api/CuentaURL', { Cuenta: cuenta, CuentaPwd: process.env.AIKON_CUENTA_PWD });
    const urlCuenta = String(j1.retorno || '').replace(/\/+$/, '');
    const j2 = await aikon(urlCuenta + '/IS3/ObtenerToken', { cuenta, usuario: process.env.AIKON_USUARIO || 'CS', 'contraseña': process.env.AIKON_PASS || '', empresa: process.env.AIKON_EMPRESA });
    const token = j2.token && j2.token.Codigo;
    if (!token) return [];
    const j = await aikon(urlCuenta + '/IS3/DtTabla', { cuenta, token, tabla: process.env.AIKON_TABLA_CLIENTES || 'CLIENTES' }, 50000);
    const lista = Array.isArray(j) ? j : (j.lista || j.retorno || j.tabla || j.Tabla || j.datos || j.Datos || j.registros || j.Registros || j.data || []);
    return (Array.isArray(lista) ? lista : []).map(o => String(val(o, 'cl_nombre', 'Nombre', 'nombre') || val(o, 'cl_razsoc', 'RazonSocial', 'RazonSoc', 'razon_social')).trim()).filter(Boolean);
  } catch (e) { console.error('Aikon CLIENTES:', e.message); return []; }
}

// ── Índice de clientes (para el dedup fuerte) ────────────────
function construirIndice(nombres) {
  const exact = new Set(); const tokens = new Map(); // token -> [nombres norm]
  for (const nm of nombres) {
    const nn = norm(nm); if (!nn) continue;
    exact.add(nn);
    for (const tk of nn.split(' ')) {
      if (tk.length < 4 || STOP.has(tk)) continue;
      if (!tokens.has(tk)) tokens.set(tk, []);
      tokens.get(tk).push(nn);
    }
  }
  return { exact, tokens };
}
function yaEsCliente(nombre, idx) {
  const nn = norm(nombre); if (!nn) return false;
  if (idx.exact.has(nn)) return true;
  // contenido: "la cañada" ⊂ "la cañada bar" y viceversa (como el código viejo, pero bien)
  for (const cn of idx.exact) { if (cn.length > 4 && (cn.includes(nn) || nn.includes(cn))) return true; }
  // 2+ tokens significativos compartidos con un mismo cliente
  const sig = nn.split(' ').filter(tk => tk.length >= 4 && !STOP.has(tk));
  const cuenta = {};
  for (const tk of sig) for (const cn of (idx.tokens.get(tk) || [])) cuenta[cn] = (cuenta[cn] || 0) + 1;
  return Object.values(cuenta).some(c => c >= 2);
}

// ── Google Places (New) ──────────────────────────────────────
async function buscarGoogle(zonas, idx, yaRef) {
  const gkey = process.env.GOOGLE_GEOCODE_KEY;
  if (!gkey) { console.warn('Sin GOOGLE_GEOCODE_KEY'); return []; }
  const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus';
  const cand = [];
  const vistosRun = new Set(); // un mismo local puede salir en varias búsquedas por tipo
  for (const z of zonas) {
    const canal = (z.canal || 'ambos').toLowerCase();
    const tipos = canal === 'on' ? TIPOS.on : canal === 'off' ? TIPOS.off : [...TIPOS.on, ...TIPOS.off];
    const radius = Math.min(Math.max(+z.radio || 3000, 300), 20000);
    // UNA búsqueda POR CADA TIPO (bares, después restós, después vinotecas…):
    // así cada categoría trae sus propios ~20 resultados y los locales chicos no
    // quedan tapados por los grandes (shoppings, hipermercados). Mucho más coverage.
    for (const tipo of tipos) {
      try {
        const pr = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gkey, 'X-Goog-FieldMask': FIELDS },
          body: JSON.stringify({ includedTypes: [tipo], maxResultCount: 20, languageCode: 'es', locationRestriction: { circle: { center: { latitude: +z.lat, longitude: +z.lng }, radius } } }),
        });
        const pj = await pr.json();
        if (!pr.ok) { console.error('Places', z.nombre, tipo, JSON.stringify(pj).slice(0, 160)); continue; }
        for (const p of (pj.places || [])) {
          if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
          const nombre = (p.displayName && p.displayName.text) || '';
          const nn = norm(nombre);
          if (!nn || !p.id) continue;
          if (vistosRun.has(p.id) || yaRef.has('google:' + p.id)) continue;
          vistosRun.add(p.id);
          if (TIPO_BLOCK.has(p.primaryType)) continue;   // bodega, teatro, estadio, shopping, pelotero…
          if (esCadena(nn)) continue;                      // cadena / súper por nombre
          if (yaEsCliente(nombre, idx)) continue;          // ya es cliente
          const off = OFF_DETECT.has(p.primaryType);
          cand.push({
            fuente: 'google', ref_id: p.id, nombre, direccion: p.formattedAddress || '',
            lat: p.location && p.location.latitude, lng: p.location && p.location.longitude,
            tipo: p.primaryType || '', canal: off ? 'off' : 'on', zona: z.nombre,
            rating: p.rating || null, reviews: p.userRatingCount || null,
            telefono: p.nationalPhoneNumber || '', website: p.websiteUri || '',
            maps_url: p.googleMapsUri || '',
          });
        }
      } catch (e) { console.error('Google', z.nombre, tipo, e.message); }
    }
  }
  return cand;
}

// ── Instagram por hashtags (dormido hasta cargar el token) ───
async function buscarInstagram(hashtags, idx, yaRef) {
  const tok = process.env.IG_GRANDBAR_TOKEN, uid = process.env.IG_GRANDBAR_USER_ID;
  if (!tok || !uid) { console.log('IG sin credenciales → fuente Instagram en pausa.'); return []; }
  const max = Math.max(1, Math.min(+process.env.IG_MAX_HASHTAGS || 4, hashtags.length)); // tope Meta: 30 hashtags/7 días
  const g = 'https://graph.facebook.com/v21.0';
  const cand = [];
  for (const h of hashtags.slice(0, max)) {
    try {
      const idr = await fetch(`${g}/ig_hashtag_search?user_id=${uid}&q=${encodeURIComponent(h.hashtag)}&access_token=${tok}`).then(r => r.json());
      const hid = idr.data && idr.data[0] && idr.data[0].id;
      if (!hid) { console.warn('IG hashtag sin id:', h.hashtag, JSON.stringify(idr).slice(0, 120)); continue; }
      const mr = await fetch(`${g}/${hid}/recent_media?user_id=${uid}&fields=id,caption,permalink,timestamp&limit=25&access_token=${tok}`).then(r => r.json());
      for (const m of (mr.data || [])) {
        // La API de hashtags NO da el @ del dueño del post → guardamos el
        // permalink para que el supervisor entre, y la IA lee el caption para
        // adivinar el nombre del local y filtrar lo que no sea un comercio.
        const short = (String(m.permalink || '').match(/\/(p|reel)\/([^/]+)/) || [])[2] || m.id;
        if (!short || yaRef.has('instagram:' + short)) continue;
        cand.push({ fuente: 'instagram', ref_id: short, nombre: '', direccion: '', tipo: '', canal: (h.canal === 'off' ? 'off' : 'on'), zona: h.zona || '', instagram_url: m.permalink || '', _caption: (m.caption || '').slice(0, 400) });
      }
    } catch (e) { console.error('IG hashtag', h.hashtag, e.message); }
  }
  return cand;
}

// ── Claude: puntúa + descarta + redacta los mensajes ─────────
// Reglas de qué es (y qué NO) un prospecto, para la IA.
const REGLAS = `GrandBar Distribuciones es una distribuidora de bebidas en Mendoza y San Luis (Argentina). Sus canales:
- ON (se consume en el local): bares, discos/boliches, restaurantes, hoteles, salones de eventos/fiestas de ADULTOS.
- OFF (reventa): vinotecas, tiendas de bebidas, autoservicios/mini-mercados de barrio.
DESCARTAR siempre (descartar=true): bodegas/wineries (les compramos, no les vendemos); hipermercados y cadenas de súper; la COMPETENCIA (otras distribuidoras o cadenas de bebidas, ej. Go Bar); teatros, cines, museos, estadios/clubes deportivos, gimnasios, iglesias, escuelas, hospitales, plazas; peloteros y salones de fiestas INFANTILES; frigoríficos/carnicerías, panaderías, ferreterías, farmacias, fábricas de soda/garrafas y cualquier negocio que no venda ni sirva bebidas alcohólicas.`;

// Lee un array JSON de la respuesta de Claude, tolerante a ```json / texto extra.
function leerArray(txt) {
  const s = String(txt || ''); const a = s.indexOf('['); const z = s.lastIndexOf(']');
  if (a < 0 || z < 0 || z < a) return null;
  try { return JSON.parse(s.slice(a, z + 1)); } catch { return null; }
}
async function claudeJSON(key, prompt, maxTok) {
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELO, max_tokens: maxTok, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Claude ' + r.status + ': ' + JSON.stringify(j).slice(0, 160));
  const txt = ((j.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('\n')) || '';
  const arr = leerArray(txt);
  if (!arr) throw new Error('sin array; inicio: ' + txt.slice(0, 120));
  return arr;
}

// PASO 1 — clasificar: salida CHICA (sin mensajes) → rápida y nunca se corta.
// Tandas de 30. Lo que la IA no llegue a clasificar NO se marca → no se guarda.
async function clasificar(cands, key) {
  for (let b = 0; b < cands.length; b += 30) {
    const lote = cands.slice(b, b + 30);
    const lista = lote.map((c, i) => ({ i, nombre: c.nombre || null, tipo: c.tipo || null, canal: c.canal, zona: c.zona, rating: c.rating || null, reviews: c.reviews || null, caption: c._caption || null, tel: !!c.telefono }));
    const prompt = `${REGLAS}

Clasificá cada negocio de la lista. Devolvé SOLO un array JSON, sin texto ni markdown, de objetos:
{"i": índice, "descartar": true/false, "nombre": nombre del local (para Instagram deducilo del caption; si no se sabe null), "categoria": "bar"|"disco"|"restaurante"|"hotel"|"salon_eventos"|"cerveceria"|"vinoteca"|"autoservicio"|"tienda_bebidas"|"otro", "score": 0-100 (mejor prospecto=más alto, usá rating/reviews/tipo; si descartar, 0), "motivo": frase corta, "canal_contacto": "whatsapp"|"instagram"|"ninguno"}

Lista:
${JSON.stringify(lista)}`;
    let arr;
    try { arr = await claudeJSON(key, prompt, 8000); }
    catch (e) { console.error('clasificar lote', b, e.message); continue; }
    const byI = {}; for (const o of arr) byI[o.i] = o;
    lote.forEach((c, i) => {
      const o = byI[i]; if (!o) return;
      c._clasificado = true;
      c.descartar = !!o.descartar;
      c.score = o.descartar ? 0 : (typeof o.score === 'number' ? Math.round(o.score) : 50);
      c.score_motivo = o.motivo || '';
      c.tipo = c.tipo || o.categoria || '';
      if (!c.nombre && o.nombre) c.nombre = o.nombre;
      c.canal_contacto = o.canal_contacto || (c.fuente === 'instagram' ? 'instagram' : (c.telefono ? 'whatsapp' : 'instagram'));
    });
  }
}

// PASO 2 — redactar los mensajes SOLO para los que quedaron (tandas de 10).
async function redactar(buenos, key) {
  for (let b = 0; b < buenos.length; b += 10) {
    const lote = buenos.slice(b, b + 10);
    const lista = lote.map((c, i) => ({ i, nombre: c.nombre, tipo: c.tipo, zona: c.zona, canal: c.canal }));
    const prompt = `Sos del equipo de GrandBar Distribuciones (bebidas, Mendoza/San Luis). Por cada local escribí un PRIMER contacto cálido, argentino, con tuteo, presentándote como distribuidora de bebidas de la zona y ofreciendo pasar a visitarlos / mostrar el catálogo. Sin exagerar, máximo 1 emoji.
Devolvé SOLO un array JSON de objetos {"i": índice, "mensaje_wsp": 2-3 frases para WhatsApp, "mensaje_ig": igual pero más breve e informal para Instagram}.

Lista:
${JSON.stringify(lista)}`;
    let arr;
    try { arr = await claudeJSON(key, prompt, 6000); }
    catch (e) { console.error('redactar lote', b, e.message); continue; }
    const byI = {}; for (const o of arr) byI[o.i] = o;
    lote.forEach((c, i) => { const o = byI[i]; if (o) { c.mensaje_wsp = o.mensaje_wsp || ''; c.mensaje_ig = o.mensaje_ig || ''; } });
  }
}

// Orquesta: 1) clasificar todo, 2) redactar mensajes a los que quedan.
// Devuelve la lista completa; el handler guarda solo los _clasificado && !descartar.
async function puntuar(cands) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !cands.length) return cands;
  await clasificar(cands, key);
  const buenos = cands.filter(c => c._clasificado && !c.descartar);
  await redactar(buenos, key);
  return cands;
}

// ── Guardado (solo inserta nuevos; nunca pisa el trabajo del supervisor) ──
async function guardar(filas) {
  let ok = 0;
  for (let i = 0; i < filas.length; i += 50) {
    const lote = filas.slice(i, i + 50);
    const r = await hub('prospectos?on_conflict=fuente,ref_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(lote) });
    if (r.ok) ok += lote.length; else console.error('Insert prospectos:', r.status, (await r.text()).slice(0, 200));
  }
  return ok;
}

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  if (process.env.SYNC_SECRET && q.key !== process.env.SYNC_SECRET) return json(403, { error: 'key inválida' });
  const t0 = Date.now();
  try {
    // 1) config
    const [zonas, hashtags] = await Promise.all([
      traerTodo(HUB_URL, 'prospectos_zonas?activa=eq.true&select=nombre,lat,lng,radio,canal'),
      traerTodo(HUB_URL, 'prospectos_hashtags?activa=eq.true&select=hashtag,canal,zona'),
    ]);

    // 2) base de clientes (Aikon + cuentas_cubo) → índice de dedup
    const [aik, cubo, existentes] = await Promise.all([
      clientesAikon(),
      traerTodo(COB_URL, 'cuentas_cubo?select=nombre'),
      traerTodo(HUB_URL, 'prospectos?select=fuente,ref_id'),
    ]);
    const nombresCli = [...aik, ...cubo.map(c => c.nombre)].filter(Boolean);
    const idx = construirIndice(nombresCli);
    const yaRef = new Set(existentes.map(p => p.fuente + ':' + p.ref_id));

    // 3) descubrir (Google + Instagram)
    const [gog, insta] = await Promise.all([
      buscarGoogle(zonas, idx, yaRef),
      buscarInstagram(hashtags, idx, yaRef),
    ]);
    // dedup entre fuentes de esta misma corrida (por ref)
    const vistos = new Set(); const crudos = [];
    for (const c of [...gog, ...insta]) { const k = c.fuente + ':' + c.ref_id; if (vistos.has(k)) continue; vistos.add(k); crudos.push(c); }

    // 4) puntuar + redactar con IA (de a tandas), y descartar lo que la IA marque
    const recortados = crudos.slice(0, MAX_CANDIDATOS);
    const puntuados = await puntuar(recortados);
    // Solo guardamos lo que la IA CLASIFICÓ y NO descartó. Lo que no llegó a
    // clasificar no se guarda (así nunca más entra basura sin filtrar).
    const buenos = puntuados.filter(c => c._clasificado && !c.descartar);

    // 5) guardar
    const filas = buenos.map(c => ({
      fuente: c.fuente, ref_id: c.ref_id, nombre: c.nombre, direccion: c.direccion || null,
      lat: c.lat || null, lng: c.lng || null, tipo: c.tipo || null, canal: c.canal || null,
      zona: c.zona || null, rating: c.rating || null, reviews: c.reviews || null,
      telefono: c.telefono || null,
      website: c.website || null, maps_url: c.maps_url || null,
      instagram: c.instagram || null,
      instagram_url: c.instagram_url || (c.fuente === 'google' ? ('https://www.instagram.com/explore/search/keyword/?q=' + encodeURIComponent(c.nombre)) : null),
      score: (c.score == null ? null : Math.round(c.score)), score_motivo: c.score_motivo || null,
      canal_contacto: c.canal_contacto || null, mensaje_wsp: c.mensaje_wsp || null, mensaje_ig: c.mensaje_ig || null,
      estado: 'nuevo',
    }));
    const guardados = await guardar(filas);

    const resumen = { ok: true, ms: Date.now() - t0, zonas: zonas.length, hashtags_activos: hashtags.length, clientes_base: nombresCli.length, encontrados: crudos.length, descartados_ia: puntuados.length - buenos.length, guardados_nuevos: guardados };
    console.log('cazar-clientes:', JSON.stringify(resumen));
    return json(200, resumen);
  } catch (e) {
    console.error('cazar-clientes ERROR', e.message);
    return json(500, { error: e.message });
  }
};

// Estado del sistema (10/10/2026): cada corrida queda en sistema_corridas (ver _corrida.js).
// Las llamadas sin la clave del disparo no cuentan.
exports.handler = require('./_corrida').conRegistro('cazar-clientes', exports.handler, { siCorre: (e) => !process.env.SYNC_SECRET || ((e && e.queryStringParameters && e.queryStringParameters.key) || '') === process.env.SYNC_SECRET });
