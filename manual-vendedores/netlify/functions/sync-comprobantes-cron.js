// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sync-comprobantes-cron  (03/11/2026)
//  Cada 30 min dispara sync-comprobantes-background, que guarda las facturas
//  emitidas (pagadas o no) para que el vendedor pueda ver y bajar las pagadas.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  const secret = process.env.SYNC_SECRET || '';
  try {
    const r = await fetch(`${base}/.netlify/functions/sync-comprobantes-background` + (secret ? '?key=' + encodeURIComponent(secret) : ''), { method: 'POST' });
    console.log('sync-comprobantes-cron: disparada →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('sync-comprobantes-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};

module.exports.handler = require('./_errores').conErrores('sync-comprobantes-cron', module.exports.handler);
