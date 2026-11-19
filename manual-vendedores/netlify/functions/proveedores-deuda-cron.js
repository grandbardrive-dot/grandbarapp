// ============================================================
//  GrandBar Hub · Function PROGRAMADA · proveedores-deuda-cron  (19/11/2026)
//  Cada hora dispara proveedores-deuda-background, que baja la deuda con proveedores de
//  CUBO (ListarProveedores tarda unos 36 s: no entra en los 30 s de una función programada).
//  Ver netlify.toml.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/proveedores-deuda-background`, { method: 'POST' }); // background → 202 al instante
    console.log('proveedores-deuda-cron: disparada la background →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('proveedores-deuda-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};

module.exports.handler = require('./_errores').conErrores('proveedores-deuda-cron', module.exports.handler);
