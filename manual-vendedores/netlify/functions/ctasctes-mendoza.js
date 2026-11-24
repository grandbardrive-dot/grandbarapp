// ============================================================
//  GrandBar Hub · Function · ctasctes-mendoza
//  Los datos del tablero Cuentas Corrientes Mendoza (cuentas-corrientes-mendoza.html):
//  saldos, antigüedad de la deuda y comprobantes de los clientes de Mendoza, según el
//  listado del ERP al 20/11/2026 (armado con build_ctasctes_mendoza.py, de Luciana).
//
//  Van acá y no en el HTML porque el sitio es estático: cualquiera con el link leería
//  la deuda de todos los clientes. Se entregan solo a quien tiene sesión del Portal con
//  rol de Cobranzas. Para actualizar: reemplazar _datos/ctasctes-mendoza.json.
//
//    GET  → el JSON completo ({meta, equipos, clientes, serie})
// ============================================================
const DATA = require('./_datos/ctasctes-mendoza.json');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
// Los mismos roles que abren la pantalla (y la tabla cc_mendoza_gestion).
const ROLES_OK = ['reclamos', 'administracion', 'tesoreria', 'admin', 'desarrollo', 'diseno', 'direccion'];

let CUERPO = null;
const json = (s, b) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: typeof b === 'string' ? b : JSON.stringify(b),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Solo lectura.' });
  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Sin sesión.' });

  const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
  if (!uRes.ok) return json(401, { error: 'Se venció la sesión. Volvé a entrar al Portal.' });
  const user = await uRes.json();

  const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol',
    { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
  const perfil = ((await pRes.json()) || [])[0] || {};
  if (!ROLES_OK.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Esta pantalla es de Cobranzas.' });

  if (!CUERPO) CUERPO = JSON.stringify(DATA);
  return json(200, CUERPO);
};

module.exports.handler = require('./_errores').conErrores('ctasctes-mendoza', module.exports.handler);
