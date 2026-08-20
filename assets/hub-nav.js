// ─── Menú del Hub del vendedor — fuente única ────────────────────────────────
// Antes cada página tenía su propio <nav> escrito a mano y quedaban desparejos:
// entrabas a Clientes y desaparecían Leads y Agenda Eficiente. Ahora todas las
// páginas dejan el <nav> vacío y este archivo lo dibuja igual en todas.
//
// Para agregar o sacar una sección del menú: tocar SOLO la lista ITEMS de acá.
(function () {
  const ITEMS = [
    { t:'Inicio',                 h:'inicio.html',            m:'Inicio',   svg:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' },
    { t:'Clientes',               h:'clientes-hub.html',      m:'Clientes', svg:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 3.5a3 3 0 0 1 0 6"/>' },
    { t:'Leads',                  h:'leads.html',                           svg:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>' },
    { t:'Planificador de ruta IA',h:'planificador-ia.html',   m:'Ruta IA',  svg:'<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.3"/>' },
    { t:'Agenda',                 h:'agenda.html',            m:'Agenda',   svg:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>' },
    { t:'Agenda Eficiente',       h:'agenda-eficiente.html',                svg:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/><circle cx="18" cy="6" r="3"/>' },
    { t:'Cobranzas',              h:'cobranzas-vendedor.html',              svg:'<path d="M12 2v20M17 6H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>' },
    { t:'Tareas',                 h:'tareas.html',                          svg:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7H4V5h11"/>' },
    { t:'Pedidos',                h:'#',                                    svg:'<path d="M6 2 3 6v14h18V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>' },
    { t:'Herramientas de venta',  h:'herramientas.html',                    svg:'<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/>' },
    { t:'Reportes',               h:'mis-reportes.html',                    svg:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>' },
  ];
  // Barra inferior del celular: los que tienen `m` (nombre corto) + "Más".
  const MAS = { t:'Más', h:'#', svg:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>' };

  // Netlify sirve las páginas sin ".html" (pretty URLs), así que se compara sin extensión.
  const base = s => String(s || '').split('/').pop().replace(/\.html$/, '').toLowerCase();
  const actual = base(location.pathname) || 'inicio';

  const link = (it, corto) => {
    const activo = it.h !== '#' && base(it.h) === actual;
    const txt = corto ? (it.m || it.t) : it.t;
    return `<a href="${it.h}"${activo ? ' class="active"' : ''}>`
      + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${it.svg}</svg>`
      + `${corto ? '' : ' '}${txt}</a>`;
  };

  function pintar() {
    document.querySelectorAll('nav.sb-nav').forEach(nav => {
      nav.innerHTML = ITEMS.map(it => link(it, false)).join('\n');
    });
    document.querySelectorAll('nav.bottomnav').forEach(nav => {
      nav.innerHTML = ITEMS.filter(it => it.m).map(it => link(it, true)).join('\n') + link(MAS, true);
    });
  }

  // ── Menú del usuario (abajo del sidebar) → Cerrar sesión ───────────────────
  // Antes, tocar el nombre disparaba un confirm() del navegador. Ahora despliega
  // un menú, igual que el panel de administración.
  const HUB = { url:'https://xqhyemccbwmzxqzkrtwa.supabase.co', key:'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc' };
  async function cerrarSesion() {
    try {
      const cfg = window.GB_SUPABASE || HUB;
      const url = cfg.SUPABASE_URL || HUB.url, key = cfg.SUPABASE_ANON_KEY || HUB.key;
      if (window.supabase) await window.supabase.createClient(url, key).auth.signOut();
    } catch (e) {}
    try {
      localStorage.removeItem('gb_demo'); localStorage.removeItem('gb_role');
      Object.keys(localStorage).filter(k => /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    location.href = 'index.html';
  }

  // El menú se cuelga del <body>, NO adentro del elemento que se toca: varias páginas
  // escriben las iniciales/el nombre con textContent sobre ese mismo nodo y eso borraba
  // el menú (por eso no se desplegaba en el avatar de arriba).
  function montarMenu(el, haciaAbajo) {
    el.removeAttribute('title');
    el.style.cursor = 'pointer';

    const menu = document.createElement('div');
    menu.setAttribute('data-hub-menu', '');
    menu.style.cssText = 'display:none;position:fixed;min-width:180px;background:#fff;border-radius:11px;'
      + 'box-shadow:0 14px 34px -10px rgba(0,0,0,.45);padding:5px;z-index:9500;white-space:nowrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🚪 Cerrar sesión';
    btn.style.cssText = 'display:block;width:100%;text-align:left;background:none;border:0;padding:10px 12px;'
      + 'border-radius:8px;font-size:13.5px;font-family:inherit;color:#1b2a32;cursor:pointer';
    btn.addEventListener('mouseenter', () => btn.style.background = '#f4f1ea');
    btn.addEventListener('mouseleave', () => btn.style.background = 'none');
    btn.addEventListener('click', e => { e.stopPropagation(); cerrarSesion(); });
    menu.appendChild(btn);
    document.body.appendChild(menu);

    function ubicar() {
      const r = el.getBoundingClientRect();
      menu.style.left = Math.round(Math.min(r.left, window.innerWidth - 200)) + 'px';
      menu.style.top = haciaAbajo ? Math.round(r.bottom + 8) + 'px'
                                  : Math.round(r.top - menu.offsetHeight - 8) + 'px';
    }
    el.addEventListener('click', e => {
      e.stopPropagation();
      const abierto = menu.style.display === 'block';
      document.querySelectorAll('[data-hub-menu]').forEach(m => m.style.display = 'none');
      if (!abierto) { menu.style.display = 'block'; ubicar(); }
    });
    window.addEventListener('resize', () => { if (menu.style.display === 'block') ubicar(); });
    document.addEventListener('click', () => { menu.style.display = 'none'; });
  }

  function menuUsuario() {
    // El bloque del usuario abajo del sidebar…
    document.querySelectorAll('.sb-user').forEach(el => montarMenu(el, false));
    // …y el avatar de arriba a la derecha, que hasta ahora no hacía nada.
    document.querySelectorAll('#avTop, .head .right .av, .topbar .av').forEach(el => montarMenu(el, true));
  }

  function iniciar() { pintar(); menuUsuario(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
