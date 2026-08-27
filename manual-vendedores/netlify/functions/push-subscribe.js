// ============================================================
//  GrandBar Hub · Function · push-subscribe
//   Guarda/borra la suscripción push de un celular y permite mandar
//   una notificación de PRUEBA al usuario. Tabla push_subscriptions (Hub).
//   Env: HUB_SERVICE_ROLE, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const { sendPush } = require('./_webpush');

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

    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

    if (b.accion === 'subscribe') {
      const s = b.subscription || {};
      if (!s.endpoint || !s.p256dh || !s.auth) return json(400, { error: 'Suscripción incompleta.' });
      const fila = { usuario_id: user.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, user_agent: (event.headers['user-agent'] || '').slice(0, 200) };
      const r = await sb('push_subscriptions?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(fila) });
      if (!r.ok) return json(502, { error: 'No pude guardar la suscripción: ' + (await r.text()).slice(0, 160) });
      return json(200, { ok: true });
    }

    if (b.accion === 'unsubscribe') {
      if (!b.endpoint) return json(400, { error: 'Falta endpoint.' });
      await sb('push_subscriptions?endpoint=eq.' + encodeURIComponent(b.endpoint), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return json(200, { ok: true });
    }

    if (b.accion === 'test') {
      if (!process.env.VAPID_PRIVATE) return json(503, { error: 'Faltan las claves VAPID en Netlify.' });
      const subs = await (await sb('push_subscriptions?usuario_id=eq.' + encodeURIComponent(user.id) + '&select=endpoint,p256dh,auth')).json();
      if (!Array.isArray(subs) || !subs.length) return json(200, { ok: true, enviados: 0, nota: 'No hay ningún celular suscripto.' });
      let ok = 0;
      for (const s of subs) {
        try {
          const r = await sendPush(s, { title: '🔔 Avisos activados', body: 'Te vamos a avisar antes de cada reunión.', url: '/agenda.html', tag: 'test' });
          if (r.status >= 200 && r.status < 300) ok++;
          else if (r.gone) await sb('push_subscriptions?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        } catch (e) {}
      }
      return json(200, { ok: true, enviados: ok });
    }

    return json(400, { error: 'Acción inválida' });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
