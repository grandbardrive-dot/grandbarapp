// ============================================================
//  GrandBar Hub · Function PROGRAMADA · cazar-clientes-cron
//  Corre cada mañana (ver netlify.toml: 10:00 UTC ≈ 07:00 ART) y
//  dispara el agente cazar-clientes-background, que busca
//  prospectos nuevos, los filtra, los puntúa y los deja en el
//  panel de supervisores. La cron solo dispara (liviana); el
//  trabajo pesado va en la background (hasta 15 min).
// ============================================================

exports.handler = async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://portalgrandbar.com';
  const secret = process.env.SYNC_SECRET || '';
  const url = `${base}/.netlify/functions/cazar-clientes-background`
    + (secret ? `?key=${encodeURIComponent(secret)}` : '');
  try {
    await fetch(url, { method: 'POST' }); // background → responde 202 al instante
    console.log('cazar-clientes-cron: disparé la búsqueda de prospectos.');
    return { statusCode: 200 };
  } catch (e) {
    console.error('cazar-clientes-cron ERROR', (e && e.message) || String(e));
    return { statusCode: 500 };
  }
};
