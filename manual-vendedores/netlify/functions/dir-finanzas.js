// ============================================================
//  GrandBar Hub · Function · dir-finanzas  (Panel de Dirección)
//  Los cuatro archivos de finanzas que Sebastián deja en Drive, leídos del lado
//  del servidor (19/10/2026). Antes los leía el navegador (assets/finanzas.js)
//  con los enlaces de los archivos a la vista: cualquiera con sesión en el
//  Portal podía ver el efectivo, los cheques y los pagos. Ahora solo responde a
//  Dirección (roles direccion, admin, duenio) y los enlaces no salen de acá.
//
//   Efectivo.xlsx                → saldo de caja, por sucursal
//   Cheques.xlsx                 → cartera de cheques y qué se acredita cuándo
//   Proceso_Pago_Proveedores.xlsx→ cuánto hay que pagar, semana por semana
//   Ordenes Compra activa.xlsx   → mercadería pedida que todavía no llegó
//
//  Se leen con una consulta a Google (gviz, CSV), porque los archivos están
//  compartidos por link. Si uno no se puede leer, ese bloque vuelve con
//  { error } y la pantalla dice "no se pudo leer": nada se inventa.
//  Las fechas ("hoy", "esta semana") son de Argentina, no del servidor.
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const ARCHIVOS = {
  efectivo: '1rp6xExmicN-BcsH8ld7_MkWnFCjBqiM2',
  cheques:  '1-EN-FTusyvtCq5iQUGeALVi60u4TG5cA',
  pagos:    '120rJc8l7ohOOb-S7_lbBbSJ2sXXkttY-',
  ordenes:  '1IK14iuaOZ7htMo1pH-hBfksTbuWn9G-c',
};

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const url = (id, hoja) => 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(hoja);

// ── CSV ────────────────────────────────────────────────────────────────────
function partirLinea(l) {
  const out = []; let cur = '', dentro = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { if (dentro && l[i + 1] === '"') { cur += '"'; i++; } else dentro = !dentro; }
    else if (ch === ',' && !dentro) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const filas = (t) => String(t || '').replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').map(partirLinea);
async function traer(id, hoja) {
  const r = await fetch(url(id, hoja));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return filas(await r.text());
}
// Los montos vienen "$1,864,450,996", "70,281,917.41" o "481000.00".
function monto(s) {
  let t = String(s == null ? '' : s).replace(/[^\d.,-]/g, '');
  if (!t) return null;
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
  const dec = Math.max(coma, punto);
  if (dec > -1 && t.length - dec - 1 <= 2 && t.length - dec - 1 > 0) t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1);
  else t = t.replace(/[.,]/g, '');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
const texto = (s) => String(s == null ? '' : s).trim();

// ── Fechas (de Argentina) ──────────────────────────────────────────────────
// Todas las fechas se arman con new Date(año, mes, día) del servidor: así se
// comparan entre sí sin importar en qué zona horaria corra la función.
function hoyAR() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function aFecha(dmy) {                       // "09/10/2026" → Date
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto(dmy));
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}
function semanaActual() {                    // lunes a domingo de la semana en curso
  const hoy = hoyAR(), d = hoy.getDay(), lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((d + 6) % 7));
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  return { desde: lunes, hasta: domingo, hoy };
}
// "dd/mm" sin año → la fecha de ese día y mes más cercana a hoy (así a fin de
// diciembre las semanas de enero son del año que viene, y en enero las de
// diciembre son del año pasado).
function fechaCercana(ddmm, hoy) {
  const a = String(ddmm).split('/');
  return [-1, 0, 1].map(k => new Date(hoy.getFullYear() + k, +a[1] - 1, +a[0]))
    .sort((x, y) => Math.abs(x - hoy) - Math.abs(y - hoy))[0];
}
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// ── Efectivo en caja ───────────────────────────────────────────────────────
async function efectivo() {
  const f = await traer(ARCHIVOS.efectivo, 'Dinero en efectivo');
  const por = []; let total = null;
  f.forEach(fila => {
    const nom = texto(fila[0]), val = monto(fila[1]);
    if (val == null || !nom) return;
    if (/total/i.test(nom)) total = val;
    else if (!/saldo de caja/i.test(nom) || /sucursal/i.test(nom) === false) por.push({ sucursal: nom, saldo: val });
  });
  if (total == null) total = por.reduce((a, x) => a + x.saldo, 0);
  let fecha = null;                          // la fecha del corte está en el encabezado del libro mayor
  try {
    const m = await traer(ARCHIVOS.efectivo, 'Mendoza');
    const mm = /Hasta:\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec((m[0] || []).join(' '));
    if (mm) fecha = mm[1];
  } catch (e) {}
  return { total, sucursales: por, fecha };
}

// ── Cheques en cartera ─────────────────────────────────────────────────────
async function cheques() {
  const f = await traer(ARCHIVOS.cheques, 'Cheques');
  const cab = f.shift() || [];
  let iAcr = cab.findIndex(c => /acredit/i.test(c));
  let iImp = cab.findIndex(c => /importe/i.test(c));
  if (iAcr < 0) iAcr = 2;
  if (iImp < 0) iImp = 5;
  const s = semanaActual();
  let total = 0, semana = 0, atrasados = 0, nSemana = 0, nAtras = 0;
  f.forEach(fila => {
    const imp = monto(fila[iImp]); if (imp == null) return;
    total += imp;
    const d = aFecha(fila[iAcr]); if (!d) return;
    if (d < s.hoy) { atrasados += imp; nAtras++; }
    else if (d <= s.hasta) { semana += imp; nSemana++; }
  });
  return { total, semana, cantidadSemana: nSemana, atrasados, cantidadAtrasados: nAtras };
}

// ── Pagos a proveedores ────────────────────────────────────────────────────
async function pagos() {
  const f = await traer(ARCHIVOS.pagos, 'Dashboard');
  let aPagar = null, conCheques = null, transferencia = null, fecha = null;
  const semanas = [];
  const mf = /·\s*(\d{1,2}\/\d{1,2}\/\d{4})/.exec((f[0] || []).join(' '));
  if (mf) fecha = mf[1];
  f.forEach(fila => {
    // Los tres totales están en la segunda fila, en las columnas B, E y H.
    if (aPagar == null && monto(fila[1]) != null && monto(fila[4]) != null && monto(fila[7]) != null) {
      aPagar = monto(fila[1]); conCheques = monto(fila[4]); transferencia = monto(fila[7]);
      return;
    }
    const m = /^(\d{1,2}\/\d{1,2})\s*[–-]\s*(\d{1,2}\/\d{1,2})$/.exec(texto(fila[4]));
    if (!m) return;
    semanas.push({ etiqueta: m[1] + ' al ' + m[2], desde: m[1], hasta: m[2], facturas: monto(fila[5]), cheques: monto(fila[6]), efectivo: monto(fila[7]) });
  });
  const hoy = hoyAR();
  semanas.forEach(w => {
    const d1 = fechaCercana(w.desde, hoy);
    const b = w.hasta.split('/');
    const d2 = new Date(d1.getFullYear(), +b[1] - 1, +b[0]);
    if (d2 < d1) d2.setFullYear(d1.getFullYear() + 1);     // la semana cruza de año
    w.desdeISO = iso(d1); w.hastaISO = iso(d2);
    w.esEstaSemana = hoy >= d1 && hoy <= d2;
    w.yaPaso = d2 < hoy;
  });
  return { aPagar, conCheques, transferencia, semanas, fecha };
}

// ── Mercadería pedida que no llegó ─────────────────────────────────────────
async function ordenes() {
  const f = await traer(ARCHIVOS.ordenes, 'Orden Compra Activa');
  const cab = f.shift() || [];
  let iSaldo = cab.findIndex(c => /saldo/i.test(c));
  let iProv = cab.findIndex(c => /proveedor/i.test(c));
  if (iSaldo < 0) iSaldo = 10;
  if (iProv < 0) iProv = 2;
  let total = 0; const porProv = {};
  f.forEach(fila => {
    const s = monto(fila[iSaldo]); if (!s) return;        // 0 o vacío = ya llegó
    total += s;
    const p = texto(fila[iProv]) || '—';
    porProv[p] = (porProv[p] || 0) + s;
  });
  const top = Object.keys(porProv).map(p => ({ proveedor: p, saldo: porProv[p] })).sort((a, b) => b.saldo - a.saldo).slice(0, 5);
  return { total, top };
}

exports.handler = async (event) => {
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    if (!DIR_ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección.' });

    const fns = { efectivo, cheques, pagos, ordenes };
    const partes = Object.keys(fns);
    const res = await Promise.all(partes.map(k => fns[k]().catch(e => ({ error: (e && e.message) || 'no se pudo leer' }))));
    const out = {}; partes.forEach((k, i) => { out[k] = res[i]; });
    return json(200, out);
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

// Estado del sistema: los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('dir-finanzas', module.exports.handler);
