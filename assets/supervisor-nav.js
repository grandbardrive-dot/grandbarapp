// ============================================================
//  GrandBar Hub · supervisor-nav
//  Si el usuario es SUPERVISOR, reemplaza el menú lateral (y el de
//  abajo en celular) por el de supervisor — SIEMPRE el mismo.
//  Dibuja al instante usando un flag cacheado (localStorage) para
//  que no parpadee ni "cambie" al navegar entre secciones.
// ============================================================
(function () {
  var HUB = { url: "https://xqhyemccbwmzxqzkrtwa.supabase.co", key: "sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc" };
  var items = [
    { href: "supervisor-equipo.html",  label: "Mi equipo",          short: "Equipo",  icon: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
    { href: "supervisor-tareas.html",  label: "Tareas del equipo",  short: "Tareas",  icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
    { href: "clientes-hub.html",       label: "Clientes del equipo",short: "Clientes",icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>' },
    { href: "leads-asignar.html",      label: "Leads",              short: "Leads",   icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>' },
    { href: "supervisor-visitas.html", label: "Visitas del equipo", short: "Visitas", icon: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>' },
    { href: "supervisor-agendas.html", label: "Agendas del equipo", short: "Agendas", icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
    { href: "agenda.html",             label: "Agenda",             short: "Agenda",  icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>' },
    { href: "tareas.html",             label: "Mis tareas",         short: "Mis tareas", icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
    { href: "mis-reportes.html",       label: "Mis reportes",       short: "Reportes", icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>' },
  ];
  var svg = function (ic) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + ic + '</svg>'; };

  function reveal() { var n = document.querySelector(".sb-nav"); if (n) n.style.visibility = "visible"; }
  function render() {
    var page = (location.pathname.split("/").pop() || "").toLowerCase();
    var nav = document.querySelector(".sb-nav");
    if (nav) { nav.innerHTML = items.map(function (it) { return '<a href="' + it.href + '" class="' + (it.href === page ? "active" : "") + '">' + svg(it.icon) + " " + it.label + "</a>"; }).join(""); nav.style.visibility = "visible"; }
    var bot = document.querySelector(".botnav, .bottomnav");
    if (bot) { var b = [items[0], items[1], items[3], items[5]]; bot.innerHTML = b.map(function (it) { return '<a href="' + it.href + '" class="' + (it.href === page ? "active" : "") + '">' + svg(it.icon) + it.short + "</a>"; }).join(""); }
  }

  // 1) Si ya sabemos (cacheado) que es supervisor → dibujar YA, sin esperar red.
  try { if (localStorage.getItem("gb_es_sup") === "1") render(); } catch (e) {}

  // 2) Confirmar contra la sesión y actualizar el cache.
  (async function () {
    try {
      if (!window.supabase) return;
      var c = supabase.createClient(HUB.url, HUB.key);
      var s = (await c.auth.getSession()).data.session; if (!s) return;
      var u = (await c.from("usuarios").select("es_supervisor").eq("id", s.user.id).maybeSingle()).data;
      var sup = !!(u && u.es_supervisor);
      try { localStorage.setItem("gb_es_sup", sup ? "1" : "0"); } catch (e) {}
      if (sup) render();
      else { try { document.documentElement.classList.remove("gb-sup"); } catch (e) {} reveal(); }
    } catch (e) { reveal(); }
  })();
})();
