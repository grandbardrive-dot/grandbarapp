// ============================================================
//  GrandBar · Netlify Function · comparar-precios
//  Busca un producto en las plataformas de la competencia (las que
//  publican precios sin login, plataforma VTEX) y devuelve nombre +
//  precio de cada una. Los que no tienen API pública se cargan a mano
//  en el panel (Coto, Maxiconsumo, Pedidos Ya, locales).
//
//  Uso: /comparar-precios?q=skyy
//  Sin escrituras, sin credenciales. GET.
// ============================================================

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Competidores con API pública (VTEX).
const VTEX = [
  { id: 'carrefour', nombre: 'Carrefour',  base: 'https://www.carrefour.com.ar' },
  { id: 'changomas', nombre: 'Chango Mas', base: 'https://www.masonline.com.ar' },
  { id: 'vea',       nombre: 'Vea',        base: 'https://www.vea.com.ar' },
  { id: 'jumbo',     nombre: 'Jumbo',      base: 'https://www.jumbo.com.ar' },
  { id: 'disco',     nombre: 'Disco',      base: 'https://www.disco.com.ar' },
  { id: 'gobar',     nombre: 'Go Bar',     base: 'https://www.gobar.com.ar' },
];
// Competidores en WooCommerce (Store API pública).
const WOO = [
  { id: 'centralbebidas', nombre: 'Central de Bebidas', base: 'https://centraldebebidas.com.ar' },
];
// Competidores sin API pública (o detrás de login) → carga manual.
// `buscar` (con %s) = link directo a la búsqueda; `web` = home del sitio.
const MANUAL = [
  { id: 'coto',         nombre: 'Coto',                web: 'https://www.cotodigital3.com.ar', buscar: 'https://www.cotodigital3.com.ar/sitios/cdigi/browse?Ntt=%s' },
  { id: 'maxiconsumo',  nombre: 'Maxiconsumo',         web: 'https://www.maxiconsumo.com',      buscar: 'https://www.maxiconsumo.com/catalogsearch/result/?q=%s' },
  { id: 'carrefourmay', nombre: 'Carrefour Mayorista', web: 'https://comerciante.carrefour.com.ar' },
  { id: 'pedidosya',    nombre: 'Pedidos Ya',          web: 'https://www.pedidosya.com.ar' },
  { id: 'almag',        nombre: 'Almag (San Luis)' },
  { id: 'alfonsa',      nombre: 'Alfonsa (San Luis)' },
];

// Normalización + relevancia: el nombre del producto debe contener TODAS
// las palabras que buscó Luci (así "skyy reg 750" no trae shampoo ni bolsas).
function norm(s) {
  return String(s == null ? '' : s).toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokensQuery(q) {
  const all = norm(q).split(' ').filter(Boolean);
  const big = all.filter((t) => t.length >= 4);   // palabras específicas (skyy, branca, 1882)
  if (big.length) return big;
  return all.filter((t) => t.length >= 3);         // fallback para búsquedas cortas (gin, ron)
}
function esRelevante(nombre, toks) {
  if (!toks.length) return true;
  const n = norm(nombre);
  return toks.every((t) => n.includes(t));
}

async function fetchTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
    const txt = await r.text();
    try { return { ok: r.ok || r.status === 206, status: r.status, json: JSON.parse(txt) }; }
    catch { return { ok: false, status: r.status, json: null }; }
  } catch (e) { return { ok: false, status: 0, error: (e && e.message) || String(e) }; }
  finally { clearTimeout(t); }
}

// Extrae los productos con precio y CON STOCK de una respuesta VTEX,
// filtrando por relevancia (nombre debe contener las palabras buscadas).
function parseVtex(arr, toks, max = 8) {
  const out = [];
  for (const p of (Array.isArray(arr) ? arr : [])) {
    try {
      const nombre = p.productName || (p.items && p.items[0] && p.items[0].name) || '—';
      if (!esRelevante(nombre, toks)) continue;
      // Solo vendedores con precio > 0 y stock disponible.
      let mejor = null;
      for (const it of (p.items || [])) {
        for (const s of (it.sellers || [])) {
          const o = s.commertialOffer;
          if (!o || !(Number(o.Price) > 0)) continue;
          const disp = o.AvailableQuantity == null ? true : Number(o.AvailableQuantity) > 0;
          if (!disp) continue;
          if (!mejor || Number(o.Price) < mejor.precio) mejor = { precio: Number(o.Price), lista: Number(o.ListPrice) || null };
        }
      }
      if (!mejor) continue; // sin stock / sin precio → no se muestra
      out.push({ producto: nombre, marca: p.brand || null, precio: mejor.precio, precio_lista: mejor.lista, disponible: true, url: p.link || null });
    } catch (e) { /* saltar producto roto */ }
    if (out.length >= max) break;
  }
  return out;
}

// Extrae productos con precio y stock de una respuesta WooCommerce Store API.
function parseWoo(arr, toks, max = 8) {
  const out = [];
  for (const p of (Array.isArray(arr) ? arr : [])) {
    try {
      if (p.is_in_stock === false) continue;            // sin stock → fuera
      if (!esRelevante(p.name || '', toks)) continue;    // relevancia
      const pr = p.prices || {};
      const minor = Number(pr.currency_minor_unit || 0);
      const precio = pr.price != null ? Number(pr.price) / Math.pow(10, minor) : 0;
      if (!precio) continue;
      out.push({ producto: p.name || '—', marca: null, precio, precio_lista: null, disponible: true, url: p.permalink || null });
    } catch (e) { /* saltar */ }
    if (out.length >= max) break;
  }
  return out;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  const q = ((event.queryStringParameters || {}).q || '').trim();
  if (!q) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, q: '', auto: [], manual: MANUAL }) };
  const toks = tokensQuery(q);

  const autoVtex = VTEX.map(async (c) => {
    const r = await fetchTimeout(`${c.base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=29`);
    if (!r.ok || !r.json) return { id: c.id, nombre: c.nombre, base: c.base, error: r.error || ('http ' + r.status), items: [] };
    return { id: c.id, nombre: c.nombre, base: c.base, items: parseVtex(r.json, toks) };
  });
  const autoWoo = WOO.map(async (c) => {
    const r = await fetchTimeout(`${c.base}/wp-json/wc/store/products?search=${encodeURIComponent(q)}&per_page=30`);
    if (!r.ok || !r.json) return { id: c.id, nombre: c.nombre, base: c.base, error: r.error || ('http ' + r.status), items: [] };
    return { id: c.id, nombre: c.nombre, base: c.base, items: parseWoo(r.json, toks) };
  });
  const auto = await Promise.all([...autoVtex, ...autoWoo]);

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, q, auto, manual: MANUAL }) };
};
