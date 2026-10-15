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

const { traerTodo } = require('./_paginar.js');

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

    // 3) Sus clientes desde cuentas_cubo (service_role bypassa RLS).
    //    Paginado: si un vendedor pasara las mil cuentas, la base corta ahí sin
    //    avisar y la deuda daría de menos. Es la misma consulta que usa el panel
    //    del supervisor, para que los dos muestren lo mismo.
    const cob = (p, o) => fetch(COB_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service }, (o && o.headers) || {}) });
    let clientes = await traerTodo(cob, 'cuentas_cubo?vendedor=eq.' + encodeURIComponent(codigo) + '&select=codigo,nombre,saldo,vencida,telefono&order=codigo.asc');
    if (!Array.isArray(clientes)) clientes = [];
    // Deuda vencida = todas las facturas vencidas, sin descontar el saldo a favor y sin
    // tope (regla del 29/09/2026, igual que supervisor, Dirección y tesorería). Hasta el
    // 07/10 acá se la recortaba al saldo neto (regla vieja del 02/09), y el vendedor y la
    // tienda veían menos vencido que el resto en los clientes con saldo a favor.
    clientes = clientes.map(c => ({ ...c, vencida: Math.max(0, Number(c.vencida) || 0) }));

    // 3b) Clientes OCULTOS de la cartera (14/10/2026: los supervisores seguían viendo los que
    //     ocultaron). Misma regla que la lista de Clientes y el panel del supervisor: manda
    //     clientes_estado (botón Quitar, por código); si no figura, la columna activo del Manual.
    //     - Oculto sin deuda: no se devuelve (no aparece en ninguna pantalla).
    //     - Oculto CON deuda: se devuelve normal. "Los que tienen deuda no se ocultan"
    //       (dueño, 15/10/2026).
    //     ?con_ocultos=1 devuelve también los ocultos sin deuda, marcados (Mis clientes,
    //     pestaña Quitados).
    try {
      const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
      const MAN_KEY = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
      const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY }, (o && o.headers) || {}) });
      const norm = x => (String(x == null ? '' : x).trim().replace(/^0+/, '') || '0');
      const vend = (await (await man('vendedores?codigo=eq.' + encodeURIComponent(codigo) + '&select=id')).json())[0];
      const [est, cli] = await Promise.all([
        traerTodo(man, 'clientes_estado?select=codigo,activo&order=codigo.asc'),
        vend ? traerTodo(man, 'clientes?vendedor_id=eq.' + vend.id + '&select=codigo_cliente,activo&order=codigo_cliente.asc') : [],
      ]);
      const estMap = {}; (Array.isArray(est) ? est : []).forEach(r => { estMap[norm(r.codigo)] = r.activo; });
      const colMap = {}; (Array.isArray(cli) ? cli : []).forEach(r => { colMap[norm(r.codigo_cliente)] = r.activo; });
      const oculto = c => { const k = norm(c.codigo); if (k in estMap) return estMap[k] === false; return colMap[k] === false; };
      const debe = c => (Number(c.saldo) || 0) > 0 || (Number(c.vencida) || 0) > 0;
      const qp = event.queryStringParameters || {};
      clientes = clientes.map(c => (oculto(c) && !debe(c) ? { ...c, oculto: true } : c))
        .filter(c => qp.con_ocultos === '1' || !c.oculto);
    } catch (e) { /* si no se puede leer el Manual, se devuelven todas como antes */ }

    // 4) Coordenadas + dirección desde clientes_geo (Supabase del Hub, service role).
    //    OJO: clientes_geo.codigo quedó numérico (sin ceros) → cruzamos por número.
    const hubService = process.env.HUB_SERVICE_ROLE;
    if (hubService && clientes.length) {
      const nums = [...new Set(clientes.map(c => parseInt(c.codigo, 10)).filter(n => !isNaN(n)))];
      const geoMap = {};
      // De a lotes de 300 para no armar URLs gigantes.
      for (let i = 0; i < nums.length; i += 300) {
        const lote = nums.slice(i, i + 300);
        const gRes = await fetch(HUB_URL + '/rest/v1/clientes_geo?select=codigo,direccion,localidad,lat,lng,geo_status&codigo=in.(' + lote.join(',') + ')', {
          headers: { apikey: hubService, Authorization: 'Bearer ' + hubService },
        });
        const gArr = await gRes.json().catch(() => []);
        if (Array.isArray(gArr)) for (const g of gArr) geoMap[g.codigo] = g;
      }
      clientes = clientes.map(c => {
        const g = geoMap[parseInt(c.codigo, 10)];
        return g ? { ...c, direccion: g.direccion, localidad: g.localidad, lat: g.lat, lng: g.lng, geo: g.geo_status } : c;
      });
    }

    const conCoords = clientes.filter(c => c.lat != null).length;
    return json(200, { codigo, nombre: perfil.nombre || null, con_coords: conCoords, clientes });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

// Estado del sistema (11/10/2026): los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('cuentas-vendedor', module.exports.handler);
