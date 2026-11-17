// ============================================================
//  GrandBar Hub · Function · avance-vendedor  (17/11/2026)
//  "Tu mes" del Inicio del vendedor: clientes activos vs clientes con compra, y el
//  avance de botellas de vinos y spirits contra el objetivo del mes.
//
//  Para el vendedor LOGUEADO (token del Hub → usuarios.codigo_vendedor):
//   · Activos     = sus clientes activos en CUBO hoy: cuentas_cubo (base de Cobranzas)
//                   que vinieron en la última corrida de DtTabla CLIENTES
//                   (_cuentas-vigentes.js). Las dadas de baja no cuentan.
//   · Con compra  = clientes distintos en las facturas del mes en curso con su código
//                   de vendedor (ventas_cliente, que baja de CUBO cada 20 minutos).
//   · Vinos / Spirits vendido = botellas del mes (rubro 01 = vinos, 02 = espirituosas,
//                   los dos primeros dígitos del artículo), con las notas de crédito restando.
//   · Objetivo    = "Presupuesto Ventas.xlsx" de la carpeta SHARE de Drive (Administración),
//                   columnas "VINOS Objetivo" y "SPIRITS Objetivo", fila con el nombre del
//                   vendedor. El archivo no dice el mes: se toma como el objetivo del mes en
//                   curso. Si Administración sube otro archivo (otro link), cambiar PRESUPUESTO.
//  Env: COBRANZAS_SERVICE_ROLE.
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY  = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const PRESUPUESTO = '10aWYQdhuoZLM9lrhTJdkTwQcia-dClez';   // SHARE / Presupuesto Ventas.xlsx
const { traerTodo } = require('./_paginar.js');
const { filtroVigentes } = require('./_cuentas-vigentes');

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
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
// "Angela Laurito" = "Ángeles Laurito", "Jonathan Guique" = "Jonathan Guigue":
// mismo comienzo de nombre y apellido con 2 letras de diferencia como mucho.
function esElMismo(planilla, vendedor) {
  const a = norm(planilla).split(' '), b = norm(vendedor).split(' ');
  if (!a[0] || !b[0]) return false;
  if (norm(planilla) === norm(vendedor)) return true;
  const apA = a[a.length - 1], apB = b[b.length - 1];
  return a[0].slice(0, 3) === b[0].slice(0, 3) && apA.length > 3 && lev(apA, apB) <= 2;
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

// Objetivo del vendedor en la planilla de Administración (null si no figura o no se pudo leer).
async function objetivos(codigo, nombre) {
  const r = await fetch('https://docs.google.com/spreadsheets/d/' + PRESUPUESTO + '/gviz/tq?tqx=out:csv&sheet=Presupuesto', { redirect: 'follow' });
  if (!r.ok) throw new Error('Drive respondió ' + r.status);
  const f = csv(await r.text());
  const cab = (f.shift() || []).map(norm);
  const iVin = cab.findIndex(c => /vino/.test(c) && /objetivo/.test(c));
  const iSpi = cab.findIndex(c => /spirit/.test(c) && /objetivo/.test(c));
  if (iVin < 0 || iSpi < 0) throw new Error('No se encontraron las columnas de objetivo');
  const fila = f.find(x => { const n = norm(x[0]); return ALIAS[n] ? ALIAS[n] === codigo : esElMismo(x[0], nombre); });
  if (!fila) return null;
  return { vinos: entero(fila[iVin]), spirits: entero(fila[iSpi]) };
}

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta COBRANZAS_SERVICE_ROLE en Netlify.' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,codigo_vendedor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const codigo = cod3(perfil.codigo_vendedor);
    if (!codigo) return json(200, { codigo: null });

    // Mes en curso, en hora de Argentina.
    const hoyAR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const desde = hoyAR.slice(0, 8) + '01';

    const cob = (p, o) => fetch(COB_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service }, (o && o.headers) || {}) });
    const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY }, (o && o.headers) || {}) });

    // Nombre del vendedor como está en el Manual (el de la planilla se cruza con este).
    const vend = ((await (await man('vendedores?codigo=eq.' + encodeURIComponent(codigo) + '&select=nombre')).json()) || [])[0] || {};
    const nombre = vend.nombre || perfil.nombre || '';

    const [activos, ventas, obj] = await Promise.all([
      (async () => {
        const vig = await filtroVigentes(cob);
        const sinCero = String(parseInt(codigo, 10));   // en CUBO a veces viene "31" en vez de "031"
        const r = await cob('cuentas_cubo?select=codigo&vendedor=in.(' + encodeURIComponent(codigo) + ',' + encodeURIComponent(sinCero) + ')' + (vig ? '&' + vig : ''),
          { headers: { Prefer: 'count=exact', Range: '0-0' } });
        return r.ok ? (Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0) : null;
      })(),
      traerTodo(man, 'ventas_cliente?select=cliente_codigo,sku,unidades,importe&vendedor=eq.' + encodeURIComponent(codigo) + '&fecha=gte.' + desde + '&order=fecha.asc'),
      objetivos(codigo, nombre).catch(e => ({ error: (e && e.message) || String(e) })),
    ]);

    const filas = Array.isArray(ventas) ? ventas : [];
    const conCompra = new Set();
    let vinos = 0, spirits = 0;
    filas.forEach(v => {
      const u = Number(v.unidades) || 0, imp = Number(v.importe) || 0;
      if (u > 0 || imp > 0) conCompra.add(String(v.cliente_codigo));
      const rubro = String(v.sku || '').slice(0, 2);
      if (rubro === '01') vinos += u; else if (rubro === '02') spirits += u;
    });

    return json(200, {
      codigo, nombre, desde, hasta: hoyAR,
      clientes: { activos, con_compra: conCompra.size },
      vinos: { vendido: Math.round(vinos), objetivo: obj && !obj.error ? obj.vinos : null },
      spirits: { vendido: Math.round(spirits), objetivo: obj && !obj.error ? obj.spirits : null },
      objetivo_error: obj && obj.error ? obj.error : (obj ? null : 'no figura en la planilla'),
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

exports.esElMismo = esElMismo;   // para probar el cruce de nombres
exports.objetivos = objetivos;
module.exports.handler = require('./_errores').conErrores('avance-vendedor', module.exports.handler);
