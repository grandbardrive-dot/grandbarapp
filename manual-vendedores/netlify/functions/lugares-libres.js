// ============================================================
//  GrandBar Hub · Function · lugares-libres  (23/10/2026)
//   Para el portal del proveedor: los lugares del manual de vendedores donde hoy no
//   hay NINGUNA acción, ordenados para su empresa (anuncio del inicio y marcas en
//   "Manual de vendedores"). El cálculo está en _lugares-libres.js.
//   El equipo puede ver lo de una empresa con ?empresa=.
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const EQUIPO = ['desarrollo', 'diseno', 'compras', 'marketing', 'direccion'];
const { lugaresPara } = require('./_lugares-libres');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' });
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token === 'null' || token === 'undefined') return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,empresa,activo', { headers: { apikey: srole, Authorization: 'Bearer ' + srole } });
    const perfil = (pRes.ok ? await pRes.json() : [])[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const qp = event.queryStringParameters || {};
    let empresa;
    if (rol === 'proveedor') empresa = perfil.empresa || perfil.nombre;
    else if (EQUIPO.includes(rol)) empresa = String(qp.empresa || '').slice(0, 80);
    else return json(403, { error: 'No autorizado.' });

    const { categorias, lugares: lista } = await lugaresPara(empresa);
    return json(200, { empresa: empresa || null, categorias, total: lista.length, tuyos: lista.filter(l => l.tuyo).length, lugares: lista });
  } catch (e) {
    return json(502, { error: 'No se pudieron revisar los lugares del manual.', detalle: String((e && e.message) || e).slice(0, 200) });
  }
};

module.exports.handler = require('./_errores').conErrores('lugares-libres', module.exports.handler);
