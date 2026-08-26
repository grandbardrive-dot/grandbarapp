// ============================================================
//  GrandBar · Netlify Function · reporte-11t
//  Reporte del plan 11T de Peñaflor. Cruza el export de ventas que sube
//  Luciana (ventas_penaflor, CuboVentas por cliente+producto) con los
//  objetivos del mes (objetivos_11t) → por canal × línea comercial:
//  Real (clientes DISTINTOS que compraron esa línea) / Objetivo / Alcance /
//  Faltan. Consolidado del equipo + apertura por vendedor.
//
//  El export ya trae tipo_cliente y vendedor por fila, así que NO necesita
//  cruzar con la tabla de clientes: el canal sale del tipo_cliente.
//  Todo lee de fzaxwuuodseyyinveknn.  GET ?mes=YYYY-MM (default: mes actual)
//        opcional &vendedor=NOMBRE  → filtra el reporte a un vendedor (supervisor)
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
    if (out.length > 400000) break;
  }
  return out;
}

// Tipo de cliente (del cubo) → canal del plan 11T. Todo lo que NO está acá
// (Empresas y Particulares, Cafetería, Catering, Autoservicio, Distribuidores
//  y Mayoristas) queda FUERA del 11T.
const TIPO_CANAL = {
  'VINOTECA': 'vinotecas',
  'TIENDA DE BEBIDAS': 'tienda_bebidas',
  'RESTAURANT': 'on_premise', 'RESTAURANTE': 'on_premise', 'HOTEL': 'on_premise',
  'BAR': 'on_premise_noche', 'BARES': 'on_premise_noche', 'DISCO': 'on_premise_noche', 'DISCOTECA': 'on_premise_noche',
};

function norm(s) {
  return String(s == null ? '' : s).toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Reglas de match por línea (nombre normalizado del objetivo → cómo reconocer
// sus productos en el nombre del artículo). inc = todos presentes; exc = ninguno;
// reqAny = al menos uno. Validadas contra el export "agosto peña".
const REGLAS = {
  'ALMA MORA LOW BLANCO':     { inc: ['ALMA MORA', 'LOW', 'BLANCO'] },
  'ALMA MORA LOW TINTO':      { inc: ['ALMA MORA', 'LOW'], reqAny: ['TINTO', 'TTO'] },
  'ALMA MORA':                { inc: ['ALMA MORA'], exc: ['LOW'] },
  'ANTARES 330':              { inc: ['ANTARES', '330'] },
  'ANTARES 660':              { inc: ['ANTARES', '660'] },
  'ANTARES XPA':              { inc: ['ANTARES', 'XPA'] },
  'ANTARES':                  { inc: ['ANTARES'], exc: ['330', '660', 'XPA', 'COPA'] },
  'ARBOLES BLANCO Y ROSADO':  { inc: ['ARBOLES'] },
  'BLEND DE EXTREMOS PINOT':  { inc: ['BLEND DE EXTREMOS', 'PINOT'] },
  'BLEND DE EXTREMOS':        { inc: ['BLEND DE EXTREMOS'], exc: ['PINOT'] },
  'CAZADOR ROSADO':           { inc: ['CAZADOR'], reqAny: ['ROSADO', 'ROSE'] },
  'CAZADOR':                  { inc: ['CAZADOR'], exc: ['ROSADO', 'ROSE'] },
  'COSTA PAMPA':              { inc: ['COSTA', 'PAMPA'] },
  'DADA EXTRA BRUT':          { inc: ['DADA', 'EXTRA BRUT'] },
  'DADA TINTO DE VERANO':     { inc: ['DADA', 'TINTO DE VERANO'] },
  'DADA SIDRA':               { inc: ['DADA', 'SIDRA'] },
  'DADA LOW WHITE':           { inc: ['DADA', 'LOW'], reqAny: ['WHITE', 'BLANCO'] },
  'DADA LOW TINTO':           { inc: ['DADA', 'LOW'], reqAny: ['TINTO', 'TTO'] },
  'DADA':                     { inc: ['DADA'], exc: ['EXTRA BRUT', 'SIDRA', 'LOW', 'TINTO DE VERANO'] },
  'DON DAVID LOW TORRONTES':  { inc: ['DON DAVID', 'LOW'] },
  'DON DAVID RED BLEND':      { inc: ['DON DAVID', 'RED BLEND'] },
  'DON DAVID':                { inc: ['DON DAVID'], exc: ['LOW', 'RED BLEND'] },
  'EL ESTECO':                { inc: ['ESTECO'], exc: ['BLEND DE EXTREMOS'] },
  'FRIZZE MANZANA':           { inc: ['FRIZZE'] },
  'FOND DE CAVE RESERVA':     { inc: ['FOND DE CAVE', 'RESERVA'] },
  'FOND DE CAVE':             { inc: ['FOND DE CAVE'], exc: ['RESERVA'] },
  'GORDON S TROPICAL':        { inc: ['GORDON', 'TROPICAL'] },
  'GORDON S':                 { inc: ['GORDON'], exc: ['TROPICAL', 'PINK'] },
  'JW BLACK':                 { inc: ['WALKER', 'BLACK'], exc: ['DOUBLE'] },
  'JW GOLD RESERVE':          { inc: ['WALKER', 'GOLD'] },
  'JW RED':                   { inc: ['WALKER', 'RED'] },
  'LA MASCOTA':               { inc: ['MASCOTA'] },
  'MEDALLA ESPUMANTE':        { inc: ['MEDALLA'], reqAny: ['BRUT', 'NATURE', 'ESPUMANTE'] },
  'MEDALLA':                  { inc: ['MEDALLA'], exc: ['BRUT', 'NATURE', 'ESPUMANTE'] },
  'NAVARRO CORREAS LATA':     { inc: ['NAVARRO CORREAS', 'LATA'] },
  'NC ESPUMANTES':            { inc: ['NAVARRO CORREAS'], exc: ['LATA', 'RVA', 'MALBEC'] },
  'TANQUERAY':                { inc: ['TANQUERAY'], exc: ['BOSSA', 'NOVA', 'SEVILLA', 'FLOR'] },
  'SMIRNOFF ICE':             { inc: ['SMIRNOFF', 'ICE'] },
  'SMIRNOFF FLAVORS':         { inc: ['SMIRNOFF'], reqAny: ['APPLE', 'GRAPEFRUIT', 'RASPBERRY', 'RUBY', 'TAMARINDO', 'TROPICAL', 'WATERMELON', 'LEMON'], exc: ['ICE', 'LATA'] },
  'SMIRNOFF':                 { inc: ['SMIRNOFF'], exc: ['ICE', 'APPLE', 'GRAPEFRUIT', 'RASPBERRY', 'RUBY', 'TAMARINDO', 'TROPICAL', 'WATERMELON', 'LEMON', 'LATA'] },
  'ALARIS':                   { inc: ['ALARIS'] },
  'TRAPICHE RESERVA':         { inc: ['TRAPICHE', 'RVA'] },
};
function reglaDe(ln) { return REGLAS[ln] || { inc: ln.split(' ').filter((t) => t.length >= 2) }; }
function cumple(txt, r) {
  if (r.inc && !r.inc.every((t) => txt.includes(t))) return false;
  if (r.exc && r.exc.some((t) => txt.includes(t))) return false;
  if (r.reqAny && !r.reqAny.some((t) => txt.includes(t))) return false;
  return true;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
  try {
    const q = (event && event.queryStringParameters) || {};
    const hoy = new Date();
    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : (hoy.getUTCFullYear() + '-' + String(hoy.getUTCMonth() + 1).padStart(2, '0'));
    const filtroVend = q.vendedor ? norm(q.vendedor) : null;

    const [objetivos, ventas, meta] = await Promise.all([
      getAll(`objetivos_11t?mes=eq.${mes}&select=canal,linea,tipo,objetivo`),
      getAll(`ventas_penaflor?mes=eq.${mes}&select=cliente_codigo,articulo,tipo_cliente,vendedor`),
      getAll(`ventas_penaflor_meta?mes=eq.${mes}&select=actualizado,filas,clientes`),
    ]);

    // Líneas objetivo distintas → su regla.
    const lineasSet = new Map(); // lineaNorm -> regla
    for (const o of objetivos) { const ln = norm(o.linea); if (!lineasSet.has(ln)) lineasSet.set(ln, reglaDe(ln)); }

    // Artículo (nombre) → línea. La línea más específica gana (mayor peso de inc).
    const artLinea = {};
    const artsSet = new Set();
    for (const v of ventas) if (v.articulo) artsSet.add(v.articulo);
    for (const art of artsSet) {
      const txt = norm(art);
      let best = null, bp = -1;
      for (const [ln, rg] of lineasSet) {
        if (cumple(txt, rg)) { const peso = (rg.inc || []).join('').length + (rg.reqAny ? 2 : 0); if (peso > bp) { bp = peso; best = ln; } }
      }
      if (best) artLinea[art] = best;
    }

    // Agregar: (canal|linea) -> Set(cliente) ; (canal|linea|vendedor) -> Set(cliente)
    const realCanal = {}, realVend = {}, vendSet = {};
    for (const row of ventas) {
      const canal = TIPO_CANAL[norm(row.tipo_cliente)]; if (!canal) continue;
      const ln = artLinea[row.articulo]; if (!ln) continue;
      const vend = (row.vendedor || 'Sin vendedor').trim();
      if (filtroVend && norm(vend) !== filtroVend) continue;
      const cli = String(row.cliente_codigo);
      (realCanal[canal + '|' + ln] = realCanal[canal + '|' + ln] || new Set()).add(cli);
      const kv = canal + '|' + ln + '|' + vend;
      (realVend[kv] = realVend[kv] || new Set()).add(cli);
      (vendSet[canal + '|' + ln] = vendSet[canal + '|' + ln] || new Set()).add(vend);
    }

    // Salida por canal, respetando el orden/tipo de los objetivos.
    const CANALES = ['vinotecas', 'tienda_bebidas', 'on_premise', 'on_premise_noche'];
    const CANAL_L = { vinotecas: 'Vinotecas', tienda_bebidas: 'Tienda de Bebidas', on_premise: 'On Premise', on_premise_noche: 'On Premise Noche' };
    const CANAL_SUB = { vinotecas: 'OFF · 1+1', tienda_bebidas: 'OFF · 1+1', on_premise: 'ON · Restaurantes y Hoteles', on_premise_noche: 'ON · Bares y Discos' };
    const salida = {};
    for (const c of CANALES) salida[c] = { label: CANAL_L[c], sub: CANAL_SUB[c], t11: [], innov: [], tot: { real: 0, objetivo: 0 } };

    for (const o of objetivos) {
      const ln = norm(o.linea);
      const real = (realCanal[o.canal + '|' + ln] || new Set()).size;
      const porVend = [];
      for (const vend of (vendSet[o.canal + '|' + ln] || [])) {
        const rv = (realVend[o.canal + '|' + ln + '|' + vend] || new Set()).size;
        if (rv > 0) porVend.push({ vendedor: vend, real: rv });
      }
      porVend.sort((a, b) => b.real - a.real);
      const objv = o.objetivo || 0;
      const fila = {
        linea: o.linea, tipo: o.tipo, real, objetivo: objv,
        alcance: objv > 0 ? Math.round((real / objv) * 100) : (real > 0 ? 100 : 0),
        faltan: Math.max(0, objv - real),
        por_vendedor: porVend,
      };
      const grp = salida[o.canal]; if (!grp) continue;
      (o.tipo === 'innovacion' ? grp.innov : grp.t11).push(fila);
    }
    // Orden dentro de cada bloque: por alcance asc (lo más rojo arriba).
    for (const c of CANALES) {
      salida[c].t11.sort((a, b) => a.alcance - b.alcance || b.objetivo - a.objetivo);
      salida[c].innov.sort((a, b) => a.alcance - b.alcance || b.objetivo - a.objetivo);
      const t = salida[c].tot;
      salida[c].t11.forEach((f) => { t.real += f.real; t.objetivo += f.objetivo; });
      t.alcance = t.objetivo > 0 ? Math.round((t.real / t.objetivo) * 100) : 0;
      t.faltan = Math.max(0, t.objetivo - t.real);
    }

    // Total general (solo 11T).
    const total = { real: 0, objetivo: 0 };
    for (const c of CANALES) { total.real += salida[c].tot.real; total.objetivo += salida[c].tot.objetivo; }
    total.alcance = total.objetivo > 0 ? Math.round((total.real / total.objetivo) * 100) : 0;
    total.faltan = Math.max(0, total.objetivo - total.real);

    // Ranking de vendedores (suma de "real" 11T de todas las líneas/canales).
    const rankVend = {};
    for (const [k, set] of Object.entries(realVend)) {
      const parts = k.split('|'); const vend = parts.slice(2).join('|');
      const esInnov = objetivos.find((o) => o.canal === parts[0] && norm(o.linea) === parts[1] && o.tipo === 'innovacion');
      if (esInnov) continue;
      rankVend[vend] = (rankVend[vend] || 0) + set.size;
    }
    const vendedores = Object.entries(rankVend).map(([vendedor, real]) => ({ vendedor, real })).sort((a, b) => b.real - a.real);

    const m0 = meta[0] || {};
    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, mes, actualizado: new Date().toISOString(),
      carga: m0.actualizado ? { fecha: m0.actualizado, filas: m0.filas, clientes: m0.clientes } : null,
      hay_datos: ventas.length > 0,
      vendedor: q.vendedor || null,
      total, canales: salida, vendedores,
    }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};
