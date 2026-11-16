// ============================================================
//  GrandBar Hub · Function PROGRAMADA · septima-cron
//  Cada mañana dispara septima-background (recalcula el avance del incentivo Séptima
//  desde las ventas ya sincronizadas y escribe el snapshot).
// ============================================================
exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const r = await fetch(`${base}/.netlify/functions/septima-background`, { method: 'POST' });
    console.log('septima-cron: disparada la background →', r.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: r.status }) };
  } catch (e) {
    console.log('septima-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};
