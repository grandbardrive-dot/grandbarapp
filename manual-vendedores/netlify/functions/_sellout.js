// ============================================================
//  Sellout de los proveedores desde CUBO (25/11/2026). Lo usa sellout-background, que lo
//  guarda en sellout_reportes (base del Manual) para el panel del proveedor ("Mis reportes",
//  proveedor-reportes.html). Reemplaza al Excel que armaba Seba a mano ("Sellout - Chandon.xlsx"),
//  que se subía en admin-sellout.html y había quedado en agosto.
//
//  Criterio, copiado del Excel de Seba (septiembre y octubre de Chandon dan igual, botella por botella):
//   · Artículos de las bodegas del proveedor (4 primeros dígitos del código = "Bodega" del Excel,
//     nombres en _familia2.js). Cada proveedor con sus bodegas en PROVEEDORES.
//   · Sin los vendedores excluidos (archivo "Vendedores Excluidos.xlsx" de SHARE).
//   · Botellas = unidades, con las notas de crédito restando. Cajas = botellas ÷ 6.
//   · Monto = con IVA, impuesto interno y percepciones (como la "Venta total" de Dirección).
//   · Canal = tipo de cliente de CUBO (rubro de cuentas_cubo); provincia del maestro de clientes
//     de CUBO (clientes_geo); familia = línea del artículo; vendedor = el de la factura.
//   · Los últimos 12 meses cerrados y el mes en curso (pedido del usuario: "los últimos 12 meses").
//   · Stock: el del ERP (productos_grandbar, se actualiza todos los días a las 6). Es el total de
//     los depósitos: CUBO no lo da separado por Mendoza y San Luis como el Excel.
//  (El "_" evita que Netlify lo publique como función.)
// ============================================================
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_SERVICE_ROLE || process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const FAMILIA2 = require('./_familia2');
const { excluidos } = require('./_vendedores-excluidos');
const { traerTodo } = require('./_paginar');

// Bodegas de cada proveedor (el nombre es usuarios.empresa del proveedor en el Portal, tal cual). "desde": mes
// desde el que la bodega entra, como en el Excel de Seba (Dellepiane desde julio y Cinzano desde agosto
// de 2026 en Peñaflor). Chandon: solo Bodega Chandon, como su último Excel (Belvedere, Hennessy y
// Glenmorangie, código 0252, quedaron afuera desde agosto de 2026).
const PROVEEDORES = {
  'Chandon': [{ p: '0118' }],
  'Pernod Ricard': [{ p: '0201' }, { p: '0108' }, { p: '0110' }],
  'Grupo Peñaflor': [
    { p: '0102' }, { p: '0106' }, { p: '0112' }, { p: '0117' }, { p: '0127' }, { p: '0184' }, { p: '0194' },
    { p: '0202' }, { p: '0512' }, { p: '0212', desde: '2026-07' }, { p: '0253', desde: '2026-08' },
  ],
  // 25/11/2026 (pedido del usuario: "activalo para Campari, Doña Paula, Renacer y Salentein").
  // Cinzano: Campari hasta julio de 2026 y Peñaflor desde agosto (decisión del usuario, como el
  // Excel de Seba). Salentein con Jack Daniel's (0242 "Salentein Jack Daniel´s" en CUBO), decisión del usuario.
  'Campari Group': [{ p: '0204' }, { p: '0253', hasta: '2026-07' }],
  'Doña Paula': [{ p: '0198' }],
  'Renacer': [{ p: '0189' }],
  'Salentein': [{ p: '0104' }, { p: '0242' }],
};
const MESES_CERRADOS = 12;
const BOT_POR_CAJA = 6;
const NOMBRE_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const p2 = n => String(n).padStart(2, '0');
const hoyAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const nc = c => String(c == null ? '' : c).trim().replace(/^0+/, '') || '0';
const limpio = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// El mes en curso y los 12 cerrados anteriores: [{ per, desde, hasta, label, enCurso }].
function meses(hoy) {
  const [y, m, d] = hoy.split('-').map(Number);
  const out = [];
  for (let i = 0; i <= MESES_CERRADOS; i++) {
    const t = new Date(Date.UTC(y, m - 1 - i, 1));
    const yy = t.getUTCFullYear(), mm = t.getUTCMonth() + 1;
    const fin = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const enCurso = i === 0;
    out.push({
      per: yy + '-' + p2(mm), desde: yy + '-' + p2(mm) + '-01', hasta: enCurso ? hoy : yy + '-' + p2(mm) + '-' + p2(fin), enCurso,
      label: NOMBRE_MES[mm - 1] + ' ' + yy + (enCurso ? ' (al ' + p2(d) + '/' + p2(m) + ')' : ''),
    });
  }
  return out;
}
// Las bodegas de un proveedor en un mes ("desde"/"hasta": mes en que entra o el último en que está).
const prefijosDe = (prov, per) => (PROVEEDORES[prov] || []).filter(b => (!b.desde || per >= b.desde) && (!b.hasta || per <= b.hasta)).map(b => b.p);

async function rpcMes(M, prefijos, excl) {
  const r = await fetch(MAN_URL + '/rest/v1/rpc/sellout_mes', {
    method: 'POST',
    headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_desde: M.desde, p_hasta: M.hasta, p_prefijos: prefijos, p_vend_excl: excl }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(d)) throw new Error('sellout_mes ' + M.per + ': ' + r.status + ' ' + JSON.stringify(d).slice(0, 150));
  return d;
}

// Nombre y tipo de cliente (cuentas_cubo) y provincia (clientes_geo), por código sin ceros adelante.
async function datosClientes() {
  const C = {};
  const cobK = process.env.COBRANZAS_SERVICE_ROLE, hubK = process.env.HUB_SERVICE_ROLE;
  const avisos = [];
  if (cobK) {
    const cob = (p, o = {}) => fetch(COB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: cobK, Authorization: 'Bearer ' + cobK, ...(o.headers || {}) } });
    const filas = await traerTodo(cob, 'cuentas_cubo?select=codigo,nombre,rubro&order=codigo.asc');
    (filas || []).forEach(c => { const k = nc(c.codigo); C[k] = Object.assign(C[k] || {}, { n: limpio(c.nombre), t: limpio(c.rubro) }); });
  } else avisos.push('Falta COBRANZAS_SERVICE_ROLE: sin nombre ni tipo de cliente de CUBO.');
  if (hubK) {
    const hub = (p, o = {}) => fetch(HUB_URL + '/rest/v1/' + p, { ...o, headers: { apikey: hubK, Authorization: 'Bearer ' + hubK, ...(o.headers || {}) } });
    const filas = await traerTodo(hub, 'clientes_geo?select=codigo,nombre,provincia&order=codigo.asc');
    (filas || []).forEach(c => { const k = nc(c.codigo); const x = C[k] = C[k] || {}; x.pv = limpio(c.provincia).toUpperCase(); if (!x.n) x.n = limpio(c.nombre); });
  } else avisos.push('Falta HUB_SERVICE_ROLE: sin provincia.');
  return { C, avisos };
}

// Arma un mes con la misma forma que guardaba admin-sellout.html desde el Excel.
function armarMes(filas, C, M) {
  const P = { canal: {}, familia: {}, articulo: {}, vendedor: {}, provincia: {}, cliente: {}, bot: 0, monto: 0, cli: new Set(), art: new Set() };
  const add = (m, k, bot, monto) => { k = limpio(k) || '(s/d)'; const x = m[k] = m[k] || { bot: 0, monto: 0 }; x.bot += bot; x.monto += monto; };
  for (const [cli, sku, vcod, vnom, u, monto, desc, linea] of filas) {
    const bot = Number(u) || 0, mo = Number(monto) || 0;
    const c = C[nc(cli)] || {};
    const tipo = c.t && !/^sin categorizar$/i.test(c.t) ? c.t : 'Sin tipo';
    P.bot += bot; P.monto += mo; P.cli.add(nc(cli)); P.art.add(sku);
    add(P.canal, tipo, bot, mo);
    add(P.familia, linea, bot, mo);
    add(P.articulo, desc || ('Artículo ' + sku), bot, mo);
    add(P.vendedor, vnom || ('Vendedor ' + vcod), bot, mo);
    add(P.provincia, c.pv, bot, mo);
    const K = P.cliente[nc(cli)] = P.cliente[nc(cli)] || { n: c.n || ('Cliente ' + cli), bot: 0, monto: 0, tipo };
    K.bot += bot; K.monto += mo;
  }
  const top = (m, n) => Object.entries(m).map(([k, v]) => ({ n: k, bot: Math.round(v.bot), monto: Math.round(v.monto) })).sort((a, b) => b.bot - a.bot).slice(0, n || 99999);
  return {
    label: M.label, fuente: 'CUBO', desde: M.desde, hasta: M.hasta, en_curso: M.enCurso || undefined,
    totales: { botellas: Math.round(P.bot), cajas: Math.round(P.bot / BOT_POR_CAJA), monto: Math.round(P.monto), clientes: P.cli.size, articulos: P.art.size },
    canal: top(P.canal), familia: top(P.familia), articulo: top(P.articulo, 30), vendedor: top(P.vendedor), provincia: top(P.provincia),
    clientes: Object.values(P.cliente).map(v => ({ n: v.n, bot: Math.round(v.bot), monto: Math.round(v.monto), tipo: v.tipo })).sort((a, b) => b.bot - a.bot),
  };
}

// Stock del ERP de las bodegas del proveedor (las de hoy). Solo los artículos con stock.
async function armarStock(prov, lineaDe) {
  const prefs = prefijosDe(prov, '9999-99');
  const r = await fetch(MAN_URL + '/rest/v1/productos_grandbar?select=codigo,descripcion,stock,actualizado_en&stock=neq.0&or=(' + prefs.map(p => 'codigo.like.' + p + '*').join(',') + ')&order=descripcion', {
    headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY },
  });
  if (!r.ok) throw new Error('productos_grandbar ' + r.status);
  const l = await r.json();
  const act = l.reduce((m, x) => (x.actualizado_en && x.actualizado_en > m ? x.actualizado_en : m), '');
  return {
    fuente: 'ERP', actualizado: act || null, updated: act ? Date.parse(act) : Date.now(),
    stock: l.map(x => ({ ubicacion: 'Depósitos (total)', codigo: x.codigo, articulo: limpio(x.descripcion), linea: lineaDe[x.codigo] || '',
      bodega: FAMILIA2[String(x.codigo).slice(0, 4)] || '', botellas: Number(x.stock) || 0 })),
  };
}

// Todo: los proveedores de PROVEEDORES, los 13 meses y el stock. Devuelve las filas de sellout_reportes.
async function generar(opciones = {}) {
  const hoy = opciones.hoy || hoyAR();
  const lista = opciones.proveedores || Object.keys(PROVEEDORES);
  const [EX, cli] = await Promise.all([excluidos(), datosClientes()]);
  const excl = [...EX];
  const filas = [], resumen = {};
  for (const prov of lista) {
    const lineaDe = {};
    const Ms = meses(hoy);
    const datos = [];
    for (let i = 0; i < Ms.length; i += 4) {        // de a 4 meses a la vez
      const tanda = Ms.slice(i, i + 4);
      datos.push(...await Promise.all(tanda.map(M => rpcMes(M, prefijosDe(prov, M.per), excl))));
    }
    Ms.forEach((M, i) => {
      datos[i].forEach(x => { if (x[7] && !lineaDe[x[1]]) lineaDe[x[1]] = x[7]; });
      const data = armarMes(datos[i], cli.C, M);
      filas.push({ proveedor: prov, periodo: M.per, data });
      resumen[prov] = resumen[prov] || {};
      resumen[prov][M.per] = data.totales.botellas;
    });
    filas.push({ proveedor: prov, periodo: 'stock', data: await armarStock(prov, lineaDe) });
  }
  return { filas, resumen, avisos: cli.avisos, desde: meses(hoy).slice(-1)[0].per, hasta: meses(hoy)[0].per };
}

// Guarda (pisa) cada mes y el stock. Los meses viejos que subió Seba quedan en la base, pero el panel
// muestra solo los últimos 12 y el mes en curso.
async function guardar(filas) {
  for (let i = 0; i < filas.length; i += 20) {
    const lote = filas.slice(i, i + 20).map(f => Object.assign({}, f, { updated_at: new Date().toISOString() }));
    const r = await fetch(MAN_URL + '/rest/v1/sellout_reportes?on_conflict=proveedor,periodo', {
      method: 'POST',
      headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lote),
    });
    if (!r.ok) throw new Error('sellout_reportes ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
}

module.exports = { PROVEEDORES, generar, guardar, meses, armarMes };
