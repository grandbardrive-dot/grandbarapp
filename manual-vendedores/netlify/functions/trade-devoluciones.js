// ============================================================
//  GrandBar Hub · Function · trade-devoluciones
//   Devoluciones de Trade Marketing (06/10/2026).
//   - Juan Pablo Sepúlveda (rol "torneo", jefe de Trade Marketing) ve las acciones
//     que carga Luciana, las trabaja con los vendedores y se las devuelve con
//     observaciones (crear).
//   - Luciana (rol compras, y quienes mantienen el panel comercial) las lee,
//     responde y las marca vistas o resueltas (responder).
//   Las acciones se leen en el navegador de sus propias bases; acá solo se guardan
//   las devoluciones (tabla acciones_devoluciones del Hub, cerrada al navegador).
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const TRADE = ['torneo', 'desarrollo', 'diseno'];                  // quien devuelve
const COMERCIAL = ['compras', 'desarrollo', 'diseno', 'marketing']; // quien responde
const ORIGENES = ['campania', 'plan', 'fecha', 'catalogo'];
const ESTADOS = ['pendiente', 'vista', 'resuelta'];
const LINK_LUCIANA = '/manual-vendedores/admin-devoluciones.html';
const LINK_TRADE = '/trade-acciones.html#devoluciones';

const { traerTodo } = require('./_paginar');
const { pushA } = require('./_notificar');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts,
      headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,email,rol,activo')).json())[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const esTrade = TRADE.includes(rol), esComercial = COMERCIAL.includes(rol);
    if (!esTrade && !esComercial) return json(403, { error: 'No autorizado.' });
    const quien = perfil.nombre || perfil.email || 'Portal';

    async function notificar(destId, n) {
      if (!destId) return;
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono, titulo: n.titulo, detalle: n.detalle || null, link: n.link || null }) }); } catch (e) {}
      try { await pushA(sb, destId, { title: n.icono + ' ' + n.titulo, body: n.detalle || '', url: n.link || '/' }); } catch (e) {}
    }

    // ---------------- GET ----------------
    if (event.httpMethod === 'GET') {
      const qp = event.queryStringParameters || {};
      if (qp.vista === 'contar') {
        const r = await sb('acciones_devoluciones?select=id&estado=eq.pendiente', { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } });
        if (!r.ok) return json(502, { error: 'No se pudieron contar las devoluciones.' });
        return json(200, { pendientes: Number(((r.headers.get('content-range') || '').split('/')[1])) || 0 });
      }
      // Todas (Juan Pablo y Luciana ven la misma lista). Primero se confirma que la tabla
      // exista: traerTodo devuelve [] si la consulta falla y parecería que no hay nada.
      const prueba = await sb('acciones_devoluciones?select=id&limit=1');
      if (!prueba.ok) return json(502, { error: 'No se pudieron leer las devoluciones. ¿Ya se corrió trade-devoluciones-setup.sql?' });
      const filas = await traerTodo(sb, 'acciones_devoluciones?select=*&order=created_at.desc');
      return json(200, { devoluciones: filas, puede: { devolver: esTrade, responder: esComercial } });
    }

    // ---------------- POST ----------------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }

      if (b.accion === 'crear') {
        if (!esTrade) return json(403, { error: 'Solo Trade Marketing devuelve acciones.' });
        const origen = texto(b.origen, 20);
        if (!ORIGENES.includes(origen)) return json(400, { error: 'No sé de qué acción se trata.' });
        const accion_id = texto(b.accion_id, 80), accion_nombre = texto(b.accion_nombre, 200);
        if (!accion_id || !accion_nombre) return json(400, { error: 'Falta la acción.' });
        const observacion = texto(b.observacion, 2000);
        if (!observacion) return json(400, { error: 'Escribí las observaciones.' });
        let detalle = (b.detalle && typeof b.detalle === 'object') ? b.detalle : {};
        if (JSON.stringify(detalle).length > 4000) detalle = {};
        const fila = { origen, accion_id, accion_nombre, accion_detalle: detalle, observacion,
          vendedores: texto(b.vendedores, 300) || null, autor_id: user.id, autor_nombre: quien, estado: 'pendiente' };
        const r = await sb('acciones_devoluciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No se pudo guardar la devolución. ¿Ya se corrió trade-devoluciones-setup.sql?' });
        const guardada = (await r.json())[0];
        // Aviso a Luciana (rol compras).
        try {
          const dest = await (await sb('usuarios?rol=eq.compras&select=id,activo')).json();
          for (const u of (Array.isArray(dest) ? dest : []).filter(u => u.activo !== false)) {
            await notificar(u.id, { icono: '📣', titulo: quien + ' te devolvió una acción', detalle: accion_nombre + ' — ' + observacion.slice(0, 140), link: LINK_LUCIANA });
          }
        } catch (e) {}
        return json(200, { ok: true, devolucion: guardada });
      }

      if (b.accion === 'responder') {
        if (!esComercial) return json(403, { error: 'Solo el panel comercial responde las devoluciones.' });
        const estado = texto(b.estado, 20);
        if (!ESTADOS.includes(estado)) return json(400, { error: 'Estado inválido.' });
        const respuesta = texto(b.respuesta, 2000);
        const cambios = { estado };
        if (estado === 'pendiente') Object.assign(cambios, { respuesta: null, respondido_por: null, respondido_at: null });
        else Object.assign(cambios, { respondido_por: quien, respondido_at: new Date().toISOString(), ...(respuesta ? { respuesta } : {}) });
        const r = await sb('acciones_devoluciones?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(cambios) });
        const f = r.ok ? (await r.json())[0] : null;
        if (!f) return json(404, { error: 'No encontré la devolución.' });
        // Aviso a quien la devolvió, cuando hay algo para contarle.
        if (estado === 'resuelta' || respuesta) {
          await notificar(f.autor_id, { icono: estado === 'resuelta' ? '✅' : '💬',
            titulo: quien + (estado === 'resuelta' ? ' resolvió tu devolución' : ' respondió tu devolución'),
            detalle: f.accion_nombre + (respuesta ? ' — ' + respuesta.slice(0, 140) : ''), link: LINK_TRADE });
        }
        return json(200, { ok: true, devolucion: f });
      }

      if (b.accion === 'borrar') {
        // Quien la mandó la puede sacar mientras Luciana no la haya visto.
        if (!esTrade) return json(403, { error: 'No autorizado.' });
        const f = (await (await sb('acciones_devoluciones?id=eq.' + encodeURIComponent(b.id) + '&autor_id=eq.' + encodeURIComponent(user.id) + '&select=id,estado')).json())[0];
        if (!f) return json(404, { error: 'No encontré la devolución.' });
        if (f.estado !== 'pendiente') return json(409, { error: 'Luciana ya la vio: no se puede borrar.' });
        await sb('acciones_devoluciones?id=eq.' + encodeURIComponent(f.id), { method: 'DELETE' });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción desconocida.' });
    }
    return json(405, { error: 'Método no permitido' });
  } catch (e) {
    return json(500, { error: 'Error: ' + (e.message || e) });
  }
};
