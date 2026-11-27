// ============================================================
//  GrandBar Hub · Function PROGRAMADA · plan11t-cron
//  Cada mañana (ver netlify.toml) dispara plan11t-background, que recalcula los
//  reales del Plan 11T (CCC por canal + por marca) desde las ventas ya
//  sincronizadas y escribe penaflor_11t_reporte. El trabajo pesado va en la background.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/plan11t-background`, { method: 'POST' });
    console.log('plan11t-cron: disparada la background →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('plan11t-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};
