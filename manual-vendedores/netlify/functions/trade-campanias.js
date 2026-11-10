// ============================================================
//  GrandBar Hub · Function · trade-campanias
//   Campañas y planes que propone Trade Marketing (10/11/2026).
//   - Juan Pablo Sepúlveda (rol "torneo") carga campañas y planes con las mismas
//     pantallas que Luciana. Se guardan sin publicar (activa / activo = false) y
//     acá se mandan a revisar (enviar): le llega el aviso a Luciana.
//   - Luciana (rol compras, y quienes mantienen el panel comercial) las edita en sus
//     pantallas de siempre y acá les hace observaciones (vuelven a Juan Pablo), no
//     las aprueba, o las aprueba: recién ahí se publican en el manual.
//   El estado vive en las columnas revision* de acciones_mensuales y checklist_planes
//   (manual-vendedores/revision-trade-setup.sql).
//   Env: HUB_SERVICE_ROLE (avisos)
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
// Base del manual: las pantallas de Luciana la escriben con esta misma clave pública.
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const TRADE = ['torneo', 'desarrollo', 'diseno'];                  // quien propone
const COMERCIAL = ['compras', 'desarrollo', 'diseno', 'marketing']; // quien revisa
const TIPOS = {
  campania: { tabla: 'acciones_mensuales', activo: 'activa', nombre: (f) => f.producto || f.accion || 'Campaña', una: 'una campaña', la: 'la campaña' },
  plan: { tabla: 'checklist_planes', activo: 'activo', nombre: (f) => f.nombre || 'Plan', una: 'un plan', la: 'el plan' },
};
const ABIERTAS = ['pendiente', 'observada'];
const LINK_LUCIANA = '/manual-vendedores/admin-campanias.html?estado=revision';
const LINK_TRADE = '/trade-campanias.html';

const { pushA } = require('./_notificar');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts,
      headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const man = (path, opts = {}) => fetch(MAN_URL + '/rest/v1/' + path, { ...opts,
      headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,email,rol,activo')).json())[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const esTrade = TRADE.includes(rol), esComercial = COMERCIAL.includes(rol);
    if (!esTrade && !esComercial) return json(403, { error: 'No autorizado.' });
    const quien = perfil.nombre || perfil.email || 'Portal';

    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }
    const T = TIPOS[b.tipo];
    if (!T) return json(400, { error: 'No sé si es una campaña o un plan.' });
    if (!/^[0-9a-f-]{36}$/i.test(String(b.id || ''))) return json(400, { error: 'Falta la campaña.' });

    const leer = async () => {
      const r = await man(T.tabla + '?id=eq.' + b.id + '&select=*');
      return r.ok ? (await r.json())[0] : null;
    };
    // Cambia la fila solo si sigue en uno de los estados esperados (dos clics no la procesan dos veces).
    const cambiar = async (cambios, estados) => {
      const filtro = estados ? '&revision=in.(' + estados.join(',') + ')' : '';
      const r = await man(T.tabla + '?id=eq.' + b.id + filtro, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(cambios) });
      return r.ok ? (await r.json())[0] : null;
    };
    const evento = (que, txt) => ({ fecha: new Date().toISOString(), quien, que, ...(txt ? { texto: txt } : {}) });
    async function notificar(destId, n) {
      if (!destId) return;
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono, titulo: n.titulo, detalle: n.detalle || null, link: n.link || null }) }); } catch (e) {}
      try { await pushA(sb, destId, { title: n.icono + ' ' + n.titulo, body: n.detalle || '', url: n.link || '/' }); } catch (e) {}
    }

    const f = await leer();
    if (!f) return json(404, { error: 'No encontré ' + T.la + '.' });
    const nombre = T.nombre(f);

    // Juan Pablo manda a revisar lo que acaba de guardar (nuevo o corregido).
    if (b.accion === 'enviar') {
      if (!esTrade) return json(403, { error: 'Solo Trade Marketing manda campañas a revisar.' });
      // Solo lo suyo: la pantalla guarda revision_autor al cargarla en modo Trade. Una campaña
      // de Luciana no tiene autor y no pasa por acá.
      if (f.revision_autor !== user.id) return json(403, { error: 'Esa campaña no la cargaste vos.' });
      if (f.revision === 'aprobada') return json(409, { error: 'Ya está aprobada y publicada: solo Luciana la puede cambiar.' });
      const nueva = !f.revision;
      const nota = texto(b.nota, 1500) || null;
      const reenvio = !nueva && f.revision !== 'pendiente';
      const g = await cambiar({ revision: 'pendiente', [T.activo]: false, revision_autor: user.id, revision_autor_nombre: quien, revision_nota: nota,
        revision_historial: [...(f.revision_historial || []), evento(nueva ? 'envio' : (reenvio ? 'reenvio' : 'edito'), nota)] });
      if (!g) return json(502, { error: 'No se pudo mandar a revisar.' });
      if (nueva || reenvio) {
        try {
          const dest = await (await sb('usuarios?rol=eq.compras&select=id,activo')).json();
          for (const u of (Array.isArray(dest) ? dest : []).filter((u) => u.activo !== false)) {
            await notificar(u.id, { icono: '📝', titulo: quien + (reenvio ? ' corrigió ' : ' te mandó ') + T.una + ' para aprobar',
              detalle: nombre + (f.proveedor ? ' (' + f.proveedor + ')' : '') + (nota ? ' — ' + nota.slice(0, 120) : ''), link: LINK_LUCIANA });
          }
        } catch (e) {}
      }
      return json(200, { ok: true, fila: g });
    }

    if (!esComercial) return json(403, { error: 'Solo el panel comercial revisa estas campañas.' });
    if (!ABIERTAS.includes(f.revision)) return json(409, { error: 'Esta propuesta ya fue revisada.' });
    const ahora = new Date().toISOString();

    if (b.accion === 'observar' || b.accion === 'rechazar') {
      const obs = texto(b.observacion, 2000);
      if (b.accion === 'observar' && !obs) return json(400, { error: 'Escribí las observaciones.' });
      const estado = b.accion === 'observar' ? 'observada' : 'rechazada';
      const g = await cambiar({ revision: estado, [T.activo]: false, revision_obs: obs || null, revision_por: quien, revision_at: ahora,
        revision_historial: [...(f.revision_historial || []), evento(b.accion === 'observar' ? 'observo' : 'rechazo', obs)] }, ABIERTAS);
      if (!g) return json(409, { error: 'Esta propuesta ya fue revisada.' });
      await notificar(f.revision_autor, b.accion === 'observar'
        ? { icono: '💬', titulo: quien + ' te hizo observaciones', detalle: nombre + ' — ' + obs.slice(0, 140), link: LINK_TRADE }
        : { icono: '✕', titulo: quien + ' no aprobó ' + T.una, detalle: nombre + (obs ? ' — ' + obs.slice(0, 140) : ''), link: LINK_TRADE });
      return json(200, { ok: true, fila: g });
    }

    if (b.accion === 'aprobar') {
      const g = await cambiar({ revision: 'aprobada', [T.activo]: true, revision_por: quien, revision_at: ahora,
        revision_historial: [...(f.revision_historial || []), evento('aprobo')] }, ABIERTAS);
      if (!g) return json(409, { error: 'Esta propuesta ya fue revisada.' });
      await notificar(f.revision_autor, { icono: '✅', titulo: quien + ' aprobó ' + T.una + ': ya está en el manual', detalle: nombre, link: LINK_TRADE });
      return json(200, { ok: true, fila: g });
    }
    return json(400, { error: 'Acción desconocida.' });
  } catch (e) {
    return json(500, { error: 'Error: ' + (e.message || e) });
  }
};

// Estado del sistema: los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('trade-campanias', module.exports.handler);
