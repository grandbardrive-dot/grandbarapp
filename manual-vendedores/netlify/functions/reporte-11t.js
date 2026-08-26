// ============================================================
//  GrandBar · Netlify Function · reporte-11t
//  Cruza las ventas por cliente (ventas_cliente, del ERP) con los
//  objetivos del 11T (objetivos_11t) para armar el reporte: por canal,
//  por línea comercial → Real (clientes que compraron) / Objetivo /
//  Alcance / Faltan. Consolidado del equipo + apertura por vendedor.
//
//  "Real" = clientes DISTINTOS que compraron cualquier producto de esa
//  línea en el mes. Cruce por nombre (descripción del ERP) con reglas.
//  Todo lee de fzaxwuuodseyyinveknn. GET  ?mes=YYYY-MM (default: mes actual)
// ============================================================

const SB_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SB_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
async function getAll(path) {
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Range: `${from}-${from + page - 1}` } });
    const arr = await r.json().catch(() => []);
    if (!Array.isArray(arr) || !arr.length) break;
    out.push(...arr);
    if (arr.length < page) break;
    if (out.length > 200000) break;
  }
  return out;
}

// Rubro del cliente → canal del plan 11T.
const TIPO_CANAL = {
  vinoteca: 'vinotecas',
  autoservicio: 'tienda_bebidas', kiosco: 'tienda_bebidas',
  restaurante: 'on_premise', hotel: 'on_premise',
  bar: 'on_premise_noche', disco: 'on_premise_noche', discoteca: 'on_premise_noche',
};

function norm(s) {
  return String(s == null ? '' : s).toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Reglas de match por línea (normalizadas). inc = todas presentes; exc = ninguna;
// reqAny = al menos una. Si una línea no está acá, se usa su propio nombre como inc.
const REGLAS = {
  'ALMA MORA':            { inc: ['ALMA MORA'], exc: ['LOW'] },
  'MEDALLA':              { inc: ['MEDALLA'], exc: ['ESPUMANTE'] },
  'FOND DE CAVE':         { inc: ['FOND DE CAVE'], exc: ['RESERVA'] },
  'FOND DE CAVE RESERVA': { inc: ['FOND DE CAVE RESERVA'] },
  'CAZADOR':              { inc: ['CAZADOR'], exc: ['ROSADO'] },
  'DON DAVID':            { inc: ['DON DAVID'], exc: ['LOW', 'RED BLEND'] },
  'DADA':                 { inc: ['DADA'], exc: ['EXTRA BRUT', 'SIDRA', 'LOW', 'TINTO DE VERANO'] },
  'GORDON S':             { inc: ['GORDON'], exc: ['TROPICAL', 'PINK'] },
  'TANQUERAY':            { inc: ['TANQUERAY'], exc: ['SEVILLA', 'RANGPUR', 'ROYALE', 'FLOR', 'BOSSA', 'NOVA'] },
  'EL ESTECO':            { inc: ['ESTECO'], reqAny: ['ESTATE', 'OLD VINES'], exc: ['BLEND DE EXTREMOS'] },
  'BLEND DE EXTREMOS':    { inc: ['BLEND DE EXTREMOS'], exc: ['PINOT'] },
  'NC ESPUMANTES':        { inc: ['NAVARRO CORREAS'], exc: ['LATA'] },
  'NAVARRO CORREAS LATA': { inc: ['NAVARRO CORREAS', 'LATA'] },
  'ANTARES':              { inc: ['ANTARES'], exc: ['XPA', '330', '660', 'LAGER'] },
  'LOS INTOCABLES':       { inc: ['INTOCABLES'], exc: ['OAK'] },
  'SMIRNOFF':             { inc: ['SMIRNOFF'], exc: ['ICE', 'FLAVOR', 'GREEN', 'RASPBERRY', 'APPLE', 'TAMARINDO', 'WATERMELON', 'TROPICAL', 'GRAPEFRUIT', 'TANGE', 'RUBY', 'LEMONGRASS', 'FRUITS', 'COMBO', 'NEUTRO'] },
  'SMIRNOFF FLAVORS':     { inc: ['SMIRNOFF'], exc: ['21', 'ICE', 'NEUTRO', 'COMBO'] },
  'SMIRNOFF ICE':         { inc: ['SMIRNOFF', 'ICE'] },
  'JW BLACK':             { inc: ['WALKER', 'BLACK'], exc: ['DOUBLE'] },
  'JW GOLD RESERVE':      { inc: ['WALKER', 'GOLD'] },
  'JW RED':               { inc: ['WALKER', 'RED'] },
  'LA MASCOTA':           { inc: ['MASCOTA'] },
  'TRAPICHE RESERVA':     { inc: ['TRAPICHE RESERVA'] },
  'COSTA PAMPA':          { inc: ['COSTA', 'PAMPA'] },
  'ARBOLES BLANCO Y ROSADO': { inc: ['ARBOLES'] },
  'GORDON S TROPICAL':    { inc: ['GORDON', 'TROPICAL'] },
  'FRIZZE MANZANA':       { inc: ['FRIZZE'] },
};
function reglaDe(lineaNorm) {
  if (REGLAS[lineaNorm]) return REGLAS[lineaNorm];
  return { inc: lineaNorm.split(' ').filter((t) => t.length >= 2) };  // default: nombre entero
}
function cumple(txt, regla) {
  if (regla.inc && !regla.inc.every((t) => txt.includes(t))) return false;
  if (regla.exc && regla.exc.some((t) => txt.includes(t))) return false;
  if (regla.reqAny && !regla.reqAny.some((t) => txt.includes(t))) return false;
  return true;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const q = (event && event.queryStringParameters) || {};
    const hoy = new Date();
    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : (hoy.getUTCFullYear() + '-' + String(hoy.getUTCMonth() + 1).padStart(2, '0'));
    const desde = mes + '-01';
    const finMes = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10);

    const [objetivos, artic, ventas, clientes, vendedores] = await Promise.all([
      getAll(`objetivos_11t?mes=eq.${mes}&select=canal,linea,tipo,objetivo`),
      getAll(`ventas_articulos?select=sku,descripcion,marca,familia_nombre&fecha=gte.${desde}&fecha=lte.${finMes}`),
      getAll(`ventas_cliente?select=cliente_codigo,sku&fecha=gte.${desde}&fecha=lte.${finMes}`),
      getAll('clientes?select=codigo_cliente,tipo,vendedor_id'),
      getAll('vendedores?select=id,nombre,codigo'),
    ]);

    // Diccionario sku -> texto (para el match por nombre).
    const skuTxt = {};
    for (const a of artic) if (a.sku && !skuTxt[a.sku]) skuTxt[a.sku] = norm(`${a.descripcion || ''} ${a.marca || ''} ${a.familia_nombre || ''}`);

    // Líneas objetivo distintas → su regla. sku -> línea (más específica gana).
    const lineasSet = new Map(); // lineaNorm -> {nombre, regla}
    for (const o of objetivos) { const ln = norm(o.linea); if (!lineasSet.has(ln)) lineasSet.set(ln, { nombre: o.linea, regla: reglaDe(ln) }); }
    const skuLinea = {}; // sku -> lineaNorm
    for (const [sku, txt] of Object.entries(skuTxt)) {
      let mejor = null, mejorPeso = 0;
      for (const [ln, { regla }] of lineasSet) {
        if (cumple(txt, regla)) { const peso = (regla.inc || []).join('').length; if (peso > mejorPeso) { mejorPeso = peso; mejor = ln; } }
      }
      if (mejor) skuLinea[sku] = mejor;
    }

    // Mapas de cliente.
    const cliInfo = {}; // codigo -> {canal, vendedor_id}
    for (const c of clientes) { const canal = TIPO_CANAL[String(c.tipo || '').toLowerCase()]; if (canal) cliInfo[String(c.codigo_cliente)] = { canal, vendedor: c.vendedor_id }; }
    const venNombre = {}; for (const v of vendedores) venNombre[v.id] = { nombre: v.nombre, codigo: v.codigo };

    // Agregar: (canal|linea) -> Set(cliente) ; (canal|linea|vendedor) -> Set(cliente)
    const realCanal = {}, realVend = {};
    for (const row of ventas) {
      const ln = skuLinea[row.sku]; if (!ln) continue;
      const ci = cliInfo[String(row.cliente_codigo)]; if (!ci) continue;
      const kC = ci.canal + '|' + ln;
      (realCanal[kC] = realCanal[kC] || new Set()).add(row.cliente_codigo);
      const kV = ci.canal + '|' + ln + '|' + (ci.vendedor || 'sin');
      (realVend[kV] = realVend[kV] || new Set()).add(row.cliente_codigo);
    }

    // Armar salida por canal, respetando el orden/tipo de objetivos.
    const CANALES = ['vinotecas', 'tienda_bebidas', 'on_premise', 'on_premise_noche'];
    const CANAL_L = { vinotecas: 'Vinotecas', tienda_bebidas: 'Tienda de Bebidas', on_premise: 'On Premise', on_premise_noche: 'On Premise Noche' };
    const salida = {};
    for (const canal of CANALES) salida[canal] = { label: CANAL_L[canal], t11: [], innov: [], tot: { real: 0, objetivo: 0 } };

    // vendedores que participan por canal (para el desglose)
    for (const o of objetivos) {
      const ln = norm(o.linea);
      const real = (realCanal[o.canal + '|' + ln] || new Set()).size;
      // desglose por vendedor
      const porVend = [];
      for (const [id, v] of Object.entries(venNombre)) {
        const rv = (realVend[o.canal + '|' + ln + '|' + id] || new Set()).size;
        if (rv > 0) porVend.push({ vendedor: v.nombre, codigo: v.codigo, real: rv });
      }
      porVend.sort((a, b) => b.real - a.real);
      const fila = {
        linea: o.linea, tipo: o.tipo, real, objetivo: o.objetivo,
        alcance: o.objetivo > 0 ? Math.round((real / o.objetivo) * 100) : (real > 0 ? 100 : 0),
        faltan: Math.max(0, (o.objetivo || 0) - real),
        por_vendedor: porVend,
      };
      const grp = salida[o.canal]; if (!grp) continue;
      (o.tipo === 'innovacion' ? grp.innov : grp.t11).push(fila);
      grp.tot.real += real; grp.tot.objetivo += o.objetivo || 0;
    }
    for (const canal of CANALES) { const t = salida[canal].tot; t.alcance = t.objetivo > 0 ? Math.round((t.real / t.objetivo) * 100) : 0; t.faltan = Math.max(0, t.objetivo - t.real); }

    // Total general (solo 11T).
    const total = { real: 0, objetivo: 0 };
    for (const canal of CANALES) salida[canal].t11.forEach((f) => { total.real += f.real; total.objetivo += f.objetivo; });
    total.alcance = total.objetivo > 0 ? Math.round((total.real / total.objetivo) * 100) : 0;
    total.faltan = Math.max(0, total.objetivo - total.real);

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, mes, actualizado: new Date().toISOString(),
      ventas_filas: ventas.length, skus_mapeados: Object.keys(skuLinea).length,
      total, canales: salida,
    }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
