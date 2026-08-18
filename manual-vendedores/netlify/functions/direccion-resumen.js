// ============================================================
//  GrandBar Hub · Function · direccion-resumen
//   Resumen de TODA la empresa para Fernando (rol direccion):
//     - cobranzas: clientes, saldo (cuenta corriente), deuda vencida,
//       clientes con deuda vencida, # vendedores  (Cobranzas)
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

    const out = { cobranzas: null, ranking: [], reportes: null, visitas: null };

    // ---- Vendedores (Hub) ----
    let nombreDeCod = {};
    try {
      const vend = await (await hub('usuarios?rol=eq.ventas&select=nombre,codigo_vendedor')).json();
      (Array.isArray(vend) ? vend : []).forEach(v => { if (v.codigo_vendedor) nombreDeCod[String(v.codigo_vendedor)] = v.nombre; });
    } catch (e) {}

    // ---- Cobranzas: cuentas_cubo (paginado) ----
    try {
      if (!cobService) throw new Error('sin cobranzas');
      const cob = (path) => fetch(COB_URL + '/rest/v1/' + path, { headers: { apikey: cobService, Authorization: 'Bearer ' + cobService } });
      let offset = 0, page = 1000, guard = 0;
      let saldo = 0, vencida = 0, clientes = 0, clientesVencidos = 0;
      const porVend = {};
      while (guard < 20) {
        const rows = await (await cob('cuentas_cubo?select=saldo,vencida,vendedor&order=codigo.asc&limit=' + page + '&offset=' + offset)).json();
        if (!Array.isArray(rows) || !rows.length) break;
        rows.forEach(c => {
          clientes++; const s = num(c.saldo), v = num(c.vencida);
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
    } catch (e) { out.cobranzas_error = String(e.message || e); }

    // ---- Reportes (Hub) ----
    try {
      const reps = await (await hub('reportes?select=estado&limit=1000')).json();
      const c = { total: 0, pendiente: 0, aprobado: 0, rechazado: 0, revision: 0 };
      (Array.isArray(reps) ? reps : []).forEach(r => { c.total++; if (c[r.estado] !== undefined) c[r.estado]++; });
      out.reportes = c;
    } catch (e) {}

    // ---- Visitas (Manual, key pública) ----
    try {
      const man = (path) => fetch(MAN_URL + '/rest/v1/' + path, { headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON } });
      const now = new Date();
      const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const hoyStr = now.toISOString().slice(0, 10);
      const vis = await (await man('visitas?select=fecha&fecha=gte.' + inicioMes + '&limit=5000')).json();
      const arr = Array.isArray(vis) ? vis : [];
      out.visitas = { mes: arr.length, hoy: arr.filter(v => String(v.fecha || '').slice(0, 10) === hoyStr).length };
    } catch (e) {}

    return json(200, out);
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
