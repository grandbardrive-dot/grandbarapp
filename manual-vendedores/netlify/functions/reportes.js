// ============================================================
//  GrandBar Hub · Function · reportes
//   Cualquier usuario CARGA reportes para Dirección.
//   Fernando (direccion/admin/duenio) los revisa: aprueba /
//   pide cambios / rechaza y deja una DEVOLUCIÓN.
//   Tabla `reportes` en el Hub. Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const ESTADOS = ['pendiente', 'aprobado', 'rechazado', 'revision'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

function areaDe(perfil) {
  const canal = String(perfil.canal || '').toUpperCase();
  const reg = perfil.region ? (String(perfil.region).charAt(0).toUpperCase() + String(perfil.region).slice(1)) : '';
  if (perfil.rol && !['ventas'].includes(String(perfil.rol).toLowerCase())) {
    return (String(perfil.rol).charAt(0).toUpperCase() + String(perfil.rol).slice(1));
  }
  return ['Ventas', reg, canal].filter(Boolean).join(' ');
}

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,canal,region,es_supervisor')).json())[0] || {};
    const isDir = DIR_ROLES.includes(String(perfil.rol || '').toLowerCase());

    // ---------- POST ----------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

      if (b.accion === 'crear') {
        if (!b.titulo) return json(400, { error: 'Falta el título del reporte.' });
        if (!b.contenido && !b.enlace) return json(400, { error: 'Escribí el reporte o pegá un enlace.' });
        const fila = {
          usuario_id: user.id, autor_nombre: perfil.nombre || user.email, area: areaDe(perfil),
          tipo: ['diario', 'semanal', 'mensual', 'puntual'].includes(b.tipo) ? b.tipo : 'diario',
          periodo: b.periodo || null, titulo: b.titulo, contenido: b.contenido || null, enlace: b.enlace || null,
          estado: 'pendiente',
        };
        const r = await sb('reportes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude guardar: ' + (await r.text()).slice(0, 160) });
        return json(200, { ok: true, reporte: (await r.json())[0] });
      }

      if (b.accion === 'revisar' && b.id) {
        if (!isDir) return json(403, { error: 'Solo Dirección puede revisar.' });
        const est = String(b.estado || '');
        if (!ESTADOS.includes(est)) return json(400, { error: 'Estado inválido.' });
        const patch = { estado: est, devolucion: b.devolucion || null, revisado_por: user.id, revisado_por_nombre: perfil.nombre || user.email, revisado_at: new Date().toISOString() };
        await sb('reportes?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        return json(200, { ok: true });
      }

      if (b.accion === 'borrar' && b.id) {
        const cur = (await (await sb('reportes?id=eq.' + encodeURIComponent(b.id) + '&select=usuario_id,estado')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        const esMio = String(cur.usuario_id) === String(user.id);
        if (!isDir && !(esMio && cur.estado === 'pendiente')) return json(403, { error: 'No autorizado.' });
        await sb('reportes?id=eq.' + encodeURIComponent(b.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // ---------- GET ----------
    const qp = event.queryStringParameters || {};

    // Vista Dirección: todos los reportes
    if (qp.admin) {
      if (!isDir) return json(403, { error: 'Solo Dirección.' });
      let path = 'reportes?select=*&order=created_at.desc&limit=500';
      if (qp.estado && ESTADOS.includes(qp.estado)) path += '&estado=eq.' + qp.estado;
      const rows = await (await sb(path)).json();
      const arr = Array.isArray(rows) ? rows : [];
      const cont = { total: arr.length, pendiente: 0, aprobado: 0, rechazado: 0, revision: 0 };
      arr.forEach(r => { if (cont[r.estado] !== undefined) cont[r.estado]++; });
      return json(200, { reportes: arr, conteo: cont, es_direccion: true });
    }

    // Vista usuario: mis reportes
    const rows = await (await sb('reportes?usuario_id=eq.' + encodeURIComponent(user.id) + '&select=*&order=created_at.desc&limit=200')).json();
    return json(200, { reportes: Array.isArray(rows) ? rows : [], es_direccion: isDir, nombre: perfil.nombre || user.email });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
