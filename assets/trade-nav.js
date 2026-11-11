// ============================================================
//  GrandBar · Menú del panel de Trade Marketing (Juan Pablo Sepúlveda, rol torneo)
//  10/11/2026: cada pantalla tenía su copia del menú a mano y no coincidían
//  (Presupuestos e Incentivos estaban en 3 de las 6): el menú cambiaba al pasar de
//  una pantalla a otra. Ahora sale de acá, igual en todas.
//
//  Uso: <script src="assets/trade-nav.js"></script> justo después del
//  <aside class="sidebar"> de la página. Pinta el menú entre el logo y el usuario
//  (.sb-foot) y marca la pantalla actual. En el celular, mobile-nav.js usa este
//  mismo menú como cajón. Una pantalla nueva del panel: sumarla en GRUPOS.
// ============================================================
(function () {
  var I = {
    torneo: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    acciones: '<path d="M4 5h16M4 12h16M4 19h10"/>',
    campanias: '<path d="M3 11l11-4v10L3 13zM14 8.5a3 3 0 0 1 0 5M7 13v4a2 2 0 0 0 2 2"/>',
    secciones: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="4" cy="6" r="1" fill="currentColor"/>',
    productos: '<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8"/>',
    evidencias: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M9 6l1.5-2h3L15 6"/>',
    kaf: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    avisos: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    presupuestos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
    incentivos: '<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5L7 22l5-3 5 3-1.5-9.5"/>'
  };
  var GRUPOS = [
    { items: [
      ['torneo-evidencias.html', 'Evidencias del torneo', 'torneo'],
      ['trade-acciones.html', 'Acciones comerciales', 'acciones'],
      ['trade-campanias.html', 'Campañas y planes', 'campanias'],
      ['trade-secciones.html', 'Secciones del manual', 'secciones'],
      ['trade-productos.html', 'Proveedores y productos', 'productos'],
      ['trade-evidencias.html', 'Evidencias de acciones', 'evidencias']
    ] },
    { titulo: 'KAF', items: [
      ['trade-kaf.html', 'Paneles KAF', 'kaf']
    ] },
    { titulo: 'CRM', items: [
      ['crm-calendario.html', 'Calendario de acciones', 'calendario'],
      ['acciones-crm.html', 'Avisos de envío', 'avisos'],
      ['presupuestos.html', 'Presupuestos', 'presupuestos'],
      ['supervisor-incentivos.html', 'Incentivos', 'incentivos']
    ] }
  ];

  function pintar() {
    var aside = document.querySelector('aside.sidebar');
    if (!aside) return;
    var pagina = (location.pathname.split('/').pop() || '').toLowerCase();
    aside.querySelectorAll('.sb-nav, .sb-cat').forEach(function (e) { e.remove(); });
    var html = GRUPOS.map(function (g) {
      return (g.titulo ? '<div class="sb-cat">' + g.titulo + '</div>' : '')
        + '<nav class="sb-nav">' + g.items.map(function (it) {
          return '<a href="' + it[0] + '"' + (it[0] === pagina ? ' class="active"' : '') + '>'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + I[it[2]] + '</svg> ' + it[1] + '</a>';
        }).join('') + '</nav>';
    }).join('');
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var foot = aside.querySelector('.sb-foot');
    while (tmp.firstChild) aside.insertBefore(tmp.firstChild, foot);
    // Con todas las opciones el menú es largo: la barra se desplaza sola.
    aside.style.overflowY = 'auto';
  }

  if (document.querySelector('aside.sidebar')) pintar();
  else document.addEventListener('DOMContentLoaded', pintar);
})();
