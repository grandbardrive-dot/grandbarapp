// ============================================================
//  GrandBar Hub · supervisor-nav
//  Si el usuario es SUPERVISOR, reemplaza el menú lateral (y el de
//  abajo en celular) por el de supervisor — SIEMPRE el mismo.
//  Dibuja al instante usando un flag cacheado (localStorage) para
//  que no parpadee ni "cambie" al navegar entre secciones.
// ============================================================
(function () {
  var HUB = { url: "https://xqhyemccbwmzxqzkrtwa.supabase.co", key: "sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc" };
  // Los supervisores (Martín en San Luis, Diego en OFF, Juan Pablo Mollar en ON)
  // también venden: tienen su propia cartera. Por eso el menú tiene tres bloques:
  // lo del equipo, lo de sus propias ventas y lo suyo (agenda, tareas, reportes).
  // (25/09/2026)
  var grupos = [
    { titulo: "Mi equipo", items: [
      { href: "supervisor-equipo.html",  label: "Resumen del equipo", short: "Equipo",  icon: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
      { href: "supervisor-visitas.html", label: "Visitas",            short: "Visitas", icon: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>' },
      { href: "supervisor-agendas.html", label: "Agendas",            short: "Agendas", icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3"/>' },
      { href: "supervisor-tareas.html",  label: "Tareas",             short: "Tareas",  icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
      { href: "clientes-hub.html?vista=equipo", label: "Clientes del equipo", short: "Clientes", icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 3.5a3 3 0 0 1 0 6"/>' },
      { href: "supervisor-pedidos.html", label: "Pedidos de acción",  short: "Pedidos", icon: '<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 14l2 2 4-4"/>' },
      { href: "leads-asignar.html",      label: "Leads",              short: "Leads",   icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>' },
      { href: "supervisor-curso.html",   label: "Curso",              short: "Curso",   icon: '<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h8M8 11h6"/>' },
      // Cómo va cada vendedor en el torneo (puntos oficiales de Administración).
      { href: "torneo-vendedor.html",    label: "Torneo Doña Paula",  short: "Torneo",  icon: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>' },
    ]},
    { titulo: "Mis ventas", items: [
      { href: "inicio.html",             label: "Mi inicio",          short: "Inicio",  icon: '<path d="M3 11l9-8 9 8"/><path d="M9 21v-6h6v6"/><path d="M5 10v11h14V10"/>' },
      { href: "clientes-hub.html",       label: "Mis clientes",       short: "Mis clientes", icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>' },
      { href: "leads.html",              label: "Mis leads",          short: "Mis leads", icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1"/>' },
      { href: "planificador-ia.html",    label: "Planificador de ruta IA", short: "Ruta IA", icon: '<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
      { href: "agenda-eficiente.html",   label: "Agenda eficiente",   short: "Ag. eficiente", icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/><circle cx="18" cy="5" r="2"/>' },
      { href: "cobranzas-vendedor.html", label: "Cobranzas",          short: "Cobranzas", icon: '<path d="M12 2v20M17 6H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>' },
      { href: "herramientas.html",       label: "Herramientas de venta", short: "Herramientas", icon: '<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/>' },
    ]},
    { titulo: "Lo mío", items: [
      { href: "agenda.html",             label: "Mi agenda",          short: "Agenda",  icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>' },
      { href: "tareas.html",             label: "Mis tareas",         short: "Mis tareas", icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
      { href: "mis-reportes.html",       label: "Mis reportes",       short: "Reportes", icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>' },
    ]},
    // La guía del panel (25/09/2026) se abre en otra pestaña: así el panel queda abierto.
    { titulo: "Ayuda", items: [
      { href: "guia-supervisores.html",  label: "Guía del panel",     short: "Guía",    nueva: true, icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14"/><path d="M12 17h.01"/>' },
    ]},
  ];
  var items = [].concat.apply([], grupos.map(function (g) { return g.items; }));
  // Barra de abajo en el celular: las cuatro que más usa (se eligen por pantalla, no por posición).
  var ABAJO = ["supervisor-equipo.html", "supervisor-visitas.html", "clientes-hub.html", "agenda.html"];
  var svg = function (ic) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + ic + '</svg>'; };
  var TIT = 'style="font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8fa3ad;padding:14px 12px 5px"';

  function reveal() { var n = document.querySelector(".sb-nav"); if (n) n.style.visibility = "visible"; }
  function render() {
    // Marca para hub-nav.js: si el menú es de supervisor, el de vendedor no lo pisa.
    window.__gbSupNav = true;
    try { document.documentElement.classList.add("gb-sup"); } catch (e) {}
    document.querySelectorAll(".sb-user .s").forEach(function (el) { if (/^\s*Vendedor\s*$/.test(el.textContent)) el.textContent = "Supervisor"; });
    // Netlify sirve las páginas sin ".html": se compara sin la extensión. Y
    // "Clientes del equipo" y "Mis clientes" son la misma pantalla con distinta
    // vista (?vista=equipo), así que también cuenta lo que va después del "?".
    var sinExt = function (h) { return String(h || "").split("?")[0].replace(/\.html$/, "").toLowerCase(); };
    var page = sinExt(location.pathname.split("/").pop()) || "inicio";
    var consulta = location.search || "";
    var exacto = items.some(function (it) { return sinExt(it.href) === page && (it.href.split("?")[1] ? "?" + it.href.split("?")[1] : "") === consulta; });
    var activo = function (it) {
      if (sinExt(it.href) !== page) return false;
      var q = it.href.split("?")[1] ? "?" + it.href.split("?")[1] : "";
      return exacto ? q === consulta : !q;
    };
    var link = function (it) { return '<a href="' + it.href + '" class="' + (activo(it) ? "active" : "") + '"' + (it.nueva ? ' target="_blank" rel="noopener"' : '') + '>' + svg(it.icon) + " " + it.label + "</a>"; };
    var nav = document.querySelector(".sb-nav");
    if (nav) {
      nav.innerHTML = grupos.map(function (g) { return '<div ' + TIT + '>' + g.titulo + '</div>' + g.items.map(link).join(""); }).join("");
      nav.style.visibility = "visible";
    }
    var bot = document.querySelector(".botnav, .bottomnav");
    if (bot) {
      var b = ABAJO.map(function (h) { return items.filter(function (it) { return it.href === h; })[0]; }).filter(Boolean);
      bot.innerHTML = b.map(function (it) { return '<a href="' + it.href + '" class="' + (activo(it) ? "active" : "") + '">' + svg(it.icon) + it.short + "</a>"; }).join("");
    }
  }

  // De quién es la sesión guardada. El cache queda atado a esa persona: si en
  // otra pestaña se entra con otra cuenta, el menú de supervisor no se le queda
  // pegado al que venga después.
  function uidGuardado() {
    try {
      var v = JSON.parse(localStorage.getItem("sb-xqhyemccbwmzxqzkrtwa-auth-token") || "null");
      var s = v && (v.currentSession || v);
      return (s && s.user && s.user.id) || "";
    } catch (e) { return ""; }
  }

  // 1) Si ya sabemos (cacheado, y de esta misma cuenta) que es supervisor → dibujar YA.
  try { var _u = uidGuardado(); if (_u && localStorage.getItem("gb_es_sup") === _u) render(); } catch (e) {}

  // 2) Confirmar contra la sesión y actualizar el cache.
  (async function () {
    try {
      if (!window.supabase) return;
      var c = supabase.createClient(HUB.url, HUB.key);
      var s = (await c.auth.getSession()).data.session; if (!s) return;
      var u = (await c.from("usuarios").select("es_supervisor").eq("id", s.user.id).maybeSingle()).data;
      var sup = !!(u && u.es_supervisor);
      try { localStorage.setItem("gb_es_sup", sup ? s.user.id : "no"); } catch (e) {}
      if (sup) render();
      else {
        window.__gbSupNav = false;
        try { document.documentElement.classList.remove("gb-sup"); } catch (e) {}
        if (window.GBHubNav) window.GBHubNav.pintar(true);   // no es supervisor: vuelve el menú de vendedor
        reveal();
      }
    } catch (e) { reveal(); }
  })();
})();
