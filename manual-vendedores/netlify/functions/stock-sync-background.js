// ============================================================
//  GrandBar Hub · BACKGROUND Function · stock-sync-background  (26/10/2026)
//  Trae el stock de Córdoba a stock_sistema (ver _stock-sync.js). En segundo plano
//  porque tarda ~30 s: Netlify responde 202 y le da hasta 15 minutos.
//  Disparo: stock-sync-cron (cada hora de 8 a 20, lunes a sábado) y el botón
//  "Sincronizar ahora" de deposito-admin.html (función stock). Las dos pasan la
//  clave SYNC_SECRET; sin ella no corre.
//  Cada corrida queda en sistema_corridas como 'stock-sync' (Estado del sistema).
// ============================================================
const { sincronizarStock } = require('./_stock-sync');

exports.handler = async (event) => {
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const key = (event && event.queryStringParameters && event.queryStringParameters.key) || '';
    if (key !== secret) { console.warn('stock-sync: key inválida, no se ejecuta.'); return; }
  }
  const origen = String((event && event.queryStringParameters && event.queryStringParameters.origen) || 'manual').slice(0, 30);
  try {
    const r = await sincronizarStock();
    console.log('stock-sync (' + origen + ') OK', JSON.stringify(r));
  } catch (e) {
    console.error('stock-sync (' + origen + ') ERROR:', (e && e.message) || String(e));
  }
};

exports.handler = require('./_corrida').conRegistro('stock-sync', exports.handler, { siCorre: (e) => !process.env.SYNC_SECRET || ((e && e.queryStringParameters && e.queryStringParameters.key) || '') === process.env.SYNC_SECRET });
