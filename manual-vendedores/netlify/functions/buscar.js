// ============================================================
//  GrandBar Hub · Function · buscar (búsqueda global de Dirección)
//   ?q=palabra  → busca en usuarios, clientes (cuentas_cubo),
//   reportes y secciones del panel. Solo rol direccion/admin/duenio.
//   Env: HUB_SERVICE_ROLE, COBRANZAS_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];

const SECCIONES = [
  { titulo: 'Inicio', link: 'direccion.html', kw: 'inicio home resumen' },
  { titulo: 'Compras', link: 'compras.html', kw: 'compras proveedores ordenes stock' },
  { titulo: 'Administración', link: 'administracion.html', kw: 'administracion cobranzas cashflow cuenta corriente pagos' },
  { titulo: 'Marketing', link: 'marketing.html', kw: 'marketing campanas placas redes' },
  { titulo: 'Depósito', link: 'deposito.html', kw: 'deposito inventario stock despachos' },
  { titulo: 'Desarrollo', link: 'desarrollo.html', kw: 'desarrollo proyectos roadmap' },
  { titulo: 'Reportes', link: 'reportes.html', kw: 'reportes entregas' },
  { titulo: 'Clientes', link: 'dir-clientes.html', kw: 'clientes cuentas' },
  { titulo: 'Vendedores', link: 'dir-vendedores.html', kw: 'vendedores equipo comercial ranking' },
  { titulo: 'Proveedores', link: 'proveedores.html', kw: 'proveedores' },
  { titulo: 'Agenda', link: 'dir-agenda.html', kw: 'agenda reuniones' },
];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    const hubService = process.env.HUB_SERVICE_ROLE;
    const cobService = process.env.COBRANZAS_SERVICE_ROLE;
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const hub = (path) => fetch(HUB_URL + '/rest/v1/' + path, { headers: { apikey: hubService || HUB_ANON, Authorization: 'Bearer ' + (hubService || token) } });
    const perfil = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol')).json())[0] || {};
    if (!DIR_ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección.' });

    const q = String((event.queryStringParameters || {}).q || '').trim();
    if (q.length < 2) return json(200, { resultados: [] });
    const like = '*' + encodeURIComponent(q) + '*';
    const res = [];

    // Usuarios
    try {
      const us = await (await hub('usuarios?or=(nombre.ilike.' + like + ',email.ilike.' + like + ')&select=id,nombre,email,rol,codigo_vendedor&limit=8')).json();
      (Array.isArray(us) ? us : []).forEach(u => res.push({
        tipo: 'Usuario', titulo: u.nombre || u.email, sub: (u.rol || '') + (u.codigo_vendedor ? ' · cód ' + u.codigo_vendedor : ''),
        link: (String(u.rol || '').toLowerCase() === 'ventas') ? 'dir-vendedores.html' : 'dir-agenda.html', icon: '👤',
      }));
    } catch (e) {}

    // Clientes (cuentas_cubo)
    try {
      if (cobService) {
        const cob = (path) => fetch(COB_URL + '/rest/v1/' + path, { headers: { apikey: cobService, Authorization: 'Bearer ' + cobService } });
        const cs = await (await cob('cuentas_cubo?or=(nombre.ilike.' + like + ',codigo.ilike.' + like + ')&select=codigo,nombre,saldo,vencida&limit=8')).json();
        (Array.isArray(cs) ? cs : []).forEach(c => res.push({
          tipo: 'Cliente', titulo: c.nombre || ('Cliente ' + c.codigo), sub: 'Cód ' + c.codigo + (Number(c.vencida) > 0 ? ' · vencido' : ''),
          link: 'dir-clientes.html', icon: '🏢',
        }));
      }
    } catch (e) {}

    // Reportes
    try {
      const rp = await (await hub('reportes?or=(titulo.ilike.' + like + ',autor_nombre.ilike.' + like + ')&select=id,titulo,autor_nombre,estado&limit=6')).json();
      (Array.isArray(rp) ? rp : []).forEach(r => res.push({
        tipo: 'Reporte', titulo: r.titulo, sub: (r.autor_nombre || '') + ' · ' + (r.estado || ''), link: 'reportes.html', icon: '📄',
      }));
    } catch (e) {}

    // Secciones del panel
    const ql = q.toLowerCase();
    SECCIONES.filter(s => s.titulo.toLowerCase().includes(ql) || s.kw.includes(ql)).forEach(s => res.push({ tipo: 'Sección', titulo: s.titulo, sub: 'Ir a la sección', link: s.link, icon: '📁' }));

    return json(200, { resultados: res.slice(0, 30) });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
