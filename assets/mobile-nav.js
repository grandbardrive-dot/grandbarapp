// ─── Barra + cajón del menú en el celular ────────────────────────────────────
// En la computadora no hace nada. En pantallas chicas el menú lateral se escondía
// y varias pantallas quedaban sin forma de navegar; ahora aparece una barra arriba
// con el botón ☰ que abre ese mismo menú como cajón.
//
// Trabaja con assets/mobile.css (que es quien tiene todos los estilos).
(function () {
  var MQ = window.matchMedia('(max-width: 900px)');
  var CHICA = 900;

  function lateral() {
    return document.querySelector('aside.sidebar') || document.querySelector('aside.sb')
        || document.querySelector('.sidebar') || document.querySelector('.sb');
  }

  function titulo() {
    var t = (document.title || '').replace(/^GrandBar\s*(Hub)?\s*[—–-]\s*/i, '').trim();
    return t || 'GrandBar';
  }

  function abrir(v) {
    document.body.classList.toggle('gb-drawer-open', !!v);
  }

  function armarBarra() {
    if (document.getElementById('gb-mtop')) return;
    // Sin menú lateral no tiene sentido la barra (esas páginas ya tienen su "volver").
    if (!lateral()) return;

    var bar = document.createElement('div');
    bar.id = 'gb-mtop';
    bar.innerHTML =
      '<button id="gb-mburger" aria-label="Abrir menú">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>'
      + '</button><span id="gb-mtitle"></span>';
    document.body.appendChild(bar);
    document.body.classList.add('gb-has-mtop');   // reserva el alto de la barra
    bar.querySelector('#gb-mtitle').textContent = titulo();

    var ov = document.createElement('div');
    ov.id = 'gb-mobile-overlay';
    document.body.appendChild(ov);

    bar.querySelector('#gb-mburger').addEventListener('click', function (e) {
      e.stopPropagation();
      abrir(!document.body.classList.contains('gb-drawer-open'));
    });
    ov.addEventListener('click', function () { abrir(false); });
    // Al elegir una sección del menú, el cajón se cierra solo.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.sidebar a, .sb a');
      if (a) abrir(false);
    });
    window.addEventListener('resize', function () { if (window.innerWidth > CHICA) abrir(false); });
  }

  // Las tablas anchas se envuelven para que scrolleen solas y no estiren la página.
  function envolverTablas() {
    document.querySelectorAll('table').forEach(function (t) {
      var p = t.parentElement;
      if (!p || p.classList.contains('gb-tablewrap')) return;
      var w = document.createElement('div');
      w.className = 'gb-tablewrap';
      p.insertBefore(w, t);
      w.appendChild(t);
    });
  }

  function iniciar() {
    if (MQ.matches) { armarBarra(); }
    envolverTablas();                       // no molesta en escritorio: sin estilos, es un div común
    // Todo lo que se dibuja después: las tablas que se llenan por JS y los menús
    // laterales que inyectan dir-nav.js / supervisor-nav.js (ahí el sidebar todavía
    // no existía cuando corrió esto por primera vez).
    var obs = new MutationObserver(function () {
      envolverTablas();
      if (MQ.matches) armarBarra();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    MQ.addEventListener ? MQ.addEventListener('change', function () { if (MQ.matches) armarBarra(); else abrir(false); })
                        : MQ.addListener(function () { if (MQ.matches) armarBarra(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
