// ============================================================
//  GrandBar Hub · Function · avance-vendedor  (17/11/2026)
//  "Tu mes" del Inicio del vendedor: clientes activos vs clientes con compra, y el
//  avance de botellas de vinos y spirits contra el objetivo del mes.
//
//  Para el vendedor LOGUEADO (token del Hub → usuarios.codigo_vendedor):
//   · Activos     = sus clientes activos en CUBO hoy: cuentas_cubo (base de Cobranzas)
//                   que vinieron en la última corrida de DtTabla CLIENTES
//                   (_cuentas-vigentes.js). Las dadas de baja no cuentan.
//   · Con compra  = clientes distintos en las facturas del mes en curso con su código
//                   de vendedor (ventas_cliente, que baja de CUBO cada 20 minutos).
//                   Desde el 18/11/2026 cuenta TODO cliente que aparece en sus ventas del mes,
//                   aunque una nota de crédito lo deje en negativo, como la planilla de
//                   Administración y el Reporte diario (antes pedía unidades o importe > 0).
//   · Vinos / Spirits vendido = botellas del mes (rubro 01 = vinos, 02 = espirituosas,
//                   los dos primeros dígitos del artículo), con las notas de crédito restando.
//   · Objetivo    = (_objetivos-vendedores.js) "Presupuesto Ventas.xlsx" de la carpeta SHARE de Drive (Administración),
//                   columnas "VINOS Objetivo" y "SPIRITS Objetivo", fila con el nombre del
//                   vendedor. El archivo no dice el mes: se toma como el objetivo del mes en
//                   curso. Si Administración sube otro archivo (otro link), cambiar PRESUPUESTO.
//   · Objetivo de clientes (17/11/2026) = "Objetivo CCC.xlsx" (clientes con compra), también
//                   en SHARE: columnas "Vendedor", "Nro Vendedor" y "Objetivos". Se cruza por el
//                   número de vendedor, no por el nombre. Administración lo actualiza pisando el
//                   mismo archivo; si suben uno nuevo (otro link), cambiar OBJ_CLIENTES.
//  Env: COBRANZAS_SERVICE_ROLE.
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY  = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const { traerTodo } = require('./_paginar.js');
const { filtroVigentes } = require('./_cuentas-vigentes');
// Lectura de las planillas de Administración, compartida con reporte-diario (18/11/2026).
const OBJ = require('./_objetivos-vendedores');
const { cod3, esElMismo } = OBJ;

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });

// Objetivo del vendedor en la planilla de Administración (null si no figura o no se pudo leer).
async function objetivos(codigo, nombre) {
  const fila = (await OBJ.leerPresupuesto()).find(x => !x.grupo && OBJ.filaEs(x, codigo, nombre));
  return fila ? { vinos: fila.vinos, spirits: fila.spirits } : null;
}

// Objetivo de clientes con compra del mes (Objetivo CCC.xlsx). null si no figura o no se pudo leer;
// 0 si Administración le puso 0 (no tiene objetivo este mes).
async function objetivoClientes(codigo) {
  const m = await OBJ.leerObjetivoCCC();
  return codigo in m ? m[codigo] : null;
}

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta COBRANZAS_SERVICE_ROLE en Netlify.' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,codigo_vendedor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const codigo = cod3(perfil.codigo_vendedor);
    if (!codigo) return json(200, { codigo: null });

    // Mes en curso, en hora de Argentina.
    const hoyAR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const desde = hoyAR.slice(0, 8) + '01';

    const cob = (p, o) => fetch(COB_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service }, (o && o.headers) || {}) });
    const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY }, (o && o.headers) || {}) });

    // Nombre del vendedor como está en el Manual (el de la planilla se cruza con este).
    const vend = ((await (await man('vendedores?codigo=eq.' + encodeURIComponent(codigo) + '&select=nombre')).json()) || [])[0] || {};
    const nombre = vend.nombre || perfil.nombre || '';

    const nc = s => String(s == null ? '' : s).trim().replace(/^0+/, '') || '0';   // código sin ceros adelante
    const [activosCods, ventas, obj, objCli] = await Promise.all([
      // Los códigos de sus clientes activos (19/11/2026: la lista, no solo cuántos, para saber
      // cuántos de SUS activos compraron). null si no se pudo leer.
      (async () => {
        const vig = await filtroVigentes(cob);
        const sinCero = String(parseInt(codigo, 10));   // en CUBO a veces viene "31" en vez de "031"
        const q = 'cuentas_cubo?select=codigo&vendedor=in.(' + encodeURIComponent(codigo) + ',' + encodeURIComponent(sinCero) + ')' + (vig ? '&' + vig : '');
        const lista = [];
        for (let i = 0; i < 20000; i += 1000) {
          const r = await cob(q, { headers: { Range: i + '-' + (i + 999) } });
          if (!r.ok) return null;
          const l = await r.json(); lista.push(...l); if (l.length < 1000) break;
        }
        return lista.map(x => nc(x.codigo));
      })(),
      traerTodo(man, 'ventas_cliente?select=cliente_codigo,sku,unidades,importe&vendedor=eq.' + encodeURIComponent(codigo) + '&fecha=gte.' + desde + '&order=fecha.asc'),
      objetivos(codigo, nombre).catch(e => ({ error: (e && e.message) || String(e) })),
      objetivoClientes(codigo).catch(() => null),
    ]);

    const filas = Array.isArray(ventas) ? ventas : [];
    const conCompra = new Set();
    let vinos = 0, spirits = 0;
    filas.forEach(v => {
      const u = Number(v.unidades) || 0;
      conCompra.add(String(v.cliente_codigo));   // todo cliente de sus ventas del mes (18/11/2026)
      const rubro = String(v.sku || '').slice(0, 2);
      if (rubro === '01') vinos += u; else if (rubro === '02') spirits += u;
    });

    const activos = activosCods ? activosCods.length : null;
    // Con compra cuenta TODO cliente facturado con su código (como Administración y el objetivo).
    // Aparte (19/11/2026, pedido del usuario): cuántos de SUS activos compraron, y quiénes de otras
    // carteras le compraron (nombre y de quién es), para que Clientes cierre con el Inicio.
    let conCompraActivos = null, otras = [];
    if (activosCods) {
      const mios = new Set(activosCods);
      conCompraActivos = [...conCompra].filter(c => mios.has(nc(c))).length;
      const fuera = [...conCompra].filter(c => !mios.has(nc(c)));
      if (fuera.length) {
        const [cl, vs] = await Promise.all([
          man('clientes?select=codigo_cliente,nombre,vendedor_id&codigo_cliente=in.(' + fuera.map(encodeURIComponent).join(',') + ')').then(r => r.ok ? r.json() : []).catch(() => []),
          man('vendedores?select=id,nombre').then(r => r.ok ? r.json() : []).catch(() => []),
        ]);
        otras = fuera.map(c => {
          const x = (cl || []).find(k => nc(k.codigo_cliente) === nc(c));
          const v = x && (vs || []).find(w => w.id === x.vendedor_id);
          return { codigo: c, nombre: x ? x.nombre : 'Cliente ' + c, cartera: v ? v.nombre : null };
        }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
      }
    }

    return json(200, {
      codigo, nombre, desde, hasta: hoyAR,
      // codigos_con_compra (19/11/2026): la lista de Clientes marca en verde a estos y en rojo al resto.
      clientes: { activos, con_compra: conCompra.size, con_compra_activos: conCompraActivos, objetivo: objCli,
        codigos_con_compra: [...conCompra], otras_carteras: otras },
      vinos: { vendido: Math.round(vinos), objetivo: obj && !obj.error ? obj.vinos : null },
      spirits: { vendido: Math.round(spirits), objetivo: obj && !obj.error ? obj.spirits : null },
      objetivo_error: obj && obj.error ? obj.error : (obj ? null : 'no figura en la planilla'),
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

exports.esElMismo = esElMismo;   // para probar el cruce de nombres
exports.objetivos = objetivos;
exports.objetivoClientes = objetivoClientes;
module.exports.handler = require('./_errores').conErrores('avance-vendedor', module.exports.handler);
