// ============================================================
//  GrandBar Hub · BACKGROUND Function · sellout-background  (25/11/2026)
//  Arma el sellout de los proveedores desde CUBO (últimos 12 meses + el mes en curso + stock)
//  y lo guarda en sellout_reportes para su panel ("Mis reportes"). Criterio y proveedores en
//  _sellout.js. La dispara sellout-cron dos veces por día; también se puede llamar a mano
//  (POST), no cambia nada más que el sellout.
//  Env: COBRANZAS_SERVICE_ROLE (nombre y tipo de cliente), HUB_SERVICE_ROLE (provincia).
// ============================================================
const { generar, guardar } = require('./_sellout');

exports.handler = async () => {
  const t0 = Date.now();
  const { filas, resumen, avisos, desde, hasta } = await generar();
  await guardar(filas);
  avisos.forEach(a => console.error('sellout:', a));
  console.log('sellout: ' + filas.length + ' filas (' + desde + ' a ' + hasta + ') en ' + Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify(resumen));
  return { statusCode: 200, body: JSON.stringify({ ok: true, filas: filas.length, desde, hasta, resumen }) };
};

// Estado del sistema: cada corrida queda en sistema_corridas (ver _corrida.js).
exports.handler = require('./_corrida').conRegistro('sellout', exports.handler);
