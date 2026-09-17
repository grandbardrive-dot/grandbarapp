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
        if (!b.titulo)     return json(400, { error: 'Falta el título.' });
        if (!b.fecha)      return json(400, { error: 'Falta la fecha.' });
        // Evento personal (sin otro usuario): queda a nombre de quien lo crea.
        if (!b.usuario_id || b.usuario_id === '__yo__') b.usuario_id = user.id;
        const fila = {
          usuario_id: b.usuario_id, titulo: b.titulo, detalle: b.detalle || null,
          tipo: ['reunion', 'llamada', 'visita', 'capacitacion'].includes(b.tipo) ? b.tipo : 'reunion',
          fecha: b.fecha, hora: b.hora || null, lugar: b.lugar || null,
          estado: 'programada', creado_por: user.id, creado_por_nombre: perfil.nombre || user.email,
        };
        // Con quién (nombre libre) solo en eventos personales
        const conQuien = String(b.usuario_id) === String(user.id) ? (String(b.con_quien || '').trim().slice(0, 120) || null) : null;
        if (conQuien) fila.con_quien = conQuien;
        let r = await sb('reuniones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok && conQuien && /con_quien/i.test(await r.clone().text())) {
          // Todavía no existe la columna: se guarda el nombre al principio del detalle
          delete fila.con_quien;
          fila.detalle = 'Con: ' + conQuien + (fila.detalle ? '\n' + fila.detalle : '');
          r = await sb('reuniones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        }
        if (!r.ok) return json(502, { error: 'No pude crear: ' + (await r.text()).slice(0, 160) });
        // aviso al usuario en su campanita (no si es un evento personal)
        if (String(b.usuario_id) !== String(user.id)) try {
          const quien = (perfil.nombre && !/@/.test(perfil.nombre)) ? String(perfil.nombre).split(/\s+/)[0] : 'Dirección';
          const detalle = fila.titulo + ' · ' + fila.fecha + (fila.hora ? ' ' + String(fila.hora).slice(0, 5) : '');
          await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: b.usuario_id, icono: '📌', titulo: quien + ' te programó una reunión', detalle, link: 'agenda.html' }) });
          await pushA(sb, b.usuario_id, { title: '📌 ' + quien + ' te programó una reunión', body: detalle, url: '/agenda.html', tag: 'reu-new-' + b.usuario_id });
        } catch (e) {}
        return json(200, { ok: true, reunion: (await r.json())[0] });
      }

      // Editar una reunión (fecha, hora, persona, título…). Si cambia cuándo o con quién,
      // vuelve a pedir confirmación y los recordatorios se reprograman.
      if (b.accion === 'editar' && b.id) {
        if (!isDir) return json(403, { error: 'Solo Dirección puede editar reuniones.' });
        const cur = (await (await sb('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=*')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        if (!b.titulo) return json(400, { error: 'Falta el título.' });
        if (!b.fecha)  return json(400, { error: 'Falta la fecha.' });
        const destino = (!b.usuario_id || b.usuario_id === '__yo__') ? user.id : b.usuario_id;
        const patch = {
          usuario_id: destino, titulo: b.titulo, detalle: b.detalle || null,
          tipo: ['reunion', 'llamada', 'visita', 'capacitacion'].includes(b.tipo) ? b.tipo : 'reunion',
          fecha: b.fecha, hora: b.hora || null, lugar: b.lugar || null,
        };
        if (String(destino) === String(user.id)) patch.con_quien = String(b.con_quien || '').trim().slice(0, 120) || null;
        else if ('con_quien' in cur) patch.con_quien = null;
        const hora5 = h => (h ? String(h).slice(0, 5) : '');
        const cambioCuando = String(cur.fecha) !== String(patch.fecha) || hora5(cur.hora) !== hora5(patch.hora);
        const cambioQuien  = String(cur.usuario_id) !== String(destino);
        if (cambioCuando || cambioQuien) {
          patch.aviso_dia_at = null; patch.aviso_hora_at = null;
          if (['confirmada', 'rechazada'].includes(cur.estado)) { patch.estado = 'programada'; patch.respuesta = null; }
        }
        let r = await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        if (!r.ok && 'con_quien' in patch && /con_quien/i.test(await r.clone().text())) {
          const nombre = patch.con_quien; delete patch.con_quien;
          if (nombre) patch.detalle = 'Con: ' + nombre + (patch.detalle && !/^Con: /.test(patch.detalle) ? '\n' + patch.detalle : '');
          r = await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        }
        if (!r.ok) return json(502, { error: 'No pude guardar: ' + (await r.text()).slice(0, 160) });
        if ((cambioCuando || cambioQuien) && String(destino) !== String(user.id)) {
          try {
            const quien = (perfil.nombre && !/@/.test(perfil.nombre)) ? String(perfil.nombre).split(/\s+/)[0] : 'Dirección';
            const detalle = patch.titulo + ' · ' + patch.fecha + (patch.hora ? ' ' + hora5(patch.hora) : '');
            const titulo = cambioQuien ? quien + ' te programó una reunión' : quien + ' cambió la reunión';
            await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destino, icono: '📌', titulo, detalle, link: 'agenda.html' }) });
            await pushA(sb, destino, { title: '📌 ' + titulo, body: detalle, url: '/agenda.html', tag: 'reu-edit-' + b.id });
          } catch (e) {}
        }
        return json(200, { ok: true });
      }

      // Marcar un pendiente de la minuta como hecho (o volver a abrirlo)
      if (b.accion === 'pendiente' && b.id && b.texto) {
        const cur = (await (await sb('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=usuario_id,minuta')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        if (!isDir && String(cur.usuario_id) !== String(user.id)) return json(403, { error: 'No autorizado.' });
        const minuta = cur.minuta || {};
        minuta.pend_estado = minuta.pend_estado || {};
        const t = String(b.texto);
        if (b.hecho) minuta.pend_estado[t] = { hecho: true, at: new Date().toISOString(), por: perfil.nombre || user.email };
        else delete minuta.pend_estado[t];
        await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ minuta }) });
        return json(200, { ok: true });
      }

      // Recordarle a la persona un pendiente de la reunión (campanita + aviso al celular)
      if (b.accion === 'recordar-pendiente' && b.id && b.texto) {
        if (!isDir) return json(403, { error: 'Solo Dirección.' });
        const cur = (await (await sb('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=usuario_id,titulo,fecha')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        if (String(cur.usuario_id) === String(user.id)) return json(400, { error: 'Es un evento personal: no hay a quién avisarle.' });
        const quien = (perfil.nombre && !/@/.test(perfil.nombre)) ? String(perfil.nombre).split(/\s+/)[0] : 'Dirección';
        const detalle = String(b.texto).slice(0, 200) + ' · de la reunión "' + (cur.titulo || '') + '"';
        await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: cur.usuario_id, icono: '⏭️', titulo: quien + ' te recuerda un pendiente', detalle, link: 'agenda.html' }) });
        try { await pushA(sb, cur.usuario_id, { title: '⏭️ ' + quien + ' te recuerda un pendiente', body: detalle, url: '/agenda.html', tag: 'reu-pend-' + b.id }); } catch (e) {}
        return json(200, { ok: true });
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
        // Si Dirección la cancela, se le avisa a la persona (salvo que sea un evento personal)
        if (est === 'cancelada' && isDir && cur.usuario_id && String(cur.usuario_id) !== String(user.id)) {
          try {
            const quien = (perfil.nombre && !/@/.test(perfil.nombre)) ? String(perfil.nombre).split(/\s+/)[0] : 'Dirección';
            await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: cur.usuario_id, icono: '❌', titulo: quien + ' canceló la reunión', detalle: cur.titulo || '', link: 'agenda.html' }) });
            await pushA(sb, cur.usuario_id, { title: '❌ ' + quien + ' canceló la reunión', body: cur.titulo || '', url: '/agenda.html', tag: 'reu-cancel-' + b.id });
          } catch (e) {}
        }
        // Avisar a quien la programó (Dirección) que el usuario respondió → push
        if (esMia && cur.creado_por && (est === 'confirmada' || est === 'rechazada')) {
          const nombre = (perfil.nombre && !/@/.test(perfil.nombre)) ? perfil.nombre : 'El usuario';
          const txt = est === 'confirmada' ? nombre + ' confirmó la reunión' : nombre + ' no puede asistir';
          try { await pushA(sb, cur.creado_por, { title: (est === 'confirmada' ? '✅ ' : '⚠️ ') + txt, body: (cur.titulo || '') + (est === 'rechazada' && patch.respuesta ? ' · ' + patch.respuesta : ''), url: '/dir-agenda.html', tag: 'reu-resp-' + b.id }); } catch (e) {}
        }
        return json(200, { ok: true });
      }

      if (b.accion === 'minuta' && b.id) {
        const cur = (await (await sb('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=usuario_id,minuta')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        const esMia = String(cur.usuario_id) === String(user.id);
        if (!isDir && !esMia) return json(403, { error: 'No autorizado.' });
        const prev = cur.minuta || {};
        const clean = (a) => Array.isArray(a) ? a.map((x) => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, 80) : [];
        const minuta = {
          temas: clean(b.temas), pendientes: clean(b.pendientes), notas: String(b.notas || '').trim() || null, autor: perfil.nombre || user.email,
          transcript: (b.transcript != null ? String(b.transcript).slice(0, 300000) : (prev.transcript || null)) || null,
          resumen_html: prev.resumen_html || null,
        };
        // Se conserva qué pendientes ya estaban hechos (los que siguen en la lista)
        const pe = {};
        Object.entries(prev.pend_estado || {}).forEach(([t, v]) => { if (minuta.pendientes.includes(t)) pe[t] = v; });
        minuta.pend_estado = pe;
        const patch = { minuta, minuta_at: new Date().toISOString(), estado: 'realizada' };
        const r = await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        if (!r.ok) return json(502, { error: 'No pude guardar la minuta: ' + (await r.text()).slice(0, 160) });
        return json(200, { ok: true });
      }

      if (b.accion === 'resumen' && b.id) {
        const cur = (await (await sb('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=usuario_id,minuta')).json())[0];
        if (!cur) return json(404, { error: 'No existe.' });
        if (!isDir && String(cur.usuario_id) !== String(user.id)) return json(403, { error: 'No autorizado.' });
        const minuta = cur.minuta || {};
        minuta.resumen_html = String(b.resumen_html || '').slice(0, 150000) || null;
        await sb('reuniones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ minuta }) });
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
      return json(200, { reuniones: (rows || []).map(r => ({ ...r, destinatario: nombres[r.usuario_id] || '—', personal: String(r.usuario_id) === String(r.creado_por) })) });
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
