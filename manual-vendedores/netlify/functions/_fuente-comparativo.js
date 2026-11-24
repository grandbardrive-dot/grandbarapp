// ============================================================
//  Fuente del Comparativo (24/11/2026), compartida por comparativo.js y diagnostico.js.
//  Sale de comparativo.js (19/11/2026) sin cambios, para que las dos pantallas usen
//  exactamente lo mismo:
//   · "Comparativo (fuente).xlsx" (Drive SHARE, Administración): Excluidos (sus ventas no
//     entran en ningún número), provincia de cada vendedor y bodegas del grupo Peñaflor.
//   · Equipo de cada vendedor = su grupo en "Presupuesto Ventas" (ON, OFF, SL y Mayoristas).
//  (El "_" evita que Netlify lo publique como función.)
// ============================================================
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const FUENTE  = '1O7-GapTY4apFw8uc8Og7kKAm9Z6dYl2t';   // SHARE / Comparativo (fuente).xlsx
const OBJ = require('./_objetivos-vendedores');
const { norm, cod3, csv } = OBJ;
const EQUIPO_DE_GRUPO = { 'EQUIPO ON': 'ON', 'EQUIPO OFF': 'OFF', 'EQUIPO SL': 'SL', 'MAYORISTA MDZ': 'Mayorista MDZ', 'MAYORISTA SL': 'Mayorista SL' };
const EQUIPOS = ['ON', 'OFF', 'SL', 'Mayorista MDZ', 'Mayorista SL'];

// ── Lo que cambia poco se guarda un rato en memoria (cada instancia de la función) ──
const cache = {};
async function guardado(clave, ms, fn) {
  const c = cache[clave];
  if (c && Date.now() - c.t < ms) return c.v;
  const v = await fn();
  cache[clave] = { t: Date.now(), v };
  return v;
}

async function hoja(nombre) {
  const r = await fetch('https://docs.google.com/spreadsheets/d/' + FUENTE + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(nombre), { redirect: 'follow' });
  if (!r.ok) throw new Error('Drive respondió ' + r.status);
  const f = csv(await r.text());
  const cab = (f.shift() || []).map(norm);
  return { cab, filas: f };
}

// Excluidos (códigos), provincia por nombre de vendedor y bodegas del grupo Peñaflor.
async function fuente() {
  const [ex, pr, pe] = await Promise.all([hoja('Excluidos'), hoja('Porvincia'), hoja('Peñaflor')]);
  const iCod = ex.cab.findIndex(c => /nro|cod/.test(c));
  const excluidos = ex.filas.map(x => cod3(x[iCod >= 0 ? iCod : 1])).filter(c => /^\d{3}$/.test(c));
  const iV = pr.cab.findIndex(c => /vendedor/.test(c)), iP = pr.cab.findIndex(c => /provincia/.test(c));
  const provincias = pr.filas.map(x => ({ nombre: String(x[iV] || '').trim(), provincia: String(x[iP] || '').trim() })).filter(x => x.nombre && x.provincia);
  const iB = pe.cab.findIndex(c => /bodega/.test(c));
  const penaflor = pe.filas.map(x => String(x[iB] || '').trim()).filter(Boolean);
  return { excluidos, provincias, penaflor };
}

// Vendedores del Manual con su equipo (Presupuesto Ventas) y su provincia (Comparativo fuente).
async function vendedores(src) {
  const man = (p) => fetch(MAN_URL + '/rest/v1/' + p, { headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY } });
  // oculto (24/11/2026): no va en las listas de vendedores (sus ventas siguen en los totales).
  const lista = await (await man('vendedores?select=codigo,nombre,oculto')).json();
  const vs = (Array.isArray(lista) ? lista : []).map(v => ({ codigo: cod3(v.codigo), nombre: String(v.nombre || '').trim(), oculto: v.oculto === true })).filter(v => v.codigo);
  const equipo = {};
  try {
    let grupo = [];
    for (const fila of await OBJ.leerPresupuesto()) {
      if (fila.grupo) { const e = EQUIPO_DE_GRUPO[String(fila.nombre).trim().toUpperCase()]; if (e) grupo.forEach(c => { equipo[c] = e; }); grupo = []; continue; }
      const c = OBJ.codigoDeFila(fila, vs); if (c) grupo.push(c);
    }
  } catch (e) {}
  const provincia = {};
  src.provincias.forEach(p => {
    const v = vs.find(v => norm(v.nombre) === norm(p.nombre)) || vs.find(v => OBJ.esElMismo(p.nombre, v.nombre));
    if (v && !provincia[v.codigo]) provincia[v.codigo] = p.provincia;
  });
  return vs.map(v => ({ ...v, equipo: equipo[v.codigo] || null, provincia: provincia[v.codigo] || null }));
}

module.exports = { guardado, fuente, vendedores, EQUIPOS };
