// ============================================================
//  GrandBar Hub · Function · reunion-marca
//  "¿Cómo viene Johnnie Walker en Bares contra 2025?" — para la Reunión de
//  Proveedor por marca (reunion-marca.html, panel de Josefina).
//
//  GET ?q=johnny&rubro=bar&desde=2026-01-01&hasta=2026-10-07
//    q      : marca o producto en texto libre (alias: johnny/jw → "J. Walker")
//    rubro  : tipo de cliente del manual (bar, restaurante, disco, hotel,
//             evento, vinoteca, tienda de bebidas, autoservicio, mayorista,
//             otros) o vacío = todos
//    desde/hasta : período actual (default 1/1 del año → ayer). Se compara
//             contra el MISMO período del año anterior.
//  Devuelve: total y por LÍNEA de producto (para los termómetros), por rubro,
//  por mes, clientes (top / dejaron de comprar), vendedores, cobertura de los
//  datos, y para el cuestionario: acciones vigentes (catálogo + propuestas de
//  proveedores) y materiales con stock de esa marca.
//  Fuente de ventas: ventas_cliente (cliente×SKU×día, completas desde que
//  sync-ventas lee las dos empresas del ERP; días "v2" en ventas_sync_log).
//  El monto es ESTIMADO: unidades × precio neto promedio del SKU en el mes.
//  Solo lectura, con claves públicas (Manual + Catálogo).
// ============================================================
const MAN = ['https://fzaxwuuodseyyinveknn.supabase.co/rest/v1/', process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk'];
const CAT = ['https://zlwnoqdxendsgbfvfyue.supabase.co/rest/v1/', process.env.CATALOGO_ANON_KEY || 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4'];

async function todo([base, key], path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(base + path, { headers: { apikey: key, Authorization: 'Bearer ' + key, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(path.split('?')[0] + ': ' + (await r.text()).slice(0, 160));
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) return out;
  }
}

// Cómo le dice la gente → cómo figura en la descripción del ERP. Frase: "walker"
// solo traería también Hiram Walker, Vodka Walker y Gin Walker.
const ALIAS = { johnny: 'j. walker', johnnie: 'j. walker', jonny: 'j. walker', jw: 'j. walker', walker: 'j. walker', smirnof: 'smirnoff', gordons: 'gordon' };
// En el catálogo de acciones y en materiales se escribe distinto ("J Walker", "JW").
const CLAVES_ACCION = { 'j. walker': ['walker', 'jw', 'johnnie', 'johnny'] };
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'x', 'ml']);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (q) => norm(q).replace(/[^a-z0-9. ]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t)).map((t) => ALIAS[t] || t);
const pg = (t) => `"*${t.replace(/"/g, '')}*"`;   // valor entre comillas: admite espacios y puntos
const iso = (d) => d.toISOString().slice(0, 10);
const menosUnAnio = (s) => `${Number(s.slice(0, 4)) - 1}${s.slice(4)}`.replace('-02-29', '-02-28');
const normCod = (c) => String(c || '').trim().replace(/^0+/, '') || '0';

// Línea de producto para el termómetro: sin envase, tamaño ni "Estuche … + 2 vasos".
function linea(desc) {
  return String(desc || '')
    .replace(/\s*\+.*$/, '')
    .replace(/\bx\s*\d+([.,]\d+)?\s*(ml|cc|lt|l|cl)\.?/ig, '')
    .replace(/\b(whisky|vodka|gin|ron|aperitivo|estuche|vap|lata|icon|label|nr|np|botella)\b\.?/ig, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/[^\s]+/g, (w) => (/^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));   // "18 Años" = "18 años"
}

// Rubro del cliente → canal de las acciones del catálogo / rubro de las propuestas.
const ON = ['bar', 'restaurante', 'hotel', 'disco', 'evento'], OFF = ['vinoteca', 'tienda de bebidas', 'autoservicio'];
const canalDe = (r) => (ON.includes(r) ? 'on' : OFF.includes(r) ? 'off' : r === 'mayorista' ? 'mayorista' : null);
const rubroPropuesta = (r) => (r === 'tienda de bebidas' ? 'tienda_bebidas' : r);

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  const out = (code, o) => ({ statusCode: code, headers, body: JSON.stringify(o) });
  const q = (event && event.queryStringParameters) || {};
  const toks = tokens(q.q);
  if (!toks.length) return out(400, { error: 'Falta ?q= (marca o producto)' });
  const rubro = q.rubro ? norm(q.rubro) : '';
  const claves = [...new Set(toks.flatMap((t) => CLAVES_ACCION[t] || [t]))];

  const hoyART = new Date(Date.now() - 3 * 3600e3);
  const ayer = iso(new Date(hoyART.getTime() - 864e5));
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(q.desde || '') ? q.desde : `${ayer.slice(0, 4)}-01-01`;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(q.hasta || '') ? (q.hasta > ayer ? ayer : q.hasta) : ayer;
  const pDesde = menosUnAnio(desde), pHasta = menosUnAnio(hasta);

  try {
    // ── Acciones y materiales (para el cuestionario), en paralelo con las ventas ──
    const orAcc = claves.map((c) => `nombre_producto.ilike.${encodeURIComponent(pg(c))},info_adicional.ilike.${encodeURIComponent(pg(c))}`).join(',');
    const orProp = claves.map((c) => `titulo.ilike.${encodeURIComponent(pg(c))},condicion.ilike.${encodeURIComponent(pg(c))},descripcion.ilike.${encodeURIComponent(pg(c))}`).join(',');
    const orMat = claves.map((c) => `name.ilike.${encodeURIComponent(pg(c))},producto_asociado.ilike.${encodeURIComponent(pg(c))}`).join(',');
    const pAcc = todo(CAT, `catalogo_acciones?select=nombre_producto,mecanica,porcentaje_off,precio_accionado,precio_regular,sugerido_venta,info_adicional,vigente_hasta,canal,placa_url,catalogo_proveedores(nombre)&activo=eq.true&or=(${orAcc})`).catch(() => []);
    const pProp = todo(MAN, `propuestas_acciones?select=titulo,condicion,descripcion,rubro,seccion,subseccion,vigencia_desde,vigencia_hasta,cajas_disponibles,autor_empresa,estado&estado=in.(aprobada,pendiente)&or=(${orProp})&order=created_at.desc`).catch(() => []);
    const pMat = todo(MAN, `materials_with_stock?select=name,stock_actual,unit_type,canales,rubros,instrucciones,processed_image_url,original_image_url&is_active=eq.true&or=(${orMat})`).catch(() => []);

    // ── 1) SKUs de la marca: todas las palabras en la descripción. Solo bebidas. ──
    const filtro = toks.map((t) => `descripcion.ilike.${encodeURIComponent(pg(t))}`).join(',');
    const prods = (await todo(MAN, `productos_grandbar?select=codigo,descripcion,stock&and=(${filtro})`))
      .filter((p) => /^(01|02|05|07|08|13)/.test(p.codigo));
    const [accionesRaw, propuestas, materiales] = await Promise.all([pAcc, pProp, pMat]);
    const canal = canalDe(rubro);
    // "Todas las marcas MENOS J Walker" no es una acción de J Walker.
    const excluye = (nombre) => claves.some((c) => new RegExp(`\\b(menos|excepto|salvo)\\b[^.]*${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(norm(nombre)));
    const acciones = accionesRaw
      .filter((a) => !excluye(a.nombre_producto))
      .filter((a) => !canal || !a.canal || a.canal === 'ambos' || a.canal === canal)
      .map((a) => ({ ...a, proveedor: a.catalogo_proveedores && a.catalogo_proveedores.nombre, catalogo_proveedores: undefined }));
    const props = propuestas.filter((p) => !rubro || !p.rubro || p.rubro === rubroPropuesta(rubro));
    const base = { ok: true, q: q.q, tokens: toks, rubro: rubro || 'todos', periodo: { desde, hasta }, anterior: { desde: pDesde, hasta: pHasta }, acciones, propuestas: props, materiales };
    if (!prods.length) return out(200, { ...base, productos: [], nota: 'No encontré productos con ese nombre en el maestro del ERP.' });
    const skus = prods.map((p) => p.codigo);
    const descDe = new Map(prods.map((p) => [p.codigo, p.descripcion]));
    const inSku = `sku=in.(${skus.join(',')})`;

    // ── 2) Ventas por cliente (los dos períodos) + precios + cobertura ──
    const [act, ant, precios, logs] = await Promise.all([
      todo(MAN, `ventas_cliente?select=cliente_codigo,sku,fecha,unidades&${inSku}&fecha=gte.${desde}&fecha=lte.${hasta}`),
      todo(MAN, `ventas_cliente?select=cliente_codigo,sku,fecha,unidades&${inSku}&fecha=gte.${pDesde}&fecha=lte.${pHasta}`),
      todo(MAN, `ventas_articulos?select=sku,fecha,unidades,importe&${inSku}&fecha=gte.${pDesde}&fecha=lte.${hasta}`),
      todo(MAN, `ventas_sync_log?select=desde&ok=eq.true&detalle=like.v2*&or=(and(desde.gte.${desde},desde.lte.${hasta}),and(desde.gte.${pDesde},desde.lte.${pHasta}))`),
    ]);
    const pm = new Map(), pmSku = new Map();
    for (const v of precios) {
      if (!(v.unidades > 0)) continue;
      for (const [m, k] of [[pm, `${v.sku}|${v.fecha.slice(0, 7)}`], [pmSku, v.sku]]) {
        const a = m.get(k) || { u: 0, i: 0 }; a.u += v.unidades; a.i += Number(v.importe) || 0; m.set(k, a);
      }
    }
    const precio = (sku, fecha) => { const a = pm.get(`${sku}|${fecha.slice(0, 7)}`) || pmSku.get(sku); return a && a.u ? a.i / a.u : 0; };

    // ── 3) Rubro y vendedor de cada cliente (manual) ──
    const codigos = [...new Set([...act, ...ant].map((v) => v.cliente_codigo))];
    const clientes = new Map();
    for (let i = 0; i < codigos.length; i += 150) {
      const lote = codigos.slice(i, i + 150);
      for (const c of await todo(MAN, `clientes?select=codigo_cliente,nombre,tipo,vendedor_id&codigo_cliente=in.(${lote.map(encodeURIComponent).join(',')})`)) clientes.set(normCod(c.codigo_cliente), c);
    }
    const vids = [...new Set([...clientes.values()].map((c) => c.vendedor_id).filter(Boolean))];
    const vend = new Map((vids.length ? await todo(MAN, `vendedores?select=id,nombre&id=in.(${vids.join(',')})`) : []).map((v) => [v.id, v.nombre]));

    // ── 4) Agregar ──
    const agregar = (rows) => {
      const r = { u: 0, m: 0, porRubro: {}, porMes: {}, porLinea: {}, porCliente: new Map(), porVend: {} };
      for (const v of rows) {
        const c = clientes.get(normCod(v.cliente_codigo)) || { nombre: `Cliente ${v.cliente_codigo}`, tipo: 'sin dato' };
        const tipo = norm(c.tipo || 'sin dato');
        const u = Number(v.unidades) || 0, m = u * precio(v.sku, v.fecha);
        const rb = r.porRubro[tipo] || (r.porRubro[tipo] = { u: 0, m: 0, cli: new Set() });
        rb.u += u; rb.m += m; if (u > 0) rb.cli.add(v.cliente_codigo);
        if (rubro && tipo !== rubro) continue;
        r.u += u; r.m += m;
        const mes = v.fecha.slice(5, 7);
        r.porMes[mes] = (r.porMes[mes] || 0) + u;
        const ln = linea(descDe.get(v.sku));
        const pl = r.porLinea[ln] || (r.porLinea[ln] = { u: 0, m: 0, cli: new Set() });
        pl.u += u; pl.m += m; if (u > 0) pl.cli.add(v.cliente_codigo);
        const pc = r.porCliente.get(v.cliente_codigo) || { codigo: v.cliente_codigo, nombre: c.nombre, tipo: c.tipo, vendedor: vend.get(c.vendedor_id) || null, u: 0, m: 0 };
        pc.u += u; pc.m += m; r.porCliente.set(v.cliente_codigo, pc);
        const vn = vend.get(c.vendedor_id) || 'Sin vendedor';
        const pv = r.porVend[vn] || (r.porVend[vn] = { u: 0, cli: new Set() }); pv.u += u; if (u > 0) pv.cli.add(v.cliente_codigo);
      }
      return r;
    };
    const A = agregar(act), P = agregar(ant);
    const red = Math.round;
    const compradores = (r) => [...r.porCliente.values()].filter((c) => c.u > 0);
    const cA = compradores(A), cP = compradores(P);
    const setA = new Set(cA.map((c) => c.codigo)), setP = new Set(cP.map((c) => c.codigo));
    const hechos = new Set(logs.map((l) => l.desde));
    const cob = (a, b) => { let n = 0, t = 0; for (let d = new Date(a + 'T12:00:00Z'); iso(d) <= b; d = new Date(d.getTime() + 864e5)) { t++; if (hechos.has(iso(d))) n++; } return t ? Math.round((n / t) * 100) : 0; };
    const par = (x, y) => ({ actual: { botellas: red(x?.u || 0), monto: red(x?.m || 0), clientes: x?.cli ? x.cli.size : 0 }, anterior: { botellas: red(y?.u || 0), monto: red(y?.m || 0), clientes: y?.cli ? y.cli.size : 0 } });

    return out(200, {
      ...base,
      cobertura_pct: { actual: cob(desde, hasta), anterior: cob(pDesde, pHasta) },
      productos: prods.map((p) => ({ sku: p.codigo, descripcion: p.descripcion, linea: linea(p.descripcion), stock: p.stock })),
      total: { actual: { botellas: red(A.u), monto: red(A.m), clientes: cA.length }, anterior: { botellas: red(P.u), monto: red(P.m), clientes: cP.length } },
      por_linea: [...new Set([...Object.keys(A.porLinea), ...Object.keys(P.porLinea)])].map((l) => ({ linea: l, ...par(A.porLinea[l], P.porLinea[l]) }))
        .sort((a, b) => (b.actual.botellas + b.anterior.botellas) - (a.actual.botellas + a.anterior.botellas)),
      por_rubro: [...new Set([...Object.keys(A.porRubro), ...Object.keys(P.porRubro)])].map((t) => ({ rubro: t, ...par(A.porRubro[t], P.porRubro[t]) }))
        .sort((a, b) => b.actual.botellas - a.actual.botellas),
      por_mes: { actual: A.porMes, anterior: P.porMes },
      top_clientes: cA.sort((a, b) => b.u - a.u).slice(0, 15).map((c) => ({ ...c, u: red(c.u), m: red(c.m), nuevo: !setP.has(c.codigo) })),
      dejaron_de_comprar: cP.filter((c) => !setA.has(c.codigo)).sort((a, b) => b.u - a.u).slice(0, 25).map((c) => ({ ...c, u: red(c.u), m: red(c.m) })),
      nuevos: cA.filter((c) => !setP.has(c.codigo)).length,
      por_vendedor: Object.entries(A.porVend).map(([n, v]) => ({ vendedor: n, botellas: red(v.u), clientes: v.cli.size, anterior: red(P.porVend[n]?.u || 0) })).sort((a, b) => b.botellas - a.botellas),
    });
  } catch (e) {
    return out(500, { error: (e && e.message) || String(e) });
  }
};
