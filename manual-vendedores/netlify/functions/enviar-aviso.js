// ============================================================
//  GrandBar Hub · Function · enviar-aviso  (one-shot, protegida con DIAG_KEY)
//   Manda una notificación (campanita + push) a Dirección (Fernando).
//   Uso: /.netlify/functions/enviar-aviso?key=XXX
//        &titulo=...&detalle=...&icono=...   (opcionales)
//   Env: DIAG_KEY, HUB_SERVICE_ROLE, VAPID_*
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const { pushA } = require('./_notificar');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    const q = (event && event.queryStringParameters) || {};
    if (!process.env.DIAG_KEY || q.key !== process.env.DIAG_KEY) return json(403, { error: 'Falta ?key= válida (env DIAG_KEY).' });
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const icono = q.icono || '🎉';
    const titulo = q.titulo || 'Hola Fer, te ahorraste $500.000';
    const detalle = q.detalle || 'Atte, el team de desarrollo 💙';
    const link = q.link || 'direccion.html';

    const dirs = await (await sb('usuarios?rol=in.(' + DIR_ROLES.join(',') + ')&select=id,nombre')).json();
    const lista = Array.isArray(dirs) ? dirs : [];
    let enviados = 0, pushOk = 0;
    for (const u of lista) {
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: u.id, icono, titulo, detalle, link }) }); enviados++; } catch (e) {}
      try { pushOk += await pushA(sb, u.id, { title: icono + ' ' + titulo, body: detalle, url: '/' + link, tag: 'aviso-dev' }); } catch (e) {}
    }
    return json(200, { ok: true, destinatarios: lista.map((u) => u.nombre || u.id), campanita: enviados, push_enviados: pushOk });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
