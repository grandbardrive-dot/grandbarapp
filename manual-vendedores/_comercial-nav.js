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

  // TODAS las pantallas del panel, en un solo menú que no cambia de una a otra.
  // Hasta el 30/09/2026 las herramientas (Vino por copa, Aperitivos, Mix Ideal,
  // Propuestas, Frigobar, Sellout, Plan 11T) usaban otro menú (_admin-sidebar.js)
  // y la barra cambiaba al entrar. El orden sigue el trabajo de Luciana.
  I.planes = '<path d="M7 3h7l5 5v13H7z" stroke-linejoin="round"/><path d="M14 3v5h5" stroke-linecap="round"/>';
  I.incorp = '<path d="M12 5v14M5 12h14" stroke-linecap="round"/><rect x="3" y="3" width="18" height="18" rx="4"/>';
  I.copa = '<path d="M8 3h8l-1 6a3 3 0 0 1-6 0zM12 15v5M9 21h6" stroke-linejoin="round" stroke-linecap="round"/>';
  I.aperitivo = '<path d="M6 4h12l-6 8zM12 12v7M8 20h8" stroke-linejoin="round" stroke-linecap="round"/>';
  I.mix = '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>';
  I.frigobar = '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12M9 6v2M9 13v3" stroke-linecap="round"/>';
  I.materiales = '<path d="M20 7L12 3 4 7v10l8 4 8-4z" stroke-linejoin="round"/><path d="M4 7l8 4 8-4M12 11v10" stroke-linecap="round" stroke-linejoin="round"/>';
  I.movimientos = '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" stroke-linecap="round" stroke-linejoin="round"/>';
  I.sellout = '<path d="M4 4v16h16" stroke-linecap="round"/><path d="M8 13l3-3 3 3 4-5" stroke-linecap="round" stroke-linejoin="round"/>';
  I.plan11t = '<path d="M4 4v16h16" stroke-linecap="round"/><path d="M8 14l3-3 2 2 4-5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="8" r="1.6" fill="currentColor" stroke="none"/>';
  var GRUPOS = [
    { items: [ { h: 'admin-comercial.html', t: 'Inicio', i: 'inicio' } ] },
    { titulo: 'Campañas', items: [
      { h: 'admin-campanias.html', t: 'Campañas y planes', s: 'Lo que ven los vendedores', i: 'campanias' },
      { h: 'admin-campanias.html?estado=borrador', t: 'Borradores', s: 'En edición', i: 'borrador' },
      { h: 'admin-planes.html', t: 'Planes', s: 'Planes de proveedores', i: 'planes' },
      { h: 'admin-resultados.html', t: 'Resultados', s: 'Desempeño de campañas', i: 'resultados' },
      // Lo que Juan Pablo Sepúlveda (Trade Marketing) devuelve después de trabajar las acciones con los vendedores (06/10/2026).
      { h: 'admin-devoluciones.html', t: 'Devoluciones de Trade Marketing', s: 'Observaciones de los vendedores', i: 'propuestas' },
    ]},
    { titulo: 'Manual de vendedores', items: [
      { h: 'admin-secciones.html', t: 'Secciones', s: 'Estructura del manual', i: 'secciones' },
      { h: 'admin-fechas.html', t: 'Fechas especiales', s: 'Calendario del manual', i: 'fechas' },
      { h: 'admin-combos.html', t: 'Combos de eventos', s: 'Para el manual de Eventos', i: 'combos' },
    ]},
    { titulo: 'Herramientas del manual', items: [
      { h: 'admin-propuestas.html', t: 'Propuestas de incorporación', s: 'Vinos y spirits para sumar', i: 'incorp' },
      { h: 'admin-vino-copa.html', t: 'Vino por copa', s: 'Vinos y condiciones', i: 'copa' },
      { h: 'admin-aperitivos.html', t: 'Aperitivos', s: 'De bienvenida o pre cena', i: 'aperitivo' },
      { h: 'admin-mixes.html', t: 'Mix Ideal', s: 'Combos de productos', i: 'mix' },
      { h: 'admin-frigobar.html', t: 'Frigobar', s: 'Packs para hoteles', i: 'frigobar' },
      { h: 'admin-materiales.html', t: 'Materiales POP', s: 'Biblioteca de materiales', i: 'materiales' },
      { h: 'admin-materiales.html#movimientos', t: 'Movimientos de materiales', s: 'Ingresos, salidas y entregas', i: 'movimientos' },
    ]},
    { titulo: 'Catálogo', items: [
      { h: 'admin-catalogo.html', t: 'Catálogo', s: 'Proveedores y productos', i: 'catalogo' },
      { h: 'admin-catalogo-clientes.html', t: 'Catálogo clientes', s: 'Catálogo público de acciones', i: 'publico' },
      { h: 'admin-comparador.html', t: 'Comparador de precios', s: 'Precios de la competencia', i: 'comparador' },
    ]},
    { titulo: 'Proveedores', items: [
      { h: 'admin-propuestas-proveedores.html', t: 'Propuestas de proveedores', s: 'Para revisar y aprobar', i: 'propuestas' },
      { h: 'admin-sellout.html', t: 'Sellout', s: 'Subir reporte de proveedor', i: 'sellout' },
      { h: 'admin-11t.html', t: 'Plan 11T', s: 'Peñaflor · por canal y línea', i: 'plan11t' },
    ]},
    { titulo: 'Lo mío', items: [
      { h: 'admin-agenda.html', t: 'Mi agenda', i: 'agenda' },
      { h: 'admin-reportes.html', t: 'Mis reportes', s: 'Para Dirección', i: 'resultados' },
    ]},
  ];

  // Las subpantallas marcan a su pantalla madre.
  var MADRE = { 'admin-nueva-campania': 'admin-campanias', 'admin-nuevo-plan': 'admin-planes', 'admin-material-nuevo': 'admin-materiales' };

  // data-solo="compras" en el <script>: la pantalla es de otra área (Materiales es de
  // Diseño) y el menú del panel comercial se pinta solo si entra ese rol.
  var SOLO = (document.currentScript && document.currentScript.getAttribute('data-solo')) || '';

  var sinExt = function (h) { return String(h || '').split(/[?#]/)[0].split('/').pop().replace(/\.html$/, '').toLowerCase(); };
  var pagina = sinExt(location.pathname) || 'admin-comercial';
  pagina = MADRE[pagina] || pagina;
  var borrador = /[?&]estado=borrador\b/.test(location.search);

  // Una pantalla con vistas (#movimientos en Materiales) marca la opción de esa vista.
  function activo(it) {
    if (sinExt(it.h) !== pagina) return false;
    var hashIt = (String(it.h).split('#')[1] || '');
    if (hashIt !== (location.hash || '').replace('#', '')) return false;
    var esBorr = /estado=borrador/.test(it.h);
    return pagina === 'admin-campanias' ? esBorr === borrador : true;
  }
  var yaPinte = false;
  window.addEventListener('hashchange', function () { if (yaPinte) pintar(); });

  var ico = function (k) { return '<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + (I[k] || '') + '</svg>'; };
  var TIT = 'style="padding:14px 13px 4px;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45)"';

  function item(it) {
    return '<a class="sb-item' + (activo(it) ? ' active' : '') + '" href="' + it.h + '">' + ico(it.i)
      + '<div><div class="sb-txt-main">' + it.t + '</div>' + (it.s ? '<div class="sb-txt-sub">' + it.s + '</div>' : '') + '</div></a>';
  }

  function pintar() {
    yaPinte = true;
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
    // Con todas las herramientas el menú es largo: la barra se desplaza sola.
    aside.style.overflowY = 'auto';
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
          if (SOLO) { if (rol === SOLO) { pintar(); campanita(); } return; }
          if (ROLES.indexOf(rol) < 0) location.replace('/hub.html');
        });
      }).catch(function () {});
    } catch (e) {}
  }

  // soporte.js (del Hub) define abrirSoporteWA; se carga una sola vez.
  if (!window.abrirSoporteWA && !document.querySelector('script[src*="soporte.js"]')) {
    var sc = document.createElement('script'); sc.src = '/assets/soporte.js'; document.head.appendChild(sc);
  }

  // Campanita de avisos del Portal (reportes devueltos, reuniones…) en la barra de
  // arriba: desde el 30/09/2026 Luciana entra directo a este panel y no pasa por el Hub,
  // que era donde la veía. notif.js usa la .tb-bell de la barra si existe.
  // Inicio tenía su propia campanita que abría un cartel del navegador ("¿Ir a
  // revisarlas?"): ahora es la misma en todas las pantallas y lo pendiente del panel
  // aparece dentro de la lista de notificaciones.
  function campanita() {
    var bar = document.querySelector('.topbar');
    if (!bar || document.querySelector('script[src*="notif.js"]')) return;
    if (!bar.querySelector('.tb-bell')) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tb-bell'; b.setAttribute('aria-label', 'Notificaciones');
      b.style.cssText = 'width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none';
      b.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
      var user = bar.querySelector('.tb-user');
      if (user) bar.insertBefore(b, user); else bar.appendChild(b);
    }
    var sc = document.createElement('script'); sc.src = '/assets/notif.js?v=3'; document.body.appendChild(sc);
    pendientes();
  }

  // Lo pendiente del panel, con las mismas reglas que Inicio: propuestas de
  // proveedores sin revisar y campañas o planes publicados que vencen en 7 días.
  var MAN = { url: 'https://fzaxwuuodseyyinveknn.supabase.co', key: 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk' };
  function pendientes() {
    try {
      var m = window.supabase.createClient(MAN.url, MAN.key, { auth: { persistSession: false } });
      var d0 = new Date(); d0.setHours(0, 0, 0, 0);
      var d7 = new Date(d0); d7.setDate(d7.getDate() + 7);
      var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      var fecha = function (s) { var x = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return x ? new Date(+x[1], +x[2] - 1, +x[3]) : null; };
      var vigente = function (a) { var fi = fecha(a.fecha_inicio); return !fi || fi <= d0; };
      // Devoluciones de Trade Marketing sin ver (viven en el Hub: se cuentan con la función).
      var devoluciones = window.supabase.createClient(HUB.url, HUB.key).auth.getSession().then(function (s) {
        var t = s && s.data && s.data.session && s.data.session.access_token;
        if (!t) return 0;
        return fetch('/.netlify/functions/trade-devoluciones?vista=contar', { headers: { Authorization: 'Bearer ' + t } })
          .then(function (x) { return x.ok ? x.json() : {}; }).then(function (j) { return j.pendientes || 0; });
      }).catch(function () { return 0; });
      Promise.all([
        m.from('propuestas_acciones').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        m.from('acciones_mensuales').select('*').eq('activa', true).gte('fecha_fin', iso(d0)).lte('fecha_fin', iso(d7) + 'T23:59:59'),
        m.from('checklist_planes').select('*').gte('fecha_fin', iso(d0)).lte('fecha_fin', iso(d7) + 'T23:59:59'),
        devoluciones,
      ]).then(function (r) {
        var lista = [];
        var dev = r[3] || 0;
        if (dev) lista.push({ icon: '📣', titulo: 'Tenés ' + dev + (dev > 1 ? ' devoluciones' : ' devolución') + ' de Trade Marketing sin ver', detalle: 'Observaciones de los vendedores sobre tus acciones', link: 'admin-devoluciones.html' });
        var prop = (r[0] && r[0].count) || 0;
        if (prop) lista.push({ icon: '📥', titulo: 'Tenés ' + prop + ' propuesta' + (prop > 1 ? 's' : '') + ' de proveedores para revisar', detalle: 'Propuestas de proveedores', link: 'admin-propuestas-proveedores.html' });
        var camps = ((r[1] && r[1].data) || []).filter(vigente)
          .concat(((r[2] && r[2].data) || []).filter(function (p) { return p.activo !== false && vigente(p); }));
        if (camps.length) {
          var nombres = camps.map(function (a) { return a.producto || a.nombre || ''; }).filter(Boolean);
          lista.push({ icon: '⏳', titulo: camps.length + (camps.length > 1 ? ' campañas vencen' : ' campaña vence') + ' en los próximos 7 días',
            detalle: nombres.slice(0, 3).join(' · ') + (nombres.length > 3 ? ' y ' + (nombres.length - 3) + ' más' : ''), link: 'admin-comercial.html' });
        }
        window.GBNotifExtra = lista;
        (function avisar(n) { if (window.GBNotifActualizar) window.GBNotifActualizar(); else if (n < 40) setTimeout(function () { avisar(n + 1); }, 250); })(0);
      }).catch(function () {});
    } catch (e) {}
  }

  revisarAcceso();
  if (SOLO) { /* se pinta cuando se sabe el rol (revisarAcceso) */ }
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { pintar(); campanita(); });
  else { pintar(); campanita(); }
})();
