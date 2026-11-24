// ============================================================
//  GrandBar Hub · Function · diagnostico  (24/11/2026)
//  "Diagnóstico de ventas" (diagnostico.html): por vendedor (o equipo, o toda la empresa),
//  clientes con compra (CCC) y volumen (botellas) del mes en curso contra el mes anterior
//  y contra el mismo mes del año anterior, y el acumulado del año contra el del año anterior.
//  Pedido del usuario con un dibujo (ejemplo: Carolina Heluani).
//  Filas: Spirits (Campari con Cinzano, Pernod Ricard, Diageo, Fratelli Branca, Cepas y otros),
//  los 10 vinos más importantes (proveedores que más facturaron en el año) y otros vinos, y
//  el resto (cervezas, sin alcohol y café).
//  Misma fuente que el Comparativo: ventas_cliente (CUBO, cada 20 min), solo familia 1
//  01/02/04/05/07, sin los vendedores de la hoja Excluidos, equipos de Presupuesto Ventas
//  (_fuente-comparativo.js) y nombres de proveedor de la Comparativa Anual (_familia2.js).
//  Si el mes es el actual, todos los períodos van hasta el mismo día.
//  RPC: diagnostico_ventas, diagnostico_top_vinos y vendedores_con_ventas (base del Manual).
//  Lo ven: supervisores y Dirección (más Desarrollo y Diseño, que mantienen el sistema).
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY  = process.env.MANUAL_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const FAMILIA2 = require('./_familia2');
const { guardado, fuente, vendedores, EQUIPOS } = require('./_fuente-comparativo');
const { cod3 } = require('./_objetivos-vendedores');

const PUEDEN = ['admin', 'direccion', 'duenio', 'desarrollo', 'diseno'];   // + es_supervisor
// Spirits que van en su propia fila (el resto, "Otros spirits"). Cinzano es de Campari.
const SPIRITS = [
  ['campari', 'Campari (con Cinzano)', ['0204', '0253']],
  ['pernod', 'Pernod Ricard', ['0201']],
  ['diageo', 'Diageo', ['0202']],
  ['branca', 'Fratelli Branca', ['0205']],
  ['cepas', 'Cepas', ['0206']],
];
const TOP_VINOS = 10;

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const p2 = n => String(n).padStart(2, '0');
const ultimoDia = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const titulo = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase()).replace(/\bDe\b/g, 'de').replace(/\bLa\b/g, 'La');

async function rpc(nombre, cuerpo) {
  const r = await fetch(MAN_URL + '/rest/v1/rpc/' + nombre, {
    method: 'POST',
    headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || d == null) throw new Error('No se pudieron leer las ventas (' + nombre + ' ' + r.status + ').');
  return d;
}

// Los cinco períodos. Si el mes es el actual, todos cortan el mismo día (24/11 contra 24/10,
// 24/11 del año pasado, etc.); si es un mes cerrado, van completos.
function periodos(mes, hoyAR) {
  const [y, m] = mes.split('-').map(Number);
  const parcial = hoyAR.slice(0, 7) === mes;
  const dia = parcial ? Number(hoyAR.slice(8, 10)) : ultimoDia(y, m);
  const corte = (yy, mm) => `${yy}-${p2(mm)}-${p2(Math.min(dia, ultimoDia(yy, mm)))}`;
  const ym = m === 1 ? [y - 1, 12] : [y, m - 1];
  return {
    parcial, dia,
    lista: [
      { k: 'mes', d: `${y}-${p2(m)}-01`, h: corte(y, m) },
      { k: 'mes_ant', d: `${ym[0]}-${p2(ym[1])}-01`, h: corte(ym[0], ym[1]) },
      { k: 'anio_ant', d: `${y - 1}-${p2(m)}-01`, h: corte(y - 1, m) },
      { k: 'acum', d: `${y}-01-01`, h: corte(y, m) },
      { k: 'acum_ant', d: `${y - 1}-01-01`, h: corte(y - 1, m) },
    ],
  };
}

exports.handler = async (event) => {
  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,es_supervisor,codigo_vendedor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    if (!perfil.es_supervisor && !PUEDEN.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'El Diagnóstico de ventas es para supervisores y Dirección.' });

    const q = event.queryStringParameters || {};
    const hoyAR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') && q.mes <= hoyAR.slice(0, 7) && q.mes >= '2026-01' ? q.mes : hoyAR.slice(0, 7);
    const P = periodos(mes, hoyAR);
    const [d0, d1, d2, d3, d4] = P.lista;

    const src = await guardado('fuente', 30 * 60e3, fuente);
    const excluidos = [...new Set(src.excluidos)];
    const [vend, conVentas, top] = await Promise.all([
      guardado('vendedores', 30 * 60e3, () => vendedores(src)),
      guardado('con-ventas-' + d4.d + d3.h.slice(0, 7), 30 * 60e3, () => rpc('vendedores_con_ventas', { p_desde: d4.d, p_hasta: d3.h })),
      guardado('top-vinos-' + d3.h, 60 * 60e3, () => rpc('diagnostico_top_vinos', { p_desde: d3.d, p_hasta: d3.h, p_vend_excl: excluidos, p_n: TOP_VINOS })),
    ]);
    const conV = new Set((conVentas || []).map(cod3));
    const lista = vend.filter(v => !excluidos.includes(v.codigo) && !v.oculto && conV.has(v.codigo))
      .sort((a, b) => (EQUIPOS.indexOf(a.equipo) + 1 || 99) - (EQUIPOS.indexOf(b.equipo) + 1 || 99) || a.nombre.localeCompare(b.nombre));

    // Qué se mira: un vendedor (v:039), un equipo (e:ON) o toda la empresa (todos).
    // De entrada, el supervisor ve su equipo y Dirección, toda la empresa.
    let sel = String(q.sel || '');
    if (!sel) {
      const mio = perfil.codigo_vendedor ? lista.find(v => v.codigo === cod3(perfil.codigo_vendedor)) : null;
      sel = perfil.es_supervisor && mio && mio.equipo ? 'e:' + mio.equipo : 'todos';
    }
    let incl = null, nombreSel = 'Toda la empresa';
    if (sel.startsWith('v:')) {
      const v = lista.find(x => x.codigo === cod3(sel.slice(2))) || vend.find(x => x.codigo === cod3(sel.slice(2)));
      if (!v || excluidos.includes(v.codigo)) return json(404, { error: 'Ese vendedor no está en el diagnóstico.' });
      incl = [v.codigo]; nombreSel = v.nombre; sel = 'v:' + v.codigo;
    } else if (sel.startsWith('e:') && EQUIPOS.includes(sel.slice(2))) {
      incl = lista.filter(v => v.equipo === sel.slice(2)).map(v => v.codigo);
      if (!incl.length) incl = ['__ninguno__'];
      nombreSel = 'Equipo ' + sel.slice(2);
    } else sel = 'todos';

    // Cada proveedor a su fila: los spirits elegidos y los 10 vinos del año.
    const grupos = {};
    SPIRITS.forEach(([k, , cods]) => cods.forEach(c => { grupos[c] = k; }));
    (top || []).forEach(c => { grupos[c] = 'v' + c; });
    const d = await rpc('diagnostico_ventas', {
      p_d0: d0.d, p_h0: d0.h, p_d1: d1.d, p_h1: d1.h, p_d2: d2.d, p_h2: d2.h, p_d3: d3.d, p_h3: d3.h, p_d4: d4.d, p_h4: d4.h,
      p_grupos: grupos, p_vend_incl: incl, p_vend_excl: excluidos,
    });
    const cero = [0, 0, 0, 0, 0];
    const fila = (clave, n, nivel) => ({ k: clave, n, nivel, u: (d[clave] || {}).u || cero, c: (d[clave] || {}).c || cero });
    const filas = [
      fila('b:spirits', 'Spirits', 'bloque'),
      ...SPIRITS.map(([k, n]) => fila('f:' + k, n, 'fila')),
      fila('f:spirits_otros', 'Otros spirits', 'fila'),
      fila('b:vinos', 'Vinos', 'bloque'),
      ...(top || []).map(c => fila('f:v' + c, titulo(FAMILIA2[c] || ('Proveedor ' + c)), 'fila')),
      fila('f:vinos_otros', 'Otros vinos', 'fila'),
      fila('b:otros', 'Cervezas, sin alcohol y café', 'bloque'),
      fila('total', 'Total', 'total'),
    ];

    const meses = [];
    for (let m = 1; m <= Number(hoyAR.slice(5, 7)); m++) meses.push(hoyAR.slice(0, 4) + '-' + p2(m));
    return json(200, {
      mes, hoy: hoyAR, parcial: P.parcial, dia: P.dia, periodos: P.lista,
      sel, nombre: nombreSel, filas,
      opciones: {
        meses,
        equipos: EQUIPOS.filter(e => lista.some(v => v.equipo === e)),
        vendedores: lista.map(v => ({ codigo: v.codigo, nombre: v.nombre, equipo: v.equipo })),
      },
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('diagnostico', module.exports.handler);
