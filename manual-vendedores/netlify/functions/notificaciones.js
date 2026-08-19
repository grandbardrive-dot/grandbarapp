// ============================================================
//  GrandBar Hub · Function · notificaciones (Dirección)
//   Junta lo que le compete a Fernando: reportes nuevos,
//   respuestas a sus reuniones, y novedades de la app.
//   Solo rol direccion/admin/duenio. Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];

// Novedades de la app (agregá nuevas arriba con su fecha).
const NOVEDADES = [
  { id: 'nv-agenda',   icon: '📅', titulo: 'Nuevo: Agenda de Dirección', detalle: 'Programá reuniones a cualquier usuario y mirá si confirman o no.', ts: '2026-08-18T12:00:00Z', link: 'dir-agenda.html' },
  { id: 'nv-reportes', icon: '📊', titulo: 'Nuevo: Reportes', detalle: 'Cada usuario te envía reportes para que los apruebes y devuelvas.', ts: '2026-08-18T11:00:00Z', link: 'reportes.html' },
  { id: 'nv-panel',    icon: '✨', titulo: 'Tu Panel de Dirección', detalle: 'Compras, Administración, Vendedores, Clientes, Proveedores y más.', ts: '2026-08-18T10:00:00Z', link: 'direccion.html' },
];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path) => fetch(HUB_URL + '/rest/v1/' + path, { headers: { apikey: srole, Authorization: 'Bearer ' + srole } });
    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol')).json())[0] || {};
    const isDir = DIR_ROLES.includes(String(perfil.rol || '').toLowerCase());

    const notifs = [];

    // 0) Notificaciones propias (tabla) — para CUALQUIER usuario
    try {
      const rows = await (await sb('notificaciones?destinatario_id=eq.' + encodeURIComponent(user.id) + '&select=*&order=created_at.desc&limit=60')).json();
      (Array.isArray(rows) ? rows : []).forEach(r => notifs.push({
        id: 'nt-' + r.id, icon: r.icono || '🔔', tipo: 'evento',
        titulo: r.titulo, detalle: r.detalle || '', ts: r.created_at, link: r.link || '#',
      }));
    } catch (e) {}

    // El resto (agregados) es sólo para Dirección
    if (!isDir) {
      notifs.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
      return json(200, { notificaciones: notifs.slice(0, 60) });
    }

    // 1) Reportes pendientes de revisar
    try {
      const reps = await (await sb('reportes?estado=eq.pendiente&select=id,autor_nombre,titulo,area,created_at&order=created_at.desc&limit=40')).json();
      (Array.isArray(reps) ? reps : []).forEach(r => notifs.push({
        id: 'rep-' + r.id, icon: '📥', tipo: 'reporte',
        titulo: (r.autor_nombre || 'Un usuario') + ' te envió un reporte',
        detalle: (r.titulo || '') + (r.area ? ' · ' + r.area : ''),
        ts: r.created_at, link: 'reportes.html',
      }));
    } catch (e) {}

    // 2) Respuestas a mis reuniones (confirmó / no puede asistir)
    try {
      const reu = await (await sb('reuniones?estado=in.(confirmada,rechazada)&select=id,usuario_id,titulo,estado,respuesta,fecha,created_at&order=created_at.desc&limit=40')).json();
      const rows = Array.isArray(reu) ? reu : [];
      let nombres = {};
      const ids = [...new Set(rows.map(r => r.usuario_id))];
      if (ids.length) {
        const us = await (await sb('usuarios?id=in.(' + ids.map(x => '"' + x + '"').join(',') + ')&select=id,nombre')).json();
        (us || []).forEach(u => { nombres[u.id] = u.nombre; });
      }
      rows.forEach(r => {
        const quien = nombres[r.usuario_id] || 'Un usuario';
        if (r.estado === 'confirmada') notifs.push({ id: 'reu-' + r.id, icon: '✅', tipo: 'reunion', titulo: quien + ' confirmó la reunión', detalle: r.titulo || '', ts: r.created_at, link: 'dir-agenda.html' });
        else notifs.push({ id: 'reu-' + r.id, icon: '⚠️', tipo: 'reunion', titulo: quien + ' no puede asistir', detalle: (r.titulo || '') + (r.respuesta ? ' · ' + r.respuesta : ''), ts: r.created_at, link: 'dir-agenda.html' });
      });
    } catch (e) {}

    // 3) Novedades de la app
    NOVEDADES.forEach(n => notifs.push({ ...n, tipo: 'novedad' }));

    notifs.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
    return json(200, { notificaciones: notifs.slice(0, 60) });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
