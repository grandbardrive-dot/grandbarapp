// ============================================================
//  GrandBar Hub · Background · plan11t-background
//  Calcula los REALES del Plan 11T de Peñaflor (CCC por canal + por marca/línea)
//  y los escribe en penaflor_11t_reporte (Manual), que ya leen admin-11t, el
//  reporte de Fernando y la tarjeta de supervisores. Reemplaza subir el Excel:
//  los reales salen solos de las ventas; lo ÚNICO que se carga 1×/mes son los
//  OBJETIVOS (tabla objetivos_11t en HUB), que Peñaflor define cada mes.
//
//  Fuentes:
//   - objetivos_11t (HUB): objetivo por canal (tipo='ccc', linea='__CCC__') y por
//     línea (tipo 11t/innovacion). Lo carga Josefina con los números de Peñaflor.
//   - penaflor_11t_skus (Manual): mapeo SKU → línea 11T (marca).
//   - ventas_cliente (Manual, que baja sync-ventas) + clientes (canal por tipo).
//
//  CCC por canal (real) = clientes distintos del canal que compraron alguna marca
//  11T en el mes (neto > 0). Por línea = clientes distintos del canal por marca.
//
//  Cron: plan11t-cron (1×/día). Prueba: ?key=DIAG_KEY&mes=2026-11 (devuelve 202 por
//  ser -background; validar leyendo penaflor_11t_reporte en Supabase).
//  Env: HUB_SERVICE_ROLE (leer objetivos), MANUAL_ANON_KEY (leer/escribir Manual).
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = () => process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const CANAL_DE_TIPO = {
  'restaurante': 'on_premise', 'hotel': 'on_premise',
  'bar': 'on_premise_noche', 'disco': 'on_premise_noche',
  'vinoteca': 'vinotecas', 'tienda de bebidas': 'tienda_bebidas',
};
const CANALES = ['vinotecas', 'tienda_bebidas', 'on_premise', 'on_premise_noche'];
const norm = s => String(s == null ? '' : s).replace(/^0+/, '');
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

function hubHeaders() {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) throw new Error('Falta HUB_SERVICE_ROLE');
  return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
}
const hub = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, Object.assign({}, opts, { headers: Object.assign({}, hubHeaders(), opts.headers || {}) }));
const man = (path, opts = {}) => fetch(MAN_URL + '/rest/v1/' + path, Object.assign({}, opts, { headers: Object.assign({ apikey: MAN_KEY(), Authorization: 'Bearer ' + MAN_KEY(), 'Content-Type': 'application/json' }, opts.headers || {}) }));

async function todo(fn, path) {
  const out = []; const PAG = 1000;
  for (let off = 0; off < 400000; off += PAG) {
    const r = await fn(path + (path.includes('?') ? '&' : '?') + 'limit=' + PAG + '&offset=' + off);
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 180));
    const lote = await r.json();
    out.push(...lote);
    if (!Array.isArray(lote) || lote.length < PAG) break;
  }
  return out;
}

async function calcular(mes) {
  const m = (mes && /^\d{4}-\d{2}$/.test(mes)) ? mes : hoyAR().slice(0, 7);
  const desde = m + '-01';
  const [y, mm] = m.split('-').map(Number);
  const hasta = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);

  // ---- Objetivos (HUB) ----
  const obj = await todo(hub, 'objetivos_11t?mes=eq.' + m + '&select=canal,linea,tipo,objetivo');
  const canalObj = {}; CANALES.forEach(c => canalObj[c] = 0);
  const lineObj = {};  // canal -> { linea -> { objetivo, tipo } }
  CANALES.forEach(c => lineObj[c] = {});
  obj.forEach(o => {
    const c = o.canal;
    if (!CANALES.includes(c)) return;
    if (o.tipo === 'ccc' || o.linea === '__CCC__') { canalObj[c] = Number(o.objetivo) || 0; return; }
    lineObj[c][o.linea] = { objetivo: Number(o.objetivo) || 0, tipo: (o.tipo === 'innovacion' ? 'innovacion' : '11t') };
  });

  // ---- Mapeo SKU -> línea (Manual) ----
  const skus = await todo(man, 'penaflor_11t_skus?select=sku,linea');
  const skuLinea = new Map();
  skus.forEach(s => skuLinea.set(norm(s.sku), s.linea));

  // ---- Clientes -> canal (Manual) ----
  const clientes = await todo(man, 'clientes?select=codigo_cliente,tipo,activo&order=codigo_cliente.asc');
  const cliCanal = new Map();
  clientes.forEach(c => {
    if (c.activo === false) return;
    const canal = CANAL_DE_TIPO[String(c.tipo || '').trim().toLowerCase()];
    if (canal) cliCanal.set(String(c.codigo_cliente), canal);
  });

  // ---- Ventas del mes (Manual) ----
  const ventas = await todo(man, 'ventas_cliente?select=cliente_codigo,sku,unidades&fecha=gte.' + desde + '&fecha=lte.' + hasta + '&order=cliente_codigo.asc,sku.asc,fecha.asc');

  // ---- Reparto: clientes distintos por canal (CCC) y por canal+línea ----
  const cccSet = {}; CANALES.forEach(c => cccSet[c] = new Set());
  const lineSet = {}; CANALES.forEach(c => lineSet[c] = {});   // canal -> linea -> Set(cliente)
  for (const f of ventas) {
    if (!(Number(f.unidades) > 0)) continue;
    const linea = skuLinea.get(norm(f.sku)); if (!linea) continue;
    const cli = String(f.cliente_codigo);
    const canal = cliCanal.get(cli); if (!canal) continue;
    cccSet[canal].add(cli);
    (lineSet[canal][linea] = lineSet[canal][linea] || new Set()).add(cli);
  }

  // ---- Armar la salida con la forma que ya lee reporte-11t ----
  const ccc = {};
  const lineas = [];
  for (const c of CANALES) {
    ccc[c] = { real: cccSet[c].size, objetivo: canalObj[c] };
    // líneas: todas las que tienen objetivo o real
    const nombres = new Set([...Object.keys(lineObj[c]), ...Object.keys(lineSet[c])]);
    for (const linea of nombres) {
      const real = (lineSet[c][linea] ? lineSet[c][linea].size : 0);
      const o = lineObj[c][linea] || { objetivo: 0, tipo: '11t' };
      lineas.push({ canal: c, tipo: o.tipo, linea, real, objetivo: o.objetivo });
    }
  }

  return {
    mes: m,
    data: { ccc, lineas },
    filas: lineas.length,
    actualizado: new Date().toISOString(),
    archivo: 'automático',
    control: { ventas_leidas: ventas.length, skus_mapeados: skuLinea.size, clientes_canal: cliCanal.size },
  };
}

async function guardar(res) {
  const payload = { mes: res.mes, data: res.data, filas: res.filas, actualizado: res.actualizado, archivo: res.archivo };
  const r = await man('penaflor_11t_reporte?on_conflict=mes', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('No se pudo guardar penaflor_11t_reporte: ' + r.status + ' ' + (await r.text()).slice(0, 180));
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const qp = (event && event.queryStringParameters) || {};
    const res = await calcular(qp.mes);
    await guardar(res);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mes: res.mes, ccc: res.data.ccc, control: res.control }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: (e && e.message) || String(e) }) };
  }
};

try { module.exports.handler = require('./_errores').conErrores('plan11t-background', module.exports.handler); } catch (e) {}
