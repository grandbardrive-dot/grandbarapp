// ============================================================
//  GrandBar · reporte-errores.js  (11/10/2026)
//  Avisa al Portal cuando algo se rompe en esta pantalla: un error de código o
//  un guardado que falló (las pantallas llaman a GBReportarError). Lo recibe la
//  función reportar-error y lo cuenta "Estado del sistema"; n8n avisa por mail.
//  - Solo si hay sesión del Portal (si no, no se manda nada).
//  - No manda cortes de señal ni errores de extensiones del navegador.
//  - Como mucho 5 avisos por pantalla abierta y sin repetir el mismo.
//  Se carga solo desde los menús (hub-nav, supervisor-nav, _comercial-nav) y en
//  las pantallas del manual de vendedores.
// ============================================================
(function () {
  if (window.GBReportarError) return;
  var RUIDO = /script error|resizeobserver|failed to fetch|load failed|networkerror|network error|aborterror|aborted|cancell?ed|non-error promise rejection|timeout|tiempo de espera|offline|sin conexi/i;
  var enviados = 0, vistos = {};

  function token() {
    try {
      var v = JSON.parse(localStorage.getItem('sb-xqhyemccbwmzxqzkrtwa-auth-token') || 'null');
      var s = v && (v.currentSession || v);
      if (!s || !s.access_token) return null;
      if (s.expires_at && s.expires_at * 1000 < Date.now()) return null;   // vencida: no sirve
      return s.access_token;
    } catch (e) { return null; }
  }

  function reportar(detalle, extra) {
    try {
      detalle = String(detalle == null ? '' : detalle).replace(/\s+/g, ' ').trim().slice(0, 500);
      if (!detalle || RUIDO.test(detalle) || enviados >= 5) return;
      var lugar = location.pathname.replace(/\.html$/, '') || '/';
      var clave = lugar + '|' + detalle;
      if (vistos[clave]) return;
      vistos[clave] = 1;
      var t = token();
      if (!t) return;
      enviados++;
      fetch('/.netlify/functions/reportar-error', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ lugar: lugar, detalle: detalle, extra: extra ? String(extra).slice(0, 200) : null }),
      }).catch(function () {});
    } catch (e) {}
  }

  window.addEventListener('error', function (e) {
    // Solo errores de nuestro código (no de extensiones ni de otros sitios).
    if (e.filename && e.filename.indexOf(location.origin) !== 0) return;
    reportar((e.message || 'Error') + (e.filename ? ' (' + e.filename.split('/').pop().split('?')[0] + ':' + e.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    reportar('Promesa sin manejar: ' + ((r && r.message) || r));
  });

  window.GBReportarError = reportar;
})();
