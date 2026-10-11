// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sync-ventas-cron
//  Mantiene las VENTAS del ERP al día sin que nadie apriete nada.
//  Corre cada 20 min (ver netlify.toml; la background dura ~13 min, no se pisan) y solo DISPARA sync-ventas-background,
//  que baja los días que falten (las dos empresas del ERP): el trabajo
//  pesado no entra en los 30 s de una función programada.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/sync-ventas-background`, { method: 'POST' }); // background → 202 al instante
    console.log('sync-ventas-cron: disparada la background →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('sync-ventas-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};

// Estado del sistema (11/10/2026): los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('sync-ventas-cron', module.exports.handler);
