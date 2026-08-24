// ============================================================
//  GrandBar · Netlify Function · resultados-acciones
//  Cruza las ACCIONES del catálogo (catalogoon.com / catalogooff.com,
//  tabla catalogo_acciones en el proyecto zlwnoqdxendsgbfvfyue) con las
//  VENTAS reales del ERP (ventas_articulos en fzaxwuuodseyyinveknn),
//  POR NOMBRE, y devuelve el cuadro de rendimiento por acción + la
//  comparativa ON vs OFF (columna `canal`).
//
//  Rango de análisis: ?desde=yyyy-mm-dd&hasta=yyyy-mm-dd
//  (default: mes en curso). Sin escrituras. GET.
// ============================================================

// Proyecto CATÁLOGO (acciones + proveedores).
const CAT_URL = 'https://zlwnoqdxendsgbfvfyue.supabase.co';
const CAT_KEY = process.env.CATALOGO_ANON_KEY || 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4';
// Proyecto del MANUAL (ventas bajadas del ERP).
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

async function getAll(base, key, path) {
  const out = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const r = await fetch(base + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key, Range: `${from}-${from + page - 1}` } });
    const arr = await r.json().catch(() => []);
    if (!Array.isArray(arr) || !arr.length) break;
    out.push(...arr);
    if (arr.length < page) break;
    if (out.length > 80000) break;
  }
  return out;
}

// Normalización para matchear por nombre.
const STOP = new Set(['X', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'BOTELLA', 'BOT', 'UNIDAD', 'PACK', 'CJ', 'CAJA', 'CAJAS', 'POR', 'CON', 'Y', 'ML', 'CC', 'LT', 'L', 'CL', 'GR', 'GRS', 'KG', 'UN', 'U', 'PET', 'LATA', 'VINO', 'ESP']);
function norm(s) {
  return String(s == null ? '' : s)
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b\d+([.,]\d+)?\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function tokens(s) { return norm(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t)); }

function mesEnCurso() {
  const d = new Date();
  const desde = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const hasta = d.toISOString().slice(0, 10);
  return { desde, hasta };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const q = (event && event.queryStringParameters) || {};
    const def = mesEnCurso();
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(q.desde || '') ? q.desde : def.desde;
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(q.hasta || '') ? q.hasta : def.hasta;

    const [acciones, proveedores, ventas] = await Promise.all([
      getAll(CAT_URL, CAT_KEY, 'catalogo_acciones?select=*'),
      getAll(CAT_URL, CAT_KEY, 'catalogo_proveedores?select=id,nombre,categoria'),
      getAll(MAN_URL, MAN_KEY, `ventas_articulos?select=sku,fecha,descripcion,marca,familia_nombre,unidades,importe,importe_iva,costo,costo_pleno,imp_interno&fecha=gte.${desde}&fecha=lte.${hasta}`),
    ]);
    const provMap = new Map(proveedores.map((p) => [p.id, p]));
    ventas.forEach((v) => { v._txt = norm(`${v.descripcion || ''} ${v.marca || ''} ${v.familia_nombre || ''}`); });

    const segDe = (canal) => (canal === 'on' ? 'on' : canal === 'off' ? 'off' : 'ambos');

    const out = acciones.map((a) => {
      const prov = provMap.get(a.proveedor_id);
      const toks = tokens(`${a.nombre_producto || ''} ${prov ? prov.nombre : ''}`);
      const artManual = Array.isArray(a.articulos) ? a.articulos.map(String) : [];
      const skuPromo = a.sku_promo ? String(a.sku_promo).replace(/\D/g, '') : '';
      const metodo = artManual.length ? 'articulos' : (skuPromo ? 'sku_promo' : (toks.length ? 'nombre' : 'sin_dato'));
      let unidades = 0, importe = 0, costo = 0, impInterno = 0, importeNeto = 0;
      const skus = new Map();
      for (const v of ventas) {
        let match = false;
        if (metodo === 'articulos') match = artManual.includes(String(v.sku));
        else if (metodo === 'sku_promo') match = String(v.sku).replace(/\D/g, '') === skuPromo;
        else if (metodo === 'nombre') { let h = 0; for (const t of toks) if (v._txt.includes(t)) h++; match = h / toks.length >= 0.6; }
        if (!match) continue;
        // Facturado = con IVA; costo = pleno (neto + IVA + imp. interno). Fallback a neto si faltan columnas.
        const fact = Number(v.importe_iva) || Number(v.importe) || 0;
        const cst = Number(v.costo_pleno) || Number(v.costo) || 0;
        unidades += Number(v.unidades) || 0; importe += fact; costo += cst;
        impInterno += Number(v.imp_interno) || 0; importeNeto += Number(v.importe) || 0;
        const s = skus.get(v.sku) || { sku: v.sku, descripcion: v.descripcion, unidades: 0, importe: 0 };
        s.unidades += Number(v.unidades) || 0; s.importe += fact; skus.set(v.sku, s);
      }
      const margen = importe - costo;
      return {
        id: a.id, producto: a.nombre_producto, proveedor: prov ? prov.nombre : null, categoria: prov ? prov.categoria : null,
        canal: a.canal || 'ambos', segmento: segDe(a.canal), mecanica: a.mecanica || null,
        porcentaje_off: a.porcentaje_off || null, precio_accionado: a.precio_accionado || null,
        activo: a.activo !== false, vigente_hasta: a.vigente_hasta || null,
        sku_promo: skuPromo || null, metodo_match: metodo,
        importe_neto: Math.round(importeNeto), imp_interno: Math.round(impInterno), costo: Math.round(costo),
        unidades: Math.round(unidades), importe: Math.round(importe), margen: Math.round(margen),
        margen_pct: importe > 0 ? Math.round((margen / importe) * 1000) / 10 : null,
        skus_match: skus.size, sin_datos: skus.size === 0,
        top_skus: [...skus.values()].sort((x, y) => y.importe - x.importe).slice(0, 6),
      };
    });

    const conDatos = out.filter((a) => !a.sin_datos).sort((x, y) => y.importe - x.importe);
    conDatos.forEach((a, i) => { a.ranking = i + 1; });

    const grupo = (seg) => {
      const items = out.filter((a) => a.segmento === seg || a.segmento === 'ambos');
      const acc = items.reduce((s, a) => { s.importe += a.importe; s.unidades += a.unidades; s.margen += a.margen; s.con += a.sin_datos ? 0 : 1; return s; }, { importe: 0, unidades: 0, margen: 0, con: 0 });
      return { acciones: items.length, con_datos: acc.con, importe: acc.importe, unidades: acc.unidades, margen: acc.margen, margen_pct: acc.importe > 0 ? Math.round((acc.margen / acc.importe) * 1000) / 10 : null };
    };

    const tImporte = out.reduce((s, a) => s + a.importe, 0);
    const tMargen = out.reduce((s, a) => s + a.margen, 0);

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      rango: { desde, hasta },
      ventas_filas: ventas.length,
      totales: { acciones: out.length, con_datos: conDatos.length, importe: tImporte, margen: tMargen, margen_pct: tImporte > 0 ? Math.round((tMargen / tImporte) * 1000) / 10 : null },
      grupos: { on: grupo('on'), off: grupo('off') },
      acciones: out,
    }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
