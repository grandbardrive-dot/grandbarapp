// ============================================================
//  GrandBar Hub · Function PROGRAMADA · stock-sync-cron  (26/10/2026)
//  Cada hora de 8 a 20 hs, lunes a sábado (ver netlify.toml), dispara
//  stock-sync-background, que trae el stock de Córdoba a stock_sistema.
//  Solo dispara: la sincronización tarda más de lo que permite una programada.
// ============================================================

exports.handler = async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://portalgrandbar.com';
  const secret = process.env.SYNC_SECRET || '';
  const url = base + '/.netlify/functions/stock-sync-background?origen=cron' + (secret ? '&key=' + encodeURIComponent(secret) : '');
  try {
    await fetch(url, { method: 'POST' });
    console.log('stock-sync-cron: disparé la sincronización del stock.');
    return { statusCode: 200 };
  } catch (e) {
    console.error('stock-sync-cron ERROR', (e && e.message) || String(e));
    return { statusCode: 500 };
  }
};

module.exports.handler = require('./_errores').conErrores('stock-sync-cron', module.exports.handler);
