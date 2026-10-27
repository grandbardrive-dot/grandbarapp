// ============================================================
//  GrandBar Hub · Function · tarea-nahuel
//   Cuando Josefina le asigna una tarea a Nahuel (tareas_para_nahuel),
//   mi-panel.html llama acá: deja la notificación en la campanita de Nahuel
//   y le manda el push al celu (con sonido gracioso del lado del Hub).
//   Solo la puede llamar el equipo (diseno / desarrollo / admin).
//   Env: HUB_SERVICE_ROLE, VAPID_*
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const NAHUEL   = '0627218c-cb7a-4d88-bb5c-4090cf11d28e'; // destinatario fijo
const EQUIPO   = ['diseno', 'desarrollo', 'admin'];
const LINK     = 'tareas-nahuel.html';

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

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,nombre')).json())[0] || {};
    if (!EQUIPO.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'No autorizado' });

    const body = JSON.parse(event.body || '{}');
    const titulo = String(body.titulo || '').trim();
    if (!titulo) return json(400, { error: 'Falta el título de la tarea' });
    const prioridad = String(body.prioridad || 'media').toLowerCase();
    const quien = (perfil.nombre || 'Josefina').split(/\s+/)[0];
    const emoji = prioridad === 'alta' ? '🔴' : (prioridad === 'baja' ? '🔵' : '🟡');

    // La campanita (tabla notificaciones) la inserta mi-panel.html directo, para no
    // duplicar. Acá SOLO mandamos el push al celu.
    // Push al celu (si tiene suscripción). tag 'tarea-nahuel'.
    let push = 0;
    try { push = await pushA(sb, NAHUEL, { title: '✅ Nueva tarea de ' + quien, body: emoji + ' ' + titulo, url: LINK, tag: 'tarea-nahuel' }); } catch (e) {}

    return json(200, { ok: true, push });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
