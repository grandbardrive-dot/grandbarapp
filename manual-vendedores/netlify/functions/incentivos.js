// ============================================================
//  GrandBar Hub · Function · incentivos
//   Para el SUPERVISOR logueado: cómo va su equipo en los PLANES de
//   incentivos de los proveedores, en tiempo real vs el objetivo.
//   Empieza con el Plan Campari 5T (mismo Sheet que lee la visita):
//   por cada marca, cuántos clientes del equipo la tienen; por vendedor;
//   y el detalle cliente x marca.
//   Cada supervisor ve SOLO sus vendedores y los clientes de sus vendedores.
//   Fuente: HUB (usuarios) + Manual (clientes/vendedores) + Sheet 5T.
//   Env: HUB_SERVICE_ROLE (opcional; si no, usa el token del supervisor).
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

exports.handler = async (event) => {
  try {
    const hubService = process.env.HUB_SERVICE_ROLE;
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const hub = (path) => fetch(HUB_URL + '/rest/v1/' + path, { headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) } });
    const perfil = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,canal,region,codigo_vendedor,es_supervisor')).json())[0] || {};
    if (!perfil.es_supervisor) return json(403, { error: 'Solo para supervisores.' });

    // Equipo: vendedores de la misma región + canal (o 'ambos')
    const eq = await (await hub('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,canal,region')).json();
    const pc = String(perfil.canal || '').toLowerCase(), preg = regionDe(perfil);
    const equipo = (Array.isArray(eq) ? eq : []).filter(u => {
      if (preg && regionDe(u) !== preg) return false;
      const uc = String(u.canal || '').toLowerCase();
      return !pc || pc === 'ambos' || uc === 'ambos' || pc === uc;
    }).filter(u => u.codigo_vendedor);
    const nombreDeCod = {}; equipo.forEach(v => { nombreDeCod[String(v.codigo_vendedor)] = v.nombre; });
    const codigos = equipo.map(v => String(v.codigo_vendedor));

    const base = { nombre: perfil.nombre, region: perfil.region, canal: perfil.canal, generado: new Date().toISOString() };
    if (!codigos.length) return json(200, Object.assign(base, { planes: [] }));

    const [clientes, t5] = await Promise.all([clientesDelEquipo(codigos), leer5T()]);

    // Cruce: clientes del equipo que están en el Plan 5T
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

    // Por vendedor
    const vmap = {};
    filas.forEach(f => {
      const v = vmap[f.vendedor] || (vmap[f.vendedor] = { codigo: f.vendedor, nombre: f.vendedor_nombre, clientes: 0, si: 0, completos: 0 });
      v.clientes++; v.si += f.tiene; if (f.faltan.length === 0) v.completos++;
    });
    const porVendedor = Object.values(vmap).map(v => ({
      ...v, tot: v.clientes * MARCAS_5T.length,
      pct: v.clientes ? Math.round(100 * v.si / (v.clientes * MARCAS_5T.length)) : 0,
    })).sort((a, b) => b.pct - a.pct);

    const plan = {
      id: 'campari5t', proveedor: 'Campari', nombre: 'Plan 5T',
      detalle: 'Las 5T: que cada cliente tenga las 6 marcas del portfolio (Aperol, Bulldog, Campari, Cinzano, Cynar, Skyy).',
      objetivoPct: 100,
      marcas: MARCAS_5T.map(([k, n]) => ({ k, n })),
      universo, completos,
      casillerosSi, casillerosTot,
      pct: casillerosTot ? Math.round(100 * casillerosSi / casillerosTot) : 0,
      porMarca, porVendedor, clientes: filas,
      actualizado: new Date().toISOString(),
    };

    return json(200, Object.assign(base, { planes: [plan] }));
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
