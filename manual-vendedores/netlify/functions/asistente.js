// ============================================================
//  GrandBar Hub · Function · asistente  (Mi asistente, 10/10/2026)
//
//  Brenda (administración) conversa con un asistente y lo va educando:
//  cuando le explica o le corrige algo, el asistente propone recordarlo y
//  ella decide si se guarda. Lo que le piden y todavía no puede hacer queda
//  anotado para que Desarrollo sepa qué agregarle.
//
//  Esta function hace lo rápido (listar, guardar lecciones, recibir el
//  mensaje). Pensar la respuesta lleva más de los 10 s que Netlify le da a
//  una function común, así que eso lo hace asistente-background y la
//  pantalla consulta acá cada un par de segundos hasta que termina.
//
//    GET  ?que=inicio                 charlas, lecciones y pendientes propios
//    GET  ?que=charla&id=             una charla, como la ve la persona
//    GET  ?que=revision               (Desarrollo/Diseño) lecciones y pendientes de todos
//    POST {accion:'nueva'}
//         {accion:'enviar', charla_id, texto}
//         {accion:'reintentar', charla_id}
//         {accion:'guardar_leccion', charla_id, propuesta_id, texto}
//         {accion:'descartar_propuesta', charla_id, propuesta_id}
//         {accion:'nueva_leccion', texto} | {accion:'editar_leccion', id, texto} | {accion:'borrar_leccion', id}
//         {accion:'borrar_charla', id}
//         {accion:'pendiente_estado', id, estado, nota}   (Desarrollo/Diseño)
//
//  Env: HUB_SERVICE_ROLE (y las de asistente-background)
// ============================================================

const A = require('./_asistente');
const { json, sb, leer } = A;

const MAX_TEXTO   = 4000;          // un mensaje
const MAX_CHARLA  = 900000;        // caracteres del historial: más que esto, charla nueva
const TRABADA_MS  = 4 * 60 * 1000; // pensando más que esto = algo se cortó, se puede reintentar

const limpio = (s, max) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim().slice(0, max);

exports.handler = async (event) => {
  try {
    if (!process.env.HUB_SERVICE_ROLE) return json(500, { error: 'Falta configurar HUB_SERVICE_ROLE en Netlify.' });
    const yo = await A.quienEs(event);
    if (!yo) return json(401, { error: 'Se venció la sesión. Volvé a entrar al Portal.' });
    if (!yo.activo) return json(403, { error: 'Tu acceso está desactivado.' });
    const puedeChat = A.ROLES_CHAT.includes(yo.rol);
    const puedeRevisar = A.ROLES_REVISION.includes(yo.rol);
    if (!puedeChat && !puedeRevisar) return json(403, { error: 'El asistente todavía no está habilitado para tu usuario.' });

    const uid = encodeURIComponent(yo.id);
    const miCharla = async (id) => id
      ? (await leer('asistente_charlas?id=eq.' + encodeURIComponent(id) + '&usuario_id=eq.' + uid + '&select=*'))[0] || null
      : null;
    const patchCharla = (id, campos) => sb('asistente_charlas?id=eq.' + encodeURIComponent(id) + '&usuario_id=eq.' + uid,
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...campos, updated_at: new Date().toISOString() }) });
    const trabada = c => ['pensando', 'trabajando'].includes(c.estado)
      && (!c.pensando_desde || Date.now() - new Date(c.pensando_desde).getTime() > TRABADA_MS);

    // Le pasa la charla a la function de fondo. Netlify contesta 202 al toque.
    async function despertar(charlaId) {
      const base = process.env.URL || 'https://portalgrandbar.com';
      try {
        const r = await fetch(base + '/.netlify/functions/asistente-background', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + yo.token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ charla_id: charlaId }),
        });
        if (r.status >= 400) throw new Error('HTTP ' + r.status);
        return true;
      } catch (e) {
        await patchCharla(charlaId, { estado: 'error', error: 'No se pudo arrancar el asistente (' + (e.message || e) + '). Probá de nuevo.' });
        return false;
      }
    }

    // ══════════ LECTURA ══════════
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};

      if (p.que === 'charla') {
        const c = await miCharla(p.id);
        if (!c) return json(404, { error: 'Esa conversación ya no existe.' });
        return json(200, { charla: { ...A.resumenCharla(c), error: c.error, trabada: trabada(c), vista: A.vistaDe(c) } });
      }

      if (p.que === 'revision') {
        if (!puedeRevisar) return json(403, { error: 'Esto lo ve Desarrollo.' });
        const [lecciones, pendientes] = await Promise.all([
          leer('asistente_lecciones?activa=eq.true&select=id,usuario_id,texto,origen,created_at,updated_at&order=created_at.desc&limit=500'),
          leer('asistente_pendientes?select=*&order=created_at.desc&limit=500'),
        ]);
        const ids = [...new Set([...lecciones, ...pendientes].map(x => x.usuario_id))];
        const nombres = {};
        if (ids.length) (await leer('usuarios?id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=id,nombre,email'))
          .forEach(u => { nombres[u.id] = u.nombre || u.email; });
        const conNombre = x => ({ ...x, de: nombres[x.usuario_id] || '—' });
        return json(200, { lecciones: lecciones.map(conNombre), pendientes: pendientes.map(conNombre) });
      }

      // inicio
      const [charlas, lecciones, pendientes] = await Promise.all([
        puedeChat ? leer('asistente_charlas?usuario_id=eq.' + uid + '&select=id,titulo,estado,created_at,updated_at&order=updated_at.desc&limit=40') : [],
        A.leccionesDe(yo.id),
        leer('asistente_pendientes?usuario_id=eq.' + uid + '&select=id,pedido,que_haria_falta,estado,nota,created_at&order=created_at.desc&limit=200'),
      ]);
      return json(200, { yo: { nombre: yo.nombre, rol: yo.rol }, puedeChat, puedeRevisar, charlas, lecciones, pendientes });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

    // ── Desarrollo marca qué hizo con un pendiente ──
    if (b.accion === 'pendiente_estado') {
      if (!puedeRevisar) return json(403, { error: 'Esto lo maneja Desarrollo.' });
      if (!['nuevo', 'visto', 'hecho', 'descartado'].includes(b.estado)) return json(400, { error: 'Estado desconocido.' });
      const campos = { estado: b.estado };
      if (b.nota !== undefined) campos.nota = limpio(b.nota, 1000) || null;
      const r = await sb('asistente_pendientes?id=eq.' + encodeURIComponent(b.id || ''), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(campos) });
      const filas = await r.json().catch(() => []);
      if (!r.ok || !filas.length) return json(404, { error: 'Ese pendiente ya no existe.' });
      return json(200, { ok: true });
    }

    if (!puedeChat) return json(403, { error: 'El asistente todavía no está habilitado para tu usuario.' });

    // ── Lecciones cargadas o corregidas a mano ──
    if (b.accion === 'nueva_leccion' || b.accion === 'editar_leccion' || b.accion === 'borrar_leccion') {
      const texto = limpio(b.texto, 2000);
      if (b.accion !== 'borrar_leccion' && !texto) return json(400, { error: 'Escribí qué tiene que recordar.' });
      let r;
      if (b.accion === 'nueva_leccion') {
        r = await sb('asistente_lecciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ usuario_id: yo.id, texto, origen: 'manual' }) });
      } else {
        const campos = b.accion === 'borrar_leccion' ? { activa: false } : { texto };
        r = await sb('asistente_lecciones?id=eq.' + encodeURIComponent(b.id || '') + '&usuario_id=eq.' + uid,
          { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...campos, updated_at: new Date().toISOString() }) });
      }
      const filas = await r.json().catch(() => []);
      if (!r.ok || !filas.length) return json(400, { error: 'No se pudo guardar.' });
      return json(200, { ok: true, lecciones: await A.leccionesDe(yo.id) });
    }

    if (b.accion === 'nueva') {
      const r = await sb('asistente_charlas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ usuario_id: yo.id }) });
      const filas = await r.json().catch(() => []);
      if (!r.ok || !filas.length) return json(502, { error: 'No se pudo empezar la conversación.' });
      return json(200, { charla: A.resumenCharla(filas[0]) });
    }

    if (b.accion === 'borrar_charla') {
      const c = await miCharla(b.id);
      if (!c) return json(404, { error: 'Esa conversación ya no existe.' });
      if (['pensando', 'trabajando'].includes(c.estado) && !trabada(c)) return json(409, { error: 'Esperá a que termine de responder.' });
      await sb('asistente_charlas?id=eq.' + encodeURIComponent(c.id) + '&usuario_id=eq.' + uid, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return json(200, { ok: true });
    }

    const c = await miCharla(b.charla_id);
    if (!c) return json(404, { error: 'Esa conversación ya no existe.' });

    // ── Guardar (o no) lo que el asistente propuso recordar ──
    if (b.accion === 'guardar_leccion' || b.accion === 'descartar_propuesta') {
      const propuesta = (c.mensajes || []).some(m => m.role === 'assistant' && Array.isArray(m.content)
        && m.content.some(x => x.type === 'tool_use' && x.name === 'proponer_leccion' && x.id === b.propuesta_id));
      if (!propuesta) return json(404, { error: 'No encuentro esa propuesta.' });
      const props = { ...(c.propuestas || {}) };
      if ((props[b.propuesta_id] || {}).estado === 'guardada') return json(200, { ok: true });
      if (b.accion === 'descartar_propuesta') {
        props[b.propuesta_id] = { ...(props[b.propuesta_id] || {}), estado: 'descartada' };
      } else {
        const texto = limpio(b.texto, 2000);
        if (!texto) return json(400, { error: 'Escribí qué tiene que recordar.' });
        const r = await sb('asistente_lecciones', { method: 'POST', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ usuario_id: yo.id, texto, origen: 'propuesta', charla_id: c.id }) });
        const filas = await r.json().catch(() => []);
        if (!r.ok || !filas.length) return json(502, { error: 'No se pudo guardar.' });
        props[b.propuesta_id] = { texto, estado: 'guardada', leccion_id: filas[0].id };
      }
      await patchCharla(c.id, { propuestas: props });
      return json(200, { ok: true });
    }

    if (b.accion === 'enviar' || b.accion === 'reintentar') {
      if (['pensando', 'trabajando'].includes(c.estado) && !trabada(c)) return json(409, { error: 'Todavía está respondiendo lo anterior.' });
      const mensajes = Array.isArray(c.mensajes) ? [...c.mensajes] : [];

      if (b.accion === 'reintentar') {
        // Solo tiene sentido si quedó una pregunta sin respuesta.
        const ult = mensajes[mensajes.length - 1];
        if (!ult || ult.role === 'assistant') {
          await patchCharla(c.id, { estado: 'listo', error: null });
          return json(200, { ok: true });
        }
        await patchCharla(c.id, { estado: 'pensando', pensando_desde: new Date().toISOString(), error: null });
        await despertar(c.id);
        return json(200, { ok: true });
      }

      const texto = limpio(b.texto, MAX_TEXTO);
      if (!texto) return json(400, { error: 'Escribí algo.' });
      if (JSON.stringify(mensajes).length > MAX_CHARLA) {
        return json(400, { error: 'Esta conversación ya es muy larga. Empezá una nueva: lo que aprendí lo sigo sabiendo.' });
      }

      // Un mensaje de sistema solo puede ir último o antes de una respuesta del
      // asistente. Si la vez anterior quedó uno sin respuesta (se cortó o no
      // pudo contestar), se saca y se vuelve a mandar la nota completa abajo.
      // Está después de la última respuesta, así que no toca nada ya pensado.
      let forzar = false;
      while (mensajes.length && mensajes[mensajes.length - 1].role === 'system') { mensajes.pop(); forzar = true; }

      mensajes.push({ role: 'user', content: texto });

      // ¿Hay que avisarle la fecha o la lista nueva de lo que aprendió?
      // Va después del mensaje de la persona, como mensaje de sistema: así no se
      // toca nada de lo ya hablado.
      const lecciones = await A.leccionesDe(yo.id);
      const hash = A.hashLecciones(lecciones);
      const hoy = A.hoyAR();
      const avisarFecha = forzar || c.ultima_fecha !== hoy;
      const avisarLecciones = forzar || c.lecciones_hash !== hash;
      if (avisarFecha || avisarLecciones) {
        mensajes.push({ role: 'system', content: A.notaDeSistema(yo.nombre, lecciones, { avisarFecha, avisarLecciones }) });
      }

      await patchCharla(c.id, {
        mensajes, estado: 'pensando', pensando_desde: new Date().toISOString(), error: null,
        lecciones_hash: hash, ultima_fecha: hoy,
        ...(c.titulo ? {} : { titulo: texto.split('\n')[0].slice(0, 70) }),
      });
      await despertar(c.id);
      return json(200, { ok: true });
    }

    return json(400, { error: 'Acción desconocida: ' + b.accion });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

// Estado del sistema (11/10/2026): los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('asistente', module.exports.handler);
