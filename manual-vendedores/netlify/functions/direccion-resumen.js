// ============================================================
//  GrandBar Hub · Function · direccion-resumen
//   Resumen de la empresa para Fernando (Dirección), con
//   filtro opcional de sucursal: ?region=mendoza | san_luis
//     - cobranzas: cuentas, saldo, deuda vencida, cuentas vencidas, # vendedores
//     - ranking de vendedores por cartera
//     - cobranzas del día: pagos de clientes ACEPTADOS hoy
//     - reportes: conteo por estado (Hub)
//     - visitas: del mes y de hoy (Manual)
//   Env: COBRANZAS_SERVICE_ROLE, HUB_SERVICE_ROLE
//
//   19/10/2026:
//   - La sucursal se arma igual que en Cobranzas (_zona-cobranzas.js): San Luis =
//     cuentas de CUBO con equipo SL o MAY SL. Antes salía de la región cargada en
//     el usuario de cada vendedor, y los números de San Luis no daban igual que en
//     Cobranzas (y Mendoza + San Luis no sumaba Todas).
//   - "Cobranzas del día" son los pagos que tesorería ACEPTÓ hoy (por la fecha en
//     que se aceptaron). Antes sumaba también los procesados (que todavía se pueden
//     rechazar) y miraba la fecha que puso el cliente; tampoco filtraba la sucursal.
//   - "Hoy" y "este mes" son de Argentina, no de la hora del servidor (después de
//     las 21 ya contaba como mañana).
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];

const { traerTodo } = require('./_paginar');
const { armarZona } = require('./_zona-cobranzas');
function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const qvals = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

// Fecha de Argentina (AAAA-MM-DD) de un instante.
const fechaAR = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const sumaDia = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); };

exports.handler = async (event) => {
  try {
    const cobService = process.env.COBRANZAS_SERVICE_ROLE;
    const hubService = process.env.HUB_SERVICE_ROLE;
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const hub = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token), ...(opts.headers || {}) } });
    const perfil = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol')).json())[0] || {};
    if (!DIR_ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección.' });

    const qp = event.queryStringParameters || {};
    const reg = String(qp.region || '').toLowerCase().replace(/[\s_]/g, '');
    const zona = reg === 'sanluis' ? 'san_luis' : reg === 'mendoza' ? 'mendoza' : null;
    const out = { cobranzas: null, ranking: [], reportes: null, visitas: null, region: zona || 'todas' };

    const hoy = fechaAR(new Date());
    const manana = sumaDia(hoy, 1);
    const inicioMes = hoy.slice(0, 8) + '01';

    // ---- Nombres de los vendedores (Hub) ----
    let vendList = [];
    try { vendList = await (await hub('usuarios?rol=in.(ventas,mayorista)&select=nombre,codigo_vendedor')).json(); } catch (e) {}
    vendList = Array.isArray(vendList) ? vendList : [];
    const nombreDeCod = {};
    vendList.forEach(v => { if (v.codigo_vendedor) nombreDeCod[String(v.codigo_vendedor)] = v.nombre; });

    const cob = cobService
      ? (path, opts = {}) => fetch(COB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: cobService, Authorization: 'Bearer ' + cobService, ...(opts.headers || {}) } })
      : null;
    // La sucursal, con la misma regla que Cobranzas.
    let Z = null;
    if (zona && cob) { try { Z = await armarZona(zona, p => traerTodo(cob, p)); } catch (e) { out.zona_error = String(e.message || e); } }

    // ---- Cobranzas: cuentas_cubo ----
    try {
      if (!cob) throw new Error('sin cobranzas');
      if (zona && !Z) throw new Error('no se pudo separar la sucursal');
      let rows = await traerTodo(cob, 'cuentas_cubo?select=codigo,saldo,vencida,vendedor&order=codigo.asc');
      rows = (Array.isArray(rows) ? rows : []).filter(c => !Z || Z.codOk(c.codigo));
      let saldo = 0, vencida = 0, clientesVencidos = 0;
      const porVend = {};
      rows.forEach(c => {
        const s = num(c.saldo), v = Math.max(0, num(c.vencida)); // vencida = facturas vencidas, sin descontar el saldo a favor (29/09/2026)
        saldo += s; vencida += v; if (v > 0) clientesVencidos++;
        const cod = String(c.vendedor || ''); if (!cod) return;
        if (!porVend[cod]) porVend[cod] = { codigo: cod, nombre: nombreDeCod[cod] || ('Vendedor ' + cod), clientes: 0, saldo: 0, vencida: 0 };
        porVend[cod].clientes++; porVend[cod].saldo += s; porVend[cod].vencida += v;
      });
      out.cobranzas = {
        clientes: rows.length,                                         // cuentas en CUBO
        saldo: Math.round(saldo), vencida: Math.round(vencida), clientesVencidos,
        // Vendedores con usuario en el Portal y cartera (sin los códigos de cuentas internas).
        vendedores: Object.keys(porVend).filter(c => nombreDeCod[c]).length,
      };
      out.ranking = Object.values(porVend).sort((a, b) => b.saldo - a.saldo).slice(0, 5)
        .map(v => ({ ...v, saldo: Math.round(v.saldo), vencida: Math.round(v.vencida) }));
    } catch (e) { out.cobranzas_error = String(e.message || e); }

    // ---- Cobranzas del día: pagos de clientes que tesorería aceptó hoy ----
    try {
      if (!cob) throw new Error('sin cobranzas');
      if (zona && !Z) throw new Error('no se pudo separar la sucursal');
      const desde = encodeURIComponent(hoy + 'T00:00:00-03:00'), hasta = encodeURIComponent(manana + 'T00:00:00-03:00');
      const rows = await traerTodo(cob, 'comprobantes?tipo=eq.cliente&estado=eq.aceptado&revisado_at=gte.' + desde + '&revisado_at=lt.' + hasta + '&select=monto,cliente_id&order=id');
      const arr = (Array.isArray(rows) ? rows : []).filter(c => !Z || Z.cliOk(c.cliente_id));
      out.cobranzasHoy = { monto: Math.round(arr.reduce((s, c) => s + num(c.monto), 0)), cantidad: arr.length, fecha: hoy };
    } catch (e) { out.cobranzasHoy_error = String(e.message || e); }

    // ---- Reportes (Hub) ----
    try {
      let path = 'reportes?select=estado&order=id';
      if (zona) path += '&area=ilike.*' + (zona === 'san_luis' ? 'luis' : 'mendoza') + '*';
      const reps = await traerTodo(hub, path);
      const c = { total: 0, pendiente: 0, aprobado: 0, rechazado: 0, revision: 0 };
      (Array.isArray(reps) ? reps : []).forEach(r => { c.total++; if (c[r.estado] !== undefined) c[r.estado]++; });
      out.reportes = c;
    } catch (e) {}

    // ---- Visitas (Manual, key pública) ----
    try {
      const man = (path, opts = {}) => fetch(MAN_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON, ...(opts.headers || {}) } });
      let vendIdFiltro = '';
      if (zona) {
        if (!Z) throw new Error('no se pudo separar la sucursal');
        // Los vendedores de la sucursal (por su código) → sus ids en el Manual.
        const vendMan = await (await man('vendedores?select=id,codigo&limit=1000')).json();
        const ids = (Array.isArray(vendMan) ? vendMan : []).filter(v => Z.vendOk(v.codigo)).map(v => v.id);
        if (!ids.length) { out.visitas = { mes: 0, hoy: 0 }; throw new Error('__done__'); }
        vendIdFiltro = '&vendedor_id=in.(' + qvals(ids) + ')';
      }
      const vis = await traerTodo(man, 'visitas?select=fecha&fecha=gte.' + encodeURIComponent(inicioMes + 'T00:00:00-03:00') + vendIdFiltro + '&order=fecha');
      const arr = Array.isArray(vis) ? vis : [];
      out.visitas = { mes: arr.length, hoy: arr.filter(v => v.fecha && fechaAR(new Date(v.fecha)) === hoy).length };
    } catch (e) { if (String(e.message) !== '__done__' && !out.visitas) { out.visitas = null; out.visitas_error = String(e.message || e); } }

    return json(200, out);
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

// Estado del sistema (11/10/2026): los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('direccion-resumen', module.exports.handler);
