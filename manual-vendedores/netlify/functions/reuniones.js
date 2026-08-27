// ============================================================
//  GrandBar Hub · Function · reuniones (Dirección → usuario)
//   Fernando (rol direccion/admin/duenio) le PROGRAMA reuniones
//   a cualquier usuario. El usuario ve las suyas.
//   Tabla `reuniones` en el Hub. Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const { pushA } = require('./_notificar');

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

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,es_supervisor')).json())[0] || {};
    const isDir = DIR_ROLES.includes(String(perfil.rol || '').toLowerCase());

    // ---------- POST ----------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

      if (b.accion === 'crear') {
        if (!isDir) return json(403, { error: 'Solo Dirección puede programar reuniones.' });
        if (!b.usuario_id) return json(400, { error: 'Falta el usuario.' });
        if (!b.titulo)     return json(400, { error: 'Falta el título.' });
        if (!b.fecha)      return json(400, { error: 'Falta la fecha.' });
        const fila = {
          usuario_id: b.usuario_id, titulo: b.titulo, detalle: b.detalle || null,
          tipo: ['reunion', 'llamada', 'visita', 'capacitacion'].includes(b.tipo) ? b.tipo : 'reunion',
          fecha: b.fecha, hora: b.hora || null, lugar: b.lugar || null,
          estado: 'programada', creado_por: user.id, creado_por_nombre: perfil.nombre || user.email,
        };
        const r = await sb('reuniones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No pude crear: ' + (await r.text()).slice(0, 160) });
        // aviso al usuario en su campanita
        try {
          const quien = (perfil.nombre && !/@/.test(perfil.nombre)) ? String(perfil.nombre).split(/\s+/)[0] : 'Dirección';
          const detalle = fila.titulo + ' · ' + fila.fecha + (fila.hora ? ' ' + String(fila.hora).slice(0, 5) : '');
          await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: b.usuario_id, icono: '📌', titulo: quien + ' te programó una reunión', detalle, link: 'agenda.html' }) });
          await pushA(sb, b.usuario_id, { title: '📌 ' + quien + ' te programó una reunión', body: detalle, url: '/agenda.html', tag: 'reu-new-' + b.usuario_id });
        } catch (e) {}
        return json(200, { ok: true, reunion: (await r.json())[0] });
      }

      if (b.accion === 'estado' && b.id) {
        const est = String(b.estado || '');
        const cur = (await (await sb('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=usuario_id,creado_por,titulo')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        const esMia = String(cur.usuario_id) === String(user.id);
        // El usuario destino puede confirmar / marcar realizada / rechazar (no asistir); Dirección puede todo.
        if (!isDir && !(esMia && ['confirmada', 'realizada', 'rechazada'].includes(est))) return json(403, { error: 'No autorizado.' });
        if (!['programada', 'confirmada', 'realizada', 'cancelada', 'rechazada'].includes(est)) return json(400, { error: 'Estado inválido.' });
        if (est === 'rechazada' && esMia && !isDir && !String(b.motivo || '').trim()) return json(400, { error: 'Poné el motivo por el que no podés asistir.' });
        const patch = { estado: est };
        if (b.motivo !== undefined) patch.respuesta = String(b.motivo || '').trim() || null;
        await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        // Avisar a quien la programó (Dirección) que el usuario respondió → push
        if (esMia && cur.creado_por && (est === 'confirmada' || est === 'rechazada')) {
          const nombre = (perfil.nombre && !/@/.test(perfil.nombre)) ? perfil.nombre : 'El usuario';
          const txt = est === 'confirmada' ? nombre + ' confirmó la reunión' : nombre + ' no puede asistir';
          try { await pushA(sb, cur.creado_por, { title: (est === 'confirmada' ? '✅ ' : '⚠️ ') + txt, body: (cur.titulo || '') + (est === 'rechazada' && patch.respuesta ? ' · ' + patch.respuesta : ''), url: '/dir-agenda.html', tag: 'reu-resp-' + b.id }); } catch (e) {}
        }
        return json(200, { ok: true });
      }

      if (b.accion === 'minuta' && b.id) {
        const cur = (await (await sb('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=usuario_id')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        const esMia = String(cur.usuario_id) === String(user.id);
        if (!isDir && !esMia) return json(403, { error: 'No autorizado.' });
        const clean = (a) => Array.isArray(a) ? a.map((x) => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, 60) : [];
        const minuta = { temas: clean(b.temas), pendientes: clean(b.pendientes), notas: String(b.notas || '').trim() || null, autor: perfil.nombre || user.email };
        const patch = { minuta, minuta_at: new Date().toISOString(), estado: 'realizada' };
        const r = await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        if (!r.ok) return json(502, { error: 'No pude guardar la minuta: ' + (await r.text()).slice(0, 160) });
        return json(200, { ok: true });
      }

      if (b.accion === 'borrar' && b.id) {
        if (!isDir) return json(403, { error: 'Solo Dirección.' });
        await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // ---------- GET ----------
    const qp = event.queryStringParameters || {};

    // Lista de usuarios para el selector (solo Dirección)
    if (qp.usuarios) {
      if (!isDir) return json(403, { error: 'Solo Dirección.' });
      const rows = await (await sb('usuarios?select=id,nombre,email,rol,canal,region,es_supervisor&order=nombre.asc&limit=1000')).json();
      return json(200, { usuarios: (Array.isArray(rows) ? rows : []).filter(u => String(u.rol || '').toLowerCase() !== 'direccion') });
    }

    // Vista Dirección: todas las reuniones programadas (con nombre del destinatario)
    if (qp.admin) {
      if (!isDir) return json(403, { error: 'Solo Dirección.' });
      const rows = await (await sb('reuniones?select=*&order=fecha.asc,hora.asc&limit=1000')).json();
      const ids = [...new Set((Array.isArray(rows) ? rows : []).map(r => r.usuario_id))];
      let nombres = {};
      if (ids.length) {
        const us = await (await sb('usuarios?id=in.(' + ids.map(x => '"' + x + '"').join(',') + ')&select=id,nombre')).json();
        (us || []).forEach(u => { nombres[u.id] = u.nombre; });
      }
      return json(200, { reuniones: (rows || []).map(r => ({ ...r, destinatario: nombres[r.usuario_id] || '—' })) });
    }

    // Historial de minutas del usuario (reuniones ya realizadas con minuta)
    if (qp.historial) {
      const rows = await (await sb('reuniones?usuario_id=eq.' + encodeURIComponent(user.id) + '&minuta=not.is.null&select=*&order=fecha.desc,hora.desc&limit=200')).json();
      return json(200, { reuniones: Array.isArray(rows) ? rows : [] });
    }

    // Vista usuario: mis reuniones (las que me programó Dirección)
    let path = 'reuniones?usuario_id=eq.' + encodeURIComponent(user.id) + '&select=*&order=fecha.asc,hora.asc&limit=500';
    if (qp.desde) path += '&fecha=gte.' + qp.desde;
    const rows = await (await sb(path)).json();
    return json(200, { reuniones: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
