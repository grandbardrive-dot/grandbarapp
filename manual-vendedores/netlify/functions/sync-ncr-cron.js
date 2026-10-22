// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sync-ncr-cron
//  Dispara sync-ncr-background para los últimos días, así las notas de crédito
//  nuevas aparecen al día siguiente sin que nadie haga nada.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/sync-ncr-background?dias=5`, { method: 'POST' });
    console.log('sync-ncr-cron: disparada →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('sync-ncr-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};

module.exports.handler = require('./_errores').conErrores('sync-ncr-cron', module.exports.handler);
