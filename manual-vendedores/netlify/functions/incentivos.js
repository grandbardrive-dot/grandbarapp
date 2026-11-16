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
//    - Doña Paula · "Torneo Doña Paula" (FINALIZADO 16/11/2026): ranking final por sucursal.
//      Fuente: incentivos_snapshots (DP_TORNEO_2026), foto de la planilla de Administración.
//   Env: HUB_SERVICE_ROLE (o token del usuario).
// ============================================================

const { regionDe } = require('./_equipo.js');
const { traerTodo } = require('./_paginar.js');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

// Misma planilla que usa la visita (Spirits > Planes Campari 5T).
const SHEET_5T = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQqUyLV4D_AsvxDat8KRQ270n7FYsgUlWSlH-HQ1F3zLwCYuOx6vXYS9CUY3tIyGw/pub?output=csv';
const MARCAS_5T = [['aperol', 'Aperol'], ['bulldog', 'Bulldog'], ['campari', 'Campari'], ['cinzano', 'Cinzano'], ['cynar', 'Cynar'], ['skyy infussion', 'Skyy Infusions']];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const pct = (a, t) => t > 0 ? Math.round(100 * a / t) : 0;
const qvals = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');
const normCod = x => (String(x == null ? '' : x).trim().replace(/^0+/, '') || '0');

function splitCSV(line) {
  const r = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { r.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  r.push(cur.trim()); return r;
}

async function leer5T() {
  try {
    const r = await fetch(SHEET_5T);
    if (!r.ok) return new Map();
    const lines = (await r.text()).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return new Map();
    const head = splitCSV(lines[0]).map(h => h.trim().toLowerCase());
    const idx = MARCAS_5T.map(([k]) => head.indexOf(k));
    const map = new Map();
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSV(lines[i]);
      const cod = normCod(cols[0]);
      if (!cod || cod === '0') continue;
      const o = {};
      MARCAS_5T.forEach(([k], j) => { o[k] = idx[j] >= 0 && cols[idx[j]] === '1'; });
      map.set(cod, o);
    }
    return map;
  } catch (e) { return new Map(); }
}

// Clientes ACTIVOS de los vendedores del equipo, desde el Manual (con nombre y vendedor).
async function clientesDelEquipo(codigos) {
  const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON }, (o && o.headers) || {}) });
  const out = new Map(); // normCod -> { nombre, vcod }
  try {
    const vends = await (await man('vendedores?codigo=in.(' + qvals(codigos) + ')&select=id,codigo')).json();
    if (!Array.isArray(vends) || !vends.length) return out;
    const codOf = {}; vends.forEach(v => { codOf[v.id] = String(v.codigo); });
    const ids = vends.map(v => '"' + v.id + '"').join(',');
    const [cli, est] = await Promise.all([
      traerTodo(man, 'clientes?vendedor_id=in.(' + ids + ')&select=codigo_cliente,nombre,vendedor_id,activo&order=codigo_cliente.asc'),
      traerTodo(man, 'clientes_estado?select=codigo,activo&order=codigo.asc'),
    ]);
    const estMap = {}; (Array.isArray(est) ? est : []).forEach(r => { estMap[normCod(r.codigo)] = r.activo; });
    (Array.isArray(cli) ? cli : []).forEach(c => {
      const vcod = codOf[c.vendedor_id]; if (!vcod) return;
      const k = normCod(c.codigo_cliente);
      const activo = (k in estMap) ? estMap[k] : (c.activo !== false);
      if (activo && !out.has(k)) out.set(k, { nombre: c.nombre || ('Cliente ' + k), vcod });
    });
  } catch (e) {}
  return out;
}

// Plan 5T: cruza los clientes del equipo con el Sheet 5T → cobertura por marca,
// por vendedor y detalle cliente×marca. Devuelve el objeto plan (o null si no hay equipo).
async function plan5T(codigos, nombreDeCod, alcance) {
  if (!codigos.length) return null;
  const [clientes, t5] = await Promise.all([clientesDelEquipo(codigos), leer5T()]);
  const filas = [];
  for (const [cod, info] of clientes) {
    const m = t5.get(cod);
    if (!m) continue; // no está en el plan
    const faltan = MARCAS_5T.filter(([k]) => !m[k]).map(([, n]) => n);
    const tiene = MARCAS_5T.length - faltan.length;
    filas.push({ codigo: cod, nombre: info.nombre, vendedor: info.vcod, vendedor_nombre: nombreDeCod[info.vcod] || info.vcod, marcas: m, tiene, faltan });
  }
  filas.sort((a, b) => a.tiene - b.tiene || (a.vendedor_nombre || '').localeCompare(b.vendedor_nombre || ''));

  const universo = filas.length;
  const porMarca = MARCAS_5T.map(([k, n]) => {
    const si = filas.filter(f => f.marcas[k]).length;
    return { k, n, si, tot: universo, pct: universo ? Math.round(100 * si / universo) : 0 };
  });
  const casillerosSi = porMarca.reduce((a, m) => a + m.si, 0);
  const casillerosTot = universo * MARCAS_5T.length;
  const completos = filas.filter(f => f.faltan.length === 0).length;

  const vmap = {};
  filas.forEach(f => {
    const v = vmap[f.vendedor] || (vmap[f.vendedor] = { codigo: f.vendedor, nombre: f.vendedor_nombre, clientes: 0, si: 0, completos: 0 });
    v.clientes++; v.si += f.tiene; if (f.faltan.length === 0) v.completos++;
  });
  const porVendedor = Object.values(vmap).map(v => ({
    ...v, tot: v.clientes * MARCAS_5T.length,
    pct: v.clientes ? Math.round(100 * v.si / (v.clientes * MARCAS_5T.length)) : 0,
  })).sort((a, b) => b.pct - a.pct);

  return {
    id: 'campari5t', nombre: 'Plan 5T',
    detalle: 'Las 5T: que cada cliente tenga las 6 marcas del portfolio (Aperol, Bulldog, Campari, Cinzano, Cynar, Skyy).',
    marcas: MARCAS_5T.map(([k, n]) => ({ k, n })),
    universo, completos, casillerosSi, casillerosTot,
    pct: casillerosTot ? Math.round(100 * casillerosSi / casillerosTot) : 0,
    porMarca, porVendedor, clientes: filas,
    // Para la tarjeta del proveedor (provPct) y la del plan:
    avanceTotal: casillerosSi, targetTotal: casillerosTot,
    actualizado: new Date().toISOString(),
  };
}

// Doña Paula · Torneo (FINALIZADO, 16/11/2026). Resultado final guardado en incentivos_snapshots
// (DP_TORNEO_2026), sacado de la planilla oficial de Administración el día que terminó: ya no
// depende del archivo de Drive. Ranking por sucursal, igual para todos.
async function torneoDP(hub) {
  try {
    const snap = (await (await hub('incentivos_snapshots?incentivo=eq.DP_TORNEO_2026&select=corte,data')).json())[0];
    if (!snap || !snap.data) return null;
    const d = snap.data;
    return { id: 'donapaula', nombre: 'Doña Paula', color: '#6B1F2A', finalizado: true, planes: [{
      id: 'torneo', nombre: d.nombre || 'Torneo Doña Paula', finalizado: true,
      detalle: 'Terminó. Resultados finales por sucursal con los puntos que cargó Administración: acciones, volumen y activaciones.',
      cerrado: d.cerrado || snap.corte, cats: d.cats || [], sucursales: d.sucursales || [],
    }] };
  } catch (e) { return null; }
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
    // Vendedores (16/11/2026, pedido del usuario): ven SOLO los resultados finales del Torneo
    // Doña Paula; los planes de Campari y Pernod siguen siendo de supervisores y Dirección.
    if (!esSup && !VER_TODO.includes(rol)) {
      if (rol !== 'ventas') return json(403, { error: 'Solo para supervisores y Dirección/Marketing.' });
      const tp = await torneoDP(hub);
      return json(200, { nombre: perfil.nombre, region: perfil.region, canal: perfil.canal, alcance: 'vendedor', codigo: perfil.codigo_vendedor || null,
        generado: new Date().toISOString(), proveedores: tp ? [tp] : [] });
    }

    // Equipo (para el Plan 5T): supervisor = vendedores de su región + canal; el resto = todos.
    const eq = await (await hub('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,canal,region')).json();
    const pc = String(perfil.canal || '').toLowerCase(), preg = regionDe(perfil);
    const equipo = (Array.isArray(eq) ? eq : []).filter(u => {
      if (!esSup) return true;                                // ve todo
      if (preg && regionDe(u) !== preg) return false;
      const uc = String(u.canal || '').toLowerCase();
      return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
    }).filter(u => u.codigo_vendedor);
    const nombreDeCod = {}; equipo.forEach(v => { nombreDeCod[String(v.codigo_vendedor)] = v.nombre; });
    const codigos = equipo.map(v => String(v.codigo_vendedor));

    const base = { nombre: perfil.nombre, region: perfil.region, canal: perfil.canal, alcance: esSup ? 'equipo' : 'todo', codigo: perfil.codigo_vendedor || null, generado: new Date().toISOString() };
    const proveedores = [];

    // ---- Campari (dos planes: Cobertura + 5T) ----
    const campariPlanes = [];

    // Plan 1: Cobertura (tabla cobertura_productos, objetivo global)
    try {
      let rows = await (await hub('cobertura_productos?select=producto,orden,color,target,avance&order=orden.asc')).json();
      if (Array.isArray(rows) && rows.length) {
        const productos = rows.map(r => {
          const target = num(r.target), avance = num(r.avance);
          return { nombre: r.producto, color: r.color || '#c79a3b', target, avance, pct: pct(avance, target) };
        });
        const targetTotal = productos.reduce((a, p) => a + p.target, 0);
        const avanceTotal = productos.reduce((a, p) => a + p.avance, 0);
        campariPlanes.push({
          id: 'cobertura', nombre: 'Cobertura',
          detalle: 'Objetivo global de la empresa por producto: cuánto llevamos (avance) contra el target.',
          productos, targetTotal, avanceTotal, pct: pct(avanceTotal, targetTotal),
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
        proveedores.push({ id: 'pernod', nombre: 'Pernod Ricard', color: '#1F447F', planes: [{
          id: 'pr_q4', nombre: d.nombre || 'Q4 2026', detalle: d.detalle || '',
          corte: d.corte || snap.corte,
          objetivos, vendedores,
          targetTotal: metaTotal, avanceTotal: logradoTotal, pct: pct(logradoTotal, metaTotal),
        }] });
      }
    } catch (e) {}

    // ---- Doña Paula · Torneo (finalizado) ----
    const tp = await torneoDP(hub);
    if (tp) proveedores.push(tp);

    return json(200, Object.assign(base, { proveedores }));
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
