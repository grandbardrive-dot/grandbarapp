// ============================================================
//  GrandBar Hub · Function · ventas-vendedor  (17/11/2026)
//  Ventas del mes en curso por vendedor y cliente, desde CUBO. Reemplaza a la planilla
//  "Avance Ventas" de Drive, que Administración dejó de actualizar el 27/10 (quedó con
//  octubre y en la papelera): el Inicio mostraba lo de octubre como si fuera el mes.
//
//  Monto = venta de productos con IVA, impuesto interno y percepciones, la misma cuenta
//  que la "Venta total con impuestos" de Dirección (RPC ventas_vendedor_mes en la base del
//  Manual, que baja de CUBO cada 20 minutos). También va el neto sin IVA.
//
//  Quién ve qué: el vendedor, solo lo suyo (su código). Supervisores, Dirección, tesorería,
//  Desarrollo y Diseño, todos los vendedores (los supervisores suman su equipo).
//  La usa assets/ventas.js (GBVentas), con la misma forma que tenía la planilla.
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY  = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const VEN_TODO = ['admin', 'direccion', 'duenio', 'desarrollo', 'diseno', 'tesoreria', 'administracion'];

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const cod3 = c => { const s = String(c == null ? '' : c).trim(); return /^\d+$/.test(s) ? s.padStart(3, '0') : s; };

exports.handler = async (event) => {
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,codigo_vendedor,es_supervisor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    const todos = !!perfil.es_supervisor || VEN_TODO.includes(rol);
    const codigo = cod3(perfil.codigo_vendedor);
    if (!todos && !codigo) return json(200, { desde: null, hasta: null, filas: [] });

    // Mes en curso, en hora de Argentina.
    const hasta = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const desde = hasta.slice(0, 8) + '01';
    const r = await fetch(MAN_URL + '/rest/v1/rpc/ventas_vendedor_mes', {
      method: 'POST',
      headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_desde: desde, p_hasta: hasta, p_vendedores: todos ? null : [codigo] }),
    });
    if (!r.ok) return json(502, { error: 'No se pudieron leer las ventas (' + r.status + ').' });
    const filas = await r.json();
    return json(200, {
      desde, hasta,
      // [vendedor, cliente, nombre, total con impuestos, neto]: corto, porque lo bajan del celular.
      filas: (Array.isArray(filas) ? filas : []).map(f => [f.vendedor, f.cliente, f.nombre || '', Number(f.total) || 0, Number(f.neto) || 0]),
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('ventas-vendedor', module.exports.handler);
