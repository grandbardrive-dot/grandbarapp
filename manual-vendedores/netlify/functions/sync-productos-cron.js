// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sync-productos-cron
//  Corre 1×/día (ver netlify.toml) y dispara la background function
//  sync-productos-background, que refresca `productos_grandbar` desde el ERP.
//  La cron es liviana (solo el disparo); el trabajo pesado va en background
//  para no chocar con el límite de tiempo de las funciones normales.
// ============================================================

exports.handler = async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://portalgrandbar.com';
  const secret = process.env.SYNC_SECRET || '';
  const url = `${base}/.netlify/functions/sync-productos-background`
    + (secret ? `?key=${encodeURIComponent(secret)}` : '');
  try {
    // Background functions responden 202 al instante; no esperamos el resultado.
    await fetch(url, { method: 'POST' });
    console.log('sync-productos-cron: disparé el sync de productos.');
    return { statusCode: 200 };
  } catch (e) {
    console.error('sync-productos-cron ERROR', (e && e.message) || String(e));
    return { statusCode: 500 };
  }
};
