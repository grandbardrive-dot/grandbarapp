// ============================================================
//  GrandBar Hub · Function · reuniones (la agenda de todos)
//
//  Cada persona del Portal (menos los proveedores) tiene su agenda:
//  eventos propios y reuniones con otras personas del Portal.
//
//  Cómo se guarda (tabla `reuniones` del Hub):
//   - Evento personal: UNA fila con usuario_id = creado_por.
//   - Reunión con invitados: una fila POR INVITADO, todas con el mismo
//     `grupo`. Cada invitado confirma o dice que no puede en su fila.
//     Quien la creó (creado_por) no tiene fila propia: la ve por ser el
//     organizador y es el único que la edita, cancela o borra.
//   - Las filas viejas (antes del 21/09/2026) no tienen grupo: cada una
//     es su propia reunión.
//
//  Privacidad: cada uno ve SOLO lo que lo incluye (lo que creó o donde
//  está invitado). Dirección también: decisión del dueño del 21/09/2026.
//
//  Env: HUB_SERVICE_ROLE
// ============================================================

const crypto = require('crypto');
const { pushA } = require('./_notificar');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const TIPOS    = ['reunion', 'llamada', 'visita', 'capacitacion'];
const ESTADOS  = ['programada', 'confirmada', 'realizada', 'cancelada', 'rechazada'];
// Un solo link para todos: la página manda a cada uno a la agenda de su panel.
const AGENDA_URL = '/mi-agenda.html';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const primerNombre = (n, def) => (n && !/@/.test(n)) ? String(n).trim().split(/\s+/)[0] : def;
const hora5 = h => (h ? String(h).slice(0, 5) : '');
const cuandoTxt = f => (f.titulo || '') + ' · ' + f.fecha + (f.hora ? ' ' + hora5(f.hora) : '');
const lista = ids => '(' + ids.map(x => '"' + x + '"').join(',') + ')';
const trozos = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const txt = (s, max) => (String(s == null ? '' : s).trim().slice(0, max) || null);

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
    const leerJson = async (path) => { const r = await sb(path); const j = await r.json(); return Array.isArray(j) ? j : []; };

    const perfil = (await leerJson('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,activo'))[0] || {};
    if (String(perfil.rol || '').toLowerCase() === 'proveedor') return json(403, { error: 'La agenda es para el equipo de GrandBar.' });
    if (perfil.activo === false) return json(403, { error: 'Tu acceso está desactivado.' });
    const yo = String(user.id);
    const miNombre = perfil.nombre || user.email;
    const quien = primerNombre(miNombre, 'Alguien');

    // Campanita + aviso al celular. Nunca frena la acción si falla.
    async function avisar(dest, icono, titulo, detalle, tag) {
      if (!dest || String(dest) === yo) return;
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: dest, icono, titulo, detalle, link: AGENDA_URL }) }); } catch (e) {}
      try { await pushA(sb, dest, { title: icono + ' ' + titulo, body: detalle, url: AGENDA_URL, tag }); } catch (e) {}
    }

    // Si todavía no se corrió el SQL (columnas grupo / con_quien), se guarda igual:
    // sin grupo, y el "con quién" libre al principio del detalle.
    function sinColumna(filas, errTxt) {
      let cambio = false;
      if (/grupo/i.test(errTxt)) { filas.forEach(f => { delete f.grupo; }); cambio = true; }
      if (/con_quien/i.test(errTxt)) {
        filas.forEach(f => {
          if ('con_quien' in f) {
            if (f.con_quien) f.detalle = 'Con: ' + f.con_quien + (f.detalle && !/^Con: /.test(f.detalle) ? '\n' + f.detalle : '');
            delete f.con_quien;
          }
        });
        cambio = true;
      }
      return cambio;
    }
    async function insertar(filas) {
      let r = await sb('reuniones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(filas) });
      if (!r.ok) {
        const t = await r.text();
        if (!sinColumna(filas, t)) return { error: t };
        r = await sb('reuniones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(filas) });
        if (!r.ok) return { error: await r.text() };
      }
      return { filas: await r.json() };
    }
    async function actualizar(filtro, patch) {
      let r = await sb('reuniones?' + filtro, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
      if (!r.ok) {
        const t = await r.text();
        const p = [patch];
        if (!sinColumna(p, t)) return t;
        r = await sb('reuniones?' + filtro, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(p[0]) });
        if (!r.ok) return await r.text();
      }
      return null;
    }
    // Solo se puede invitar a gente del Portal que esté activa y no sea proveedor.
    async function usuariosValidos(ids) {
      const limpios = [...new Set((ids || []).map(String).filter(x => x && x !== yo && x !== '__yo__'))].slice(0, 40);
      if (!limpios.length) return [];
      const us = await leerJson('usuarios?id=in.' + lista(limpios) + '&select=id,nombre,rol,activo');
      return us.filter(u => String(u.rol || '').toLowerCase() !== 'proveedor' && u.activo !== false);
    }
    const invitadosDe = b => Array.isArray(b.invitados) ? b.invitados : (b.usuario_id ? [b.usuario_id] : []);

    // ---------- POST ----------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

      if (b.accion === 'crear') {
        const titulo = txt(b.titulo, 160);
        if (!titulo)  return json(400, { error: 'Falta el título.' });
        if (!b.fecha) return json(400, { error: 'Falta la fecha.' });
        const invitados = await usuariosValidos(invitadosDe(b));
        const base = {
          titulo, detalle: txt(b.detalle, 4000),
          tipo: TIPOS.includes(b.tipo) ? b.tipo : 'reunion',
          fecha: b.fecha, hora: b.hora || null, lugar: txt(b.lugar, 200),
          estado: 'programada', creado_por: yo, creado_por_nombre: miNombre,
        };
        const conQuien = txt(b.con_quien, 120);
        if (conQuien) base.con_quien = conQuien;
        const grupo = invitados.length ? crypto.randomUUID() : null;
        const filas = invitados.length
          ? invitados.map(u => ({ ...base, usuario_id: u.id, grupo }))
          : [{ ...base, usuario_id: yo }];
        const res = await insertar(filas);
        if (res.error) return json(502, { error: 'No pude guardar: ' + String(res.error).slice(0, 160) });
        for (const u of invitados) {
          await avisar(u.id, '📌', quien + ' te invitó a una reunión', cuandoTxt(base), 'reu-new-' + (grupo || '') + u.id);
        }
        return json(200, { ok: true, reunion: (res.filas || [])[0] || null });
      }

      // Las demás acciones son sobre una reunión que ya existe.
      if (!b.id) return json(400, { error: 'Acción inválida' });
      const cur = (await leerJson('reuniones?id=eq.' + encodeURIComponent(b.id) + '&select=*'))[0];
      if (!cur) return json(404, { error: 'Esa reunión ya no existe.' });
      const delGrupo = cur.grupo ? await leerJson('reuniones?grupo=eq.' + encodeURIComponent(cur.grupo) + '&select=*') : [cur];
      const filasG = delGrupo.length ? delGrupo : [cur];
      const idsG = filasG.map(r => r.id);
      const filtroG = 'id=in.' + lista(idsG);
      const esOrganizador = String(cur.creado_por) === yo;
      const miFila = filasG.find(r => String(r.usuario_id) === yo);
      if (!esOrganizador && !miFila) return json(403, { error: 'Esa reunión no está en tu agenda.' });
      const invitadosG = filasG.filter(r => String(r.usuario_id) !== String(r.creado_por)).map(r => String(r.usuario_id));

      // Editar: solo quien la creó. Si cambia el día o la hora, a los que ya habían
      // respondido se les vuelve a pedir confirmación y los recordatorios se rehacen.
      if (b.accion === 'editar') {
        if (!esOrganizador) return json(403, { error: 'Solo quien creó la reunión la puede cambiar.' });
        const titulo = txt(b.titulo, 160);
        if (!titulo)  return json(400, { error: 'Falta el título.' });
        if (!b.fecha) return json(400, { error: 'Falta la fecha.' });
        const nuevos = await usuariosValidos(invitadosDe(b));
        const quiero = nuevos.length ? nuevos.map(u => String(u.id)) : [yo];
        const comun = {
          titulo, detalle: txt(b.detalle, 4000),
          tipo: TIPOS.includes(b.tipo) ? b.tipo : 'reunion',
          fecha: b.fecha, hora: b.hora || null, lugar: txt(b.lugar, 200),
          con_quien: txt(b.con_quien, 120),
        };
        const cambioCuando = String(cur.fecha) !== String(comun.fecha) || hora5(cur.hora) !== hora5(comun.hora);
        const grupo = cur.grupo || (quiero.some(x => x !== yo) ? crypto.randomUUID() : null);
        const quedan  = filasG.filter(r => quiero.includes(String(r.usuario_id)));
        const salen   = filasG.filter(r => !quiero.includes(String(r.usuario_id)));
        const entran  = quiero.filter(x => !filasG.some(r => String(r.usuario_id) === x));

        if (quedan.length) {
          const patch = { ...comun };
          if (grupo) patch.grupo = grupo;
          if (cambioCuando) { patch.aviso_dia_at = null; patch.aviso_hora_at = null; }
          const e1 = await actualizar('id=in.' + lista(quedan.map(r => r.id)), patch);
          if (e1) return json(502, { error: 'No pude guardar: ' + String(e1).slice(0, 160) });
          if (cambioCuando) await actualizar('id=in.' + lista(quedan.map(r => r.id)) + '&estado=in.(confirmada,rechazada)', { estado: 'programada', respuesta: null });
        }
        if (entran.length) {
          const nuevasFilas = entran.map(uid => {
            const f = { ...comun, usuario_id: uid, estado: 'programada', creado_por: yo, creado_por_nombre: cur.creado_por_nombre || miNombre };
            if (grupo) f.grupo = grupo;
            if (cur.minuta) { f.minuta = cur.minuta; f.minuta_at = cur.minuta_at || null; }
            return f;
          });
          const res = await insertar(nuevasFilas);
          if (res.error) return json(502, { error: 'No pude sumar a los invitados: ' + String(res.error).slice(0, 160) });
        }
        if (salen.length) await sb('reuniones?id=in.' + lista(salen.map(r => r.id)), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

        const info = cuandoTxt(comun);
        for (const uid of entran) await avisar(uid, '📌', quien + ' te invitó a una reunión', info, 'reu-new-' + (grupo || cur.id) + uid);
        if (cambioCuando) for (const r of quedan) await avisar(r.usuario_id, '📌', quien + ' cambió la reunión', info, 'reu-edit-' + r.id);
        for (const r of salen) await avisar(r.usuario_id, '❌', quien + ' te sacó de la reunión', comun.titulo, 'reu-fuera-' + r.id);
        return json(200, { ok: true });
      }

      if (b.accion === 'estado') {
        const est = String(b.estado || '');
        if (!ESTADOS.includes(est)) return json(400, { error: 'Estado inválido.' });
        // El organizador cambia la reunión entera (cancelarla, marcarla hecha…).
        if (esOrganizador) {
          const patch = { estado: est };
          if (b.motivo !== undefined) patch.respuesta = txt(b.motivo, 500);
          await actualizar(filtroG, patch);
          if (est === 'cancelada') for (const uid of invitadosG) await avisar(uid, '❌', quien + ' canceló la reunión', cur.titulo || '', 'reu-cancel-' + (cur.grupo || cur.id) + uid);
          return json(200, { ok: true });
        }
        // Un invitado responde por él: confirma, dice que no puede o la marca hecha.
        if (!['confirmada', 'realizada', 'rechazada'].includes(est)) return json(403, { error: 'Eso lo decide quien creó la reunión.' });
        const motivo = txt(b.motivo, 500);
        if (est === 'rechazada' && !motivo) return json(400, { error: 'Poné el motivo por el que no podés asistir.' });
        const patch = { estado: est };
        if (b.motivo !== undefined) patch.respuesta = motivo;
        await actualizar('id=eq.' + encodeURIComponent(miFila.id), patch);
        if (est === 'confirmada' || est === 'rechazada') {
          const nombre = (perfil.nombre && !/@/.test(perfil.nombre)) ? perfil.nombre : 'Un invitado';
          await avisar(cur.creado_por, est === 'confirmada' ? '✅' : '⚠️',
            est === 'confirmada' ? nombre + ' confirmó la reunión' : nombre + ' no puede asistir',
            (cur.titulo || '') + (est === 'rechazada' && motivo ? ' · ' + motivo : ''), 'reu-resp-' + miFila.id);
        }
        return json(200, { ok: true });
      }

      // La minuta es de la reunión: la escribe cualquiera que participe y la ven todos.
      if (b.accion === 'minuta') {
        const prev = cur.minuta || {};
        const clean = (a) => Array.isArray(a) ? a.map((x) => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, 80) : [];
        const minuta = {
          temas: clean(b.temas), pendientes: clean(b.pendientes), notas: String(b.notas || '').trim() || null, autor: miNombre,
          transcript: (b.transcript != null ? String(b.transcript).slice(0, 300000) : (prev.transcript || null)) || null,
          resumen_html: prev.resumen_html || null,
        };
        // Se conserva qué pendientes ya estaban hechos (los que siguen en la lista)
        const pe = {};
        Object.entries(prev.pend_estado || {}).forEach(([t, v]) => { if (minuta.pendientes.includes(t)) pe[t] = v; });
        minuta.pend_estado = pe;
        const e1 = await actualizar(filtroG, { minuta, minuta_at: new Date().toISOString() });
        if (e1) return json(502, { error: 'No pude guardar la minuta: ' + String(e1).slice(0, 160) });
        // Quedó hecha para los que no la habían rechazado ni cancelado.
        await actualizar(filtroG + '&estado=in.(programada,confirmada)', { estado: 'realizada' });
        return json(200, { ok: true });
      }

      if (b.accion === 'resumen') {
        const minuta = cur.minuta || {};
        minuta.resumen_html = String(b.resumen_html || '').slice(0, 150000) || null;
        await actualizar(filtroG, { minuta });
        return json(200, { ok: true });
      }

      // Marcar un pendiente de la minuta como hecho (o volver a abrirlo)
      if (b.accion === 'pendiente' && b.texto) {
        const minuta = cur.minuta || {};
        minuta.pend_estado = minuta.pend_estado || {};
        const t = String(b.texto);
        if (b.hecho) minuta.pend_estado[t] = { hecho: true, at: new Date().toISOString(), por: miNombre };
        else delete minuta.pend_estado[t];
        await actualizar(filtroG, { minuta });
        return json(200, { ok: true });
      }

      // Recordarle a los invitados un pendiente de la reunión
      if (b.accion === 'recordar-pendiente' && b.texto) {
        if (!esOrganizador) return json(403, { error: 'Solo quien creó la reunión manda recordatorios.' });
        if (!invitadosG.length) return json(400, { error: 'Es un evento personal: no hay a quién avisarle.' });
        const detalle = String(b.texto).slice(0, 200) + ' · de la reunión "' + (cur.titulo || '') + '"';
        for (const uid of invitadosG) await avisar(uid, '⏭️', quien + ' te recuerda un pendiente', detalle, 'reu-pend-' + cur.id + uid);
        return json(200, { ok: true });
      }

      if (b.accion === 'borrar') {
        if (!esOrganizador) return json(403, { error: 'Solo quien creó la reunión la puede borrar.' });
        await sb('reuniones?' + filtroG, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // ---------- GET ----------
    const qp = event.queryStringParameters || {};

    // Gente del Portal a la que se puede invitar (todos los activos menos proveedores)
    if (qp.usuarios) {
      const rows = await leerJson('usuarios?select=id,nombre,email,rol,canal,region,es_supervisor,activo&order=nombre.asc&limit=1000');
      return json(200, {
        usuarios: rows
          .filter(u => String(u.rol || '').toLowerCase() !== 'proveedor' && u.activo !== false)
          .map(({ activo, ...u }) => u),
      });
    }

    // Mi agenda: lo que creé y donde estoy invitado. `admin=1` (la agenda de
    // Dirección) devuelve lo mismo: cada uno ve solo lo suyo.
    let path = 'reuniones?or=(usuario_id.eq.' + yo + ',creado_por.eq.' + yo + ')&select=*&limit=2000';
    if (qp.historial) path += '&minuta=not.is.null&order=fecha.desc,hora.desc';
    else path += '&order=fecha.asc,hora.asc';
    if (qp.desde && /^\d{4}-\d{2}-\d{2}$/.test(qp.desde)) path += '&fecha=gte.' + qp.desde;
    const mias = await leerJson(path);

    // Las otras filas de cada reunión (para saber con quién es y quién confirmó)
    const grupos = [...new Set(mias.map(r => r.grupo).filter(Boolean))];
    const porGrupo = {};
    for (const t of trozos(grupos, 80)) {
      const rs = await leerJson('reuniones?grupo=in.' + lista(t) + '&select=id,grupo,usuario_id,creado_por,estado,respuesta');
      rs.forEach(r => { (porGrupo[r.grupo] = porGrupo[r.grupo] || []).push(r); });
    }
    const idsGente = new Set();
    mias.forEach(r => { idsGente.add(r.usuario_id); if (r.creado_por) idsGente.add(r.creado_por); });
    Object.values(porGrupo).forEach(rs => rs.forEach(r => idsGente.add(r.usuario_id)));
    const nombres = {};
    for (const t of trozos([...idsGente].filter(Boolean), 80)) {
      (await leerJson('usuarios?id=in.' + lista(t) + '&select=id,nombre,email')).forEach(u => { nombres[u.id] = u.nombre || u.email; });
    }

    const vistos = new Set(), eventos = [];
    for (const r of mias) {
      const clave = r.grupo || r.id;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const filas = r.grupo ? (porGrupo[r.grupo] || [r]) : [r];
      const organizador = String(r.creado_por) === yo;
      const base = organizador
        ? mias.filter(x => (x.grupo || x.id) === clave).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]
        : (mias.find(x => (x.grupo || x.id) === clave && String(x.usuario_id) === yo) || r);
      const participantes = filas
        .filter(f => String(f.usuario_id) !== String(f.creado_por))
        .map(f => ({ usuario_id: f.usuario_id, nombre: nombres[f.usuario_id] || '—', estado: f.estado, respuesta: f.respuesta || null, yo: String(f.usuario_id) === yo }));
      const personal = participantes.length === 0;
      let estado = base.estado;
      if (organizador && !personal) {
        const est = participantes.map(p => p.estado);
        const activos = est.filter(e => e !== 'cancelada' && e !== 'rechazada');
        if (est.every(e => e === 'cancelada')) estado = 'cancelada';
        else if (est.some(e => e === 'realizada')) estado = 'realizada';
        else if (!activos.length) estado = 'rechazada';
        else if (activos.every(e => e === 'confirmada')) estado = 'confirmada';
        else estado = 'programada';
      }
      const orgNombre = r.creado_por_nombre || nombres[r.creado_por] || '—';
      // Con quién es, visto desde mí: todos los que están menos yo.
      const con = [];
      if (!organizador && r.creado_por && String(r.creado_por) !== yo) con.push(orgNombre);
      participantes.forEach(p => { if (!p.yo) con.push(p.nombre); });
      eventos.push({
        ...base,
        estado,
        mi_estado: organizador ? null : base.estado,
        organizador,
        organizador_nombre: orgNombre,
        participantes,
        personal,
        con,
        destinatario: personal ? (base.con_quien || 'Personal') : con.join(', '),
      });
    }
    return json(200, { reuniones: eventos });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
