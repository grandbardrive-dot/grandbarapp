// ─── Mantener la sesión iniciada ─────────────────────────────────────────────
// Problema: en el celular, si dejabas la app un rato y volvías (o recargabas), te
// mandaba al login. Tres causas, las tres tapadas acá:
//
//  1. Cada página creaba VARIOS clientes de Supabase del mismo proyecto (el de la
//     página + el de la campanita + el del menú). Todos comparten el mismo token en
//     el navegador y todos intentan renovarlo a la vez; el que pierde la carrera se
//     queda con un refresh token viejo, lo reporta como inválido y borra la sesión.
//     → Ahora se reutiliza UN solo cliente por proyecto.
//
//  2. El token dura una hora y se renueva solo mientras la pestaña está viva. En el
//     teléfono la pestaña se congela al pasar a otra app, no se renueva, y al volver
//     ya estaba vencido. → Se renueva al volver a la pantalla.
//
//  3. Los porteros hacían `getSession()` y, si no había, al login. Cuando el token
//     estaba vencido pero el refresh todavía servía, igual te echaban.
//     → getSession ahora intenta renovar antes de contestar que no hay sesión.
//
// Se carga justo después del SDK de Supabase y antes del código de cada página.
(function () {
  if (!window.supabase || !window.supabase.createClient) return;

  var crearOriginal = window.supabase.createClient.bind(window.supabase);
  var clientes = {};      // url + persistencia → cliente ya creado
  var vigilado = false;

  window.supabase.createClient = function (url, key, opts) {
    opts = opts || {};
    var auth = Object.assign(
      { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      opts.auth || {}
    );
    var clave = url + '|' + (auth.persistSession ? 'persistente' : 'temporal');
    if (clientes[clave]) return clientes[clave];

    var c = crearOriginal(url, key, Object.assign({}, opts, { auth: auth }));
    clientes[clave] = c;
    tolerante(c);
    if (auth.persistSession && !vigilado) { vigilado = true; vigilar(c); }
    return c;
  };

  // getSession que, si no hay sesión a mano, intenta renovarla antes de rendirse.
  function tolerante(c) {
    if (!c.auth || !c.auth.getSession) return;
    var original = c.auth.getSession.bind(c.auth);
    c.auth.getSession = function () {
      return original().then(function (r) {
        if (r && r.data && r.data.session) return r;
        return c.auth.refreshSession().then(function (rr) {
          return (rr && rr.data && rr.data.session) ? rr : r;
        }).catch(function () { return r; });
      });
    };
  }

  // Al volver a la app (o al recargar desde el caché del navegador) se renueva el
  // token, con un mínimo de 30 segundos entre intentos para no pedirlo de más.
  function vigilar(c) {
    var ultimo = 0;
    function renovar() {
      var ahora = Date.now();
      if (ahora - ultimo < 30000) return;
      ultimo = ahora;
      try { c.auth.getSession(); } catch (e) {}
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') renovar();
    });
    window.addEventListener('pageshow', renovar);
    window.addEventListener('online', renovar);
  }
})();
