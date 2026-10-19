// ─── Finanzas: lo que Sebastián deja en Drive ────────────────────────────────
// Desde el 19/10/2026 los archivos los lee el servidor (función dir-finanzas),
// que solo le responde a Dirección. Antes se leían desde acá, con los enlaces de
// los archivos a la vista de cualquiera con sesión en el Portal.
//
// GBFinanzas.cargar() devuelve { efectivo, cheques, pagos, ordenes }, cada uno
// con sus datos o { error } si ese archivo no se pudo leer (la pantalla dice
// "no se pudo leer"; nada se inventa).
window.GBFinanzas = (function () {
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  var cache = null;
  async function token() {
    try { var c = supabase.createClient(HUB.url, HUB.key); var r = await c.auth.getSession(); return r.data.session && r.data.session.access_token; }
    catch (e) { return null; }
  }
  async function cargar(forzar) {
    if (cache && !forzar) return cache;
    var t = await token();
    var r = await fetch('/.netlify/functions/dir-finanzas', { headers: { Authorization: 'Bearer ' + (t || '') } });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var err = { error: d.error || ('HTTP ' + r.status) };
      return { efectivo: err, cheques: err, pagos: err, ordenes: err };
    }
    cache = d;
    return cache;
  }
  return { cargar: cargar };
})();
