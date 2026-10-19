// ============================================================
//  GrandBar Hub · Function · dir-ventas  (14/10/2026)
//   Ventas y margen para el panel de Dirección (dir-ventas.html).
//   Los números salen de CUBO (sync-ventas, cada 20 min, también el día de hoy) y los
//   suma la base con dir_ventas(desde, hasta) — ver dir-ventas-setup.sql:
//   - Venta de productos = neto sin IVA de facturas menos notas de crédito.
//   - Margen bruto = venta neta − costo neto (sin IVA), solo productos con código.
//   - Aparte: lo facturado sin código de artículo (eventos, servicios: sin costo en CUBO)
//     y los ajustes (rubros 06 y 14). Las notas de débito (cheques rechazados) no son venta.
//   GET ?periodo=hoy|semana|mes|mes_anterior|anio  (o ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD)
//   Devuelve el período, el período anterior equivalente y el mismo del año pasado.
//   Solo Dirección (y Diseño/Desarrollo, que mantienen el sistema).
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = process.env.MANUAL_SERVICE_ROLE || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const ROLES = ['direccion', 'admin', 'duenio', 'desarrollo', 'diseno'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

// Fechas en hora de Argentina, como texto AAAA-MM-DD.
const iso = d => d.toISOString().slice(0, 10);
const dia = (y, m, d) => new Date(Date.UTC(y, m, d, 12));
const finDeMes = (y, m) => new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
// El mismo día en otro mes; si ese mes es más corto, su último día (31/03 → 28/02).
const mover = (d, meses, anios = 0) => {
  const y = d.getUTCFullYear() + anios, m = d.getUTCMonth() + meses;
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return dia(yy, mm, Math.min(d.getUTCDate(), finDeMes(yy, mm)));
};

function periodos(p, qd, qh) {
  const a = new Date(Date.now() - 3 * 3600 * 1000);
  const hoy = dia(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const y = hoy.getUTCFullYear(), m = hoy.getUTCMonth();
  const R = (d, h) => ({ desde: iso(d), hasta: iso(h) });
  if (/^\d{4}-\d{2}-\d{2}$/.test(qd || '') && /^\d{4}-\d{2}-\d{2}$/.test(qh || '') && qd <= qh) {
    const d = new Date(qd + 'T12:00:00Z'), h = new Date(qh + 'T12:00:00Z');
    const n = Math.round((h - d) / 864e5) + 1;
    return { titulo: 'Rango elegido', actual: R(d, h),
      anterior: { ...R(new Date(d - n * 864e5), new Date(d - 864e5)), titulo: `los ${n} días anteriores` },
      anio: { ...R(mover(d, 0, -1), mover(h, 0, -1)), titulo: 'las mismas fechas del año pasado' } };
  }
  switch (p) {
    case 'hoy': {
      const sem = new Date(hoy - 7 * 864e5);
      return { titulo: 'Hoy', actual: R(hoy, hoy),
        anterior: { ...R(sem, sem), titulo: 'el mismo día de la semana pasada' },
        anio: { ...R(mover(hoy, 0, -1), mover(hoy, 0, -1)), titulo: 'la misma fecha del año pasado' } };
    }
    case 'semana': {
      const dow = (hoy.getUTCDay() + 6) % 7;            // lunes = 0
      const lun = new Date(hoy - dow * 864e5);
      return { titulo: 'Esta semana', actual: R(lun, hoy),
        anterior: { ...R(new Date(lun - 7 * 864e5), new Date(hoy - 7 * 864e5)), titulo: 'los mismos días de la semana pasada' },
        anio: { ...R(mover(lun, 0, -1), mover(hoy, 0, -1)), titulo: 'las mismas fechas del año pasado' } };
    }
    case 'mes_anterior': {
      const yy = m === 0 ? y - 1 : y, mm = m === 0 ? 11 : m - 1;
      const ini = dia(yy, mm, 1), fin = dia(yy, mm, finDeMes(yy, mm));
      const pi = mover(ini, -1), pf = dia(pi.getUTCFullYear(), pi.getUTCMonth(), finDeMes(pi.getUTCFullYear(), pi.getUTCMonth()));
      return { titulo: 'Mes anterior', actual: R(ini, fin),
        anterior: { ...R(pi, pf), titulo: 'el mes previo completo' },
        anio: { ...R(dia(yy - 1, mm, 1), dia(yy - 1, mm, finDeMes(yy - 1, mm))), titulo: 'el mismo mes del año pasado' } };
    }
    case 'anio': {
      const ini = dia(y, 0, 1);
      return { titulo: 'En lo que va del año', actual: R(ini, hoy),
        anterior: null,
        anio: { ...R(dia(y - 1, 0, 1), mover(hoy, 0, -1)), titulo: 'el mismo período del año pasado' } };
    }
    default: {                                          // mes en curso
      const ini = dia(y, m, 1);
      return { titulo: 'Este mes', actual: R(ini, hoy),
        anterior: { ...R(mover(ini, -1), mover(hoy, -1)), titulo: 'los mismos días del mes pasado' },
        anio: { ...R(mover(ini, 0, -1), mover(hoy, 0, -1)), titulo: 'los mismos días del año pasado' } };
    }
  }
}

async function resumen(r) {
  const res = await fetch(MAN_URL + '/rest/v1/rpc/dir_ventas', {
    method: 'POST',
    headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_desde: r.desde, p_hasta: r.hasta }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('dir_ventas ' + res.status + ' ' + JSON.stringify(d).slice(0, 200));
  return d;
}
// Para comparar alcanza con los totales (sin las listas largas).
const soloTotales = d => d && ({ desde: d.desde, hasta: d.hasta, venta: d.venta, costo: d.costo, margen: d.margen, unidades: d.unidades,
  facturado: d.facturado, sin_codigo: d.sin_codigo, dias: d.dias, por_rubro: d.por_rubro,
  por_proveedor: (d.por_proveedor || []).map(x => ({ codigo: x.codigo, venta: x.venta, margen: x.margen })),
  por_vendedor: (d.por_vendedor || []).map(x => ({ codigo: x.codigo, nombre: x.nombre, venta: x.venta, margen: x.margen })),
  vendedor_completo: d.vendedor_completo });

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
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,activo', { headers: { apikey: srole, Authorization: 'Bearer ' + srole } });
    const perfil = (pRes.ok ? await pRes.json() : [])[0] || {};
    if (perfil.activo === false || !ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección.' });

    const qp = event.queryStringParameters || {};
    const P = periodos(qp.periodo || 'mes', qp.desde, qp.hasta);
    // La última vez que la tarea de ventas leyó CUBO bien. El "actualizado" de las ventas es
    // la última factura cargada: un domingo o un feriado no hay facturas y la pantalla decía
    // que la carga "se demoró" aunque anduviera bien (19/10/2026).
    const syncP = fetch(HUB_URL + '/rest/v1/sistema_corridas?tarea=eq.sync-ventas&ok=eq.true&select=fin&order=inicio.desc&limit=1',
      { headers: { apikey: srole, Authorization: 'Bearer ' + srole } }).then(r => r.ok ? r.json() : []).then(a => (a && a[0] && a[0].fin) || null).catch(() => null);
    const [actual, anterior, anio, sync] = await Promise.all([
      resumen(P.actual), P.anterior ? resumen(P.anterior) : null, P.anio ? resumen(P.anio) : null, syncP,
    ]);
    return json(200, {
      periodo: qp.periodo || 'mes', titulo: P.titulo,
      actual,
      anterior: anterior ? { ...soloTotales(anterior), titulo: P.anterior.titulo } : null,
      anio: anio ? { ...soloTotales(anio), titulo: P.anio.titulo } : null,
      generado: new Date().toISOString(),
      sync,
    });
  } catch (e) {
    return json(500, { error: 'No se pudieron calcular las ventas.', detalle: String((e && e.message) || e).slice(0, 200) });
  }
};

// Estado del sistema: los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('dir-ventas', module.exports.handler);
