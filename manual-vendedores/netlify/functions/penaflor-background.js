// ============================================================
//  GrandBar Hub · Background · penaflor-background
//  Calcula el AVANCE del incentivo Peñaflor (Volumen + Clientes con compra)
//  y lo guarda en incentivos_snapshots (incentivo = PENAFLOR_<mes>).
//
//  Se actualiza solo, todos los días. NO llama al ERP: lee las ventas que
//  sync-ventas ya baja cada 20 min a ventas_cliente (proyecto Manual), y la
//  cartera vigente de clientes (Manual). El objetivo por vendedor está cargado
//  en las tablas penaflor_obj_vol / penaflor_obj_ccc (HUB), sembradas con el
//  cálculo mensual de Peñaflor.
//
//  Reglas (resumen del pedido):
//   - Alcance: solo los SKU de penaflor_articulos (cruce SKU = código de artículo).
//   - Avance Volumen: unidades netas vendidas en el mes, por barra, asignadas al
//     vendedor que HOY tiene al cliente (cartera vigente), no al que facturó.
//   - Avance CCC: clientes distintos de la cartera del vendedor que compraron algún
//     artículo Peñaflor en el mes (neto > 0), por canal (según tipo de cliente).
//   - Cada venta cuenta una sola vez; la suma de vendedores da el equipo y el total.
//
//  Uso:
//   - Cron la dispara 1×/día (penaflor-cron). También se puede probar:
//       /.netlify/functions/penaflor-background?key=DIAG_KEY&mes=2026-11
//
//  Env: HUB_SERVICE_ROLE (leer objetivo + escribir snapshot), MANUAL_ANON_KEY
//       (o la key pública del Manual), DIAG_KEY (modo prueba).
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = () => process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const BARRAS = ['Vinos del año', 'Vinos de guarda', 'Espumantes', 'RTD', 'Spirits importados', 'Spirits nacionales', 'Cerveza artesanal', 'Vermouth'];
const CANALES = ['On Premise', 'On Premise Noche', 'Vinotecas', 'Tienda de Bebidas'];

// tipo de cliente del Manual -> canal de CCC. Lo que no está acá no cuenta para CCC
// (pero igual suma al volumen).
const CANAL_DE_TIPO = {
  'restaurante': 'On Premise', 'hotel': 'On Premise',
  'bar': 'On Premise Noche', 'disco': 'On Premise Noche',
  'vinoteca': 'Vinotecas',
  'tienda de bebidas': 'Tienda de Bebidas',
};

const norm = v => String(v == null ? '' : v).trim().replace(/^0+/, '');   // sin ceros
const pad8 = v => norm(v).padStart(8, '0');
const hoyAR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

function hubHeaders() {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) throw new Error('Falta HUB_SERVICE_ROLE');
  return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
}
const hub = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, Object.assign({}, opts, { headers: Object.assign({}, hubHeaders(), opts.headers || {}) }));
const man = (path, opts = {}) => fetch(MAN_URL + '/rest/v1/' + path, Object.assign({}, opts, { headers: Object.assign({ apikey: MAN_KEY(), Authorization: 'Bearer ' + MAN_KEY(), 'Content-Type': 'application/json' }, opts.headers || {}) }));

// lectura paginada genérica (Supabase corta en 1000 filas)
async function todo(fn, path) {
  const out = []; const PAG = 1000;
  for (let off = 0; off < 300000; off += PAG) {
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
  // fin de mes:
  const [y, mm] = m.split('-').map(Number);
  const hasta = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
  const corteReal = (m === hoyAR().slice(0, 7)) ? hoyAR() : hasta;

  // ---- Objetivo (HUB) ----
  const [vends, objVol, objCcc, arts] = await Promise.all([
    todo(hub, 'penaflor_vendedores?select=codigo,nombre,equipo'),
    todo(hub, 'penaflor_obj_vol?mes=eq.' + m + '&select=vendedor_codigo,equipo,barra,objetivo'),
    todo(hub, 'penaflor_obj_ccc?mes=eq.' + m + '&select=vendedor_codigo,equipo,canal,activos,objetivo'),
    todo(hub, 'penaflor_articulos?select=sku,barra'),
  ]);
  if (!vends.length || !arts.length) throw new Error('Faltan datos base (vendedores/artículos) de Peñaflor');

  const skuBarra = new Map(arts.map(a => [norm(a.sku), a.barra]));           // sku sin ceros -> barra
  const vendInfo = new Map(vends.map(v => [String(v.codigo), { nombre: v.nombre, equipo: v.equipo }]));
  const esPenaflorVend = c => vendInfo.has(String(c));

  // estructura base por vendedor (obj y avance en 0)
  const V = new Map();
  for (const v of vends) {
    const vol = {}; BARRAS.forEach(b => vol[b] = { obj: 0, av: 0 });
    const ccc = {}; CANALES.forEach(c => ccc[c] = { obj: 0, av: 0, activos: 0 });
    V.set(String(v.codigo), { codigo: String(v.codigo), nombre: v.nombre, equipo: v.equipo, vol, ccc });
  }
  objVol.forEach(o => { const v = V.get(String(o.vendedor_codigo)); if (v && v.vol[o.barra]) v.vol[o.barra].obj = Number(o.objetivo) || 0; });
  objCcc.forEach(o => { const v = V.get(String(o.vendedor_codigo)); if (v && v.ccc[o.canal]) { v.ccc[o.canal].obj = Number(o.objetivo) || 0; v.ccc[o.canal].activos = Number(o.activos) || 0; } });

  // ---- Cartera vigente (Manual): cliente -> vendedor actual + canal ----
  const vendManual = await todo(man, 'vendedores?select=id,codigo');
  const codOf = {}; vendManual.forEach(v => { codOf[v.id] = String(v.codigo); });
  const clientes = await todo(man, 'clientes?select=codigo_cliente,tipo,vendedor_id,activo');
  const cliVend = new Map();   // codigo_cliente (como viene) -> vendedor_codigo
  const cliCanal = new Map();  // codigo_cliente -> canal | null
  clientes.forEach(c => {
    const vcod = codOf[c.vendedor_id]; if (!vcod) return;
    const k = String(c.codigo_cliente);
    cliVend.set(k, vcod);
    cliCanal.set(k, CANAL_DE_TIPO[String(c.tipo || '').trim().toLowerCase()] || null);
  });

  // ---- Ventas del mes de los SKU Peñaflor (Manual) ----
  const skus = arts.map(a => pad8(a.sku));
  // PostgREST in() con muchos valores: se parte en tandas.
  const filas = [];
  const CH = 120;
  for (let i = 0; i < skus.length; i += CH) {
    const chunk = skus.slice(i, i + CH);
    // ventas_cliente.sku puede venir con o sin ceros: pedimos ambas formas.
    const vals = [];
    chunk.forEach(s => { vals.push('"' + s + '"'); const sc = s.replace(/^0+/, ''); if (sc !== s) vals.push('"' + sc + '"'); });
    const path = 'ventas_cliente?select=cliente_codigo,sku,unidades,fecha'
      + '&fecha=gte.' + desde + '&fecha=lte.' + hasta
      + '&sku=in.(' + vals.join(',') + ')';
    const lote = await todo(man, path);
    filas.push(...lote);
  }

  // ---- Reparto por cartera vigente ----
  // Volumen: unidades netas por vendedor×barra.
  // CCC: neto por (vendedor, canal, cliente); cuenta clientes con neto > 0.
  const cccNeto = new Map();  // `${vcod}|${canal}|${cli}` -> neto
  for (const f of filas) {
    const barra = skuBarra.get(norm(f.sku)); if (!barra) continue;   // no es artículo del listado
    const cli = String(f.cliente_codigo);
    const vcod = cliVend.get(cli); if (!vcod || !esPenaflorVend(vcod)) continue;  // cartera fuera del objetivo
    const u = Number(f.unidades) || 0;
    const v = V.get(vcod); if (!v) continue;
    if (v.vol[barra]) v.vol[barra].av += u;
    const canal = cliCanal.get(cli);
    if (canal) {
      const kk = vcod + '|' + canal + '|' + cli;
      cccNeto.set(kk, (cccNeto.get(kk) || 0) + u);
    }
  }
  for (const [kk, neto] of cccNeto) {
    if (neto <= 0.0001) continue;
    const [vcod, canal] = kk.split('|');
    const v = V.get(vcod); if (v && v.ccc[canal]) v.ccc[canal].av += 1;
  }

  // redondeo de unidades
  const r2 = n => Math.round(n * 100) / 100;
  const vendedores = [...V.values()].map(v => {
    BARRAS.forEach(b => v.vol[b].av = r2(v.vol[b].av));
    return v;
  });

  return {
    mes: m, corte: corteReal, actualizado: new Date().toISOString(),
    barras: BARRAS, canales: CANALES,
    vendedores,
    control: { ventas_leidas: filas.length, clientes_cartera: cliVend.size },
  };
}

async function guardar(data) {
  const incentivo = 'PENAFLOR_' + data.mes.replace('-', '_');
  const row = { incentivo, corte: data.corte, data, updated_at: new Date().toISOString() };
  const r = await hub('incentivos_snapshots?on_conflict=incentivo', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('No se pudo guardar el snapshot: ' + r.status + ' ' + (await r.text()).slice(0, 180));
  return incentivo;
}

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const esPrueba = q.key && process.env.DIAG_KEY && q.key === process.env.DIAG_KEY;
  try {
    const data = await calcular(q.mes);
    const incentivo = await guardar(data);
    if (esPrueba) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, incentivo, data }) };
    }
    return { statusCode: 202, body: '' };
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (esPrueba) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) };
    console.error('penaflor-background', msg);
    return { statusCode: 202, body: '' };
  }
};
