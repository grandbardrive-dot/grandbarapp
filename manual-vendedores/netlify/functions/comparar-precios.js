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
// Competidores sin API pública → carga manual en el panel (por ahora).
const MANUAL = [
  { id: 'coto',        nombre: 'Coto' },
  { id: 'maxiconsumo', nombre: 'Maxiconsumo' },
  { id: 'pedidosya',   nombre: 'Pedidos Ya' },
  { id: 'almag',       nombre: 'Almag (San Luis)' },
  { id: 'alfonsa',     nombre: 'Alfonsa (San Luis)' },
];

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

// Extrae los productos con precio de una respuesta VTEX.
function parseVtex(arr, max = 8) {
  const out = [];
  for (const p of (Array.isArray(arr) ? arr : [])) {
    try {
      const it = (p.items || [])[0]; if (!it) continue;
      const sel = (it.sellers || []).find((s) => s.commertialOffer && s.commertialOffer.Price > 0) || (it.sellers || [])[0];
      const o = sel && sel.commertialOffer; if (!o) continue;
      const precio = Number(o.Price) || 0;
      const disponible = (o.AvailableQuantity == null ? 1 : Number(o.AvailableQuantity)) > 0 && precio > 0;
      out.push({
        producto: p.productName || it.name || '—',
        marca: p.brand || null,
        precio: precio || null,
        precio_lista: Number(o.ListPrice) || null,
        disponible,
        url: p.link || null,
      });
    } catch (e) { /* saltar producto roto */ }
    if (out.length >= max) break;
  }
  return out;
}

// Extrae productos con precio de una respuesta WooCommerce Store API.
function parseWoo(arr, max = 8) {
  const out = [];
  for (const p of (Array.isArray(arr) ? arr : [])) {
    try {
      const pr = p.prices || {};
      const minor = Number(pr.currency_minor_unit || 0);
      const precio = pr.price != null ? Number(pr.price) / Math.pow(10, minor) : 0;
      if (!precio) continue;
      out.push({ producto: p.name || '—', marca: null, precio, precio_lista: null, disponible: p.is_in_stock !== false, url: p.permalink || null });
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

  const autoVtex = VTEX.map(async (c) => {
    const r = await fetchTimeout(`${c.base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=9`);
    if (!r.ok || !r.json) return { id: c.id, nombre: c.nombre, base: c.base, error: r.error || ('http ' + r.status), items: [] };
    return { id: c.id, nombre: c.nombre, base: c.base, items: parseVtex(r.json) };
  });
  const autoWoo = WOO.map(async (c) => {
    const r = await fetchTimeout(`${c.base}/wp-json/wc/store/products?search=${encodeURIComponent(q)}&per_page=10`);
    if (!r.ok || !r.json) return { id: c.id, nombre: c.nombre, base: c.base, error: r.error || ('http ' + r.status), items: [] };
    return { id: c.id, nombre: c.nombre, base: c.base, items: parseWoo(r.json) };
  });
  const auto = await Promise.all([...autoVtex, ...autoWoo]);

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, q, auto, manual: MANUAL }) };
};
