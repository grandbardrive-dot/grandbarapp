// ============================================================
//  GrandBar Hub · Background · septima-background
//  Incentivo Séptima (líneas de vino de la bodega Séptima). Por vendedor: clientes con
//  compra de las líneas participantes en el período vs objetivo, con premio.
//  Participan equipos OFF (sup Diego) y SL (sup Martín).
//
//  Reglas (planilla de Josefina):
//   - Avance = clientes distintos de la CARTERA VIGENTE del vendedor que compraron alguna
//     línea Séptima (neto > 0) en el período (septima_config desde..hasta).
//   - Vendedor: cobra si llega al 80% del objetivo (cobra el 80% del premio).
//   - Supervisor: cobra el 100% del premio si su EQUIPO llega al 80% de los compradores
//     objetivo totales del equipo.
//
//  NO llama al ERP: lee ventas_cliente (Manual) ya sincronizadas + cartera de clientes.
//  Objetivo/premio en septima_objetivo (HUB), líneas en septima_articulos, ventana en
//  septima_config.
//
//  Uso: cron 1×/día (septima-cron). Snapshot: incentivos_snapshots incentivo='SEPTIMA'.
//  Env: HUB_SERVICE_ROLE, MANUAL_ANON_KEY (o key pública Manual), DIAG_KEY (prueba).
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = () => process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const norm = v => String(v == null ? '' : v).trim().replace(/^0+/, '');
const pad8 = v => norm(v).padStart(8, '0');
const hoyAR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

function hubHeaders() {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) throw new Error('Falta HUB_SERVICE_ROLE');
  return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' };
}
const hub = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, Object.assign({}, o, { headers: Object.assign({}, hubHeaders(), o.headers || {}) }));
const man = (p, o = {}) => fetch(MAN_URL + '/rest/v1/' + p, Object.assign({}, o, { headers: Object.assign({ apikey: MAN_KEY(), Authorization: 'Bearer ' + MAN_KEY(), 'Content-Type': 'application/json' }, o.headers || {}) }));

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

async function calcular() {
  const [arts, obj, cfg, vends] = await Promise.all([
    todo(hub, 'septima_articulos?select=sku'),
    todo(hub, 'septima_objetivo?select=vendedor_codigo,equipo,es_supervisor,objetivo,premio'),
    todo(hub, 'septima_config?select=k,v'),
    todo(hub, 'penaflor_vendedores?select=codigo,nombre'),
  ]);
  if (!arts.length || !obj.length) throw new Error('Faltan artículos/objetivo de Séptima');
  const C = {}; cfg.forEach(r => { C[r.k] = r.v; });
  const desde = C.desde || '2026-10-01';
  const hasta = C.hasta || '2026-11-30';
  const corte = hoyAR() < hasta ? hoyAR() : hasta;
  const nombreOf = {}; vends.forEach(v => { nombreOf[String(v.codigo)] = v.nombre; });
  const skuSet = new Set(arts.map(a => norm(a.sku)));
  const participantes = new Set(obj.map(o => String(o.vendedor_codigo)));

  // cartera vigente: cliente -> vendedor actual
  const vendManual = await todo(man, 'vendedores?select=id,codigo');
  const codOf = {}; vendManual.forEach(v => { codOf[v.id] = String(v.codigo); });
  const clientes = await todo(man, 'clientes?select=codigo_cliente,vendedor_id');
  const cliVend = new Map();
  clientes.forEach(c => { const vc = codOf[c.vendedor_id]; if (vc) cliVend.set(String(c.codigo_cliente), vc); });

  // ventas Séptima del período
  const skus = arts.map(a => pad8(a.sku));
  const filas = [];
  const CH = 120;
  for (let i = 0; i < skus.length; i += CH) {
    const chunk = skus.slice(i, i + CH);
    const vals = [];
    chunk.forEach(s => { vals.push('"' + s + '"'); const sc = s.replace(/^0+/, ''); if (sc !== s) vals.push('"' + sc + '"'); });
    const path = 'ventas_cliente?select=cliente_codigo,sku,unidades,fecha'
      + '&fecha=gte.' + desde + '&fecha=lte.' + hasta
      + '&sku=in.(' + vals.join(',') + ')';
    const lote = await todo(man, path);
    filas.push(...lote);
  }

  // neto por (vendedor, cliente) -> contar clientes con neto>0
  const neto = new Map(); // `${vcod}|${cli}` -> unidades
  for (const f of filas) {
    if (!skuSet.has(norm(f.sku))) continue;
    const cli = String(f.cliente_codigo);
    const vc = cliVend.get(cli); if (!vc || !participantes.has(vc)) continue;
    const k = vc + '|' + cli;
    neto.set(k, (neto.get(k) || 0) + (Number(f.unidades) || 0));
  }
  const avanceDe = {}; participantes.forEach(v => avanceDe[v] = 0);
  for (const [k, n] of neto) { if (n > 0.0001) { const vc = k.split('|')[0]; avanceDe[vc] = (avanceDe[vc] || 0) + 1; } }

  const vendedores = obj.map(o => ({
    codigo: String(o.vendedor_codigo),
    nombre: nombreOf[String(o.vendedor_codigo)] || ('Vendedor ' + o.vendedor_codigo),
    equipo: o.equipo, es_supervisor: !!o.es_supervisor,
    objetivo: o.objetivo != null ? Number(o.objetivo) : null,
    premio: Number(o.premio) || 0,
    avance: avanceDe[String(o.vendedor_codigo)] || 0,
  }));

  return {
    nombre: C.nombre || 'Incentivo Séptima', desde, hasta, corte, actualizado: new Date().toISOString(),
    umbral_vendedor: Number(C.umbral_vendedor || 0.8), umbral_supervisor: Number(C.umbral_supervisor || 0.8),
    vendedores,
    control: { ventas_leidas: filas.length, clientes_cartera: cliVend.size },
  };
}

async function guardar(data) {
  const row = { incentivo: 'SEPTIMA', corte: data.corte, data, updated_at: new Date().toISOString() };
  const r = await hub('incentivos_snapshots?on_conflict=incentivo', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) });
  if (!r.ok) throw new Error('No se pudo guardar: ' + r.status + ' ' + (await r.text()).slice(0, 180));
}

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const esPrueba = q.key && process.env.DIAG_KEY && q.key === process.env.DIAG_KEY;
  try {
    const data = await calcular();
    await guardar(data);
    if (esPrueba) return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ ok: true, data }) };
    return { statusCode: 202, body: '' };
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (esPrueba) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) };
    console.error('septima-background', msg);
    return { statusCode: 202, body: '' };
  }
};
