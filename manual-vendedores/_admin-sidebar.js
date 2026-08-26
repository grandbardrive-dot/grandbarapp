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

  // ── Menú del panel comercial (Luciana) ─────────────────────────────────────
  // Antes cada pantalla tenía su propio <nav> escrito a mano y no coincidían: a
  // Secciones le faltaban Catálogo clientes, Comparador y Borradores, a Combos le
  // faltaban cuatro, etc. El menú cambiaba según dónde estabas parado. Ahora la
  // lista vive acá y se pinta igual en todas.
  const PAGINAS_COMERCIAL = [
    'admin-campanias.html', 'admin-nueva-campania.html', 'admin-fechas.html',
    'admin-secciones.html', 'admin-combos.html', 'admin-catalogo.html',
    'admin-catalogo-clientes.html', 'admin-resultados.html', 'admin-comparador.html',
  ];
  const MENU = [
    { key:'campanias', href:'admin-campanias.html', label:'Campañas', sub:'Acciones comerciales',
      ico:'<path d="M4 5h16M4 12h16M4 19h10" stroke-linecap="round"/>' },
    { key:'secciones', href:'admin-secciones.html', label:'Secciones', sub:'Estructura del manual',
      ico:'<path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/>' },
    { key:'combos',    href:'admin-combos.html', label:'Combos', sub:'Para eventos',
      ico:'<path d="M5 8h14l-1 12H6z" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke-linecap="round"/>' },
    { key:'catalogo',  href:'admin-catalogo.html', label:'Catálogo', sub:'Proveedores y productos',
      ico:'<path d="M4 7l8-4 8 4-8 4z" stroke-linejoin="round"/><path d="M4 7v10l8 4 8-4V7" stroke-linecap="round" stroke-linejoin="round"/>' },
    { key:'catclientes', href:'admin-catalogo-clientes.html', label:'Catálogo clientes', sub:'Catálogo público de acciones',
      ico:'<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z" stroke-linejoin="round"/>' },
    { key:'resultados', href:'admin-resultados.html', label:'Resultados', sub:'Desempeño de campañas',
      ico:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke-linecap="round"/>' },
    { key:'comparador', href:'admin-comparador.html', label:'Comparador', sub:'Precios de la competencia',
      ico:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/>' },
    { key:'borradores', href:'admin-campanias.html?estado=borrador', label:'Borradores', sub:'En edición',
      ico:'<path d="M7 3h7l5 5v13H7z" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h6" stroke-linecap="round"/>' },
  ];
  const AYUDA = [
    { fn:'verGuias', label:'Guías y tutoriales',
      ico:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7v.4" stroke-linecap="round"/><circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none"/>' },
    { fn:'soporte', label:'Soporte',
      ico:'<path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3M4 13v4a2 2 0 0 0 2 2h1v-6H4" stroke-linecap="round" stroke-linejoin="round"/>' },
  ];

  const archivo = () => (location.pathname.split('/').pop() || 'admin-campanias.html').toLowerCase();

  // Qué opción se marca como activa en cada pantalla.
  function activo() {
    const f = archivo(), esBorrador = /estado=borrador/.test(location.search);
    if (f === 'admin-campanias.html')      return esBorrador ? 'borradores' : 'campanias';
    if (f === 'admin-nueva-campania.html' || f === 'admin-fechas.html') return 'campanias';
    const it = MENU.find(m => m.href.split('?')[0] === f);
    return it ? it.key : '';
  }

  function itemHTML(m, on) {
    const ico = `<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${m.ico}</svg>`;
    const txt = `<div><div class="sb-txt-main">${m.label}</div>${m.sub ? `<div class="sb-txt-sub">${m.sub}</div>` : ''}</div>`;
    return `<a class="sb-item${on ? ' active' : ''}" href="${m.href}">${ico}${txt}</a>`;
  }

  function pintarMenuComercial() {
    if (PAGINAS_COMERCIAL.indexOf(archivo()) < 0) return;
    const aside = document.querySelector('aside.sidebar');
    if (!aside || !aside.querySelector('.sb-nav')) return;

    // El recuadro de ayuda es propio de cada pantalla ("Cómo funciona"): se respeta.
    const ayudaPropia = aside.querySelector('.sb-help');
    const ayudaHTML = ayudaPropia ? ayudaPropia.outerHTML : `
      <div class="sb-help">
        <div class="sb-help-t">💡 ¿Necesitás ayuda?</div>
        <div class="sb-help-p">Accedé a guías rápidas y tutoriales paso a paso.</div>
      </div>`;
    aside.querySelectorAll('.sb-nav, .sb-label, .sb-spacer, .sb-help').forEach(n => n.remove());

    const act = activo();
    const html = `
      <nav class="sb-nav">${MENU.map(m => itemHTML(m, m.key === act)).join('')}</nav>
      <div class="sb-label">Ayuda</div>
      <nav class="sb-nav" style="padding-top:0">
        ${AYUDA.map(a => `<button class="sb-item" style="background:none;border:none;font-family:inherit;text-align:left;width:100%" onclick="${a.fn}()">
          <svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${a.ico}</svg>
          <div><div class="sb-txt-main">${a.label}</div></div>
        </button>`).join('')}
      </nav>
      <div class="sb-spacer"></div>
      ${ayudaHTML}`;
    aside.insertAdjacentHTML('beforeend', html);

    // Guías y Soporte estaban en el menú de varias pantallas pero solo Inicio tenía
    // las funciones: al tocarlos no pasaba nada. Acá van los respaldos.
    if (typeof window.verGuias !== 'function') {
      window.verGuias = () => alert('Guías y tutoriales — próximamente.');
    }
    if (typeof window.soporte !== 'function') {
      window.soporte = () => {
        if (typeof window.abrirSoporte === 'function') return window.abrirSoporte();
        if (confirm('¿Abrir WhatsApp de soporte?')) window.open('https://wa.link/0khu1f', '_blank');
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pintarMenuComercial);
  } else {
    pintarMenuComercial();
  }
})();
