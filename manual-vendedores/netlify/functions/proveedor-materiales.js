// ============================================================
//  GrandBar Hub · Function · proveedor-materiales  (14/10/2026)
//   "Materiales en GrandBar" del portal de proveedores: el material POP de la marca
//   que hay en el depósito (lo carga Marketing en Materiales, base del Manual).
//   - El proveedor ve SOLO lo suyo: su empresa sale de su usuario del Portal, no del
//     navegador. Se cruza con los proveedores del Manual por nombre (sin "Grupo",
//     "Bodega"…) y entran los materiales cargados a ese proveedor o a una de sus líneas.
//   - Solo materiales activos, con stock y que Marketing dejó visibles (visible_to_luciana).
//   - El equipo (desarrollo, diseño, compras, marketing, dirección) puede ver el de una
//     empresa con ?empresa= para revisar qué le aparece.
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const EQUIPO = ['desarrollo', 'diseno', 'compras', 'marketing', 'direccion'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
// Nombre de proveedor para comparar: sin acentos ni "grupo/group/bodega(s)".
const nrmProv = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(grupo|group|bodegas?|s\.?a\.?)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// "campari" es "Campari" y "Campari Group"; "penaflor" es "Grupo Peñaflor" y "Peñaflor vinos".
const mismaEmpresa = (a, b) => a.length >= 4 && b.length >= 4 && (a === b || (' ' + a + ' ').includes(' ' + b + ' ') || (' ' + b + ' ').includes(' ' + a + ' '));

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
    const en = nrmProv(empresa);
    if (!en) return json(200, { empresa: empresa || null, materiales: [] });

    const man = async path => { const r = await fetch(MAN_URL + '/rest/v1/' + path, { headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY } }); return r.ok ? r.json() : []; };

    // Proveedores del Manual que son esta empresa, y sus líneas (marcas).
    const provs = (await man('proveedores?select=id,nombre')).filter(p => mismaEmpresa(nrmProv(p.nombre), en));
    if (!provs.length) return json(200, { empresa, materiales: [] });
    const provIds = provs.map(p => p.id);
    const lista = provIds.join(',');
    const marcas = await man('brands?select=id,name,supplier_id&supplier_id=in.(' + lista + ')');
    const marcaIds = marcas.map(b => b.id);
    const MARCA = {};
    (await man('brands?select=id,name')).forEach(b => { MARCA[b.id] = b.name; });

    // Materiales activos, con stock y visibles: los del proveedor o de una de sus líneas.
    const filtro = 'or=(supplier_id.in.(' + lista + ')' + (marcaIds.length ? ',brand_id.in.(' + marcaIds.join(',') + ')' : '') + ')';
    const filas = await man('materials_with_stock?select=id,name,description,brand_id,unit_type,stock_actual,processed_image_url,original_image_url,fecha_ingreso,condition'
      + '&is_active=eq.true&visible_to_luciana=eq.true&stock_actual=gt.0&' + filtro + '&order=name');

    const materiales = (Array.isArray(filas) ? filas : []).map(m => ({
      id: m.id,
      nombre: m.name,
      linea: MARCA[m.brand_id] || null,
      descripcion: m.description || null,
      foto: m.processed_image_url || m.original_image_url || null,
      stock: Number(m.stock_actual || 0),
      unidad: m.unit_type || 'unidad',
      ingreso: m.fecha_ingreso || null,
      usado: m.condition && m.condition !== 'nuevo' ? m.condition : null,
    }));
    return json(200, { empresa, materiales });
  } catch (e) {
    return json(500, { error: 'No se pudieron leer los materiales.', detalle: String((e && e.message) || e).slice(0, 200) });
  }
};

// Estado del sistema: los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('proveedor-materiales', module.exports.handler);
