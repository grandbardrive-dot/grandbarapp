// ─── Menú del usuario (Cerrar sesión) — igual en todos los paneles ───────────
// Vendedores, supervisores, tesorería, dirección: tocar el bloque del usuario
// (o el avatar) despliega un menú con "Cerrar sesión". Antes cada panel resolvía
// esto por su cuenta, casi siempre con el confirm() del navegador.
//
// Funciona por delegación: no necesita que el bloque exista al cargar la página,
// así que también toma los sidebars que se inyectan por JS (dir-nav / supervisor-nav).
(function () {
  var SEL = '.sb-user, .sb-me, .user-chip, [data-hub-user], #avTop, #avSb, .head .right .av, .topbar .av';
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  var menu = null, refActual = null;

  var css = document.createElement('style');
  css.textContent = SEL.split(',').map(function (s) { return s.trim(); }).join(',') + '{cursor:pointer}';
  document.head.appendChild(css);

  async function cerrarSesion() {
    try {
      var cfg = window.GB_SUPABASE || {};
      var url = cfg.SUPABASE_URL || HUB.url, key = cfg.SUPABASE_ANON_KEY || HUB.key;
      if (window.GBAuth && window.GBAuth.signOut) { await window.GBAuth.signOut(); }
      else if (window.supabase) { await window.supabase.createClient(url, key).auth.signOut(); }
    } catch (e) {}
    try {
      localStorage.removeItem('gb_demo'); localStorage.removeItem('gb_role');
      Object.keys(localStorage).filter(function (k) { return /^sb-.*-auth-token/.test(k); })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    location.href = 'index.html';
  }

  function crearMenu() {
    menu = document.createElement('div');
    menu.setAttribute('data-hub-menu', '');
    menu.style.cssText = 'display:none;position:fixed;min-width:180px;background:#fff;border-radius:11px;'
      + 'box-shadow:0 14px 34px -10px rgba(0,0,0,.45);padding:5px;z-index:99999;white-space:nowrap;'
      + 'font-family:inherit';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🚪 Cerrar sesión';
    btn.style.cssText = 'display:block;width:100%;text-align:left;background:none;border:0;padding:10px 12px;'
      + 'border-radius:8px;font-size:13.5px;font-family:inherit;color:#1b2a32;cursor:pointer';
    btn.addEventListener('mouseenter', function () { btn.style.background = '#f4f1ea'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = 'none'; });
    btn.addEventListener('click', function (e) { e.stopPropagation(); cerrarSesion(); });
    menu.appendChild(btn);
    document.body.appendChild(menu);
  }

  // Se ubica contra el elemento tocado: hacia abajo si está en la parte de arriba
  // de la pantalla (avatar de la barra), hacia arriba si está abajo (sidebar).
  function ubicar(el) {
    var r = el.getBoundingClientRect();
    var abajo = r.top < window.innerHeight / 2;
    menu.style.left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - 196))) + 'px';
    menu.style.top = abajo ? Math.round(r.bottom + 8) + 'px'
                           : Math.round(Math.max(8, r.top - menu.offsetHeight - 8)) + 'px';
  }

  function cerrar() { if (menu) menu.style.display = 'none'; refActual = null; }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest(SEL) : null;
    if (!el) { if (!menu || !menu.contains(e.target)) cerrar(); return; }
    e.stopPropagation();
    if (!menu) crearMenu();
    if (el.onclick) el.onclick = null;          // por si quedó un logout viejo enganchado
    el.removeAttribute('title');
    if (menu.style.display === 'block' && refActual === el) { cerrar(); return; }
    refActual = el;
    menu.style.display = 'block';
    ubicar(el);
  }, true);

  window.addEventListener('resize', function () { if (menu && menu.style.display === 'block') ubicar(refActual); });
})();
