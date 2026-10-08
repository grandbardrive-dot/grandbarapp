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
  on:  ['bar', 'night_club', 'restaurant', 'hotel', 'event_venue', 'banquet_hall', 'wedding_venue'],
  off: ['liquor_store', 'convenience_store', 'grocery_store'],
};
// Para CLASIFICAR el canal de cada resultado (no para buscar): qué cuenta como OFF.
const OFF_DETECT = new Set(['liquor_store', 'convenience_store', 'grocery_store', 'supermarket', 'market', 'food_store', 'wholesaler']);

// Lista negra: cadenas / mayoristas que NO son prospectos de zona.
const CADENAS = [
  'carrefour', 'walmart', 'jumbo', 'vea', 'disco', 'changomas', 'chango mas',
  'dia ', 'dia%', 'coto', 'la anonima', 'makro', 'maxiconsumo', 'vital',
  'diarco', 'atomo', 'oscar david', 'libertad', 'hipermercado', 'mega',
  'yaguar', 'nini', 'blow max', 'super a', 'supermercado',
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
  const cand = [];
  for (const z of zonas) {
    const canal = (z.canal || 'ambos').toLowerCase();
    const tipos = canal === 'on' ? TIPOS.on : canal === 'off' ? TIPOS.off : [...TIPOS.on, ...TIPOS.off];
    const radius = Math.min(Math.max(+z.radio || 3000, 300), 20000);
    try {
      const pr = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': gkey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus',
        },
        body: JSON.stringify({ includedTypes: tipos, maxResultCount: 20, languageCode: 'es', locationRestriction: { circle: { center: { latitude: +z.lat, longitude: +z.lng }, radius } } }),
      });
      const pj = await pr.json();
      if (!pr.ok) { console.error('Places', z.nombre, JSON.stringify(pj).slice(0, 200)); continue; }
      for (const p of (pj.places || [])) {
        if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
        const nombre = (p.displayName && p.displayName.text) || '';
        const nn = norm(nombre);
        if (!nn || !p.id) continue;
        if (yaRef.has('google:' + p.id)) continue;
        if (esCadena(nn)) continue;
        if (yaEsCliente(nombre, idx)) continue;
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
    } catch (e) { console.error('Google zona', z.nombre, e.message); }
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
async function puntuar(cands) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !cands.length) return cands.map(c => ({ ...c, score: null, descartar: !key }));
  const lista = cands.map((c, i) => ({ i, fuente: c.fuente, nombre: c.nombre || null, tipo: c.tipo || null, canal: c.canal, zona: c.zona, direccion: c.direccion || null, rating: c.rating || null, reviews: c.reviews || null, caption: c._caption || null }));
  const PROMPT = `Sos el analista comercial de GrandBar Distribuciones, una distribuidora de bebidas en Mendoza y San Luis (Argentina). Sus canales son:
- ON (se consume en el local): bares, discos/boliches, restaurantes, hoteles, salones de eventos/fiestas, eventos y sunsets.
- OFF (reventa): vinotecas, tiendas de bebidas y autoservicios/mini-mercados de barrio.
Le interesan los negocios INDEPENDIENTES de zona. NO le interesan los hipermercados ni las grandes cadenas (Carrefour, Walmart, Jumbo, Vea, Disco, ChangoMás, Día, Coto, La Anónima, Átomo, Makro, Maxiconsumo, etc.), ni negocios que no vendan/sirvan bebidas (ferreterías, farmacias, kioscos mínimos, etc.).

Te paso una lista de posibles clientes nuevos (de Google y de posts de Instagram). Para cada uno devolvé un objeto con:
- "i": el índice que te di.
- "descartar": true si NO es un prospecto válido (hipermercado o cadena grande, mayorista, un negocio que no vende/sirve bebidas, o un post de Instagram que no es claramente un local comercial). Un autoservicio o mini-mercado de barrio independiente SÍ es válido (OFF). Si dudás y parece un local independiente de alguno de los canales, dejalo (descartar=false).
- "nombre": para los de Instagram, deducí del caption el nombre del local (ej. "Bar La Esquina"). Para los de Google, repetí el nombre que te di. Si no se puede saber, null.
- "categoria": una de "bar","disco","restaurante","hotel","salon_eventos","cafe","cerveceria","vinoteca","autoservicio","tienda_bebidas","otro".
- "score": 0 a 100. Más alto = mejor prospecto (local activo, buena reputación, encaja con el target). Usá rating/reviews y el tipo. Si descartar=true, score 0.
- "motivo": una frase corta explicando el score (ej. "Resto activo, 4.6★ con 320 reseñas, zona céntrica").
- "canal_contacto": "whatsapp" si es de Google y conviene WhatsApp, "instagram" si vino de Instagram o no hay teléfono, "ninguno" si descartado.
- "mensaje_wsp": mensaje corto (2-3 frases) de PRIMER contacto por WhatsApp, de parte del equipo de GrandBar Distribuciones, presentándose como distribuidora de bebidas de la zona y ofreciendo pasar a visitarlos/mostrarles el catálogo. Tono argentino, cálido y profesional, tuteo, sin exagerar, sin emojis excesivos (1 como mucho). Usá el nombre del local si lo tenés. Vacío si descartado.
- "mensaje_ig": igual pero para mensaje directo de Instagram, un toque más breve e informal.

Devolvé ÚNICAMENTE un array JSON, sin texto antes ni después, sin markdown.

Lista:
${JSON.stringify(lista)}`;
  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELO, max_tokens: 8000, messages: [{ role: 'user', content: PROMPT }] }),
    });
    const j = await r.json();
    const txt = (j.content && j.content[0] && j.content[0].text) || '[]';
    const arr = JSON.parse(txt.replace(/^```json\s*|\s*```$/g, '').trim());
    const byI = {}; for (const o of arr) byI[o.i] = o;
    return cands.map((c, i) => {
      const o = byI[i] || {};
      return {
        ...c,
        nombre: c.nombre || o.nombre || '(ver post de Instagram)',
        tipo: c.tipo || o.categoria || '',
        score: o.descartar ? 0 : (typeof o.score === 'number' ? o.score : 50),
        score_motivo: o.motivo || '',
        canal_contacto: o.canal_contacto || (c.fuente === 'instagram' ? 'instagram' : (c.telefono ? 'whatsapp' : 'instagram')),
        mensaje_wsp: o.mensaje_wsp || '',
        mensaje_ig: o.mensaje_ig || '',
        descartar: !!o.descartar,
      };
    });
  } catch (e) {
    console.error('Claude puntuar:', e.message);
    return cands.map(c => ({ ...c, score: 50, descartar: false, canal_contacto: c.fuente === 'instagram' ? 'instagram' : (c.telefono ? 'whatsapp' : 'instagram') }));
  }
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

    // 4) puntuar + redactar con IA, y descartar lo que la IA marque
    const puntuados = await puntuar(crudos);
    const buenos = puntuados.filter(c => !c.descartar);

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
