// ============================================================
//  GrandBar Hub · Function · crm-publicar
//   Publica una acción del CRM (crm_acciones, HUB) a los vendedores:
//   la marca publicada=true y les manda una notificación a la campanita
//   (+ push al celu). La acción queda visible en acciones-crm.html.
//   Solo la puede llamar el equipo que carga el CRM. Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const EQUIPO   = ['desarrollo', 'diseno', 'compras', 'torneo', 'direccion', 'admin', 'duenio'];
const LINK     = 'acciones-crm.html';

let pushA = async () => 0;
try { ({ pushA } = require('./_notificar')); } catch (e) {}

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });

    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, {
      ...opts,
      headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol')).json())[0] || {};
    if (!EQUIPO.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'No autorizado' });

    const body = JSON.parse(event.body || '{}');
    const accionId = body.accion_id;
    if (!accionId) return json(400, { error: 'Falta accion_id' });

    const acc = (await (await sb('crm_acciones?id=eq.' + encodeURIComponent(accionId) + '&select=id,nombre,rubro,proveedor')).json())[0];
    if (!acc) return json(404, { error: 'Acción no encontrada' });

    // Marca la acción como publicada
    await sb('crm_acciones?id=eq.' + encodeURIComponent(accionId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ publicada: true, publicada_at: new Date().toISOString() }),
    });

    // Destinatarios: vendedores (ventas / mayorista) + supervisores, activos
    let dests = [];
    try {
      const rows = await (await sb('usuarios?select=id,activo&or=(rol.eq.ventas,rol.eq.mayorista,es_supervisor.eq.true)')).json();
      dests = (Array.isArray(rows) ? rows : []).filter(u => u && u.id && u.activo !== false).map(u => u.id);
      dests = [...new Set(dests)];
    } catch (e) {}

    const icono = '📣';
    const titulo = 'Nueva acción CRM' + (acc.proveedor ? ': ' + acc.proveedor : '');
    const detalle = (acc.nombre || 'Nueva acción') + ' · mirá la placa y cómo cargarla';

    let avisados = 0;
    for (const dest of dests) {
      try {
        await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: dest, icono, titulo, detalle, link: LINK }) });
        avisados++;
      } catch (e) {}
      try { await pushA(sb, dest, { title: icono + ' ' + titulo, body: detalle, url: LINK, tag: 'crm-' + accionId }); } catch (e) {}
    }

    return json(200, { ok: true, avisados });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
