// ============================================================
//  GrandBar Hub · Function PROGRAMADA · recibos-erp-cron
//  Dispara recibos-erp-background: trae los recibos nuevos del ERP y completa
//  solo el N° de recibo en las planillas de rendición (ver ese archivo).
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/recibos-erp-background`, { method: 'POST' });
    console.log('recibos-erp-cron: disparada →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('recibos-erp-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};

module.exports.handler = require('./_errores').conErrores('recibos-erp-cron', module.exports.handler);
