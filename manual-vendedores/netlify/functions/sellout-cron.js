// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sellout-cron  (25/11/2026)
//  Dispara sellout-background (el sellout de los proveedores desde CUBO) a las 6:30 y a las 14:30
//  de Argentina (ver netlify.toml): a la mañana ya están las ventas de ayer y el stock del día.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/sellout-background`, { method: 'POST' });   // background → 202 al instante
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};

module.exports.handler = require('./_errores').conErrores('sellout-cron', module.exports.handler);
