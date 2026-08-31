/* ===========================================================
   GrandBar — mapa de pantallas del sistema
   -----------------------------------------------------------
   Lo usan los paneles de Diseño (Josefina) y Desarrollo (Nahuel)
   para llegar a cualquier pantalla sin tener que acordarse de la
   URL ni entrar con la cuenta de otro.

   Al crear una pantalla nueva, agregala acá y aparece sola en
   los dos paneles.

   - ruta:  desde la raíz del sitio
   - quien: quién la usa todos los días (para poder buscar por persona)
   - nota:  qué se hace ahí, en una línea
   =========================================================== */
const PANTALLAS = [
  {
    grupo: 'App del vendedor',
    color: '#2f6f5e',
    ico: '🧑‍💼',
    quien: 'Vendedores',
    items: [
      { n:'Inicio del vendedor',    r:'inicio.html',                        nota:'Tablero del día: visitas, tareas, ventas y avisos.' },
      { n:'Manual de visita',       r:'manual-vendedores/visita.html',      nota:'El checklist que completa en el punto de venta. Necesita cliente elegido.' },
      { n:'Ingreso al manual',      r:'manual-vendedores/index.html',       nota:'Login del manual y elección de cliente.' },
      { n:'Mi cartera',             r:'manual-vendedores/clientes.html',    nota:'Sus clientes asignados.' },
      { n:'Clientes (Hub)',         r:'clientes-hub.html',                  nota:'Lista y ficha de clientes con acciones rápidas.' },
      { n:'Agenda',                 r:'agenda.html',                        nota:'Visitas planificadas.' },
      { n:'Agenda eficiente',       r:'agenda-eficiente.html',              nota:'Armado de recorrido por zona.' },
      { n:'Planificador de ruta IA',r:'planificador-ia.html',               nota:'La IA arma el recorrido del día.' },
      { n:'Tareas',                 r:'tareas.html',                        nota:'Pendientes del vendedor.' },
      { n:'Mis compromisos',        r:'manual-vendedores/compromisos.html', nota:'Lo que prometió a cada cliente.' },
      { n:'Cobranzas',              r:'cobranzas-vendedor.html',            nota:'Deuda y comprobantes de sus clientes.' },
      { n:'Leads',                  r:'leads.html',                         nota:'Posibles clientes asignados.' },
      { n:'Posibles nuevos clientes',r:'nuevos-clientes.html',              nota:'Alta de prospectos desde la calle.' },
      { n:'Herramientas de venta',  r:'herramientas.html',                  nota:'Catálogo, materiales y utilidades.' },
      { n:'Mis reportes',           r:'mis-reportes.html',                  nota:'Su desempeño.' },
      { n:'Reporte semanal',        r:'reporte-semanal.html',               nota:'Resumen completo de la semana.' },
      { n:'Ventas',                 r:'ventas.html',                        nota:'Ventas del mes por vendedor.' },
      { n:'Torneo Doña Paula',      r:'manual-vendedores/torneo.html',      nota:'Ranking del torneo.' },
      { n:'Registrar actividad',    r:'manual-vendedores/torneo-registro.html', nota:'Carga de actividad del torneo.' },
      { n:'Mi avatar',              r:'manual-vendedores/vestidor.html',    nota:'Personalización del avatar.' },
    ],
  },
  {
    grupo: 'Supervisión',
    color: '#2f5f8f',
    ico: '👥',
    quien: 'Supervisores',
    items: [
      { n:'Panel supervisor',   r:'manual-vendedores/supervisor.html', nota:'Visitas y cumplimiento del equipo.' },
      { n:'Mi equipo',          r:'supervisor-equipo.html',            nota:'Ficha de cada vendedor.' },
      { n:'Agendas del equipo', r:'supervisor-agendas.html',           nota:'Qué tiene planificado cada uno.' },
      { n:'Tareas del equipo',  r:'supervisor-tareas.html',            nota:'Pendientes por vendedor.' },
      { n:'Visitas del equipo', r:'supervisor-visitas.html',           nota:'Visitas cargadas y su detalle.' },
      { n:'Asignar leads',      r:'leads-asignar.html',                nota:'Repartir posibles clientes.' },
    ],
  },
  {
    grupo: 'Panel comercial (Luciana)',
    color: '#c9a13b',
    ico: '📣',
    quien: 'Luciana',
    items: [
      { n:'Inicio comercial',    r:'manual-vendedores/admin-comercial.html',        nota:'Resumen de campañas.' },
      { n:'Campañas y planes',   r:'manual-vendedores/admin-campanias.html',        nota:'Todas las campañas y planes cargados.' },
      { n:'Nueva campaña',       r:'manual-vendedores/admin-nueva-campania.html',   nota:'Asistente de carga.' },
      { n:'Nuevo plan',          r:'manual-vendedores/admin-nuevo-plan.html',       nota:'Carga de planes y programas.' },
      { n:'Planes',              r:'manual-vendedores/admin-planes.html',           nota:'Listado de planes.' },
      { n:'Secciones del manual',r:'manual-vendedores/admin-secciones.html',        nota:'Estructura del manual e ítems del checklist.' },
      { n:'Combos de eventos',   r:'manual-vendedores/admin-combos.html',           nota:'Combos que ve el mayorista.' },
      { n:'Fechas especiales',   r:'manual-vendedores/admin-fechas.html',           nota:'Calendario del manual.' },
      { n:'Resultados',          r:'manual-vendedores/admin-resultados.html',       nota:'Desempeño de las campañas.' },
      { n:'Catálogo',            r:'manual-vendedores/admin-catalogo.html',         nota:'Proveedores y productos.' },
      { n:'Catálogo clientes',   r:'manual-vendedores/admin-catalogo-clientes.html',nota:'Catálogo público de acciones.' },
      { n:'Comparador de precios',r:'manual-vendedores/admin-comparador.html',      nota:'Precios de la competencia.' },
      { n:'Importar clientes',   r:'manual-vendedores/admin-importar.html',         nota:'Carga masiva desde planilla.' },
      { n:'Propuestas de proveedores', r:'manual-vendedores/propuestas.html',       nota:'Lo que cargan los proveedores para aprobar.' },
      { n:'Guía para proveedores',r:'manual-vendedores/proveedores-info.html',      nota:'Instructivo que se les comparte.' },
    ],
  },
  {
    grupo: 'Marketing',
    color: '#6b5bd0',
    ico: '🎨',
    quien: 'Marketing',
    items: [
      { n:'Panel Marketing (unificado)', r:'panel-diseno.html',                nota:'Ya no existe aparte: sus herramientas pasaron al panel de Diseño y Desarrollo.' },
      { n:'Materiales',        r:'manual-vendedores/admin-materiales.html',     nota:'Inventario de POP y materiales.' },
      { n:'Nuevo material',    r:'manual-vendedores/admin-material-nuevo.html', nota:'Alta de material con foto.' },
      { n:'Marketing (Hub)',   r:'marketing.html',                              nota:'Tablero del área.' },
    ],
  },
  {
    grupo: 'Dirección',
    color: '#0d2238',
    ico: '📈',
    quien: 'Dirección',
    items: [
      { n:'Dirección',              r:'direccion.html',        nota:'Tablero general.' },
      { n:'Vendedores (Dirección)', r:'dir-vendedores.html',   nota:'Desempeño por vendedor.' },
      { n:'Clientes (Dirección)',   r:'dir-clientes.html',     nota:'Cartera completa.' },
      { n:'Agenda (Dirección)',     r:'dir-agenda.html',       nota:'Actividad del equipo.' },
      { n:'Reportes',               r:'reportes.html',         nota:'Dashboards.' },
      { n:'Desarrollo de negocio',  r:'desarrollo.html',       nota:'Proyectos y oportunidades. Ojo: es negocio, no sistemas.' },
    ],
  },
  {
    grupo: 'Administración y depósito',
    color: '#d0603e',
    ico: '🏦',
    quien: 'Administración',
    items: [
      { n:'Administración',        r:'administracion.html',      nota:'Tablero del área.' },
      { n:'Revisión de cobranzas', r:'cobranzas-tesoreria.html', nota:'Extracto y match de pagos.' },
      { n:'Compras',               r:'compras.html',             nota:'Tablero de compras.' },
      { n:'Depósito',              r:'deposito.html',            nota:'Stock y movimientos.' },
      { n:'Productos',             r:'productos.html',           nota:'Maestro de productos.' },
      { n:'Proveedores',           r:'proveedores.html',         nota:'Maestro de proveedores.' },
    ],
  },
  {
    grupo: 'Sistema',
    color: '#7a8891',
    ico: '⚙️',
    quien: 'Nahuel y Josefina',
    items: [
      { n:'Panel de Josefina',  r:'panel-diseno.html',                         nota:'Panel de Diseño y Desarrollo (el de Josefina).' },
      { n:'Panel de Nahuel',    r:'panel-desarrollo.html',                     nota:'El mismo panel, con su nombre.' },
      { n:'Hub',                r:'hub.html',                                  nota:'La pantalla de herramientas según el rol.' },
      { n:'Ingreso',            r:'index.html',                                nota:'Login del Hub.' },
      { n:'Panel clásico',      r:'manual-vendedores/admin.html?tab=checklists',nota:'Visitas, compromisos y checklists en crudo.' },
      { n:'Configuración',      r:'configuracion.html',                        nota:'En construcción.' },
      { n:'Panel (viejo)',      r:'panel.html',                                nota:'Versión anterior del Hub.' },
    ],
  },
];

/* Pinta el mapa completo dentro de un contenedor. Filtra por texto. */
function renderPantallas(contenedorId, filtro) {
  const cont = document.getElementById(contenedorId);
  if (!cont) return;
  const q = (filtro || '').toLowerCase().trim();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const grupos = PANTALLAS.map(g => {
    const items = g.items.filter(i =>
      !q || (i.n + ' ' + i.nota + ' ' + g.grupo + ' ' + g.quien).toLowerCase().includes(q));
    return { ...g, items };
  }).filter(g => g.items.length);

  if (!grupos.length) {
    cont.innerHTML = `<div class="pv-vacio">No hay pantallas que coincidan con “${esc(filtro)}”.</div>`;
    return;
  }

  cont.innerHTML = grupos.map(g => `
    <section class="pv-grupo">
      <div class="pv-grupo-h">
        <span class="pv-dot" style="background:${g.color}"></span>
        <h2>${g.ico} ${esc(g.grupo)}</h2>
        <span class="pv-quien">${esc(g.quien)}</span>
        <span class="pv-n">${g.items.length}</span>
      </div>
      <div class="pv-cards">
        ${g.items.map(i => `
          <a class="pv-card" href="${esc(i.r)}">
            <div class="pv-card-n">${esc(i.n)}</div>
            <div class="pv-card-nota">${esc(i.nota)}</div>
            <div class="pv-card-ruta">${esc(i.r)}</div>
          </a>`).join('')}
      </div>
    </section>`).join('');
}

function totalPantallas() { return PANTALLAS.reduce((a, g) => a + g.items.length, 0); }
