// ============================================================
//  GrandBar Hub · Function · incentivos
//   Planes de incentivos de proveedores vs objetivo, para supervisores
//   y Marketing/Dirección.
//   Proveedores:
//    - Campari · "Cobertura": por producto, Target vs Avance → % cumplimiento.
//      Objetivo GLOBAL de la empresa. Fuente: tabla cobertura_productos (editable).
//    - Campari · "Plan 5T": por cada marca del portfolio, cuántos clientes del
//      equipo la tienen; por vendedor y detalle cliente×marca. Cada supervisor ve
//      SOLO sus vendedores/clientes. Fuente: HUB (usuarios) + Manual (clientes/
//      vendedores) + Sheet 5T (el mismo que lee la visita).
//    - Pernod Ricard · "Q4 2026 · Clientes con compra": por objetivo (marca×canal)
//      meta/logrado/cerca/promo + por vendedor. Fuente: incentivos_snapshots.
//    - El Torneo Doña Paula (terminó el 16/11/2026) se sacó de Incentivos el 19/11/2026, en todos
//      los paneles (pedido del usuario). El resultado final sigue guardado en incentivos_snapshots
//      (DP_TORNEO_2026), sin tocar.
//   Env: HUB_SERVICE_ROLE (o token del usuario).
// ============================================================

const { regionDe } = require('./_equipo.js');
const { traerTodo } = require('./_paginar.js');
const { excluidos, esExcluido } = require('./_vendedores-excluidos');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

// 5T = las 5 marcas del portfolio Campari (SIN Cinzano desde 11/2026). "Tener la marca" =
// que el cliente la haya COMPRADO en el período (se calcula de las ventas con la RPC
// cobertura_5t del Manual; ya NO se lee el Google Sheet).
const MARCAS_5T = [['aperol', 'Aperol'], ['campari', 'Campari'], ['cynar', 'Cynar'], ['skyy', 'Skyy Inf'], ['others', 'Others']];
// Objetivo = clientes a los que CADA vendedor puede venderle Campari (su universo real).
// OFF Mendoza SOLO puede venderle a VINOTECAS (no autoservicios ni tiendas de bebidas), así que
// su universo es fijo (dato de Comercial, nov-2026): 015 Ojer, 027 Gimenez, 024 Franso, 047 López, 011 Sebastianelli.
// El resto (ON Mendoza + todo San Luis) le puede vender a TODOS sus clientes → objetivo = sus clientes activos.
const CAMPARI_OBJETIVO_OFF = { '015': 52, '027': 68, '024': 59, '047': 25, '011': 65 };

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const pct = (a, t) => t > 0 ? Math.round(100 * a / t) : 0;
const qvals = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');
const normCod = x => (String(x == null ? '' : x).trim().replace(/^0+/, '') || '0');


// Clientes ACTIVOS de los vendedores del equipo, desde el Manual (con nombre y vendedor).
async function clientesDelEquipo(codigos) {
  const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON }, (o && o.headers) || {}) });
  const out = new Map(); // codigo_cliente (con ceros, como en ventas_cliente) -> { nombre, vcod }
  try {
    const vends = await (await man('vendedores?codigo=in.(' + qvals(codigos) + ')&select=id,codigo')).json();
    if (!Array.isArray(vends) || !vends.length) return out;
    const codOf = {}; vends.forEach(v => { codOf[v.id] = String(v.codigo); });
    const ids = vends.map(v => '"' + v.id + '"').join(',');
    const [cli, est] = await Promise.all([
      traerTodo(man, 'clientes?vendedor_id=in.(' + ids + ')&select=codigo_cliente,nombre,vendedor_id,activo&order=codigo_cliente.asc'),
      traerTodo(man, 'clientes_estado?select=codigo,activo&order=codigo.asc'),
    ]);
    const estMap = {}; (Array.isArray(est) ? est : []).forEach(r => { estMap[String(r.codigo)] = r.activo; });
    (Array.isArray(cli) ? cli : []).forEach(c => {
      const vcod = codOf[c.vendedor_id]; if (!vcod) return;
      const k = String(c.codigo_cliente);
      const activo = (k in estMap) ? estMap[k] : (c.activo !== false);
      if (activo && !out.has(k)) out.set(k, { nombre: c.nombre || ('Cliente ' + k), vcod });
    });
  } catch (e) {}
  return out;
}

// Plan 5T: cobertura de las 5 marcas Campari por cliente, DIRECTO de las ventas
// (RPC cobertura_5t del Manual = última compra de cada marca en los últimos 3 meses).
// Devuelve dos períodos para filtrar en la UI: '3m' (últimos 3 meses) y 'mes' (mes actual).
async function plan5T(codigos, nombreDeCod, alcance) {
  if (!codigos.length) return null;
  const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, Object.assign({}, o, { headers: Object.assign({ apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON, 'Content-Type': 'application/json' }, (o && o.headers) || {}) }));
  const clientes = await clientesDelEquipo(codigos);
  if (!clientes.size) return null;
  // Objetivo por vendedor: OFF Mza = universo fijo (vinotecas); el resto = sus clientes activos.
  const activosPorVend = {}; for (const [, info] of clientes) { activosPorVend[info.vcod] = (activosPorVend[info.vcod] || 0) + 1; }
  const objetivoDe = (vcod) => (CAMPARI_OBJETIVO_OFF[String(vcod)] != null) ? CAMPARI_OBJETIVO_OFF[String(vcod)] : (activosPorVend[String(vcod)] || 0);
  // cobertura_5t trae UNA fila por cliente (las 5 fechas como columnas) SIN filtrar por códigos:
  // filtrar por miles de códigos hacía timeout (Luciana/Dirección ven toda la empresa). Acá se
  // filtra en memoria contra `clientes`. (Fix 19/11/2026)
  let rows = [];
  try { rows = await (await man('rpc/cobertura_5t', { method: 'POST', body: '{}' })).json(); } catch (e) {}
  if (!Array.isArray(rows)) rows = [];
  const porCli = {}; rows.forEach(r => { porCli[r.cliente_codigo] = { aperol: r.aperol, campari: r.campari, cynar: r.cynar, skyy: r.skyy, others: r.others }; });
  const d = new Date();
  const mesDesde = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-01';

  function armar(okFecha) {
    const filas = [];
    for (const [cod, info] of clientes) {
      const mc = porCli[cod]; if (!mc) continue;
      const marcas = {}; MARCAS_5T.forEach(([k]) => { marcas[k] = !!(mc[k] && okFecha(mc[k])); });
      const tiene = MARCAS_5T.filter(([k]) => marcas[k]).length;
      if (!tiene) continue; // universo = clientes que compran Campari en el período
      const faltan = MARCAS_5T.filter(([k]) => !marcas[k]).map(([, n]) => n);
      filas.push({ codigo: cod, nombre: info.nombre, vendedor: info.vcod, vendedor_nombre: nombreDeCod[info.vcod] || info.vcod, marcas, tiene, faltan });
    }
    filas.sort((a, b) => a.tiene - b.tiene || (a.vendedor_nombre || '').localeCompare(b.vendedor_nombre || ''));
    const universo = filas.length;
    const porMarca = MARCAS_5T.map(([k, n]) => { const si = filas.filter(f => f.marcas[k]).length; return { k, n, si, tot: universo, pct: universo ? Math.round(100 * si / universo) : 0 }; });
    const casillerosSi = porMarca.reduce((a, m) => a + m.si, 0), casillerosTot = universo * MARCAS_5T.length;
    const completos = filas.filter(f => f.tiene >= 4).length;
    const vmap = {};
    // Siembro todos los vendedores con su objetivo (aparecen aunque tengan 0 avance).
    Object.keys(activosPorVend).forEach(vcod => { vmap[vcod] = { codigo: vcod, nombre: nombreDeCod[vcod] || vcod, clientes: 0, completos: 0, objetivo: objetivoDe(vcod) }; });
    filas.forEach(f => { const v = vmap[f.vendedor] || (vmap[f.vendedor] = { codigo: f.vendedor, nombre: f.vendedor_nombre, clientes: 0, completos: 0, objetivo: objetivoDe(f.vendedor) }); v.clientes++; if (f.tiene >= 4) v.completos++; });
    // Cumplimiento (Opción A): clientes con 4+ de 5 ÷ clientes a los que puede venderle Campari.
    const porVendedor = Object.values(vmap).map(v => ({ ...v, pct: pct(v.completos, v.objetivo) })).sort((a, b) => b.pct - a.pct);
    const objetivoTotal = Object.values(vmap).reduce((a, v) => a + (v.objetivo || 0), 0);
    // % general = clientes con 4+ de 5 sobre los que COMPRAN Campari (universo), misma base que
    // "por marca" (pedido de Josefina 25/11). El objetivoTotal queda como contexto (cobro por vendedor).
    return { universo, completos, objetivoTotal, pct: pct(completos, universo), casillerosSi, casillerosTot, porMarca, porVendedor, clientes: filas };
  }
  const p3 = armar(() => true);
  const pMes = armar(f => f >= mesDesde);
  return Object.assign({
    id: 'campari5t', nombre: 'Convivencia',
    detalle: 'Convivencia Campari: el objetivo es que cada cliente tenga al menos 4 de las 5 marcas (Aperol, Campari, Cynar, Skyy Inf, Others). Filtrá por últimos 3 meses o mes actual.',
    marcas: MARCAS_5T.map(([k, n]) => ({ k, n })),
    periodos: { '3m': p3, 'mes': pMes },
    avanceTotal: p3.completos, targetTotal: p3.objetivoTotal,
    actualizado: new Date().toISOString(),
  }, p3);
}

// Peñaflor · Volumen (botellas) + Clientes con compra (CCC). Objetivo por vendedor en las
// tablas penaflor_obj_* (carga mensual); avance diario calculado por penaflor-background y
// guardado en incentivos_snapshots. Cada portal ve SU nivel (suma de vendedores = equipo =
// total; cada venta una sola vez):
//   vendedor → lo suyo · supervisor → su equipo (detalle por vendedor) ·
//   Compras (Luciana) → Distribución (detalle por cuenta) · Dirección → total (detalle por equipo).
const PF_EQNOM = { ON: 'Equipo ON', OFF: 'Equipo OFF', SL: 'San Luis', DIST: 'Distribución' };
async function penaflor(hub, perfil) {
  const rol = String(perfil.rol || '').toLowerCase();
  const cod = perfil.codigo_vendedor != null ? String(perfil.codigo_vendedor) : null;
  const esSup = !!perfil.es_supervisor;
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const incentivo = 'PENAFLOR_' + hoy.slice(0, 7).replace('-', '_');
  const snap = (await (await hub('incentivos_snapshots?incentivo=eq.' + incentivo + '&select=corte,data,updated_at')).json())[0];
  if (!snap || !snap.data || !Array.isArray(snap.data.vendedores)) return null;
  const d = snap.data, barras = d.barras || [], canales = d.canales || [], all = d.vendedores;
  const pI = (a, t) => t > 0 ? Math.round(100 * a / t) : 0;

  let subset = [], detalle = 'none', nivel = '';
  if (esSup) {
    const yo = all.find(v => v.codigo === cod); const eq = yo ? yo.equipo : null;
    if (!eq) return null;
    subset = all.filter(v => v.equipo === eq); detalle = 'vendedor'; nivel = PF_EQNOM[eq] || eq;
  } else if (['direccion', 'admin', 'diseno', 'torneo', 'desarrollo', 'compras'].includes(rol)) {
    subset = all; detalle = 'equipo'; nivel = 'Toda la empresa';
  } else if (rol === 'ventas' || rol === 'mayorista') {
    subset = all.filter(v => v.codigo === cod); detalle = 'none'; nivel = 'Tu objetivo';
  } else return null;
  if (!subset.length) return null;

  const barraSuma = (keys, metric) => keys.map(k => {
    let obj = 0, av = 0; subset.forEach(v => { const o = (v[metric] && v[metric][k]) || {}; obj += o.obj || 0; av += o.av || 0; });
    return { nombre: k, obj, av, pct: pI(av, obj) };
  });
  const volBar = barraSuma(barras, 'vol'), cccBar = barraSuma(canales, 'ccc');
  const volA = volBar.reduce((a, x) => a + x.av, 0), volT = volBar.reduce((a, x) => a + x.obj, 0);
  const cccA = cccBar.reduce((a, x) => a + x.av, 0), cccT = cccBar.reduce((a, x) => a + x.obj, 0);

  const filasVend = metric => subset.map(v => {
    let obj = 0, av = 0; (metric === 'vol' ? barras : canales).forEach(k => { const o = (v[metric] && v[metric][k]) || {}; obj += o.obj || 0; av += o.av || 0; });
    return { nombre: v.nombre, av, obj, pct: pI(av, obj) };
  }).sort((a, b) => b.pct - a.pct || b.av - a.av);
  const filasEq = metric => {
    const g = {}; subset.forEach(v => { const e = v.equipo; g[e] = g[e] || { obj: 0, av: 0 }; (metric === 'vol' ? barras : canales).forEach(k => { const o = (v[metric] && v[metric][k]) || {}; g[e].obj += o.obj || 0; g[e].av += o.av || 0; }); });
    return Object.entries(g).map(([e, x]) => ({ nombre: PF_EQNOM[e] || e, av: x.av, obj: x.obj, pct: pI(x.av, x.obj) })).sort((a, b) => b.av - a.av);
  };
  const det = metric => detalle === 'vendedor' ? filasVend(metric) : (detalle === 'equipo' ? filasEq(metric) : null);
  const detTit = detalle === 'vendedor' ? (nivel === 'Distribución' ? 'Por cuenta' : 'Por vendedor') : (detalle === 'equipo' ? 'Por equipo' : '');

  const planVol = {
    id: 'volumen', tipo: 'penaflor', nombre: 'Volumen', unidad: 'botellas',
    detalle: 'Botellas vendidas vs. objetivo, por línea de producto.',
    corte: d.corte, barras: volBar, avanceTotal: volA, targetTotal: volT, pct: pI(volA, volT),
    det: { titulo: detTit, filas: det('vol') },
  };
  const planCcc = {
    id: 'ccc', tipo: 'penaflor', nombre: 'Clientes con compra', unidad: 'clientes',
    detalle: 'Clientes que compraron Peñaflor vs. objetivo, por canal.',
    corte: d.corte, barras: cccBar, pct: pI(cccA, cccT), cccAv: cccA, cccObj: cccT,
    det: { titulo: detTit, filas: det('ccc') },
  };
  return { id: 'penaflor', nombre: 'Peñaflor', color: '#7A1F2B', cardPct: pI(volA, volT), nivel, actualizado: d.actualizado, planes: [planVol, planCcc] };
}

// Séptima · incentivo por vendedor: clientes con compra de las líneas Séptima (Oct–Nov) vs
// objetivo, con premio. Avance en snapshot 'SEPTIMA' (septima-background). Participan OFF (sup
// Diego) y SL (sup Martín). Vendedor cobra con 80% del objetivo; supervisor cobra 100% si su
// equipo llega al 80% de los compradores objetivo.
const PF_SEPEQ = { OFF: 'Equipo OFF', SL: 'San Luis', ON: 'Equipo ON', DIST: 'Distribución' };
async function septima(hub, perfil) {
  const rol = String(perfil.rol || '').toLowerCase();
  const cod = perfil.codigo_vendedor != null ? String(perfil.codigo_vendedor) : null;
  const esSup = !!perfil.es_supervisor;
  const snap = (await (await hub('incentivos_snapshots?incentivo=eq.SEPTIMA&select=corte,data')).json())[0];
  if (!snap || !snap.data || !Array.isArray(snap.data.vendedores)) return null;
  const d = snap.data, all = d.vendedores;
  const pI = (a, t) => t > 0 ? Math.round(100 * a / t) : 0;
  const umbV = d.umbral_vendedor || 0.8, umbS = d.umbral_supervisor || 0.8;

  let subset = [], vista = '';
  if (esSup && all.some(v => v.codigo === cod && v.es_supervisor)) {
    const eq = all.find(v => v.codigo === cod).equipo;
    subset = all.filter(v => v.equipo === eq); vista = 'equipo';
  } else if (['direccion', 'admin', 'diseno', 'torneo', 'desarrollo', 'compras'].includes(rol)) {
    subset = all; vista = 'todo';
  } else if (rol === 'ventas' || rol === 'mayorista') {
    if (!all.some(v => v.codigo === cod && !v.es_supervisor)) return null;
    subset = all.filter(v => v.codigo === cod); vista = 'vendedor';
  } else return null;
  if (!subset.length) return null;

  const eqs = [...new Set(subset.map(v => v.equipo))];
  const grupos = eqs.map(eq => {
    const miembros = subset.filter(v => v.equipo === eq && !v.es_supervisor);
    const sup = subset.find(v => v.equipo === eq && v.es_supervisor);
    const filas = miembros.map(v => ({
      nombre: v.nombre, avance: v.avance, objetivo: v.objetivo, premio: v.premio,
      pct: pI(v.avance, v.objetivo || 0), cobra: v.objetivo ? (v.avance >= v.objetivo * umbV) : false,
    })).sort((a, b) => b.pct - a.pct);
    const teamObj = filas.reduce((a, f) => a + (f.objetivo || 0), 0);
    const teamAv = filas.reduce((a, f) => a + f.avance, 0);
    return {
      equipo: eq, nombreEq: PF_SEPEQ[eq] || eq, filas, teamObj, teamAv, teamPct: pI(teamAv, teamObj),
      supervisor: sup ? { nombre: sup.nombre, premio: sup.premio, cobra: teamObj ? (teamAv >= teamObj * umbS) : false } : null,
    };
  });
  const totObj = grupos.reduce((a, g) => a + g.teamObj, 0), totAv = grupos.reduce((a, g) => a + g.teamAv, 0);

  const plan = {
    id: 'septima', tipo: 'septima', nombre: 'Séptima',
    detalle: (d.nombre || 'Incentivo Séptima') + '. Clientes con compra de las líneas Séptima vs. objetivo.',
    desde: d.desde, hasta: d.hasta, corte: d.corte, vista,
    umbralV: Math.round(umbV * 100), umbralS: Math.round(umbS * 100),
    grupos, avanceTotal: totAv, targetTotal: totObj, pct: pI(totAv, totObj),
  };
  return { id: 'septima', nombre: 'Séptima', color: '#7A2E4A', cardPct: pI(totAv, totObj), actualizado: d.actualizado, planes: [plan] };
}

// Incentivo Malibu + Beefeater Familia (ON Trade): objetivo POR VENDEDOR (tabla ontrade_objetivos)
// vs avance AUTOMÁTICO (clientes con compra de cada producto, por cartera vigente del vendedor).
const ONT_EQ  = { '029':'ON','039':'ON','025':'ON','007':'ON','031':'MAY','017':'SL','041':'SL','032':'MAY' };
const ONT_SUP = { '005':'ON','011':'OFF','010':'SL' };
async function ontrade(hub, perfil) {
  const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, Object.assign({}, o, { headers: Object.assign({ apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON, 'Content-Type': 'application/json' }, (o && o.headers) || {}) }));
  let objRows, cfgRows;
  try {
    [objRows, cfgRows] = await Promise.all([
      (await hub('ontrade_objetivos?select=vendedor_codigo,vendedor_nombre,producto,objetivo')).json(),
      (await hub('ontrade_config?select=k,v')).json(),
    ]);
  } catch (e) { return null; }
  if (!Array.isArray(objRows) || !objRows.length) return null;
  const C = {}; (Array.isArray(cfgRows) ? cfgRows : []).forEach(r => { C[r.k] = r.v; });
  const desde = C.desde || '2026-10-01', hasta = C.hasta || '2026-12-31';
  let av = [];
  try { av = await (await man('rpc/ontrade_avance', { method: 'POST', body: JSON.stringify({ desde, hasta }) })).json(); } catch (e) {}
  const avMap = {}; (Array.isArray(av) ? av : []).forEach(r => { (avMap[r.cod] = avMap[r.cod] || {})[r.producto] = num(r.clientes); });
  const vmap = {};
  objRows.forEach(r => { const v = vmap[r.vendedor_codigo] || (vmap[r.vendedor_codigo] = { codigo: r.vendedor_codigo, nombre: r.vendedor_nombre || r.vendedor_codigo, obj: {} }); v.obj[r.producto] = num(r.objetivo); });

  const rol = String(perfil.rol || '').toLowerCase();
  const cod = perfil.codigo_vendedor != null ? String(perfil.codigo_vendedor) : null;
  const esSup = !!perfil.es_supervisor;
  let codigos = Object.keys(vmap), nivel = 'Toda la empresa';
  if (['direccion', 'admin', 'diseno', 'torneo', 'desarrollo', 'compras'].includes(rol)) { /* todos */ }
  else if (esSup) { const eq = ONT_SUP[cod]; if (!eq) return null; codigos = codigos.filter(c => ONT_EQ[c] === eq); nivel = 'Tu equipo'; }
  else if (rol === 'ventas' || rol === 'mayorista') { if (!vmap[cod]) return null; codigos = [cod]; nivel = 'Tu objetivo'; }
  else return null;
  if (!codigos.length) return null;

  const filas = codigos.map(c => {
    const v = vmap[c], a = avMap[c] || {};
    const mal = { obj: num(v.obj.malibu), av: num(a.malibu) }; mal.pct = pct(mal.av, mal.obj);
    const bee = { obj: num(v.obj.beefeater_fam), av: num(a.beefeater_fam) }; bee.pct = pct(bee.av, bee.obj);
    const tObj = mal.obj + bee.obj, tAv = mal.av + bee.av;
    return { codigo: c, nombre: v.nombre, malibu: mal, beef: bee, totObj: tObj, totAv: tAv, pct: pct(tAv, tObj) };
  }).sort((x, y) => y.pct - x.pct || (x.nombre || '').localeCompare(y.nombre || ''));
  const sum = k1 => filas.reduce((s, f) => s + f[k1].obj, 0), suma = k1 => filas.reduce((s, f) => s + f[k1].av, 0);
  const malObj = sum('malibu'), malAv = suma('malibu'), beeObj = sum('beef'), beeAv = suma('beef');
  const plan = {
    id: 'ontrade', tipo: 'ontrade', nombre: C.nombre || 'Malibu + Beefeater · ON Trade',
    detalle: 'Clientes con compra de Malibu y Beefeater Familia por vendedor (su cartera) vs objetivo. Avance automático, período Oct–Dic.',
    desde, hasta, nivel, filas,
    malibu: { obj: malObj, av: malAv, pct: pct(malAv, malObj) },
    beef: { obj: beeObj, av: beeAv, pct: pct(beeAv, beeObj) },
    avanceTotal: malAv + beeAv, targetTotal: malObj + beeObj, pct: pct(malAv + beeAv, malObj + beeObj),
  };
  return { id: 'ontrade', nombre: 'Malibu + Beefeater', color: '#1F447F', cardPct: plan.pct, planes: [plan] };
}

exports.handler = async (event) => {
  try {
    const hubService = process.env.HUB_SERVICE_ROLE;
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const hub = (path) => fetch(HUB_URL + '/rest/v1/' + path, { headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) } });
    const perfil = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,canal,region,codigo_vendedor,es_supervisor')).json())[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    const esSup = !!perfil.es_supervisor;
    // Supervisores → su equipo. Marketing/Dirección/Trade → toda la empresa (panorama).
    const VER_TODO = ['diseno', 'admin', 'direccion', 'torneo', 'compras', 'desarrollo'];
    const esVendedor = !esSup && (rol === 'ventas' || rol === 'mayorista');
    // Solo vendedores, supervisores y Dirección/Marketing acceden.
    if (!esSup && !VER_TODO.includes(rol) && !esVendedor) return json(403, { error: 'Solo para supervisores y Dirección/Marketing.' });
    // Vendedores (24/11/2026): ven TODOS los planes como los supervisores —Campari (Cobertura global
    // + Convivencia de SUS clientes), Pernod (Q4 + ON Trade), Peñaflor, Séptima y Chandon—, scopeados
    // a su propia cartera (antes solo veían Peñaflor/Séptima/ON Trade). Torneo Doña Paula: fuera 19/11.

    // Equipo (para el Plan 5T): vendedor = solo su cartera; supervisor = su región + canal; el resto = todos.
    // Vendedores excluidos (25/11/2026, archivo de SHARE): no van en la lista (_vendedores-excluidos.js).
    const EX = await excluidos();
    const eq = await (await hub('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,canal,region')).json();
    const pc = String(perfil.canal || '').toLowerCase(), preg = regionDe(perfil);
    const equipo = (Array.isArray(eq) ? eq : []).filter(u => !esExcluido(EX, u.codigo_vendedor)).filter(u => {
      if (esVendedor) return String(u.codigo_vendedor) === String(perfil.codigo_vendedor);  // solo él
      if (!esSup) return true;                                // Dirección/Marketing: ve todo
      if (preg && regionDe(u) !== preg) return false;
      const uc = String(u.canal || '').toLowerCase();
      return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
    }).filter(u => u.codigo_vendedor);
    const nombreDeCod = {}; equipo.forEach(v => { nombreDeCod[String(v.codigo_vendedor)] = v.nombre; });
    const codigos = equipo.map(v => String(v.codigo_vendedor));

    const base = { nombre: perfil.nombre, region: perfil.region, canal: perfil.canal, alcance: esSup ? 'equipo' : (esVendedor ? 'vendedor' : 'todo'), codigo: perfil.codigo_vendedor || null, generado: new Date().toISOString() };
    const proveedores = [];

    // ---- Campari (dos planes: Cobertura + 5T) ----
    const campariPlanes = [];

    // Plan 1: Cobertura (tabla cobertura_productos, objetivo global)
    try {
      let [rows, cfg] = await Promise.all([
        (await hub('cobertura_productos?select=producto,orden,color,target,avance&order=orden.asc')).json(),
        (await hub('club_campari_config?select=k,v')).json(),
      ]);
      if (Array.isArray(rows) && rows.length) {
        const C = {}; (Array.isArray(cfg) ? cfg : []).forEach(r => { C[r.k] = r.v; });
        const productos = rows.map(r => {
          const target = num(r.target), avance = num(r.avance);
          return { nombre: r.producto, color: r.color || '#c79a3b', target, avance, pct: pct(avance, target) };
        });
        const targetTotal = productos.reduce((a, p) => a + p.target, 0);
        const avanceTotal = productos.reduce((a, p) => a + p.avance, 0);
        // Anillo = clientes DISTINTOS que compran alguna de las 5 marcas vs objetivo global.
        const clientesObj = num(C.objetivo_clientes), clientesAv = num(C.avance_clientes);
        campariPlanes.push({
          id: 'cobertura', nombre: 'Cobertura',
          detalle: 'Objetivo global de la empresa: clientes que compran Campari (alguna de las 5 marcas) en el Q, y la cobertura por producto.',
          productos, targetTotal, avanceTotal,
          clientesObj, clientesAv, pct: pct(clientesAv, clientesObj),
        });
      }
    } catch (e) {}

    // Plan 2: 5T (Sheet + equipo/clientes)
    try {
      const p5 = await plan5T(codigos, nombreDeCod, base.alcance);
      if (p5) campariPlanes.push(p5);
    } catch (e) {}

    if (campariPlanes.length) proveedores.push({ id: 'campari', nombre: 'Campari', color: '#C8102E', planes: campariPlanes });

    // ---- Pernod Ricard · Q4 2026 (incentivos_snapshots) ----
    try {
      const snap = (await (await hub('incentivos_snapshots?incentivo=eq.PR_Q4_2026&select=corte,data,updated_at')).json())[0];
      if (snap && snap.data) {
        const d = snap.data;
        const objetivos = (d.objetivos || []).map(o => ({
          id: o.id, nombre: o.nombre, meta: num(o.meta), logrado: num(o.logrado),
          faltan: num(o.faltan != null ? o.faltan : Math.max(0, num(o.meta) - num(o.logrado))),
          con_promo: num(o.con_promo), cerca: num(o.cerca), pct: pct(num(o.logrado), num(o.meta)),
        }));
        const metaTotal = objetivos.reduce((a, o) => a + o.meta, 0);
        const logradoTotal = objetivos.reduce((a, o) => a + o.logrado, 0);
        const vendedores = (d.vendedores || []).slice().sort((a, b) => num(b.logrado_total) - num(a.logrado_total));
        const pernodPlanes = [{
          id: 'pr_q4', nombre: d.nombre || 'Q4 2026', detalle: d.detalle || '',
          corte: d.corte || snap.corte,
          objetivos, vendedores,
          targetTotal: metaTotal, avanceTotal: logradoTotal, pct: pct(logradoTotal, metaTotal),
        }];
        // Plan 2 de Pernod: Malibu + Beefeater Familia ON Trade (objetivo POR VENDEDOR vs avance automático)
        try { const ot = await ontrade(hub, perfil); if (ot && ot.planes) pernodPlanes.push(...ot.planes); } catch (e) {}
        proveedores.push({ id: 'pernod', nombre: 'Pernod Ricard', color: '#1F447F', planes: pernodPlanes });
      }
    } catch (e) {}

    // ---- Peñaflor · Volumen + Clientes con compra (snapshot diario, por nivel) ----
    try { const pf = await penaflor(hub, perfil); if (pf) proveedores.push(pf); } catch (e) {}

    // ---- Séptima · clientes con compra vs objetivo, con premio (snapshot diario) ----
    try { const sp = await septima(hub, perfil); if (sp) proveedores.push(sp); } catch (e) {}

    // ---- Chandon · Plan mes corriente (surtido + clientes con compra por grupo) ----
    // Objetivo GLOBAL de la empresa, Mendoza + San Luis juntos (NO se separa por vendedor).
    // Lee las ventas del mes directo del Manual (no llama al ERP), igual que la Cobertura Campari.
    try {
      const { calcularChandon, PROVEEDOR } = require('./incentivo-chandon.js');
      const ch = await calcularChandon({});
      if (ch && Array.isArray(ch.grupos) && ch.grupos.length) {
        ch.avanceTotal = ch.grupos.reduce((a, g) => a + (g.surtido.avance || 0), 0);
        ch.targetTotal = ch.grupos.reduce((a, g) => a + (g.surtido.objetivo || 0), 0);
        ch.pct = pct(ch.avanceTotal, ch.targetTotal);
        proveedores.push({ id: PROVEEDOR.id, nombre: PROVEEDOR.nombre, color: PROVEEDOR.color, planes: [ch] });
      }
    } catch (e) {}

    return json(200, Object.assign(base, { proveedores }));
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
