// ============================================================
//  GrandBar Hub · supervisor-nav
//  Si el usuario logueado es SUPERVISOR, reemplaza el menú lateral
//  (y el de abajo en celular) de las páginas compartidas por el
//  menú de supervisor, para que no "vuelva" al panel de vendedor.
//  Se incluye en: tareas.html, agenda.html, clientes-hub.html.
// ============================================================
(async function () {
  try {
    if (!window.supabase) return;
    const HUB = { url: "https://xqhyemccbwmzxqzkrtwa.supabase.co", key: "sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc" };
    const c = supabase.createClient(HUB.url, HUB.key);
    const { data: { session } } = await c.auth.getSession();
    if (!session) return;
    const { data: u } = await c.from("usuarios").select("es_supervisor").eq("id", session.user.id).maybeSingle();
    if (!u || !u.es_supervisor) return;

    const page = (location.pathname.split("/").pop() || "").toLowerCase();
    const items = [
      { href: "supervisor-equipo.html", label: "Mi equipo",         short: "Equipo",  icon: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
      { href: "supervisor-tareas.html", label: "Tareas del equipo",  short: "Tareas",  icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
      { href: "clientes-hub.html",      label: "Clientes del equipo", short: "Clientes",icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>' },
      { href: "supervisor-visitas.html", label: "Visitas del equipo", short: "Visitas", icon: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>' },
      { href: "supervisor-agendas.html", label: "Agendas del equipo", short: "Agendas", icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
      { href: "agenda.html",            label: "Agenda",              short: "Agenda",  icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>' },
      { href: "tareas.html",            label: "Mis tareas",          short: "Mis tareas", icon: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
      { href: "mis-reportes.html",      label: "Mis reportes",        short: "Reportes", icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>' },
    ];
    const svg = (ic, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${extra || ""}>${ic}</svg>`;

    const nav = document.querySelector(".sb-nav");
    if (nav) nav.innerHTML = items.map(it => `<a href="${it.href}" class="${it.href === page ? "active" : ""}">${svg(it.icon)} ${it.label}</a>`).join("");

    const bot = document.querySelector(".botnav, .bottomnav");
    if (bot) {
      const b = [items[0], items[1], items[3], items[4]];
      bot.innerHTML = b.map(it => `<a href="${it.href}" class="${it.href === page ? "active" : ""}">${svg(it.icon)}${it.short}</a>`).join("");
    }
  } catch (e) { /* si falla, queda el menú por defecto */ }
})();
