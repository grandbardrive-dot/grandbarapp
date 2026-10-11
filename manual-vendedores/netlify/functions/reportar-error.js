// ============================================================
//  GrandBar Hub · Function · reportar-error  (11/10/2026)
//   Las pantallas avisan acá cuando algo se rompe en el navegador (un error de
//   código o un guardado que falló, por ejemplo "no se pudo guardar la visita").
//   Lo manda assets/reporte-errores.js. Queda en sistema_errores (Hub, cerrada) y
//   estado-sistema lo cuenta para avisar por n8n.
//   Solo con sesión del Portal; como mucho 20 avisos por persona cada 10 minutos.
//   Env: HUB_SERVICE_ROLE
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
// Lo que no es una falla del sistema: cortes de señal del celular, extensiones, etc.
const RUIDO = /script error|resizeobserver|failed to fetch|load failed|networkerror|network error|aborterror|aborted|cancell?ed|non-error promise rejection|err_internet|timeout|tiempo de espera|offline|sin conexi/i;

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(200, { ok: false });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const u = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!u.ok) return json(401, { error: 'Sesión inválida' });
    const user = await u.json();

    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos' }); }
    const lugar = String(b.lugar || '').replace(/[^\w\-/.]/g, '').slice(0, 120);
    const detalle = String(b.detalle || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!lugar || !detalle || RUIDO.test(detalle)) return json(200, { ok: true, ignorado: true });

    const cab = { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json' };
    // Tope por persona: 20 cada 10 minutos.
    const desde = new Date(Date.now() - 10 * 60000).toISOString();
    const c = await fetch(HUB_URL + '/rest/v1/sistema_errores?select=id&usuario_id=eq.' + encodeURIComponent(user.id) + '&momento=gte.' + desde, { method: 'HEAD', headers: { ...cab, Prefer: 'count=exact', Range: '0-0' } });
    const n = Number(((c.headers.get('content-range') || '').split('/')[1]) || 0);
    if (n >= 20) return json(200, { ok: true, tope: true });

    const nombre = (user.user_metadata && (user.user_metadata.nombre || user.user_metadata.full_name)) || user.email || null;
    await fetch(HUB_URL + '/rest/v1/sistema_errores', {
      method: 'POST', headers: { ...cab, Prefer: 'return=minimal' },
      body: JSON.stringify({ origen: 'pantalla', lugar, detalle: detalle + (b.extra ? ' · ' + String(b.extra).slice(0, 200) : ''), usuario_id: user.id, usuario: nombre }),
    });
    return json(200, { ok: true });
  } catch (e) {
    return json(200, { ok: false });
  }
};
