// ============================================================
//  Objetivos de Administración en Drive (carpeta SHARE), 18/11/2026.
//  Los usan avance-vendedor (Inicio del vendedor) y reporte-diario.
//  (El "_" evita que Netlify lo publique como función.)
//
//   · "Presupuesto Ventas.xlsx": una fila por vendedor con "VINOS Objetivo" y
//     "SPIRITS Objetivo" (botellas del mes). Las filas en MAYÚSCULAS son los subtotales
//     de cada equipo (EQUIPO ON, EQUIPO OFF, MAYORISTA MDZ, EQUIPO SL, MAYORISTA SL) y
//     la última es TOTAL: de ahí sale el orden y los equipos del reporte diario.
//     La planilla trae el nombre, no el código: se cruza con el nombre del Manual.
//   · "Objetivo CCC.xlsx": objetivo de clientes con compra, por número de vendedor.
//  Las dos se leen por gviz (están compartidas por link). El archivo no dice el mes:
//  Administración los pisa cada mes. Si suben uno nuevo (otro link), cambiar acá.
// ============================================================
const PRESUPUESTO = '10aWYQdhuoZLM9lrhTJdkTwQcia-dClez';   // SHARE / Presupuesto Ventas.xlsx
const OBJ_CLIENTES = '1Ej_ckOWLEEGVZJKi3TaDItrOkzXOL6YU';  // SHARE / Objetivo CCC.xlsx (clientes con compra)

const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const cod3 = c => { const s = String(c == null ? '' : c).trim(); return /^\d+$/.test(s) ? s.padStart(3, '0') : s; };
const entero = s => { const t = String(s == null ? '' : s).replace(/[^\d-]/g, ''); const n = parseInt(t, 10); return isNaN(n) ? null : n; };

// Filas de la planilla que no son personas: se buscan por código, no por nombre.
const ALIAS = { 'mayorista mza': '014', 'mayor distribucion': '031', 'mayorista san luis': '008', 'mayorista': '032' };

function lev(a, b) {
  const m = a.length, n = b.length; if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// ¿El nombre de la planilla es este vendedor? "Carolina Hiluani" = "Carolina Heluani",
// "Angela Laurito" = "Ángeles Laurito", "Jonathan Guique" = "Jonathan Guigue",
// "Emiliano Lopez" = "E. López" (inicial, 18/11/2026): mismo comienzo de nombre (o la
// inicial) y apellido con 2 letras de diferencia como mucho.
function esElMismo(planilla, vendedor) {
  const a = norm(planilla).split(' '), b = norm(vendedor).split(' ');
  if (!a[0] || !b[0]) return false;
  if (norm(planilla) === norm(vendedor)) return true;
  const apA = a[a.length - 1], apB = b[b.length - 1];
  const nombre = a[0].slice(0, 3) === b[0].slice(0, 3)
    || (b[0].length === 1 && a[0][0] === b[0]) || (a[0].length === 1 && b[0][0] === a[0]);
  return nombre && a.length > 1 && b.length > 1 && apA.length > 3 && lev(apA, apB) <= 2;
}

function csv(t) {
  return String(t || '').replace(/\r/g, '').split('\n').filter(l => l.trim()).map(l => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out;
  });
}

async function hoja(id, nombreHoja) {
  const r = await fetch('https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv' + (nombreHoja ? '&sheet=' + encodeURIComponent(nombreHoja) : ''), { redirect: 'follow' });
  if (!r.ok) throw new Error('Drive respondió ' + r.status);
  return csv(await r.text());
}

// Fila en MAYÚSCULAS = subtotal de un equipo (o TOTAL).
const esGrupo = s => { const t = String(s || '').trim(); return /[A-Z]/.test(t) && t === t.toUpperCase(); };

// Presupuesto Ventas, en el orden de la planilla: [{ nombre, vinos, spirits, grupo }].
async function leerPresupuesto() {
  const f = await hoja(PRESUPUESTO, 'Presupuesto');
  const cab = (f.shift() || []).map(norm);
  const iVin = cab.findIndex(c => /vino/.test(c) && /objetivo/.test(c));
  const iSpi = cab.findIndex(c => /spirit/.test(c) && /objetivo/.test(c));
  if (iVin < 0 || iSpi < 0) throw new Error('No se encontraron las columnas de objetivo');
  return f.filter(x => String(x[0] || '').trim()).map(x => ({
    nombre: String(x[0]).trim(), vinos: entero(x[iVin]), spirits: entero(x[iSpi]), grupo: esGrupo(x[0]),
  }));
}

// ¿Esta fila del presupuesto es este vendedor?
const filaEs = (fila, codigo, nombre) => { const n = norm(fila.nombre); return ALIAS[n] ? ALIAS[n] === codigo : esElMismo(fila.nombre, nombre); };

// Código del vendedor de una fila (null si no se encuentra). vendedores = [{ codigo, nombre }] del Manual.
function codigoDeFila(fila, vendedores) {
  const n = norm(fila.nombre);
  if (ALIAS[n]) return ALIAS[n];
  const v = vendedores.find(v => esElMismo(fila.nombre, v.nombre));
  return v ? cod3(v.codigo) : null;
}

// Objetivo CCC: { '027': 85, ... } (0 = sin objetivo este mes).
async function leerObjetivoCCC() {
  const f = await hoja(OBJ_CLIENTES);
  const cab = (f.shift() || []).map(norm);
  const iCod = cab.findIndex(c => /vendedor/.test(c) && /(nro|num|cod)/.test(c));
  const iObj = cab.findIndex(c => /objetivo/.test(c));
  if (iCod < 0 || iObj < 0) throw new Error('No se encontraron las columnas de Objetivo CCC');
  const m = {};
  f.forEach(x => { const c = cod3(x[iCod]); if (c) m[c] = entero(x[iObj]); });
  return m;
}

module.exports = { PRESUPUESTO, OBJ_CLIENTES, norm, cod3, entero, ALIAS, esElMismo, csv, leerPresupuesto, filaEs, codigoDeFila, leerObjetivoCCC };
