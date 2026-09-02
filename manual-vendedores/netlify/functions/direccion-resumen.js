// ============================================================
//  GrandBar Hub · Function · direccion-resumen
//   Resumen de la empresa para Fernando (rol direccion), con
//   filtro opcional de sucursal: ?region=mendoza | san_luis
//     - cobranzas: clientes, saldo, deuda vencida, clientes vencidos, # vendedores
//     - ranking de vendedores por cartera gestionada
//     - reportes: conteo por estado (Hub)
//     - visitas: del mes y de hoy (Manual)
//   Env: COBRANZAS_SERVICE_ROLE, HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const norm = s => String(s || '').toLowerCase().replace(/[\s_]/g, '');
const qvals = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

exports.handler = async (event) => {
  try {
    const cobService = process.env.COBRANZAS_SERVICE_ROLE;
    const hubService = process.env.HUB_SERVICE_ROLE;
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const hub = (path) => fetch(HUB_URL + '/rest/v1/' + path, { headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) } });
    const perfil = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol')).json())[0] || {};
    if (!DIR_ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección.' });

    const qp = event.queryStringParameters || {};
    const regionFiltro = norm(qp.region); // '' | 'mendoza' | 'sanluis'
    const out = { cobranzas: null, ranking: [], reportes: null, visitas: null, region: regionFiltro || 'todas' };

    // ---- Vendedores (Hub) con región ----
    let vendList = [];
    try { vendList = await (await hub('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor,region')).json(); } catch (e) {}
    vendList = Array.isArray(vendList) ? vendList : [];
    const nombreDeCod = {};
    vendList.forEach(v => { if (v.codigo_vendedor) nombreDeCod[String(v.codigo_vendedor)] = v.nombre; });
    const codigosRegion = regionFiltro
      ? vendList.filter(v => v.codigo_vendedor && norm(v.region) === regionFiltro).map(v => String(v.codigo_vendedor))
      : null;

    // ---- Cobranzas: cuentas_cubo ----
    try {
      if (!cobService) throw new Error('sin cobranzas');
      if (regionFiltro && (!codigosRegion || !codigosRegion.length)) {
        out.cobranzas = { clientes: 0, saldo: 0, vencida: 0, clientesVencidos: 0, vendedores: 0 };
      } else {
        const cob = (path) => fetch(COB_URL + '/rest/v1/' + path, { headers: { apikey: cobService, Authorization: 'Bearer ' + cobService } });
        const filtro = codigosRegion ? '&vendedor=in.(' + qvals(codigosRegion) + ')' : '';
        let offset = 0, page = 1000, guard = 0;
        let saldo = 0, vencida = 0, clientes = 0, clientesVencidos = 0;
        const porVend = {};
        while (guard < 20) {
          const rows = await (await cob('cuentas_cubo?select=saldo,vencida,vendedor&order=codigo.asc' + filtro + '&limit=' + page + '&offset=' + offset)).json();
          if (!Array.isArray(rows) || !rows.length) break;
          rows.forEach(c => {
            clientes++; const s = num(c.saldo), v = Math.max(0, Math.min(num(c.vencida), s)); // la vencida no puede superar el saldo neto (nota de crédito)
            saldo += s; vencida += v; if (v > 0) clientesVencidos++;
            const cod = String(c.vendedor || ''); if (!cod) return;
            if (!porVend[cod]) porVend[cod] = { codigo: cod, nombre: nombreDeCod[cod] || cod, clientes: 0, saldo: 0, vencida: 0 };
            porVend[cod].clientes++; porVend[cod].saldo += s; porVend[cod].vencida += v;
          });
          if (rows.length < page) break;
          offset += page; guard++;
        }
        out.cobranzas = { clientes, saldo: Math.round(saldo), vencida: Math.round(vencida), clientesVencidos, vendedores: Object.keys(porVend).length };
        out.ranking = Object.values(porVend).sort((a, b) => b.saldo - a.saldo).slice(0, 5)
          .map(v => ({ ...v, saldo: Math.round(v.saldo), vencida: Math.round(v.vencida) }));
      }
    } catch (e) { out.cobranzas_error = String(e.message || e); }

    // ---- Cobranzas del día (pagos de clientes aceptados, con fecha de hoy) ----
    try {
      if (cobService) {
        const cob = (path) => fetch(COB_URL + '/rest/v1/' + path, { headers: { apikey: cobService, Authorization: 'Bearer ' + cobService } });
        const now = new Date();
        const hoy = now.toISOString().slice(0, 10);
        const manana = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
        const rows = await (await cob('comprobantes?tipo=eq.cliente&estado=in.(aceptado,procesado)&fecha_pago=gte.' + hoy + '&fecha_pago=lt.' + manana + '&select=monto&limit=3000')).json();
        const arr = Array.isArray(rows) ? rows : [];
        out.cobranzasHoy = { monto: Math.round(arr.reduce((s, c) => s + num(c.monto), 0)), cantidad: arr.length, fecha: hoy };
      }
    } catch (e) { out.cobranzasHoy_error = String(e.message || e); }

    // ---- Reportes (Hub) ----
    try {
      let path = 'reportes?select=estado&limit=1000';
      if (regionFiltro) path += '&area=ilike.*' + (regionFiltro === 'sanluis' ? 'luis' : 'mendoza') + '*';
      const reps = await (await hub(path)).json();
      const c = { total: 0, pendiente: 0, aprobado: 0, rechazado: 0, revision: 0 };
      (Array.isArray(reps) ? reps : []).forEach(r => { c.total++; if (c[r.estado] !== undefined) c[r.estado]++; });
      out.reportes = c;
    } catch (e) {}

    // ---- Visitas (Manual, key pública) ----
    try {
      const man = (path) => fetch(MAN_URL + '/rest/v1/' + path, { headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON } });
      let vendIdFiltro = '';
      if (regionFiltro) {
        // mapear codigo -> id en Manual para filtrar visitas por región
        const vendMan = await (await man('vendedores?select=id,codigo&limit=2000')).json();
        const setCod = new Set((codigosRegion || []).map(String));
        const ids = (Array.isArray(vendMan) ? vendMan : []).filter(v => setCod.has(String(v.codigo))).map(v => v.id);
        if (!ids.length) { out.visitas = { mes: 0, hoy: 0 }; throw new Error('__done__'); }
        vendIdFiltro = '&vendedor_id=in.(' + qvals(ids) + ')';
      }
      const now = new Date();
      const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const hoyStr = now.toISOString().slice(0, 10);
      const vis = await (await man('visitas?select=fecha&fecha=gte.' + inicioMes + vendIdFiltro + '&limit=5000')).json();
      const arr = Array.isArray(vis) ? vis : [];
      out.visitas = { mes: arr.length, hoy: arr.filter(v => String(v.fecha || '').slice(0, 10) === hoyStr).length };
    } catch (e) { if (String(e.message) !== '__done__' && !out.visitas) out.visitas = null; }

    return json(200, out);
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
