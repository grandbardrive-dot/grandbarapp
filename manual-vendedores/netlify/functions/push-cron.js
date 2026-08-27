// ============================================================
//  GrandBar Hub · Function PROGRAMADA · push-cron
//   Corre por cron (ver netlify.toml). Busca reuniones próximas y manda el
//   recordatorio push: un DÍA antes y una HORA antes. Marca aviso_dia_at /
//   aviso_hora_at para no repetir. También se puede llamar por HTTP para probar.
//   Zona horaria: Argentina (UTC-3).  Env: HUB_SERVICE_ROLE, VAPID_*
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const { sendPush } = require('./_webpush');
const ART_OFFSET = 3; // UTC = hora local + 3

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const pad = (n) => String(n).padStart(2, '0');

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole || !process.env.VAPID_PRIVATE) return json(500, { error: 'Falta configuración (HUB_SERVICE_ROLE o VAPID).' });
    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const now = new Date();
    const todayLocal = new Date(now.getTime() - ART_OFFSET * 3600000);
    const hoy = todayLocal.toISOString().slice(0, 10);
    const finVentana = new Date(todayLocal.getTime() + 2 * 86400000).toISOString().slice(0, 10);

    const reus = await (await sb('reuniones?estado=in.(programada,confirmada)&fecha=gte.' + hoy + '&fecha=lte.' + finVentana + '&select=id,usuario_id,titulo,fecha,hora,lugar,aviso_dia_at,aviso_hora_at&limit=1000')).json();
    if (!Array.isArray(reus)) return json(502, { error: 'No pude leer reuniones' });

    const subsCache = {};
    async function subsDe(uid) {
      if (subsCache[uid]) return subsCache[uid];
      const s = await (await sb('push_subscriptions?usuario_id=eq.' + encodeURIComponent(uid) + '&select=endpoint,p256dh,auth')).json();
      subsCache[uid] = Array.isArray(s) ? s : [];
      return subsCache[uid];
    }
    async function enviar(uid, payload) {
      const subs = await subsDe(uid); let ok = 0;
      for (const s of subs) {
        try {
          const r = await sendPush(s, payload);
          if (r.status >= 200 && r.status < 300) ok++;
          else if (r.gone) await sb('push_subscriptions?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        } catch (e) {}
      }
      return ok;
    }

    let avisosDia = 0, avisosHora = 0;
    for (const r of reus) {
      const [Y, M, D] = String(r.fecha).split('-').map(Number);
      const conHora = !!r.hora;
      const [h, mi] = (conHora ? String(r.hora).slice(0, 5) : '09:00').split(':').map(Number);
      const dt = new Date(Date.UTC(Y, M - 1, D, (h || 0) + ART_OFFSET, mi || 0));
      const diffMin = Math.round((dt - now) / 60000);

      // Una HORA antes (solo si tiene hora)
      if (conHora && !r.aviso_hora_at && diffMin >= 0 && diffMin <= 70) {
        const body = r.titulo + ' · ' + pad(h) + ':' + pad(mi) + ' hs' + (r.lugar ? ' · ' + r.lugar : '');
        await enviar(r.usuario_id, { title: '⏰ Reunión en 1 hora', body, url: '/agenda.html', tag: 'reu-h-' + r.id });
        await sb('reuniones?id=eq.' + encodeURIComponent(r.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ aviso_hora_at: new Date().toISOString() }) });
        avisosHora++;
      }

      // Un DÍA antes (~24 h)
      if (!r.aviso_dia_at && diffMin >= 1380 && diffMin <= 1500) {
        const cuando = pad(D) + '/' + pad(M) + (conHora ? ' ' + pad(h) + ':' + pad(mi) + ' hs' : '');
        await enviar(r.usuario_id, { title: '📅 Mañana tenés una reunión', body: r.titulo + ' · ' + cuando + (r.lugar ? ' · ' + r.lugar : ''), url: '/agenda.html', tag: 'reu-d-' + r.id });
        await sb('reuniones?id=eq.' + encodeURIComponent(r.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ aviso_dia_at: new Date().toISOString() }) });
        avisosDia++;
      }
    }

    return json(200, { ok: true, revisadas: reus.length, avisos_dia: avisosDia, avisos_hora: avisosHora });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
