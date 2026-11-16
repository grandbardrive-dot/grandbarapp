// ============================================================
//  GrandBar Hub · Function PROGRAMADA · incentivo-pernod-cron
//  Cada mañana (06:10 ART, ver netlify.toml) dispara incentivo-pernod-background,
//  que recalcula el incentivo Pernod Ricard Q4 contra el ERP y escribe el snapshot.
//  El trabajo pesado (leer el ERP, ~minutos) no entra en una función programada.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/incentivo-pernod-background`, { method: 'POST' }); // background → 202 al instante
    console.log('incentivo-pernod-cron: disparada la background →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('incentivo-pernod-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};
