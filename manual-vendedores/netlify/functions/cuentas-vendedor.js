// ============================================================
//  GrandBar Hub · Function · cuentas-vendedor
//  Devuelve los clientes (con saldo y deuda vencida REALES) del
//  vendedor LOGUEADO en el Hub, leyendo la tabla `cuentas_cubo`
//  de la base de Cobranzas con la service_role (bypassa RLS).
//
//  Seguridad: el vendedor se identifica por SU token del Hub
//  (no se confía en un código enviado por el cliente):
//    token Hub → auth/v1/user → usuarios.codigo_vendedor → cuentas_cubo
//
//  Único secreto requerido (env var en Netlify del Hub):
//    COBRANZAS_SERVICE_ROLE = service_role key de qpaoyfubyaloyhepatlm
//  (las URLs y la anon/publishable del Hub son públicas → hardcodeadas)
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta la variable COBRANZAS_SERVICE_ROLE en Netlify.' });

    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión iniciada.' });

    // 1) Validar el token del Hub → usuario
    const uRes = await fetch(HUB_URL + '/auth/v1/user', {
      headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token },
    });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida o vencida.' });
    const user = await uRes.json();

    // 2) Su código de vendedor (RLS: lee su propio perfil con su token)
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,codigo_vendedor,rol', {
      headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token },
    });
    const perfil = (await pRes.json())[0] || {};
    const codigo = perfil.codigo_vendedor;
    if (!codigo) return json(200, { codigo: null, nombre: perfil.nombre || null, clientes: [] });

    // 3) Sus clientes desde cuentas_cubo (service_role bypassa RLS)
    const q = COB_URL + '/rest/v1/cuentas_cubo?vendedor=eq.' + encodeURIComponent(codigo) +
      '&select=codigo,nombre,saldo,vencida,telefono&order=nombre.asc';
    const cRes = await fetch(q, { headers: { apikey: service, Authorization: 'Bearer ' + service } });
    if (!cRes.ok) return json(502, { error: 'Error leyendo cuentas_cubo: ' + (await cRes.text()).slice(0, 200) });
    const clientes = await cRes.json();

    return json(200, { codigo, nombre: perfil.nombre || null, clientes: Array.isArray(clientes) ? clientes : [] });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
