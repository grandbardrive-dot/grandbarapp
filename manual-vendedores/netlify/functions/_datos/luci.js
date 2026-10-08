// ============================================================
//  Datos del tablero de Luciana (export CuboVentas del ERP, familias Diageo y
//  Cinzano, ene–sep 2025 y ene–sep 2026) para reunion-marca.js.
//  Se usan MIENTRAS el relleno de ventas del sistema no llega a 2025: ahí
//  ya trae el año anterior completo, por cliente, vendedor y tipo de cliente.
//  luci-diageo-cinzano.json: filas [anio_idx(0=2025,1=2026), mes(1-9), seg,
//  marca, cliente, linea11t, neto, unidades]; cli = [codigo, nombre, vend, tipo]
//  (vendedor y tipo de la última compra). No se publica: la ruta
//  /manual-vendedores/netlify/* devuelve 404 (netlify.toml).
// ============================================================
const L = require('./luci-diageo-cinzano.json');

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Tipo de cliente de CUBO → rubro del manual (el mismo filtro de la página).
const TIPO_A_RUBRO = { bares: 'bar', restaurant: 'restaurante', cafeteria: 'restaurante', catering: 'evento', evento: 'evento', disco: 'disco', hotel: 'hotel', vinoteca: 'vinoteca', 'tienda de bebidas': 'tienda de bebidas', autoservicio: 'autoservicio', 'distribuidores y mayoristas': 'mayorista', 'empresas y particulares': 'otros' };
const rubroDeTipo = (i) => TIPO_A_RUBRO[norm(L.tipo[i])] || 'otros';

// ¿Qué marcas del tablero corresponden a la búsqueda? ("johnny" → JW Black, JW Red…)
function marcasDe(claves) {
  const ks = claves.map(norm).flatMap((k) => (k === 'walker' || k === 'j. walker' || k === 'johnnie' || k === 'johnny' ? ['jw', 'walker'] : [k]));
  return L.marca.map((m, i) => ({ m, i })).filter(({ m }) => {
    if (m === 'Complementos promo') return false;
    const w = norm(m).split(/[^a-z0-9&]+/).filter(Boolean);   // "Gordon's" → gordon, s
    return ks.some((k) => w.includes(k) || (k.length >= 4 && w.some((x) => x.startsWith(k))));
  });
}

// Meses del período pedido que entran en el tablero (solo 2026 vs 2025, ene–sep).
function mesesDe(desde, hasta) {
  const a1 = Number(desde.slice(0, 4)), a2 = Number(hasta.slice(0, 4));
  if (a1 !== 2026 || a2 !== 2026) return [];
  const m1 = Number(desde.slice(5, 7)), m2 = Number(hasta.slice(5, 7));
  const out = [];
  for (let m = Math.max(1, m1); m <= Math.min(9, m2); m++) out.push(m);
  return out;
}

function consultar({ claves, rubro, desde, hasta }) {
  const marcas = marcasDe(claves);
  const meses = mesesDe(desde, hasta);
  if (!marcas.length || !meses.length) return null;
  const setM = new Set(marcas.map((x) => x.i)), setMes = new Set(meses);
  const agg = () => ({ u: 0, n: 0, porRubro: {}, porMes: {}, porLinea: {}, porCli: new Map(), porVend: {} });
  const Y = [agg(), agg()];
  for (const r of L.rows) {
    const [y, mes, , mi, ci, , neto, uni] = r;
    if (!setM.has(mi) || !setMes.has(mes)) continue;
    const cli = L.cli[ci] || [];
    const rb = rubroDeTipo(cli[3]);
    const A = Y[y];
    const pr = A.porRubro[rb] || (A.porRubro[rb] = { u: 0, n: 0, cli: new Map() });
    pr.u += uni; pr.n += neto; pr.cli.set(ci, (pr.cli.get(ci) || 0) + neto);
    if (rubro && rb !== rubro) continue;
    A.u += uni; A.n += neto;
    const mk = String(mes).padStart(2, '0');
    A.porMes[mk] = (A.porMes[mk] || 0) + uni;
    const ln = L.marca[mi];
    const pl = A.porLinea[ln] || (A.porLinea[ln] = { u: 0, n: 0, cli: new Map() });
    pl.u += uni; pl.n += neto; pl.cli.set(ci, (pl.cli.get(ci) || 0) + neto);
    const pc = A.porCli.get(ci) || { u: 0, n: 0 }; pc.u += uni; pc.n += neto; A.porCli.set(ci, pc);
    const vn = L.vend[cli[2]] || 'Sin vendedor';
    const pv = A.porVend[vn] || (A.porVend[vn] = { u: 0, cli: new Map() }); pv.u += uni; pv.cli.set(ci, (pv.cli.get(ci) || 0) + neto);
  }
  const [P, A] = Y;
  const red = Math.round;
  const pos = (mp) => [...mp.values()].filter((v) => v > 0).length;   // clientes con compra = venta neta positiva (criterio de Luci)
  const compr = (X) => [...X.porCli.entries()].filter(([, v]) => v.n > 0);
  const setA = new Set(compr(A).map(([c]) => c)), setP = new Set(compr(P).map(([c]) => c));
  const fichaCli = (ci, v, nuevo) => { const c = L.cli[ci] || []; return { codigo: c[0], nombre: c[1], tipo: L.tipo[c[3]] || null, vendedor: L.vend[c[2]] || null, u: red(v.u), m: red(v.n), ...(nuevo != null ? { nuevo } : {}) }; };
  const par = (x, y) => ({ actual: { botellas: red(x?.u || 0), monto: red(x?.n || 0), clientes: x ? pos(x.cli) : 0 }, anterior: { botellas: red(y?.u || 0), monto: red(y?.n || 0), clientes: y ? pos(y.cli) : 0 } });
  const mesTxt = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep'];
  return {
    fuente: 'luci',
    // Proveedor = segmento del tablero de la marca (Diageo / Cinzano).
    proveedor: [...new Set(L.rows.filter((r) => setM.has(r[3])).slice(0, 200).map((r) => L.seg[r[2]]))].join(' / ') || null,
    fuente_txt: `${L.fuente}. Período usado: ${mesTxt[meses[0]]}–${mesTxt[meses[meses.length - 1]]} 2026 contra el mismo de 2025.`,
    meses_usados: meses,
    periodo_pedido_hasta: hasta,
    periodo: { desde: `2026-${String(meses[0]).padStart(2, '0')}-01`, hasta: `2026-${String(meses[meses.length - 1]).padStart(2, '0')}-${meses[meses.length - 1] === 9 ? 30 : new Date(Date.UTC(2026, meses[meses.length - 1], 0)).getUTCDate()}` },
    anterior: { desde: `2025-${String(meses[0]).padStart(2, '0')}-01`, hasta: `2025-${String(meses[meses.length - 1]).padStart(2, '0')}-${new Date(Date.UTC(2025, meses[meses.length - 1], 0)).getUTCDate()}` },
    cobertura_pct: { actual: 100, anterior: 100 },
    monto_real: true,
    productos: marcas.map(({ m }) => ({ sku: null, descripcion: m, linea: m, stock: null })),
    total: { actual: { botellas: red(A.u), monto: red(A.n), clientes: setA.size }, anterior: { botellas: red(P.u), monto: red(P.n), clientes: setP.size } },
    por_linea: [...new Set([...Object.keys(A.porLinea), ...Object.keys(P.porLinea)])].map((l) => ({ linea: l, ...par(A.porLinea[l], P.porLinea[l]) }))
      .sort((a, b) => (b.actual.botellas + b.anterior.botellas) - (a.actual.botellas + a.anterior.botellas)),
    por_rubro: [...new Set([...Object.keys(A.porRubro), ...Object.keys(P.porRubro)])].map((t) => ({ rubro: t, ...par(A.porRubro[t], P.porRubro[t]) }))
      .sort((a, b) => b.actual.botellas - a.actual.botellas),
    por_mes: { actual: A.porMes, anterior: P.porMes },
    top_clientes: compr(A).sort((a, b) => b[1].u - a[1].u).slice(0, 15).map(([ci, v]) => fichaCli(ci, v, !setP.has(ci))),
    dejaron_de_comprar: compr(P).filter(([ci]) => !setA.has(ci)).sort((a, b) => b[1].u - a[1].u).slice(0, 25).map(([ci, v]) => fichaCli(ci, v)),
    dejaron_total: [...setP].filter((c) => !setA.has(c)).length,
    nuevos: [...setA].filter((c) => !setP.has(c)).length,
    por_vendedor: Object.entries(A.porVend).map(([n, v]) => ({ vendedor: n, botellas: red(v.u), clientes: pos(v.cli), anterior: red(P.porVend[n]?.u || 0) })).sort((a, b) => b.botellas - a.botellas),
  };
}

module.exports = { consultar, marcasDe };
