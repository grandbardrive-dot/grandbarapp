// ============================================================
//  GrandBar Hub · Function PROGRAMADA · penaflor-cron
//  Cada mañana (ver netlify.toml) dispara penaflor-background, que recalcula el
//  avance del incentivo Peñaflor (Volumen + Clientes con compra) desde las ventas
//  ya sincronizadas y escribe el snapshot. El trabajo pesado va en la background.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/penaflor-background`, { method: 'POST' }); // background → 202 al instante
    console.log('penaflor-cron: disparada la background →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('penaflor-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};
