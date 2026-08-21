// ============================================================
//  GrandBar · Netlify Function · resultados-acciones
//  Cruza las acciones (acciones_mensuales) con las ventas reales
//  (ventas_articulos, bajadas del ERP) POR NOMBRE, y devuelve el
//  cuadro de rendimiento por acción + comparativa ON-trade / OFF-trade.
//
//  Todo lee del proyecto del panel de Luciana (fzaxwuuodseyyinveknn).
//  Sin escrituras. GET.
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const sb = (path) => fetch(SB_URL + '/rest/v1/' + path, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });

// Canales → segmento comercial.
const ON_TRADE  = new Set(['restaurantes', 'bares', 'discos', 'discotecas', 'hoteles', 'eventos']);
const OFF_TRADE = new Set(['vinotecas', 'autoservicios', 'kioscos', 'mayorista', 'mayorista_mendoza', 'mayorista_sanluis']);
function segmento(aplica) {
  const a = Array.isArray(aplica) ? aplica.map((x) => String(x).toLowerCase()) : [];
  if (a.includes('todos') || (a.some((x) => ON_TRADE.has(x)) && a.some((x) => OFF_TRADE.has(x)))) return 'ambos';
  if (a.some((x) => ON_TRADE.has(x))) return 'on';
  if (a.some((x) => OFF_TRADE.has(x))) return 'off';
  return 'otro';
}

// Normalización para matchear por nombre.
const STOP = new Set(['X', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'BOTELLA', 'BOT', 'UNIDAD', 'PACK', 'CJ', 'CAJA', 'CAJAS', 'POR', 'CON', 'Y', 'ML', 'CC', 'LT', 'L', 'CL', 'GR', 'GRS', 'KG', 'UN', 'U', 'PET', 'LATA', 'VINO']);
function norm(s) {
  return String(s == null ? '' : s)
    .toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")      // saca acentos
    .replace(/[^A-Z0-9]+/g, ' ')                            // deja letras/números
    .replace(/\b\d+([.,]\d+)?\b/g, ' ')                     // saca números (medidas)
    .replace(/\s+/g, ' ').trim();
}
function tokens(s) {
  return norm(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t));
}

async function getAll(path, pageCol) {
  const out = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const r = await fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Range: `${from}-${from + page - 1}` },
    });
    const arr = await r.json().catch(() => []);
    if (!Array.isArray(arr) || !arr.length) break;
    out.push(...arr);
    if (arr.length < page) break;
    if (out.length > 60000) break; // tope de seguridad
  }
  return out;
}

exports.handler = async () => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const acciones = await getAll('acciones_mensuales?select=*&order=fecha_inicio.desc');
    if (!acciones.length) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, acciones: [], grupos: {}, nota: 'No hay acciones cargadas.' }) };

    // Rango global de fechas de las acciones.
    const fechas = acciones.flatMap((a) => [a.fecha_inicio, a.fecha_fin]).filter(Boolean).sort();
    const gDesde = fechas[0], gHasta = fechas[fechas.length - 1];

    // Ventas del rango global (una sola bajada, se filtra por acción en memoria).
    const ventas = await getAll(`ventas_articulos?select=sku,fecha,descripcion,marca,familia_nombre,unidades,importe,costo&fecha=gte.${gDesde}&fecha=lte.${gHasta}`);
    // Pre-normalizo el texto de cada venta.
    ventas.forEach((v) => { v._txt = norm(`${v.descripcion || ''} ${v.marca || ''} ${v.familia_nombre || ''}`); });

    const hoy = new Date().toISOString().slice(0, 10);
    const out = acciones.map((a) => {
      const toks = tokens(`${a.producto || ''} ${a.proveedor || ''} ${a.varietales || ''}`);
      const artManual = Array.isArray(a.articulos) ? a.articulos.map(String) : [];
      let unidades = 0, importe = 0, costo = 0;
      const skus = new Map(); // sku -> {descripcion, unidades, importe}
      for (const v of ventas) {
        if (v.fecha < a.fecha_inicio || v.fecha > a.fecha_fin) continue;
        let match = false;
        if (artManual.length) match = artManual.includes(String(v.sku));
        else if (toks.length) {
          let hits = 0; for (const t of toks) if (v._txt.includes(t)) hits++;
          match = hits / toks.length >= 0.6;
        }
        if (!match) continue;
        unidades += Number(v.unidades) || 0;
        importe += Number(v.importe) || 0;
        costo += Number(v.costo) || 0;
        const s = skus.get(v.sku) || { sku: v.sku, descripcion: v.descripcion, unidades: 0, importe: 0 };
        s.unidades += Number(v.unidades) || 0; s.importe += Number(v.importe) || 0;
        skus.set(v.sku, s);
      }
      const margen = importe - costo;
      const seg = segmento(a.aplica_a);
      const finalizada = a.fecha_fin && a.fecha_fin < hoy;
      const topSkus = [...skus.values()].sort((x, y) => y.importe - x.importe).slice(0, 6);
      return {
        id: a.id, producto: a.producto, proveedor: a.proveedor || null, accion: a.accion,
        categoria: a.categoria, aplica_a: a.aplica_a || [], segmento: seg,
        fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin, activa: a.activa !== false, finalizada,
        objetivo_unidades: a.objetivo_unidades || null,
        unidades: Math.round(unidades), importe: Math.round(importe), margen: Math.round(margen),
        margen_pct: importe > 0 ? Math.round((margen / importe) * 1000) / 10 : null,
        cumplimiento: a.objetivo_unidades ? Math.round((unidades / a.objetivo_unidades) * 100) : null,
        skus_match: skus.size, sin_datos: skus.size === 0,
        top_skus: topSkus,
      };
    });

    // Ranking por facturación (solo con datos).
    const conDatos = out.filter((a) => !a.sin_datos).sort((x, y) => y.importe - x.importe);
    conDatos.forEach((a, i) => { a.ranking = i + 1; });

    // Comparativa por segmento comercial.
    const grupo = (seg) => {
      const items = out.filter((a) => a.segmento === seg || (seg !== 'otro' && a.segmento === 'ambos'));
      const acc = items.reduce((s, a) => { s.importe += a.importe; s.unidades += a.unidades; s.margen += a.margen; s.conDatos += a.sin_datos ? 0 : 1; return s; }, { importe: 0, unidades: 0, margen: 0, conDatos: 0 });
      return { acciones: items.length, con_datos: acc.conDatos, importe: acc.importe, unidades: acc.unidades, margen: acc.margen, margen_pct: acc.importe > 0 ? Math.round((acc.margen / acc.importe) * 1000) / 10 : null };
    };

    const totalImporte = out.reduce((s, a) => s + a.importe, 0);
    const totalMargen = out.reduce((s, a) => s + a.margen, 0);

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      rango: { desde: gDesde, hasta: gHasta },
      ventas_filas: ventas.length,
      totales: { acciones: out.length, con_datos: conDatos.length, importe: totalImporte, margen: totalMargen, margen_pct: totalImporte > 0 ? Math.round((totalMargen / totalImporte) * 1000) / 10 : null },
      grupos: { on: grupo('on'), off: grupo('off') },
      acciones: out,
    }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
