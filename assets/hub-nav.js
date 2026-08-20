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
    // Pedidos todavía no tiene pantalla: en vez de no hacer nada al tocarlo, avisa.
    { t:'Pedidos',                h:'#', proximamente:true,                 svg:'<path d="M6 2 3 6v14h18V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>' },
    { t:'Herramientas de venta',  h:'herramientas.html',                    svg:'<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/>' },
    { t:'Reportes',               h:'mis-reportes.html',                    svg:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>' },
  ];
  // Barra inferior del celular: los que tienen `m` (nombre corto) + "Más".
  // "Más" abre el menú completo (el cajón), en vez de no hacer nada.
  const MAS = { t:'Más', h:'#', abreMenu:true, svg:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>' };

  // Netlify sirve las páginas sin ".html" (pretty URLs), así que se compara sin extensión.
  const base = s => String(s || '').split('/').pop().replace(/\.html$/, '').toLowerCase();
  const actual = base(location.pathname) || 'inicio';

  const link = (it, corto) => {
    const activo = it.h !== '#' && base(it.h) === actual;
    const txt = corto ? (it.m || it.t) : it.t;
    const extra = it.proximamente ? ` data-proximamente="${it.t}"` : (it.abreMenu ? ' data-abre-menu' : '');
    return `<a href="${it.h}"${activo ? ' class="active"' : ''}${extra}>`
      + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${it.svg}</svg>`
      + `${corto ? '' : ' '}${txt}</a>`;
  };

  // Aviso corto abajo de la pantalla (nada de carteles del navegador).
  function avisar(txt) {
    var t = document.getElementById('gb-aviso');
    if (!t) {
      t = document.createElement('div');
      t.id = 'gb-aviso';
      t.style.cssText = 'position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:99999;'
        + 'background:#0d2230;color:#fff;padding:12px 20px;border-radius:11px;font-size:14px;font-weight:600;'
        + 'font-family:inherit;box-shadow:0 10px 30px -8px rgba(0,0,0,.5);opacity:0;transition:opacity .2s;'
        + 'pointer-events:none;max-width:88vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = txt;
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    clearTimeout(avisar._t);
    avisar._t = setTimeout(function () { t.style.opacity = '0'; }, 2400);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-proximamente], a[data-abre-menu]');
    if (!a) return;
    e.preventDefault();
    if (a.hasAttribute('data-abre-menu')) { document.body.classList.toggle('gb-drawer-open'); return; }
    avisar(a.getAttribute('data-proximamente') + ': todavía no está disponible.');
  });

  function pintar() {
    document.querySelectorAll('nav.sb-nav').forEach(nav => {
      nav.innerHTML = ITEMS.map(it => link(it, false)).join('\n');
    });
    document.querySelectorAll('nav.bottomnav').forEach(nav => {
      nav.innerHTML = ITEMS.filter(it => it.m).map(it => link(it, true)).join('\n') + link(MAS, true);
    });
  }

  function iniciar() { pintar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
