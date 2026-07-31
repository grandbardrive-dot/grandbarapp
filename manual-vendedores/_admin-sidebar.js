// ── Sidebar compartido del panel de Marketing ──────────────────────────────
// Uso: <div id="sidebar"></div> + renderSidebar('materiales')
// Un solo lugar para el menú: Inicio, Campañas, Materiales, Checklists,
// Compromisos, Proveedores, Usuarios, Configuración.
(function () {
  const ICONS = {
    inicio:      '<path d="M3 11l9-7 9 7M5 10v9h14v-9" stroke-linecap="round" stroke-linejoin="round"/>',
    campanias:   '<path d="M4 5h16M4 12h16M4 19h10" stroke-linecap="round"/>',
    materiales:  '<path d="M20 7L12 3 4 7v10l8 4 8-4z" stroke-linejoin="round"/><path d="M4 7l8 4 8-4M12 11v10" stroke-linecap="round" stroke-linejoin="round"/>',
    checklists:  '<path d="M9 11l2 2 4-4M4 5h16v14H4z" stroke-linecap="round" stroke-linejoin="round"/>',
    compromisos: '<path d="M12 21s-7-4.35-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9z" stroke-linejoin="round"/>',
    proveedores: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke-linecap="round" stroke-linejoin="round"/>',
    usuarios:    '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round"/>',
    config:      '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.3-1.3l-.3-2.5h-4l-.3 2.5a7 7 0 0 0-2.3 1.3l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.3l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.3 1.3l.3 2.5h4l.3-2.5a7 7 0 0 0 2.3-1.3l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z" stroke-linejoin="round"/>',
  };
  const ITEMS = [
    { key:'inicio',      label:'Inicio',        href:'admin-marketing.html' },
    { key:'campanias',   label:'Campañas',      sub:'Acciones comerciales', href:'admin-campanias.html' },
    { key:'materiales',  label:'Materiales',    sub:'Biblioteca e inventario', href:'admin-materiales.html' },
    { key:'checklists',  label:'Checklists',    sub:'Manual del vendedor', href:'admin.html?tab=checklists' },
    { key:'compromisos', label:'Compromisos',   sub:'Seguimiento', href:'admin.html?tab=compromisos' },
    { key:'proveedores', label:'Proveedores',   sub:'Marcas y productos', href:'admin-catalogo.html' },
    { key:'usuarios',    label:'Usuarios',      soon:true },
    { key:'config',      label:'Configuración', soon:true },
  ];

  window.renderSidebar = function (active) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    const nav = ITEMS.map(it => {
      const on = it.key === active ? ' active' : '';
      const ico = `<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS[it.key] || ''}</svg>`;
      const txt = `<div><div class="sb-txt-main">${it.label}</div>${it.sub ? `<div class="sb-txt-sub">${it.sub}</div>` : ''}</div>`;
      if (it.soon) {
        return `<button class="sb-item${on}" onclick="alert('${it.label} — próximamente (llega con el login real).')">${ico}${txt}</button>`;
      }
      return `<a class="sb-item${on}" href="${it.href}">${ico}${txt}</a>`;
    }).join('');
    el.innerHTML = `
      <div class="sb-logo"><img src="GrandBar%20logotipo%20con%20sombra-05%20%282%29.png" alt="GrandBar"></div>
      <nav class="sb-nav">${nav}</nav>
      <div class="sb-spacer"></div>
      <nav class="sb-nav" style="padding-top:0">
        <button class="sb-item" onclick="sessionStorage.removeItem('admin_perfil');location.href='admin.html'">
          <svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M15 12H5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div><div class="sb-txt-main">Cambiar de perfil</div></div>
        </button>
      </nav>`;
    hacerResponsive();
  };

  // ── Responsive: en celular la barra es un menú hamburguesa (drawer) ──────────
  function hacerResponsive() {
    if (document.getElementById('sb-burger')) return; // ya inyectado

    const css = `
      .sb-burger,.sb-backdrop{display:none}
      @media (max-width:820px){
        #sidebar.sidebar{position:fixed;top:0;left:0;bottom:0;height:100%;width:270px;max-width:84vw;
          display:flex !important;transform:translateX(-100%);transition:transform .25s ease;
          z-index:120;box-shadow:0 0 44px rgba(0,0,0,.4);overflow-y:auto}
        #sidebar.sidebar.open{transform:translateX(0)}
        .sb-burger{display:flex;position:fixed;top:12px;left:12px;z-index:125;width:44px;height:44px;
          border-radius:12px;border:none;background:#1F447F;color:#fff;align-items:center;justify-content:center;
          box-shadow:0 3px 12px rgba(0,0,0,.28);cursor:pointer}
        .sb-burger svg{width:22px;height:22px}
        .sb-backdrop{display:block;position:fixed;inset:0;background:rgba(15,25,50,.5);z-index:115;
          opacity:0;pointer-events:none;transition:opacity .25s}
        .sb-backdrop.open{opacity:1;pointer-events:auto}
        .topbar{padding-left:64px !important}
      }`;
    const style = document.createElement('style');
    style.id = 'sb-responsive-style'; style.textContent = css;
    document.head.appendChild(style);

    const burger = document.createElement('button');
    burger.id = 'sb-burger'; burger.className = 'sb-burger'; burger.setAttribute('aria-label', 'Menú');
    burger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>';
    const backdrop = document.createElement('div');
    backdrop.id = 'sb-backdrop'; backdrop.className = 'sb-backdrop';

    const sidebar = document.getElementById('sidebar');
    const set = (open) => { sidebar.classList.toggle('open', open); backdrop.classList.toggle('open', open); };
    burger.addEventListener('click', () => set(!sidebar.classList.contains('open')));
    backdrop.addEventListener('click', () => set(false));
    // cerrar el menú al elegir una opción
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a.sb-item')) set(false); });

    document.body.appendChild(burger);
    document.body.appendChild(backdrop);
  }

  // Para páginas con sidebar propio (Campañas, Catálogo, Inicio Luciana, Resultados):
  // se aseguran de que la barra tenga id="sidebar" y le suman el menú hamburguesa.
  window.hacerSidebarResponsive = function () {
    const sb = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sb) return;
    if (!sb.id) sb.id = 'sidebar';
    hacerResponsive();
  };
})();
