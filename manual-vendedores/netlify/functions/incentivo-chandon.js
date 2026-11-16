// ============================================================
//  GrandBar Hub · Function · incentivo-chandon
//  Plan Chandon · MES CORRIENTE
//   Por grupo de productos: Surtido (unidades) y Clientes con compra (CCC),
//   objetivo vs avance vs %. Más 3 promedios: surtido, clientes y avance del mes.
//   No se separa por vendedor. Mendoza + San Luis juntos.
//
//  Fuente: ventas_cliente (proyecto Manual), que ya actualiza sync-ventas cada 20 min.
//  NO llama al ERP. Solo lee Supabase.
//
//  Uso:
//   - MODO PRUEBA (solo lectura, protegido con DIAG_KEY):
//       /.netlify/functions/incentivo-chandon?key=DIAG_KEY&hasta=2026-11-15&detalle=1
//       hasta   = fecha de corte AAAA-MM-DD (opcional; default = hoy en Argentina)
//       detalle = 1 → agrega unidades por SKU y clientes por grupo (para controlar)
//   - PRODUCCIÓN: incentivos.js hace require('./incentivo-chandon') y llama
//       calcularChandon() para sumar el plan a la lista de proveedores.
//
//  Env: MANUAL_SERVICE_ROLE (lectura de ventas), DIAG_KEY (modo prueba).
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';

// ===================== CONFIGURACIÓN DEL PLAN =====================
// Todo lo que define el plan está acá. El cálculo de abajo no se toca.

const PROVEEDOR = { id: 'chandon', nombre: 'Chandon', color: '#B08D57' };

const CONFIG = {
  id: 'chandon_mes',
  nombre: 'Plan Chandon · Mes corriente',
  detalle: 'Surtido (unidades) y clientes con compra por grupo de productos, contra el objetivo del mes.',

  // Familias BODEGA CHANDON (0118) y CHANDON (0252), por prefijo de código de artículo.
  // Se usan para detectar SKUs nuevos de la bodega que todavía no tienen grupo asignado.
  prefijos_bodega: ['0118', '0252'],

  // Cliente con compra (CCC): cuenta si sus unidades netas del mes en el grupo son >= este número.
  min_unidades_ccc: 1,

  // Consumidor Final: se excluyen de TODO (no suman unidades ni cuentan como cliente).
  clientes_excluidos: ['09689', '09627', '09690', '09691', '09692', '02068', '09687', '10012', '03600'],

  // Grupos, en el orden en que se muestran. mandatorio = se resalta.
  grupos: [
    { id: 'EB',   nombre: 'Extra Brut',       obj_unidades: 3100, obj_clientes: 98, mandatorio: false },
    { id: 'DEL',  nombre: 'Delice',           obj_unidades: 2600, obj_clientes: 40, mandatorio: false },
    { id: 'APE',  nombre: 'Aperitif',         obj_unidades: 300,  obj_clientes: 25, mandatorio: true  },
    { id: 'BRO',  nombre: 'Brut Rose',        obj_unidades: 320,  obj_clientes: 26, mandatorio: false },
    { id: 'DRO',  nombre: 'Delice Rose',      obj_unidades: 360,  obj_clientes: 20, mandatorio: false },
    { id: 'BAR',  nombre: 'Baron B.',         obj_unidades: 900,  obj_clientes: 38, mandatorio: false },
    { id: 'TOR',  nombre: 'Terrazas Origen',  obj_unidades: 54,   obj_clientes: 4,  mandatorio: false },
    { id: 'TRE',  nombre: 'Terrazas Reserva', obj_unidades: 136,  obj_clientes: 18, mandatorio: false },
    { id: 'ADP',  nombre: 'Altos del Plata',  obj_unidades: 120,  obj_clientes: 8,  mandatorio: false },
    { id: 'L33',  nombre: 'Latitud 33',       obj_unidades: 3100, obj_clientes: 65, mandatorio: true  },
    { id: 'HEN',  nombre: 'Hennessy',         obj_unidades: 7,    obj_clientes: 5,  mandatorio: false },
    { id: 'L33S', nombre: 'Latitud 33 SPK',   obj_unidades: 420,  obj_clientes: 15, mandatorio: false },
  ],

  // SKU → grupo. Código del ERP con ceros a la izquierda (8 dígitos).
  skus: {
    // EB
    '01180177': 'EB', // Chandon Extra Brut NP Magnum x 1500 ml
    '01180171': 'EB', // Chandon Extra Brut NP x 187 ml
    '01180178': 'EB', // Chandon Extra Brut NP x 3000 ml
    '01180173': 'EB', // CHANDON EXTRA BRUT NP x 375 ml
    '01180170': 'EB', // Chandon Extra Brut NP x 750 ml
    '01180176': 'EB', // Estuche Chandon Extra Brut Magnum NP x 1500 ml
    '01180174': 'EB', // Estuche Chandon Extra Brut NP 1 x 750 ml
    '01180175': 'EB', // Estuche Chandon Extra Brut NP 2 Copas + 2 x 750 ml
    '01180156': 'EB', // Promo Chandon Extra Brut Magnum 1.5lt
    '01180138': 'EB', // Promo Chandon Extra Brut x 750ml ON
    // DEL
    '01180187': 'DEL', // Chandon Delice NP x 187 ml
    '01180188': 'DEL', // Chandon Delice NP x 375ml
    '01180186': 'DEL', // Chandon Delice NP x 750ml
    // APE
    '01180190': 'APE', // Chandon Aperitif NP x 187 ml
    '01180191': 'APE', // Chandon Aperitif NP x 375ml
    '01180189': 'APE', // Chandon Aperitif NP x 750 ml
    // BRO
    '01180183': 'BRO', // Chandon Brut Rose NP x 375ml
    '01180181': 'BRO', // Chandon Brut Rose NP x 750 ml
    '01180197': 'BRO', // Promo Chandon Brut Rose DDM x 750 ml
    // DRO
    '01180196': 'DRO', // Chandon Delice Rose NP x 750ml
    // BAR
    '01180206': 'BAR', // Baron B. Brut Nature x 750 ml
    '01180208': 'BAR', // Baron B. Brut Rosé x 750ml
    '01180202': 'BAR', // Baron B. Extra Brut x 750 ml
    '01180217': 'BAR', // Baron B. Heritage E03 x 750 ml
    '01180215': 'BAR', // Baron B. Heritage E04 x 750 ml
    '01180216': 'BAR', // Baron B. Heritage E05 Brut Rose x 750 ml
    '01180205': 'BAR', // Estuche Baron B Brut Nature 1 x 750 ml
    '01180214': 'BAR', // Estuche Baron B Brut Nature Heritage 1 x 750ml
    '01180211': 'BAR', // Estuche Baron B EB - BR - BN x 750ml
    '01180203': 'BAR', // Estuche Baron B Extra Brut 1 x 750 ml
    '01180204': 'BAR', // Estuche Baron B Magnum Extra Brut 1 x 1500 ml
    '01180201': 'BAR', // Estuche Baron B Rosé 1 x 750 ml
    // TOR
    '01182303': 'TOR', // Terrazas Origen Mal - Cab Altamira x 750ml
    '01182301': 'TOR', // Terrazas Origen Malbec Las Compuertas x 750ml
    '01182302': 'TOR', // Terrazas Origen Malbec Los Chacayes x 750ml
    // TRE
    '01180759': 'TRE', // Promo Terrazas Reserva Cabernet
    '01180753': 'TRE', // Promo Terrazas Reserva Malbec ON
    '01180752': 'TRE', // Promo Terrazas Reserva Malbec Rose DDE
    '01180758': 'TRE', // Promo Terrazas Rva. Chardonnay ON x 750ml
    '01180734': 'TRE', // Terrazas Reserva Cabernet Franc x 750 ml
    '01180709': 'TRE', // Terrazas Reserva Cabernet Sauvignon x 750 ml
    '01180708': 'TRE', // Terrazas Reserva Chardonnay x 750 ml
    '01180750': 'TRE', // Terrazas Reserva Malbec Rose x 750 ml
    '01180710': 'TRE', // Terrazas Reserva Malbec x 750 ml
    '01180756': 'TRE', // Terrazas Reserva Pinot Noir x 750 ml
    '01180751': 'TRE', // Terrazas Reserva Sauvignon Blanc x 750 ml
    '01180711': 'TRE', // Terrazas Reserva Syrah x 750 ml
    // ADP
    '01182202': 'ADP', // Altos del Plata Cabernet Sauvignon x 750 ml
    '01182201': 'ADP', // Altos del Plata Chardonnay x 750 ml
    '01182203': 'ADP', // Altos del Plata Malbec x 750 ml
    '01182204': 'ADP', // Altos del Plata Syrah x 750 ml
    '01182206': 'ADP', // Estuche Altos del Plata Malbec 1x750 ml
    // L33
    '01180502': 'L33', // Latitud 33 Cabernet Sauvignon x 750 ml
    '01180501': 'L33', // Latitud 33 Chardonnay x 750 ml
    '01182101': 'L33', // Latitud 33 Extra Brut x 750ml
    '01180503': 'L33', // Latitud 33 Malbec x 750 ml
    '01180528': 'L33', // Latitud 33 Rose x 750
    '01180505': 'L33', // Latitud 33 Sauvignon Blanc x 750 ml
    '01180531': 'L33', // Promo Latitud 33 Chardonnay ON x 750ml
    '01180537': 'L33', // Promo Latitud Cabernet OFF
    '01180534': 'L33', // Promo Latitud Cabernet x 750ml SL
    '01180529': 'L33', // Promo Latitud Malbec OFF
    '01180532': 'L33', // Promo Latitud Rose DDE
    // HEN
    '02520101': 'HEN', // Hennessy V.S. Gold Limited x 700ml
    '02520102': 'HEN', // Hennessy V.S. Luminous x 700 ml
    '02520103': 'HEN', // Hennessy V.S. x 700 ml
    '02520104': 'HEN', // Hennessy V.S.O.P. x 700 ml
    '02520105': 'HEN', // Hennessy X.O. x 700 ml
    '02520106': 'HEN', // Hennessy V.S. x 1.5lt
    // L33S
    '01182103': 'L33S', // Latitud 33 Espumante Dulce x 750ml
    '01182102': 'L33S', // Latitud 33 Espumante Rosado Dulce x 750ml
  },

  // SKUs de la bodega que van a "Otros" (no suman a ningún grupo). Se listan para que
  // no aparezcan como "SKU nuevo sin grupo".
  skus_otros: [
    '01182801', '01180193', '01182002', '01182003', '01182001', '01180192',
    '01182604', '01182603', '01180179', '01180182', '01180127', '01181404',
    '01181411', '01181802', '01181801', '01180807', '01180801', '01180194',
    '01180123', '01182506', '01182507', '01181303', '01181304', '01181301',
    '01180302', '01180305', '01180301', '01180303', '01180901', '01180904',
    '01180909', '01180910', '01180902', '01180306', '01181902', '01181901',
    '01181701', '01182403', '01182401', '01182402', '01182404', '01181513',
    '01181525', '01181522', '01181523', '01181503', '01181517', '01181509',
    '01181511', '01181524', '01182901', '02520201', '02520202', '02520204',
    '02520205', '02520206', '02520301', '02520302', '02520303', '02520304',
    '02520305', '02520307', '02520308', '02520309', '02520401', '02520402',
    '02520501', '02520502'
  ],
};
// =================== FIN CONFIGURACIÓN DEL PLAN ===================


// ---------- utilidades ----------
const norm = (v) => String(v == null ? '' : v).trim().replace(/^0+/, '');   // sin ceros a la izquierda
const pad8 = (v) => norm(v).padStart(8, '0');
const r2 = (n) => Math.round(n * 100) / 100;
const pct = (a, o) => (o > 0 ? a / o : 0);
const pctInt = (x) => Math.round(x * 100);

function hoyArgentina() {
  // Netlify corre en UTC; Argentina es UTC-3 todo el año.
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

// ---------- lectura de ventas (paginada: Supabase devuelve máx. 1000 filas por pedido) ----------
async function leerVentas(desde, hasta) {
  const key = process.env.MANUAL_SERVICE_ROLE;
  if (!key) throw new Error('Falta la variable de entorno MANUAL_SERVICE_ROLE');

  // Trae todo lo de la bodega (por prefijo). Se piden las dos formas del código
  // (con y sin ceros adelante) por si ventas_cliente.sku no viene con ceros.
  const conds = [];
  CONFIG.prefijos_bodega.forEach((p) => {
    conds.push(`sku.like.${p}*`);
    const sinCeros = p.replace(/^0+/, '');
    if (sinCeros !== p) conds.push(`sku.like.${sinCeros}*`);
  });
  const filtro = encodeURIComponent('(' + conds.join(',') + ')');
  const base = `${SB_URL}/rest/v1/ventas_cliente?select=cliente_codigo,sku,fecha,unidades,vendedor`
    + `&fecha=gte.${desde}&fecha=lte.${hasta}&or=${filtro}`
    + `&order=fecha.asc,cliente_codigo.asc,sku.asc,vendedor.asc`;

  const PAG = 1000;
  const filas = [];
  for (let offset = 0; offset < 200000; offset += PAG) {
    const r = await fetch(`${base}&limit=${PAG}&offset=${offset}`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < PAG) break;
  }
  return filas;
}

// ---------- cálculo ----------
function calcular(filas, periodo, conDetalle) {
  const skuGrupo = new Map(Object.entries(CONFIG.skus).map(([s, g]) => [norm(s), g]));
  const conocidos = new Set([...skuGrupo.keys(), ...CONFIG.skus_otros.map(norm)]);
  const excluidos = new Set(CONFIG.clientes_excluidos.map(norm));

  const unidades = {};      // grupo → unidades netas
  const netoCliente = {};   // grupo → Map(cliente → unidades netas)
  const porSku = {};        // grupo → { sku: unidades } (solo detalle)
  const sinGrupo = {};      // sku nuevo → unidades

  for (const f of filas) {
    const sku = norm(f.sku);
    const sku8 = pad8(f.sku);
    if (!CONFIG.prefijos_bodega.some((p) => sku8.startsWith(p))) continue; // otra bodega
    const cli = norm(f.cliente_codigo);
    if (!cli || excluidos.has(cli)) continue;            // Consumidor Final: fuera de todo
    const u = Number(f.unidades) || 0;
    const g = skuGrupo.get(sku);

    if (!g) {
      if (!conocidos.has(sku)) sinGrupo[sku8] = (sinGrupo[sku8] || 0) + u;
      continue; // "Otros" o SKU nuevo: no suma
    }

    unidades[g] = (unidades[g] || 0) + u;               // devoluciones restan (vienen negativas)
    if (conDetalle) {
      porSku[g] = porSku[g] || {};
      porSku[g][sku8] = (porSku[g][sku8] || 0) + u;
    }

    netoCliente[g] = netoCliente[g] || new Map();
    netoCliente[g].set(cli, (netoCliente[g].get(cli) || 0) + u);
  }

  const grupos = CONFIG.grupos.map((gr) => {
    const avU = r2(unidades[gr.id] || 0);
    const mapa = netoCliente[gr.id] || new Map();
    const minCCC = CONFIG.min_unidades_ccc;
    const avC = [...mapa.values()].filter((n) => n >= minCCC - 0.0001).length;  // neto del mes >= mínimo
    const out = {
      id: gr.id, nombre: gr.nombre, mandatorio: gr.mandatorio,
      surtido:  { objetivo: gr.obj_unidades, avance: avU, pct: pctInt(pct(avU, gr.obj_unidades)), _p: pct(avU, gr.obj_unidades) },
      clientes: { objetivo: gr.obj_clientes, avance: avC, pct: pctInt(pct(avC, gr.obj_clientes)), _p: pct(avC, gr.obj_clientes) },
    };
    if (conDetalle) {
      out.detalle = {
        unidades_por_sku: Object.fromEntries(Object.entries(porSku[gr.id] || {}).map(([k, v]) => [k, r2(v)])),
        clientes: [...mapa.entries()].map(([c, n]) => ({ cliente: c.padStart(5, '0'), neto: r2(n), cuenta: n >= CONFIG.min_unidades_ccc - 0.0001 }))
          .sort((a, b) => a.cliente.localeCompare(b.cliente)),
      };
    }
    return out;
  });

  // Promedios = promedio simple de los % de cada grupo (sin tope, sin redondear antes)
  const prom = (k) => pctInt(grupos.reduce((a, g) => a + g[k]._p, 0) / grupos.length);
  const resumen = {
    prom_surtido: prom('surtido'),
    prom_clientes: prom('clientes'),
    avance_mes: pctInt(periodo.dia / periodo.dias_mes),   // días corridos / días del mes
  };
  grupos.forEach((g) => { delete g.surtido._p; delete g.clientes._p; });

  return {
    id: CONFIG.id,
    tipo: 'surtido_ccc',
    nombre: CONFIG.nombre,
    detalle: CONFIG.detalle,
    corte: periodo.hasta,
    periodo,
    resumen,
    grupos,
    alertas: {
      skus_sin_grupo: Object.entries(sinGrupo).map(([sku, u]) => ({ sku, unidades: r2(u) })),
    },
    control: { filas_leidas: filas.length },
  };
}

// ---------- función principal (la usa incentivos.js) ----------
async function calcularChandon({ hasta, detalle } = {}) {
  const h = hasta || hoyArgentina();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) throw new Error('hasta debe ser AAAA-MM-DD');
  const [y, m, d] = h.split('-').map(Number);
  const periodo = {
    desde: `${h.slice(0, 7)}-01`,
    hasta: h,
    dia: d,
    dias_mes: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
  const filas = await leerVentas(periodo.desde, periodo.hasta);
  return calcular(filas, periodo, !!detalle);
}

// ---------- MODO PRUEBA ----------
exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (!process.env.DIAG_KEY || q.key !== process.env.DIAG_KEY) return json(401, { error: 'key inválida' });
  try {
    return json(200, await calcularChandon({ hasta: q.hasta, detalle: q.detalle === '1' }));
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};

exports.calcularChandon = calcularChandon;
exports.PROVEEDOR = PROVEEDOR;
