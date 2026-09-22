// ─── Con qué cuenta está abierta esta pantalla ───────────────────────────────
// El navegador guarda UNA sola sesión por sitio: si en otra pestaña entrás con
// otra cuenta, todas las pestañas pasan a ser esa cuenta. Antes eso no se veía:
// la pantalla vieja seguía mostrando lo de antes (el menú de supervisor, por
// ejemplo, que queda cacheado) y al recargar aparecía otro nombre con el mismo
// contenido. Este archivo tapa las dos puntas:
//
//  1. Al cargar, si la cuenta cambió desde la última vez, borra lo que estaba
//     guardado de la cuenta anterior (menú de supervisor, avisos leídos) y avisa
//     con quién quedaste.
//  2. Mientras la pantalla está abierta, si otra pestaña cambia de cuenta o
//     cierra sesión, aparece un cartel arriba para actualizar.
//
// No usa el SDK de Supabase: lee el token del navegador, así que puede ir en
// cualquier página, antes o después de todo lo demás.
(function () {
  var CLAVE = 'sb-xqhyemccbwmzxqzkrtwa-auth-token';   // sesión del Hub
  var CACHES = ['gb_es_sup', 'gb_role', 'gb_demo', 'gb_notif_seen'];

  function sesion() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      var s = v && (v.currentSession || v);
      return (s && s.user && s.user.id) ? s : null;
    } catch (e) { return null; }
  }
  function quien(s) { return (s && s.user && (s.user.email || s.user.id)) || ''; }

  var s = sesion();
  var uid = s ? s.user.id : null;

  // 1) ¿Cambió la cuenta desde la última vez en este navegador?
  var cambio = false;
  try {
    var previo = localStorage.getItem('gb_uid');
    if (uid && previo && previo !== uid) {
      cambio = true;
      CACHES.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    }
    if (uid) localStorage.setItem('gb_uid', uid);
    else localStorage.removeItem('gb_uid');
  } catch (e) {}

  if (!uid) return;                 // login o página pública: no hay nada que avisar

  function cartel(html, texto, accion) {
    var b = document.getElementById('gb-cuenta-cartel');
    if (!b) {
      b = document.createElement('div');
      b.id = 'gb-cuenta-cartel';
      b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483000;'
        + 'background:#0d2230;color:#f6f1e8;font:600 13.5px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;'
        + 'padding:calc(10px + env(safe-area-inset-top,0px)) 16px 10px;display:flex;gap:12px;align-items:center;'
        + 'flex-wrap:wrap;box-shadow:0 6px 20px -8px rgba(0,0,0,.5)';
      document.body.appendChild(b);
    }
    b.innerHTML = '';
    var t = document.createElement('div');
    t.style.cssText = 'flex:1;min-width:200px;font-weight:500';
    t.innerHTML = html;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = texto;
    btn.style.cssText = 'font:inherit;font-weight:700;background:#c0912f;color:#241a06;border:0;'
      + 'border-radius:9px;padding:8px 14px;cursor:pointer';
    btn.onclick = accion;
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = '✕'; x.title = 'Cerrar el aviso';
    x.style.cssText = 'font:inherit;background:transparent;color:#9db0ba;border:0;cursor:pointer;padding:6px 4px';
    x.onclick = function () { b.remove(); };
    b.appendChild(t); b.appendChild(btn); b.appendChild(x);
    return b;
  }

  function texto(x) { return String(x || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function avisarCambio() {
    if (!document.body) return document.addEventListener('DOMContentLoaded', avisarCambio);
    var aviso = cartel('Ahora estás como <b>' + texto(quien(s)) + '</b>. Antes había otra cuenta abierta en este navegador, así que refresqué lo que quedaba guardado de la anterior.',
      'Entendido', function () { var b = document.getElementById('gb-cuenta-cartel'); if (b) b.remove(); });
    setTimeout(function () { if (aviso && aviso.parentNode) aviso.remove(); }, 12000);
  }
  if (cambio) avisarCambio();

  // 2) Otra pestaña cambió de cuenta (o cerró sesión) mientras esta estaba abierta.
  window.addEventListener('storage', function (ev) {
    if (ev.key !== CLAVE) return;
    var ahora = sesion();
    var nuevo = ahora ? ahora.user.id : null;
    if (nuevo === uid) return;
    if (!document.body) return;
    if (nuevo) {
      cartel('Entraste como <b>' + texto(quien(ahora)) + '</b> en otra pestaña. El navegador usa una sola cuenta por vez, así que <b>esta pantalla quedó con la cuenta anterior</b> y lo que ves puede no corresponder.',
        'Actualizar', function () { location.reload(); });
    } else {
      cartel('Cerraste sesión en otra pestaña.', 'Ir al ingreso', function () { location.href = '/index.html'; });
    }
  });
})();
