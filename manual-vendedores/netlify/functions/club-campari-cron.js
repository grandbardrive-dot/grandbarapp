// ============================================================
//  GrandBar Hub · Function PROGRAMADA · club-campari-cron
//  Cada mañana dispara club-campari-background, que recalcula el avance del plan
//  Cobertura de Campari (clientes con compra por marca, Oct–Nov) y lo escribe en
//  cobertura_productos.
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/club-campari-background`, { method: 'POST' });
    console.log('club-campari-cron: disparada la background →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('club-campari-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};
