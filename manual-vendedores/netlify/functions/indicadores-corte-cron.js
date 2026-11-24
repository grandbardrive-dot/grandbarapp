// ============================================================
//  GrandBar Hub · Function PROGRAMADA · indicadores-corte-cron  (24/11/2026)
//  Guarda el corte del día para los indicadores financieros de Dirección (dir-indicadores):
//  saldo de cuentas corrientes de clientes, cheques de clientes en cartera, facturas de
//  proveedores a pagar y echeqs entregados sin debitar (ver _indicadores.js).
//  Corre dos veces por día (20:55 y 23:55 de Argentina, ver netlify.toml) y pisa el corte del
//  mismo día: así el último día de cada mes queda el cierre, aunque una corrida falle.
//  Si una fuente no se puede leer, ese dato no se toca (queda el de la corrida anterior del día)
//  y la corrida se marca con error en el estado del sistema.
//  Env: HUB_SERVICE_ROLE, COBRANZAS_SERVICE_ROLE
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const { tomarCorte } = require('./_indicadores');
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const CAMPOS = ['saldo_clientes', 'cheques_cartera', 'saldo_proveedores', 'cheques_propios'];

exports.handler = async () => {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
  const c = await tomarCorte();
  if (CAMPOS.every(x => c[x] == null)) {
    console.error('indicadores-corte: no se pudo leer ninguna fuente', JSON.stringify(c.detalle.errores || {}));
    return json(502, { error: 'No se pudo leer ninguna fuente.', detalle: c.detalle });
  }
  // Solo los datos que se pudieron leer (lo demás queda como estaba en el corte del día).
  const fila = { fecha: c.fecha, detalle: c.detalle, actualizado_at: new Date().toISOString() };
  CAMPOS.forEach(x => { if (c[x] != null) fila[x] = c[x]; });
  const r = await fetch(HUB_URL + '/rest/v1/indicadores_cortes?on_conflict=fecha', {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(fila),
  });
  if (!r.ok) throw new Error('No se pudo guardar el corte: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  if (c.detalle.errores) console.error('indicadores-corte: fuentes que no se pudieron leer', JSON.stringify(c.detalle.errores));
  return json(200, { ok: true, corte: fila });
};

module.exports.handler = require('./_corrida').conRegistro('indicadores-corte', exports.handler);
