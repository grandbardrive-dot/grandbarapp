// ============================================================
//  Indicadores financieros de Dirección (24/11/2026): lo que comparten la tarea que guarda
//  el corte de cada día (indicadores-corte-cron) y la pantalla de Fernando (dir-indicadores).
//  Pedido de Fernando con dos PDF ("Indicadores de cobranzas" e "Indicadores de pago a
//  proveedores"): cierres de mes y actualización semanal.
//
//  Fuentes (nada se inventa: si una no se puede leer, ese número queda en null):
//   · Saldo de cuentas corrientes de clientes: cuentas_cubo (base de Cobranzas, CUBO cada
//     hora), solo las cuentas vigentes, igual que el Inicio.
//   · Cheques de clientes en cartera sin acreditar: Cheques.xlsx (Disponibilidad), con su
//     fecha de acreditación → también los "ingresos previstos por cheques" por semana.
//   · Facturas de proveedores a pagar y echeqs entregados sin debitar:
//     Proceso_Pago_Proveedores.xlsx, hoja "Resumen Semanal".
//   · Ventas con IVA (netas de notas de crédito): RPC ventas_con_iva_por_dia (base del Manual).
//  Las compras del mes (para el plazo de pago a proveedores) CUBO no las da: quedan pendientes.
//  (El "_" evita que Netlify lo publique como función.)
// ============================================================
const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const ARCHIVOS = require('./_finanzas-archivos');
const { traerTodo } = require('./_paginar');
const { filtroVigentes } = require('./_cuentas-vigentes');

// ── Planillas de Drive (CSV de gviz, como dir-finanzas) ──────────────────────
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
async function hoja(id, nombre) {
  const r = await fetch('https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(nombre));
  if (!r.ok) throw new Error('Drive ' + r.status);
  return String(await r.text()).replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').map(partirLinea);
}
// "$1,864,450,996", "70,281,917.41" o "481000.00" → número
function monto(s) {
  let t = String(s == null ? '' : s).replace(/[^\d.,-]/g, '');
  if (!t) return null;
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.'), dec = Math.max(coma, punto);
  if (dec > -1 && t.length - dec - 1 <= 2 && t.length - dec - 1 > 0) t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1);
  else t = t.replace(/[.,]/g, '');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
// "09/10/2026" → "2026-10-09"
const isoDe = dmy => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(dmy || '')); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : null; };
const hoyAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

// Cheques de clientes en cartera: cada uno con su fecha de acreditación.
async function cheques() {
  const f = await hoja(ARCHIVOS.cheques, 'Cheques');
  const cab = (f.shift() || []).map(c => String(c).trim().toLowerCase());
  const ix = (re, def) => { const i = cab.findIndex(c => re.test(c)); return i >= 0 ? i : def; };
  const iAcr = ix(/acredit/, 2), iImp = ix(/importe/, 5), iEst = ix(/^estado/, 6), iRec = ix(/recepci/, 8);
  const lista = [];
  let ultimaRecepcion = null;
  f.forEach(r => {
    const imp = monto(r[iImp]); if (imp == null) return;
    const est = String(r[iEst] || '').trim().toUpperCase();
    if (est && est !== 'C') return;                       // C = en cartera (no entregado ni depositado)
    lista.push({ acr: isoDe(r[iAcr]), imp });
    const rec = isoDe(r[iRec]); if (rec && (!ultimaRecepcion || rec > ultimaRecepcion)) ultimaRecepcion = rec;
  });
  return { total: lista.reduce((s, x) => s + x.imp, 0), cantidad: lista.length, lista, ultimaRecepcion };
}

// Proveedores: total de facturas a pagar (hoja "Dashboard", igual que la franja Finanzas del
// Inicio: la fila de totales trae B = a pagar y H = transferencia) y echeqs entregados sin
// debitar (hoja "Resumen Semanal": la fila "TOTAL GENERAL" no sale en el CSV de Google).
async function pagos() {
  const [f, dash] = await Promise.all([hoja(ARCHIVOS.pagos, 'Resumen Semanal'), hoja(ARCHIVOS.pagos, 'Dashboard')]);
  const cab = f[0] || [];
  const fechaResumen = isoDe(cab[0]);                    // "RESUMEN SEMANAL — 19/11/2026 Desde"
  let aPagar = null;
  for (const r of dash) {
    if (monto(r[1]) != null && monto(r[7]) != null && !/\//.test(String(r[4] || ''))) { aPagar = monto(r[1]); break; }
  }
  // Echeqs: las columnas "Entregado a" e "Importe" a la derecha del resumen.
  const iEnt = cab.findIndex(c => /entregado a/i.test(c));
  const iImp = iEnt >= 0 ? iEnt + 1 : -1;
  let echeqs = null, cantidad = 0;
  if (iEnt >= 0) {
    const filaTot = f.find(r => /^total$/i.test(String(r[iEnt] || '').trim()));
    let suma = 0;
    f.slice(1).forEach(r => { const n = String(r[iEnt] || '').trim(); if (n && !/^total$/i.test(n)) { const m = monto(r[iImp]); if (m != null) { suma += m; cantidad++; } } });
    echeqs = filaTot ? monto(filaTot[iImp]) : (cantidad ? suma : null);
  }
  return { aPagar, echeqs, cantidadEcheqs: cantidad, fechaResumen };
}

// Saldo de las cuentas corrientes de clientes (cuentas vigentes de CUBO), como el Inicio.
async function saldoClientes() {
  const k = process.env.COBRANZAS_SERVICE_ROLE;
  if (!k) throw new Error('Falta COBRANZAS_SERVICE_ROLE');
  const cob = (p, o = {}) => fetch(COB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: k, Authorization: 'Bearer ' + k, ...(o.headers || {}) } });
  const vig = await filtroVigentes(cob);
  const filas = await traerTodo(cob, 'cuentas_cubo?select=saldo&order=codigo.asc' + (vig ? '&' + vig : ''));
  const lista = Array.isArray(filas) ? filas : [];
  return { saldo: lista.reduce((s, c) => s + (Number(c.saldo) || 0), 0), cuentas: lista.length };
}

// El corte de hoy: los cuatro saldos. Lo que no se pudo leer queda en null y el error, en detalle.
async function tomarCorte() {
  const [cl, ch, pa] = await Promise.allSettled([saldoClientes(), cheques(), pagos()]);
  const errores = {};
  if (cl.status === 'rejected') errores.clientes = String(cl.reason && cl.reason.message || cl.reason);
  if (ch.status === 'rejected') errores.cheques = String(ch.reason && ch.reason.message || ch.reason);
  if (pa.status === 'rejected') errores.pagos = String(pa.reason && pa.reason.message || pa.reason);
  const C = cl.value || {}, H = ch.value || {}, P = pa.value || {};
  return {
    fecha: hoyAR(),
    saldo_clientes: cl.status === 'fulfilled' ? Math.round(C.saldo) : null,
    cheques_cartera: ch.status === 'fulfilled' ? Math.round(H.total) : null,
    saldo_proveedores: P.aPagar != null ? Math.round(P.aPagar) : null,
    cheques_propios: P.echeqs != null ? Math.round(P.echeqs) : null,
    detalle: {
      cuentas: C.cuentas || null,
      cheques: H.cantidad != null ? H.cantidad : null, cheques_ultima_recepcion: H.ultimaRecepcion || null,
      pagos_resumen_al: P.fechaResumen || null, echeqs: P.cantidadEcheqs || null,
      errores: Object.keys(errores).length ? errores : undefined,
    },
    _cheques: H.lista || null,           // para los ingresos previstos (no se guarda)
  };
}

// Ventas con IVA por día (YYYY-MM-DD → $), de la base del Manual.
async function ventasPorDia(desde, hasta) {
  const r = await fetch(MAN_URL + '/rest/v1/rpc/ventas_con_iva_por_dia', {
    method: 'POST',
    headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_desde: desde, p_hasta: hasta }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || typeof d !== 'object') throw new Error('ventas ' + r.status);
  return d;
}

module.exports = { tomarCorte, ventasPorDia, hoyAR };
