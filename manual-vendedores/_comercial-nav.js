// ============================================================
//  GrandBar · Panel comercial (Luciana): menú y acceso
//  -----------------------------------------------------------
//  Antes cada pantalla del panel tenía su propio menú copiado a mano y
//  ninguno coincidía (en Secciones faltaban Comparador y Borradores, en
//  Combos había solo cinco opciones, en Campañas aparecía Fechas en vez de
//  Combos): el menú cambiaba al pasar de una pantalla a otra. Tampoco había
//  control de acceso: cualquiera con el enlace podía entrar y editar.
//  Desde el 25/09/2026 el menú sale de acá, igual en todas, y solo entra
//  quien tiene sesión en el Portal con un rol del área.
//
//  Uso: <script src="_comercial-nav.js"></script> al final del <body>,
//  después del SDK de Supabase. Toma el <aside class="sidebar"> de la página.
// ============================================================
(function () {
  var HUB = { url: 'https://xqhyemccbwmzxqzkrtwa.supabase.co', key: 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };

  // Quién administra el contenido comercial: Luciana (compras) y quienes
  // mantienen el sistema (Josefina y Nahuel; Marketing quedó unificado ahí).
  var ROLES = ['compras', 'desarrollo', 'diseno', 'marketing'];

  var I = {
    inicio:     '<path d="M3 11l9-7 9 7M5 10v9h14v-9" stroke-linecap="round" stroke-linejoin="round"/>',
    campanias:  '<path d="M4 5h16M4 12h16M4 19h10" stroke-linecap="round"/>',
    borrador:   '<path d="M7 3h7l5 5v13H7z" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h6" stroke-linecap="round"/>',
    resultados: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke-linecap="round"/>',
    secciones:  '<path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>',
    fechas:     '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18" stroke-linecap="round"/>',
    combos:     '<path d="M5 8h14l-1 12H6z" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke-linecap="round"/>',
    catalogo:   '<path d="M4 7l8-4 8 4-8 4z" stroke-linejoin="round"/><path d="M4 7v10l8 4 8-4V7" stroke-linecap="round" stroke-linejoin="round"/>',
    publico:    '<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z" stroke-linejoin="round"/>',
    comparador: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/>',
    propuestas: '<path d="M4 4h16v12H8l-4 4z" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke-linecap="round"/>',
    agenda:     '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3" stroke-linecap="round"/>',
    soporte:    '<path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3M4 13v4a2 2 0 0 0 2 2h1v-6H4" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  // El orden sigue el trabajo de Luciana: campañas, el manual, el catálogo y
  // lo que mandan los proveedores.
  var GRUPOS = [
    { items: [ { h: 'admin-comercial.html', t: 'Inicio', i: 'inicio' } ] },
    { titulo: 'Campañas', items: [
      { h: 'admin-campanias.html', t: 'Campañas y planes', s: 'Lo que ven los vendedores', i: 'campanias' },
      { h: 'admin-campanias.html?estado=borrador', t: 'Borradores', s: 'En edición', i: 'borrador' },
      { h: 'admin-resultados.html', t: 'Resultados', s: 'Desempeño de campañas', i: 'resultados' },
    ]},
    { titulo: 'Manual de vendedores', items: [
      { h: 'admin-secciones.html', t: 'Secciones', s: 'Estructura del manual', i: 'secciones' },
      { h: 'admin-fechas.html', t: 'Fechas especiales', s: 'Calendario del manual', i: 'fechas' },
      { h: 'admin-combos.html', t: 'Combos de eventos', s: 'Para el manual de Eventos', i: 'combos' },
    ]},
    { titulo: 'Catálogo', items: [
      { h: 'admin-catalogo.html', t: 'Catálogo', s: 'Proveedores y productos', i: 'catalogo' },
      { h: 'admin-catalogo-clientes.html', t: 'Catálogo clientes', s: 'Catálogo público de acciones', i: 'publico' },
      { h: 'admin-comparador.html', t: 'Comparador de precios', s: 'Precios de la competencia', i: 'comparador' },
    ]},
    { titulo: 'Proveedores', items: [
      { h: 'admin-propuestas-proveedores.html', t: 'Propuestas de proveedores', s: 'Para revisar y aprobar', i: 'propuestas' },
    ]},
    { titulo: 'Lo mío', items: [
      { h: '/mi-agenda.html', t: 'Mi agenda', i: 'agenda' },
    ]},
  ];

  // Las subpantallas (nueva campaña, planes) marcan a su pantalla madre.
  var MADRE = { 'admin-nueva-campania': 'admin-campanias', 'admin-planes': 'admin-campanias', 'admin-nuevo-plan': 'admin-campanias' };

  var sinExt = function (h) { return String(h || '').split('?')[0].split('/').pop().replace(/\.html$/, '').toLowerCase(); };
  var pagina = sinExt(location.pathname) || 'admin-comercial';
  pagina = MADRE[pagina] || pagina;
  var borrador = /[?&]estado=borrador\b/.test(location.search);

  function activo(it) {
    if (sinExt(it.h) !== pagina) return false;
    var esBorr = /estado=borrador/.test(it.h);
    return pagina === 'admin-campanias' ? esBorr === borrador : true;
  }

  var ico = function (k) { return '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + (I[k] || '') + '</svg>'; };
  var TIT = 'style="padding:14px 13px 4px;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45)"';

  function item(it) {
    return '<a class="sb-item' + (activo(it) ? ' active' : '') + '" href="' + it.h + '">' + ico(it.i)
      + '<div><div class="sb-txt-main">' + it.t + '</div>' + (it.s ? '<div class="sb-txt-sub">' + it.s + '</div>' : '') + '</div></a>';
  }

  function pintar() {
    var aside = document.querySelector('aside.sidebar');
    if (!aside) return;
    var navs = aside.querySelectorAll('.sb-nav');
    var nav = navs[0];
    if (!nav) { nav = document.createElement('nav'); nav.className = 'sb-nav'; aside.appendChild(nav); }
    nav.innerHTML = GRUPOS.map(function (g) {
      return (g.titulo ? '<div ' + TIT + '>' + g.titulo + '</div>' : '') + g.items.map(item).join('');
    }).join('')
      // Soporte: abre WhatsApp con el equipo de sistemas (assets/soporte.js).
      + '<div ' + TIT + '>Ayuda</div>'
      + '<button type="button" class="sb-item" data-soporte style="background:none;border:none;font-family:inherit;text-align:left;width:100%;cursor:pointer">'
      + ico('soporte') + '<div><div class="sb-txt-main">Soporte</div><div class="sb-txt-sub">Escribinos por WhatsApp</div></div></button>';
    // Lo que sobraba de cada copia: el bloque "Ayuda" con "Guías y tutoriales",
    // que solo decía "próximamente", y el recuadro de ayuda de abajo.
    for (var k = 1; k < navs.length; k++) navs[k].remove();
    aside.querySelectorAll('.sb-label, .sb-help').forEach(function (el) { el.remove(); });
    var sop = nav.querySelector('[data-soporte]');
    if (sop) sop.addEventListener('click', function () {
      if (window.abrirSoporteWA) window.abrirSoporteWA();
      else alert('Escribinos al WhatsApp de soporte: +54 9 261 245-2651');
    });
  }

  // Solo entra quien tiene sesión en el Portal y un rol del área. El resto
  // vuelve al Hub, que lo manda a su propio panel; sin sesión, al ingreso.
  function revisarAcceso() {
    try {
      if (!window.supabase || !window.supabase.createClient) return;
      var c = window.supabase.createClient(HUB.url, HUB.key);
      c.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session;
        if (!s) { location.replace('/index.html'); return; }
        return c.from('usuarios').select('rol').eq('id', s.user.id).maybeSingle().then(function (q) {
          var rol = String((q && q.data && q.data.rol) || '').toLowerCase();
          if (ROLES.indexOf(rol) < 0) location.replace('/hub.html');
        });
      }).catch(function () {});
    } catch (e) {}
  }

  // soporte.js (del Hub) define abrirSoporteWA; se carga una sola vez.
  if (!window.abrirSoporteWA && !document.querySelector('script[src*="soporte.js"]')) {
    var sc = document.createElement('script'); sc.src = '/assets/soporte.js'; document.head.appendChild(sc);
  }

  revisarAcceso();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar);
  else pintar();
})();
