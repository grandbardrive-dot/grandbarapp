// ============================================================
//  Helper compartido: manda una notificación PUSH a todos los celulares
//  suscriptos de un usuario. (El "_" evita que Netlify lo publique como función.)
//  Úsalo junto al insert en la tabla `notificaciones` para que la campanita
//  también llegue como notificación al celu.
//  `sb` = el helper fetch con service role de cada función.
// ============================================================
const { sendPush } = require('./_webpush');

async function pushA(sb, destinatario_id, { title, body, url, tag } = {}) {
  if (!destinatario_id || !process.env.VAPID_PRIVATE) return 0;
  let ok = 0;
  try {
    const subs = await (await sb('push_subscriptions?usuario_id=eq.' + encodeURIComponent(destinatario_id) + '&select=endpoint,p256dh,auth')).json();
    for (const s of (Array.isArray(subs) ? subs : [])) {
      try {
        const r = await sendPush(s, { title: title || 'GrandBar', body: body || '', url: url || '/agenda.html', tag });
        if (r.status >= 200 && r.status < 300) ok++;
        else if (r.gone) await sb('push_subscriptions?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      } catch (e) {}
    }
  } catch (e) {}
  return ok;
}

module.exports = { pushA };
