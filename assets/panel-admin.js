/* ===========================================================
   GrandBar — panel de Diseño y Desarrollo (Josefina y Nahuel)
   -----------------------------------------------------------
   UN SOLO panel para los dos. Las páginas panel-diseno.html y
   panel-desarrollo.html solo cambian el nombre y el mail de la
   barra: el contenido, las secciones y las herramientas salen
   de acá, así no se pueden desincronizar.

   Uso:  <div id="panel"></div>
         montarPanel({ area:'Diseño', persona:'Josefina', mail:'…' })
   =========================================================== */

// Accesos directos a las herramientas que antes estaban repartidas entre el panel de
// Marketing y el panel clásico. Los dos ven exactamente las mismas.
const PANEL_HERRAMIENTAS = [
  { i:'📦', n:'Materiales',        r:'manual-vendedores/admin-materiales.html' },
  { i:'➕', n:'Nuevo material',     r:'manual-vendedores/admin-material-nuevo.html' },
  { i:'🍾', n:'Catálogo',          r:'manual-vendedores/admin-catalogo.html' },
  { i:'📣', n:'Campañas y planes', r:'manual-vendedores/admin-campanias.html' },
  { i:'🧱', n:'Secciones del manual', r:'manual-vendedores/admin-secciones.html' },
  { i:'📋', n:'Checklists',        r:'manual-vendedores/admin.html?tab=checklists' },
  { i:'🤝', n:'Compromisos',       r:'manual-vendedores/admin.html?tab=compromisos' },
  { i:'📍', n:'Visitas',           r:'manual-vendedores/admin.html?tab=visitas' },
  { i:'⬆️', n:'Importar clientes', r:'manual-vendedores/admin-importar.html' },
];

const PANEL_VISTAS = [
  { k:'mapa',         i:'🗺️', n:'Mapa de pantallas' },
  { k:'pedidos',      i:'🎨', n:'Pedidos de diseño' },
  { k:'piezas',       i:'🖼️', n:'Biblioteca de piezas' },
  { k:'usuarios',     i:'👤', n:'Usuarios y roles' },
  { k:'herramientas', i:'🧩', n:'Herramientas del Hub' },
  { k:'estado',       i:'📡', n:'Estado del sistema' },
];

function montarPanel(cfg) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const otro = cfg.area === 'Diseño'
    ? { n:'Panel de Desarrollo', r:'panel-desarrollo.html', i:'🧑‍💻' }
    : { n:'Panel de Diseño',     r:'panel-diseno.html',     i:'🎨' };

  document.getElementById('panel').innerHTML = `
  <div class="app">
    <aside class="sidebar">
      <div class="sb-logo">Grand<b>Bar</b></div>
      <div class="sb-sub">Distribuciones</div>
      <div class="sb-rol">${esc(cfg.area)} · ${esc(cfg.persona)}</div>
      <div class="sb-sub" style="padding-bottom:2px">${esc(cfg.mail)}</div>
      <nav class="sb-nav">
        ${PANEL_VISTAS.map((v, k) => `<button class="sb-item${k === 0 ? ' on' : ''}" data-v="${v.k}"><span class="i">${v.i}</span> ${v.n}</button>`).join('')}
      </nav>
      <div class="sb-rol">Herramientas</div>
      <nav class="sb-nav">
        ${PANEL_HERRAMIENTAS.map(h => `<a class="sb-item" href="${esc(h.r)}"><span class="i">${h.i}</span> ${esc(h.n)}</a>`).join('')}
      </nav>
      <div class="sb-spacer"></div>
      <a class="sb-item" href="${otro.r}"><span class="i">${otro.i}</span> ${otro.n}</a>
      <a class="sb-item" href="hub.html"><span class="i">←</span> Volver al Hub</a>
      <div class="sb-pie">Los paneles de Diseño y Desarrollo tienen exactamente lo mismo: cambia el nombre, nada más.</div>
    </aside>

    <main class="main">
      <div class="head">
        <div>
          <h1>Panel de ${esc(cfg.area)}</h1>
          <div class="head-sub">Todo el sistema desde un solo lugar: cualquier pantalla de cualquier perfil, sin cambiar de cuenta ni buscar la dirección.</div>
        </div>
      </div>

      <div class="vista on" id="v-mapa">
        <div class="buscador">
          <span class="lupa">🔎</span>
          <input id="q" type="text" placeholder="Buscar pantalla, área o persona… (ej: supervisor, catálogo, Luciana)">
        </div>
        <div id="mapa"></div>
      </div>

      <div class="vista" id="v-pedidos">
        <div class="pd-tabs" id="pd-tabs"></div>
        <div id="pd-lista"><div class="pv-vacio">Cargando pedidos…</div></div>
      </div>

      <div class="vista" id="v-piezas">
        <div class="en-obra">
          <h3>Biblioteca de piezas</h3>
          <p>Las piezas terminadas ordenadas para que vendedores y Luciana las bajen solos, sin pedirlas cada vez.</p>
          <ul>
            <li>Placas y flyers por proveedor y por campaña.</li>
            <li>Plantillas editables y logos de cada bodega.</li>
            <li>Lo que suban acá aparece en las herramientas del vendedor.</li>
          </ul>
        </div>
        <div class="aviso"><span>📦</span><div>Ya existe el depósito de archivos que usa Materiales (el bucket <code>Activaciones</code>), así que las piezas pueden guardarse ahí mismo. Falta definir cómo ordenarlas: por proveedor, por campaña o por tipo de pieza.</div></div>
      </div>

      <div class="vista" id="v-usuarios">
        <div class="en-obra">
          <h3>Usuarios y roles</h3>
          <p>Dar de alta gente, cambiarle el rol y ver qué herramientas le quedan visibles en el Hub. Hoy eso se toca a mano en Supabase, en la tabla <code>usuarios</code>.</p>
          <ul>
            <li>Alta y baja de personas, sin entrar a Supabase.</li>
            <li>Cambiar el rol y ver en el momento qué tarjetas pasa a ver.</li>
            <li>Marcar quién es supervisor y de qué equipo.</li>
          </ul>
        </div>
        <div class="aviso"><span>🔑</span><div>Para leer y escribir la tabla de usuarios hace falta permiso de servicio: con la clave pública que usa el sitio, Supabase la bloquea. <b>Es lo primero que hay que resolver</b> antes de armar esta pantalla.</div></div>
      </div>

      <div class="vista" id="v-herramientas">
        <div id="tools"></div>
        <div class="aviso"><span>📝</span><div>Esta lista sale de <code>assets/apps.js</code>, que hoy es un archivo de código. Para poder prender, apagar y mover tarjetas desde acá hay que pasarla a una tabla. <b>Por ahora es solo lectura</b>: sirve para ver qué ve cada rol.</div></div>
      </div>

      <div class="vista" id="v-estado">
        <div class="en-obra">
          <h3>Estado del sistema</h3>
          <p>Qué se está usando de verdad y qué está fallando, sin abrir cada pantalla a mano.</p>
          <ul>
            <li>Visitas cargadas por día y por vendedor.</li>
            <li>Quién no entra hace más de una semana.</li>
            <li>Campañas vencidas que siguen publicadas.</li>
            <li>Secciones del manual sin ítems y clientes sin vendedor asignado.</li>
          </ul>
        </div>
      </div>
    </main>
  </div>`;

  // Navegación entre vistas
  document.querySelectorAll('.sb-item[data-v]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.sb-item[data-v]').forEach(x => x.classList.remove('on'));
      document.querySelectorAll('.vista').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.getElementById('v-' + b.dataset.v).classList.add('on');
    });
  });

  renderPantallas('mapa', '');
  pdCargar();
  document.getElementById('q').addEventListener('input', e => renderPantallas('mapa', e.target.value));

  // Herramientas del Hub: qué ve cada rol, leído de apps.js
  if (typeof APPS !== 'undefined') {
    const porArea = {};
    APPS.forEach(a => (porArea[a.area] = porArea[a.area] || []).push(a));
    document.getElementById('tools').innerHTML = Object.keys(AREAS).filter(k => porArea[k]).map(k => `
      <section class="pv-grupo">
        <div class="pv-grupo-h"><span class="pv-dot" style="background:#0d2238"></span><h2>${esc(AREAS[k])}</h2><span class="pv-n">${porArea[k].length}</span></div>
        <div class="pv-cards">
          ${porArea[k].map(a => `
            <a class="pv-card" href="${a.url === '#' ? 'javascript:void(0)' : esc(a.url)}">
              <div class="pv-card-n">${esc(a.icon || '')} ${esc(a.name)}
                <span class="pv-n" style="margin:0 0 0 6px;background:${a.status === 'live' ? 'var(--green-soft)' : 'var(--line-2)'};color:${a.status === 'live' ? 'var(--green)' : 'var(--muted)'}">${a.status === 'live' ? 'Activo' : 'Próximamente'}</span>
              </div>
              <div class="pv-card-nota">${esc(a.desc)}</div>
              <div class="pv-card-ruta">Lo ven: ${esc(a.roles.join(', '))}</div>
            </a>`).join('')}
        </div>
      </section>`).join('');
  }
}

/* ── Bandeja de pedidos de diseño ───────────────────────────────────────────
   Los pedidos los deja el manual cuando el vendedor toca "Pedir diseño".
   Viven en el proyecto del manual, en la tabla pedidos_diseno.            */
const PD_ESTADOS = [
  { k:'nuevo',     n:'Nuevos',    color:'#c0392b' },
  { k:'en_curso',  n:'En curso',  color:'#a9852a' },
  { k:'listo',     n:'Listos',    color:'#2f6f5e' },
  { k:'cancelado', n:'Cancelados',color:'#7a8891' },
];
const PD_TIPOS = { placa:'Placa', flyer:'Flyer', evento:'Diseño de evento', otro:'Otro' };

let PD = [], _pdFiltro = 'nuevo', _pdSb = null;

function pdSb() {
  if (!_pdSb) _pdSb = supabase.createClient(
    'https://fzaxwuuodseyyinveknn.supabase.co',
    'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk');
  return _pdSb;
}
const pdEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pdFecha = d => { if (!d) return '—'; const x = new Date(d);
  return String(x.getDate()).padStart(2,'0') + '/' + String(x.getMonth()+1).padStart(2,'0') + '/' + x.getFullYear(); };
// "hace 3 días" dice más que una fecha cuando lo que importa es cuánto lleva esperando.
function pdHace(d) {
  if (!d) return '';
  const dias = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return 'hace ' + dias + ' días';
}

async function pdCargar() {
  const cont = document.getElementById('pd-lista');
  if (!cont) return;
  try {
    const { data, error } = await pdSb().from('pedidos_diseno').select('*').order('created_at', { ascending:false });
    if (error) throw error;
    PD = data || [];
  } catch (e) {
    const falta = /does not exist|schema cache/i.test(e.message || '');
    document.getElementById('pd-tabs').innerHTML = '';
    cont.innerHTML = falta
      ? `<div class="aviso"><span>🗄️</span><div>Todavía no está creada la tabla <code>pedidos_diseno</code>.
           Corré <code>manual-vendedores/pedidos-diseno-setup.sql</code> en Supabase → proyecto del manual
           (<code>fzaxwuuodseyyinveknn</code>) → SQL Editor, y recargá esta pantalla.</div></div>`
      : `<div class="aviso"><span>⚠️</span><div>No pude leer los pedidos: ${pdEsc(e.message || e)}</div></div>`;
    return;
  }
  pdRender();
}

function pdRender() {
  const cuenta = k => PD.filter(p => (p.estado || 'nuevo') === k).length;
  document.getElementById('pd-tabs').innerHTML =
    PD_ESTADOS.map(e => `<button class="pd-tab ${_pdFiltro === e.k ? 'on' : ''}" onclick="pdFiltrar('${e.k}')">
      <span class="pd-dot" style="background:${e.color}"></span>${e.n} <span class="pv-n">${cuenta(e.k)}</span></button>`).join('') +
    `<button class="pd-tab ${_pdFiltro === 'todos' ? 'on' : ''}" onclick="pdFiltrar('todos')">Todos <span class="pv-n">${PD.length}</span></button>`;

  const lista = _pdFiltro === 'todos' ? PD : PD.filter(p => (p.estado || 'nuevo') === _pdFiltro);
  const cont = document.getElementById('pd-lista');
  if (!lista.length) {
    cont.innerHTML = `<div class="pv-vacio">${_pdFiltro === 'nuevo'
      ? 'No hay pedidos nuevos. Cuando un vendedor pida diseño desde el manual, aparece acá.'
      : 'No hay pedidos en este estado.'}</div>`;
    return;
  }

  cont.innerHTML = lista.map(p => {
    const est = PD_ESTADOS.find(e => e.k === (p.estado || 'nuevo')) || PD_ESTADOS[0];
    const wa = p.cliente_whatsapp
      ? `<a class="pd-b" href="https://wa.me/${pdEsc(String(p.cliente_whatsapp).replace(/\D/g,''))}" target="_blank" rel="noopener">💬 WhatsApp del cliente</a>` : '';
    const pieza = p.pieza_url
      ? `<a class="pd-b" href="${pdEsc(p.pieza_url)}" target="_blank" rel="noopener">🖼️ Ver pieza</a>` : '';
    return `<article class="pd-card">
      <div class="pd-top">
        <span class="pd-est" style="background:${est.color}1a;color:${est.color}">${est.n.replace(/s$/,'')}</span>
        <span class="pd-tipo">${pdEsc(PD_TIPOS[p.tipo] || p.tipo || 'Otro')}</span>
        <span class="pd-cuando">${pdEsc(pdHace(p.created_at))} · ${pdEsc(pdFecha(p.created_at))}</span>
      </div>
      <div class="pd-cliente">${pdEsc(p.cliente_nombre || 'Sin cliente')}</div>
      <div class="pd-quien">Lo pidió ${pdEsc(p.vendedor_nombre || '—')}${p.vendedor_codigo ? ' · ' + pdEsc(p.vendedor_codigo) : ''}${p.fecha_necesita ? ' · lo necesita para el ' + pdEsc(pdFecha(p.fecha_necesita)) : ''}</div>
      ${p.detalle ? `<div class="pd-detalle">${pdEsc(p.detalle)}</div>` : ''}
      ${p.nota ? `<div class="pd-detalle" style="color:var(--muted)">${pdEsc(p.nota)}</div>` : ''}
      ${p.respuesta ? `<div class="pd-detalle" style="color:var(--green)">↳ ${pdEsc(p.respuesta)}</div>` : ''}
      <div class="pd-acts">
        ${p.estado !== 'en_curso' && p.estado !== 'listo' ? `<button class="pd-b" onclick="pdEstado('${p.id}','en_curso')">▶️ Tomarlo</button>` : ''}
        ${p.estado !== 'listo' ? `<button class="pd-b ok" onclick="pdEstado('${p.id}','listo')">✅ Marcar listo</button>` : ''}
        ${p.estado === 'listo' ? `<button class="pd-b" onclick="pdEstado('${p.id}','en_curso')">↩️ Reabrir</button>` : ''}
        <button class="pd-b" onclick="pdAdjuntar('${p.id}')">🔗 Adjuntar pieza</button>
        <button class="pd-b" onclick="pdResponder('${p.id}')">💬 Responder</button>
        ${wa}${pieza}
        ${p.estado !== 'cancelado' ? `<button class="pd-b danger" onclick="pdEstado('${p.id}','cancelado')">✕ Cancelar</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

function pdFiltrar(k) { _pdFiltro = k; pdRender(); }

async function pdGuardar(id, campos) {
  const { error } = await pdSb().from('pedidos_diseno').update(campos).eq('id', id);
  if (error) { alert('No pude guardar: ' + error.message); return false; }
  const p = PD.find(x => x.id === id);
  if (p) Object.assign(p, campos);
  pdRender();
  return true;
}
function pdEstado(id, estado) {
  const campos = { estado };
  if (estado === 'listo') campos.entregado_en = new Date().toISOString();
  pdGuardar(id, campos);
}
function pdAdjuntar(id) {
  const p = PD.find(x => x.id === id) || {};
  const url = prompt('Link de la pieza terminada (Drive, Canva, etc.):', p.pieza_url || '');
  if (url === null) return;
  pdGuardar(id, { pieza_url: url.trim() || null });
}
function pdResponder(id) {
  const p = PD.find(x => x.id === id) || {};
  const txt = prompt('Respuesta para el vendedor:', p.respuesta || '');
  if (txt === null) return;
  pdGuardar(id, { respuesta: txt.trim() || null });
}
