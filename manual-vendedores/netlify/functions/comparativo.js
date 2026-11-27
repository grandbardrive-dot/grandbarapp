// ============================================================
//  GrandBar Hub · Function · comparativo  (19/11/2026)
//  Sección "Comparativo" (comparativo.html): un mes contra el mismo mes del año anterior.
//  Si el mes elegido es el actual, los dos van hasta el mismo día (20/11/2026 contra 20/11/2025).
//  27/11/2026 (pedido del usuario): varios meses de cada lado y contra cualquier mes.
//   · meses=2026-08,2026-09  → los meses elegidos.  contra=2025-06,2025-07 → contra esos meses
//     (sin "contra", los mismos meses del año anterior, como antes).
//   · Va a la izquierda (base) el período que empieza antes; la variación es del otro contra ese.
//   · En "contra" libre, el mes en curso va hasta hoy y los demás meses completos (se avisa).
//   · RPC comparativo_datos_rangos: cada período es una lista de rangos de fechas.
//
//  Datos: RPC comparativo_datos (base del Manual, ventas_cliente que baja de CUBO cada 20 min).
//   · Monto con IVA, igual que "Ventas acumuladas" (decisión del usuario).
//   · Botellas = unidades. CCC = clientes distintos con algún renglón.
//   · Tipo de producto (Familia 1): solo 01 vinos, 02 espirituosas, 04 cafés, 05 cervezas,
//     07 sin alcohol; el resto queda afuera (pedido del usuario).
//  Filtros que salen de Drive SHARE (Administración):
//   · Excluidos ("Vendedores Excluidos.xlsx", desde el 25/11/2026): sus ventas no entran en ningún número.
//  Y de "Comparativo (fuente).xlsx":
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

// IPC nacional nivel general de INDEC, mes por mes desde 2024 (27/11/2026: para la inflación entre
// dos períodos cualesquiera). "interanual" = últimos 12 meses del último mes publicado, como antes.
async function inflacion() {
  const r = await fetch('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&start_date=2024-01-01&format=json');
  if (!r.ok) throw new Error('datos.gob.ar ' + r.status);
  const d = ((await r.json()) || {}).data || [];
  const serie = {};
  d.forEach(([f, v]) => { if (f && v != null) serie[String(f).slice(0, 7)] = Number(v); });
  const meses = Object.keys(serie).sort();
  if (meses.length < 13) throw new Error('serie corta');
  const ultimo = meses[meses.length - 1], antes = menosUnAnio(ultimo);
  return { mes: ultimo, interanual: serie[antes] ? Math.round((serie[ultimo] / serie[antes] - 1) * 1000) / 10 : null,
    fuente: 'INDEC · IPC nacional, nivel general', serie };
}

// Inflación entre los dos períodos: promedio del índice de los meses del segundo contra el del primero.
// Un mes que INDEC todavía no publicó toma el último publicado (y se avisa con "estimado").
function inflacionEntre(ipc, a, b) {
  if (!ipc || !ipc.serie) return null;
  const val = m => (ipc.serie[m] != null ? ipc.serie[m] : (m > ipc.mes ? ipc.serie[ipc.mes] : null));
  const prom = ms => { const v = ms.map(val); return v.some(x => x == null) ? null : v.reduce((s, x) => s + x, 0) / v.length; };
  const pa = prom(a), pb = prom(b);
  if (!pa || !pb) return null;
  return { pct: Math.round((pb / pa - 1) * 1000) / 10, hasta: ipc.mes, estimado: a.concat(b).some(m => m > ipc.mes) };
}

// ── Meses de cada período (27/11/2026) ──
const MES_MIN = '2025-01';          // desde acá hay ventas cargadas (ventas_cliente arranca el 02/01/2025)
const MAX_MESES = 12;               // por lado
const p2 = n => String(n).padStart(2, '0');
const finDeMes = m => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
const menosUnAnio = m => (Number(m.slice(0, 4)) - 1) + m.slice(4);
const idxMes = m => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const listaMeses = (txt, hoyMes) => [...new Set(String(txt || '').split(',').map(s => s.trim())
  .filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && m >= MES_MIN && m <= hoyMes))].sort();

// Rangos de fechas de una lista de meses: los meses seguidos y completos se juntan en un solo rango.
// corte = { 'YYYY-MM': día } para los meses que no van completos.
function rangos(meses, corte) {
  const out = [];
  meses.forEach(m => {
    const fin = finDeMes(m), dia = Math.min(corte[m] || fin, fin);
    const ult = out[out.length - 1];
    if (ult && ult.completo && idxMes(ult.mes) + 1 === idxMes(m)) { ult.hasta = m + '-' + p2(dia); ult.mes = m; ult.completo = dia === fin; }
    else out.push({ desde: m + '-01', hasta: m + '-' + p2(dia), mes: m, completo: dia === fin });
  });
  return out.map(r => ({ desde: r.desde, hasta: r.hasta }));
}

// Los dos períodos. Sin "contra": los mismos meses del año anterior; si está el mes en curso, el del
// año anterior va hasta el mismo día (como antes). Con "contra": a la izquierda el que empieza antes.
function periodos(q, hoyAR) {
  const hoyMes = hoyAR.slice(0, 7), dia = Number(hoyAR.slice(8, 10));
  let elegidos = listaMeses(q.meses || q.mes, hoyMes);
  if (!elegidos.length) elegidos = [hoyMes];
  const contra = listaMeses(q.contra, hoyMes);
  if (elegidos.length > MAX_MESES || contra.length > MAX_MESES) { const e = new Error('Elegí hasta ' + MAX_MESES + ' meses de cada lado.'); e.status = 400; throw e; }
  const corte = {};
  if (elegidos.includes(hoyMes) || contra.includes(hoyMes)) corte[hoyMes] = dia;
  let modo, a, b;
  if (!contra.length) {
    modo = 'anio'; b = elegidos; a = elegidos.map(menosUnAnio);
    if (elegidos.includes(hoyMes)) corte[menosUnAnio(hoyMes)] = dia;
  } else {
    modo = 'libre';
    [a, b] = contra[0] <= elegidos[0] ? [contra, elegidos] : [elegidos, contra];
  }
  const lado = ms => {
    const R = rangos(ms, corte);
    const cortado = ms.find(m => corte[m] && corte[m] < finDeMes(m));
    return { desde: R[0].desde, hasta: R[R.length - 1].hasta, meses: ms, rangos: R, parcial: cortado ? { mes: cortado, dia: corte[cortado] } : null };
  };
  return { modo, elegidos, contra, hoyMes, dia, a: lado(a), b: lado(b) };
}

// Lo que hay que avisar arriba de los números.
function avisosDe(P) {
  const out = [];
  const nombre = m => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
  if (P.a.meses.some(m => m < MES_MIN)) out.push('Antes de enero de 2025 no hay ventas cargadas. Para ver meses de 2025, elegí en "Contra" los meses con los que querés compararlos.');
  if (P.modo === 'libre' && (P.a.meses.includes(P.hoyMes) || P.b.meses.includes(P.hoyMes)))
    out.push('El mes en curso (' + nombre(P.hoyMes) + ') tiene ventas hasta hoy, ' + P.dia + '/' + P.hoyMes.slice(5, 7) + '; los otros meses van completos.');
  if (P.a.meses.length !== P.b.meses.length)
    out.push('Los períodos tienen distinta cantidad de meses (' + P.a.meses.length + ' y ' + P.b.meses.length + '): los totales no se comparan directo; el precio promedio, el drop y la facturación promedio sí.');
  return out;
}

// La base corta las consultas con la clave pública a los 3 s (con MANUAL_SERVICE_ROLE, a los 8 s).
// Si corta, se reintenta una vez: la segunda ya encuentra los datos en memoria (igual que dir-ventas).
async function datosRangos(cuerpo) {
  const key = process.env.MANUAL_SERVICE_ROLE || MAN_KEY;
  const t0 = Date.now();
  const llamar = async () => {
    const r = await fetch(MAN_URL + '/rest/v1/rpc/comparativo_datos_rangos', {
      method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return { r, d: await r.json().catch(() => null) };
  };
  let x = await llamar();
  if (!x.r.ok && x.d && x.d.code === '57014' && Date.now() - t0 < 4500) x = await llamar();
  return x;
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
    const modo = MODOS.includes(q.modo) ? q.modo : 'proveedor';
    let P;
    try { P = periodos(q, hoyAR); } catch (e) { return json(e.status || 400, { error: e.message }); }
    const avisos = avisosDe(P);

    const [src, ipc] = await Promise.all([
      guardado('fuente', 30 * 60e3, fuente),
      guardado('ipc-serie', 12 * 3600e3, inflacion).catch(() => null),
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

    const { r, d } = await datosRangos({
      p_a_desde: P.a.rangos.map(x => x.desde), p_a_hasta: P.a.rangos.map(x => x.hasta),
      p_b_desde: P.b.rangos.map(x => x.desde), p_b_hasta: P.b.rangos.map(x => x.hasta),
      p_modo: modo, p_f1: f1, p_f2: f2, p_f3: f3, p_vend_incl: incl, p_vend_excl: [...excluidos], p_clientes: clientesFiltro });
    if (!r.ok && d && d.code === '57014') return json(504, { error: 'Son muchos meses para calcular de una vez. Probá con menos meses o con algún filtro (vendedor, equipo, proveedor).' });
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
      mes: P.b.meses[P.b.meses.length - 1], modo, hoy: hoyAR,
      // comp: 'anio' = contra los mismos meses del año anterior; 'libre' = contra los meses de "contra".
      comp: P.modo, meses: P.elegidos, contra: P.contra, a: P.a, b: P.b,
      parcial: !!(P.a.parcial || P.b.parcial),
      resumen: d.resumen || {},
      filas,
      inflacion: ipc ? { mes: ipc.mes, interanual: ipc.interanual, fuente: ipc.fuente } : null,
      inflacion_periodos: inflacionEntre(ipc, P.a.meses, P.b.meses),
      filtros: {
        vendedores: vend.filter(v => !excluidos.has(v.codigo) && conVentas.has(v.codigo)).sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map(v => ({ codigo: v.codigo, nombre: v.nombre, equipo: v.equipo, provincia: v.provincia })),
        equipos: EQUIPOS,
        provincias: [...new Set(vend.filter(v => !excluidos.has(v.codigo) && v.provincia).map(v => v.provincia))].sort(),
        tipos,
        familias1: Object.keys(FAMILIA1).map(k => ({ codigo: k, nombre: FAMILIA1[k] })),
        proveedores: (d.proveedores || []).map(k => ({ codigo: k, nombre: nomProv(k) })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        // Todos los meses con ventas cargadas, de enero de 2025 al mes en curso.
        meses: (() => { const out = []; for (let i = idxMes(MES_MIN); i <= idxMes(P.hoyMes); i++) out.push(Math.floor(i / 12) + '-' + p2(i % 12 + 1)); return out; })(),
      },
      avisos,
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('comparativo', module.exports.handler);
