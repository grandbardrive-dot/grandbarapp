// ============================================================
//  GrandBar Hub · Function · comparativo  (19/11/2026)
//  Sección "Comparativo" (comparativo.html): un mes contra el mismo mes del año anterior.
//  Si el mes elegido es el actual, los dos van hasta el mismo día (20/11/2026 contra 20/11/2025).
//
//  Datos: RPC comparativo_datos (base del Manual, ventas_cliente que baja de CUBO cada 20 min).
//   · Monto con IVA, igual que "Ventas acumuladas" (decisión del usuario).
//   · Botellas = unidades. CCC = clientes distintos con algún renglón.
//   · Tipo de producto (Familia 1): solo 01 vinos, 02 espirituosas, 04 cafés, 05 cervezas,
//     07 sin alcohol; el resto queda afuera (pedido del usuario).
//  Filtros que salen de "Comparativo (fuente).xlsx" (Drive SHARE, Administración):
//   · Excluidos: sus ventas no entran en ningún número.
//   · Provincia de cada vendedor (por nombre).  · Peñaflor: las bodegas del grupo (por nombre).
//  Equipo = el del vendedor en "Presupuesto Ventas" (ON, OFF, SL y Mayoristas; decisión del usuario).
//  Tipo de cliente = rubro de CUBO (cuentas_cubo, base de Cobranzas); si no tiene, el del Manual.
//  Nombre de proveedor (Familia 2) = _familia2.js.  Inflación = IPC nacional de INDEC (datos.gob.ar).
//  Lo ven: supervisores y Dirección (más Desarrollo y Diseño, que mantienen el sistema).
//  Env: COBRANZAS_SERVICE_ROLE (rubros de los clientes).
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY  = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const { traerTodo } = require('./_paginar.js');
const OBJ = require('./_objetivos-vendedores');
const FAMILIA2 = require('./_familia2');
// Excluidos, provincias, Peñaflor y equipos: _fuente-comparativo.js (24/11/2026, lo comparte con
// el Diagnóstico de ventas). Antes estaba escrito acá; se movió sin cambios.
const { guardado, fuente, vendedores, EQUIPOS } = require('./_fuente-comparativo');
const { norm, cod3 } = OBJ;

const PUEDEN = ['admin', 'direccion', 'duenio', 'desarrollo', 'diseno'];   // + es_supervisor
const FAMILIA1 = { '01': 'Vinos', '02': 'Spirits', '05': 'Cervezas', '07': 'Bebidas sin alcohol', '04': 'Café' };
const MODOS = ['clientes', 'familia3', 'proveedor', 'articulo'];
const TIPO_MANUAL = { vinoteca: 'Vinoteca', bar: 'Bares', restaurante: 'Restaurant', autoservicio: 'Autoservicio', disco: 'Disco',
  'tienda de bebidas': 'Tienda de Bebidas', hotel: 'Hotel', mayorista: 'Distribuidores y Mayoristas', evento: 'Evento' };

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const nc = s => String(s == null ? '' : s).trim().replace(/^0+/, '') || '0';
const iso = d => d.toISOString().slice(0, 10);

// Tipo de cliente y nombre: rubro de CUBO; si no tiene, el tipo del Manual.
async function clientes() {
  const service = process.env.COBRANZAS_SERVICE_ROLE;
  const cob = (p, o) => fetch(COB_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service }, (o && o.headers) || {}) });
  const man = (p, o) => fetch(MAN_URL + '/rest/v1/' + p, { headers: Object.assign({ apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY }, (o && o.headers) || {}) });
  const [cc, mc] = await Promise.all([
    service ? traerTodo(cob, 'cuentas_cubo?select=codigo,nombre,rubro&order=codigo') : Promise.resolve([]),
    traerTodo(man, 'clientes?select=codigo_cliente,nombre,tipo&order=codigo_cliente'),
  ]);
  const tipo = {}, nombre = {};
  (mc || []).forEach(c => { const k = nc(c.codigo_cliente); nombre[k] = c.nombre; const t = TIPO_MANUAL[String(c.tipo || '').toLowerCase()]; if (t) tipo[k] = t; });
  (cc || []).forEach(c => { const k = nc(c.codigo); if (c.nombre && !nombre[k]) nombre[k] = String(c.nombre).trim(); const r = String(c.rubro || '').trim(); if (r && !/^sin categorizar$/i.test(r)) tipo[k] = r; });
  return { tipo, nombre };
}

// Inflación de los últimos 12 meses: IPC nacional nivel general de INDEC, último mes publicado.
async function inflacion() {
  const r = await fetch('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&last=13&format=json');
  if (!r.ok) throw new Error('datos.gob.ar ' + r.status);
  const d = ((await r.json()) || {}).data || [];
  if (d.length < 13) throw new Error('serie corta');
  const [mesU, vU] = d[d.length - 1], [, vA] = d[d.length - 13];
  return { mes: String(mesU).slice(0, 7), interanual: Math.round((vU / vA - 1) * 1000) / 10, fuente: 'INDEC · IPC nacional, nivel general' };
}

// Período del mes elegido y del mismo mes del año anterior (si es el mes en curso, hasta hoy).
function periodos(mes, hoyAR) {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const esActual = hoyAR.slice(0, 7) === mes;
  const dia = esActual ? Number(hoyAR.slice(8, 10)) : ultimo;
  const ultimoA = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  const diaA = Math.min(dia, ultimoA);
  const p2 = n => String(n).padStart(2, '0');
  return {
    a: { desde: `${y - 1}-${p2(m)}-01`, hasta: `${y - 1}-${p2(m)}-${p2(diaA)}` },
    b: { desde: `${y}-${p2(m)}-01`, hasta: `${y}-${p2(m)}-${p2(dia)}` },
    parcial: esActual, dia,
  };
}

exports.handler = async (event) => {
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,es_supervisor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    if (!perfil.es_supervisor && !PUEDEN.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'El Comparativo es para supervisores y Dirección.' });

    const q = event.queryStringParameters || {};
    const hoyAR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') && q.mes <= hoyAR.slice(0, 7) && q.mes >= '2026-01' ? q.mes : hoyAR.slice(0, 7);
    const modo = MODOS.includes(q.modo) ? q.modo : 'proveedor';
    const P = periodos(mes, hoyAR);
    const avisos = [];

    const [src, ipc] = await Promise.all([
      guardado('fuente', 30 * 60e3, fuente),
      guardado('ipc', 12 * 3600e3, inflacion).catch(() => null),
    ]);
    const [vend, cli] = await Promise.all([
      guardado('vendedores', 30 * 60e3, () => vendedores(src)),
      guardado('clientes', 30 * 60e3, clientes),
    ]);
    const excluidos = new Set(src.excluidos);

    // ── Filtros ──
    let incl = null;
    const filtVend = vend.filter(v => !excluidos.has(v.codigo)
      && (!q.vend || v.codigo === cod3(q.vend))
      && (!q.equipo || v.equipo === q.equipo)
      && (!q.prov || v.provincia === q.prov));
    if (q.vend || q.equipo || q.prov) incl = filtVend.map(v => v.codigo).concat(['__ninguno__']);
    // Tipo de producto: uno o varios, separados por coma (20/11/2026: "f1=01,02" = Vinos y Spirits).
    const f1Pedidos = [...new Set(String(q.f1 || '').split(',').map(s => s.trim()).filter(k => FAMILIA1[k]))];
    const f1 = f1Pedidos.length ? f1Pedidos : Object.keys(FAMILIA1);
    let f2 = null;
    if (q.f2 && /^\d{4}$/.test(q.f2)) f2 = [q.f2];
    if (q.penaflor === '1') {
      const nombres = new Set(src.penaflor.map(norm));
      const cods = Object.keys(FAMILIA2).filter(k => nombres.has(norm(FAMILIA2[k])));
      f2 = f2 ? f2.filter(k => cods.includes(k)) : cods;
      if (!f2.length) f2 = ['__ninguno__'];
    }
    const f3 = q.f3 && /^\d{6}$/.test(q.f3) ? [q.f3] : null;
    let clientesFiltro = null;
    if (q.tipo) {
      clientesFiltro = Object.keys(cli.tipo).filter(k => (q.tipo === 'Sin tipo' ? false : cli.tipo[k] === q.tipo));
      if (!clientesFiltro.length) clientesFiltro = ['__ninguno__'];
    }

    const r = await fetch(MAN_URL + '/rest/v1/rpc/comparativo_datos', {
      method: 'POST',
      headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_a_desde: P.a.desde, p_a_hasta: P.a.hasta, p_b_desde: P.b.desde, p_b_hasta: P.b.hasta,
        p_modo: modo, p_f1: f1, p_f2: f2, p_f3: f3, p_vend_incl: incl, p_vend_excl: [...excluidos], p_clientes: clientesFiltro }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) return json(502, { error: 'No se pudieron leer las ventas (' + r.status + ').' });

    // Nombres que la base no tiene: proveedor (Familia 2) y clientes que no están en el Manual.
    const nomProv = k => FAMILIA2[k] || ('Proveedor ' + k);
    const filas = (d.filas || []).map(f => {
      let n = f.n;
      if (modo === 'proveedor') n = nomProv(f.k);
      else if (modo === 'clientes' && !n) n = cli.nombre[f.k] || ('Cliente ' + f.k);
      else if (!n) n = f.k;
      const out = { k: f.k, n, ua: f.ua, ma: f.ma, ub: f.ub, mb: f.mb };
      if (modo === 'clientes') out.t = cli.tipo[f.k] || null;
      return out;
    });

    const conVentas = new Set((d.vendedores || []).map(cod3));
    const tipos = [...new Set(Object.values(cli.tipo))].sort((a, b) => a.localeCompare(b));
    return json(200, {
      mes, modo, a: P.a, b: P.b, parcial: P.parcial, hoy: hoyAR,
      resumen: d.resumen || {},
      filas,
      inflacion: ipc,
      filtros: {
        vendedores: vend.filter(v => !excluidos.has(v.codigo) && conVentas.has(v.codigo)).sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map(v => ({ codigo: v.codigo, nombre: v.nombre, equipo: v.equipo, provincia: v.provincia })),
        equipos: EQUIPOS,
        provincias: [...new Set(vend.filter(v => !excluidos.has(v.codigo) && v.provincia).map(v => v.provincia))].sort(),
        tipos,
        familias1: Object.keys(FAMILIA1).map(k => ({ codigo: k, nombre: FAMILIA1[k] })),
        proveedores: (d.proveedores || []).map(k => ({ codigo: k, nombre: nomProv(k) })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        meses: (() => { const out = []; for (let m = 1; m <= Number(hoyAR.slice(5, 7)); m++) out.push(hoyAR.slice(0, 4) + '-' + String(m).padStart(2, '0')); return out; })(),
      },
      avisos,
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('comparativo', module.exports.handler);
