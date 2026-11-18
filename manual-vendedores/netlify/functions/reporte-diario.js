// ============================================================
//  GrandBar Hub · Function · reporte-diario  (18/11/2026)
//  "Reporte diario" del portal de vendedores (reporte-diario.html), como la planilla
//  que armaba Administración: todos los vendedores, por equipo, en el mes en curso.
//
//   · Equipos y orden = "Presupuesto Ventas.xlsx" (las filas en MAYÚSCULAS son los
//     subtotales de cada equipo). Solo entran los vendedores de esa planilla.
//   · Unidades por rubro y clientes con compra = RPC reporte_diario_mes (base del Manual,
//     ventas_cliente, que baja de CUBO cada 20 minutos): 01 vinos, 02 espirituosas,
//     07 sin alcohol, 05 cervezas, 04 cafés. Con compra = todo cliente que aparece en sus
//     ventas del mes.
//   · Pesos = lo mismo que "Ventas acumuladas" del Inicio (ventas_vendedor_mes).
//   · Objetivos: vinos y spirits de Presupuesto Ventas; clientes de "Objetivo CCC.xlsx".
//   · Clientes activos = cuentas_cubo vigentes (base de Cobranzas) por vendedor.
//  Quién lo ve: vendedores, tienda, supervisores, Dirección, Administración, tesorería,
//  Desarrollo y Diseño. Todos ven el reporte completo (pedido del usuario).
//  El subtotal "Distribución" deja afuera a Mayorista Mendoza (014) y Mayorista San Luis
//  (008), como la planilla de Administración: lo arma la pantalla con `distribucion`.
//  Env: COBRANZAS_SERVICE_ROLE (sin ella, los activos quedan en blanco).
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY  = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const { traerTodo } = require('./_paginar.js');
const { filtroVigentes } = require('./_cuentas-vigentes');
const OBJ = require('./_objetivos-vendedores');
const { cod3, norm } = OBJ;

const PUEDEN = ['ventas', 'mayorista', 'admin', 'direccion', 'duenio', 'desarrollo', 'diseno', 'tesoreria', 'administracion'];
const FUERA_DE_DISTRIBUCION = ['014', '008'];   // Mayorista Mendoza y Mayorista San Luis
const NOMBRE_EQUIPO = { 'EQUIPO SL': 'EQUIPO SAN LUIS', 'MAYORISTA MDZ': 'MAYORISTA MENDOZA', 'MAYORISTA SL': 'MAYORISTA SAN LUIS' };

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });

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
    if (!perfil.es_supervisor && !PUEDEN.includes(rol)) return json(403, { error: 'El reporte diario es para vendedores, supervisores y Dirección.' });

    // Mes en curso, en hora de Argentina.
    const hoyAR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const desde = hoyAR.slice(0, 8) + '01';

    const service = process.env.COBRANZAS_SERVICE_ROLE;
    const cob = (p, o) => fetch(COB_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service }, (o && o.headers) || {}) });
    const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, Object.assign({}, o || {}, { headers: Object.assign({ apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY }, (o && o.headers) || {}) }));
    const avisos = [];

    const [vendedores, presupuesto, objCCC, ventas, activos] = await Promise.all([
      man('vendedores?select=codigo,nombre').then(r => r.ok ? r.json() : []).catch(() => []),
      OBJ.leerPresupuesto().catch(e => ({ error: (e && e.message) || String(e) })),
      OBJ.leerObjetivoCCC().catch(() => { avisos.push('No se pudo leer "Objetivo CCC": los objetivos de clientes quedan en blanco.'); return {}; }),
      man('rpc/reporte_diario_mes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_desde: desde, p_hasta: hoyAR }) })
        .then(async r => { if (!r.ok) throw new Error('ventas ' + r.status); return r.json(); }),
      (async () => {
        if (!service) { avisos.push('Falta la clave de la base de Cobranzas: los clientes activos quedan en blanco.'); return null; }
        const vig = await filtroVigentes(cob);
        const filas = await traerTodo(cob, 'cuentas_cubo?select=vendedor' + (vig ? '&' + vig : ''));
        const m = {};
        filas.forEach(f => { const c = cod3(f.vendedor); if (c) m[c] = (m[c] || 0) + 1; });
        return m;
      })().catch(() => { avisos.push('No se pudieron contar los clientes activos.'); return null; }),
    ]);

    if (!Array.isArray(presupuesto)) return json(502, { error: 'No se pudo leer la planilla "Presupuesto Ventas" (' + (presupuesto && presupuesto.error) + ').' });

    const porVendedor = {};
    (Array.isArray(ventas) ? ventas : []).forEach(v => { porVendedor[cod3(v.vendedor)] = v; });
    const num = x => Number(x) || 0;
    const nombreDe = {};
    (Array.isArray(vendedores) ? vendedores : []).forEach(v => { nombreDe[cod3(v.codigo)] = v.nombre; });

    // Equipos en el orden de la planilla: cada fila en MAYÚSCULAS cierra el equipo de las de arriba.
    const grupos = [];
    const usados = new Set();
    let actual = [];
    for (const fila of presupuesto) {
      if (fila.grupo) {
        if (norm(fila.nombre) === 'total') break;
        if (actual.length) grupos.push({ nombre: NOMBRE_EQUIPO[fila.nombre] || fila.nombre, filas: actual });
        actual = [];
        continue;
      }
      const codigo = OBJ.codigoDeFila(fila, vendedores || []);
      if (codigo && usados.has(codigo)) continue;
      if (codigo) usados.add(codigo);
      const v = (codigo && porVendedor[codigo]) || {};
      actual.push({
        codigo: codigo || null,
        nombre: (codigo && nombreDe[codigo]) || fila.nombre,
        vinos: num(v.vinos), obj_vinos: fila.vinos,
        spirits: num(v.spirits), obj_spirits: fila.spirits,
        sin_alcohol: num(v.sin_alcohol), cervezas: num(v.cervezas), cafe: num(v.cafe),
        activos: activos && codigo ? (activos[codigo] || 0) : null,
        obj_ccc: codigo && codigo in objCCC ? objCCC[codigo] : null,
        ccc: num(v.ccc),
        total: num(v.total),
        distribucion: !!codigo && !FUERA_DE_DISTRIBUCION.includes(codigo),
      });
      if (!codigo) avisos.push('"' + fila.nombre + '" de Presupuesto Ventas no se encontró entre los vendedores: sale sin datos.');
    }
    if (actual.length) grupos.push({ nombre: 'OTROS', filas: actual });

    return json(200, { desde, hasta: hoyAR, codigo_propio: cod3(perfil.codigo_vendedor) || null, grupos, avisos });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('reporte-diario', module.exports.handler);
