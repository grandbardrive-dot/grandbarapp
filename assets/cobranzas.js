/* ===========================================================
   GrandBar — sección Cobranzas del Portal
   -----------------------------------------------------------
   Las 7 opciones del sistema de cuenta corriente, adentro del
   Portal. Los datos los sirve la function cobranzas-panel, que
   lee del lado del servidor y verifica quién pregunta.

   Uso: <div id="cob"></div> + montarCobranzas()
   =========================================================== */
const COB_API = '/.netlify/functions/cobranzas-panel';

// Secciones que son de Brenda (administración): no se le muestran a tesorería (Mónica).
// Mónica ve: Tablero, Revisión (extra), Clientes, Supervisión, Cobros en efectivo y Planillas.
const COB_SOLO_ADMIN = ['administracion', 'admin', 'direccion', 'duenio', 'desarrollo', 'diseno'];
const COB_SECCIONES = [
  { id:'clientes',     ico:'👥', n:'Clientes',            d:'Buscá un cliente y mirá su cuenta corriente, facturas y datos.', color:'#e0567f' },
  { id:'comprobantes', ico:'🧾', n:'Supervisión de cobranzas', d:'Cómo vienen los comprobantes que suben los clientes: dónde se frenan y cuánto tardan.', color:'#69a531' },
  { id:'whatsapp',     ico:'📲', n:'WhatsApp',            d:'Lo que responden los clientes y cómo llegaron los avisos. Es de lectura.', color:'#e0533c', roles:COB_SOLO_ADMIN },
  { id:'estadisticas', ico:'📊', n:'Estadísticas',        d:'Cartera, cobranzas y comparativas del período.',                 color:'#2f6db0', roles:COB_SOLO_ADMIN },
  { id:'bloquear',     ico:'🔒', n:'Bloquear cuentas',    d:'Clientes que superaron su límite: bloqueá o dá de alta.',        color:'#d6a52b', roles:COB_SOLO_ADMIN },
  // conZona: también la ve tesorería con zona (Romina, San Luis: sus reclamos, 19/10/2026).
  { id:'reclamos',     ico:'💬', n:'Reclamos',            d:'Reclamos de clientes, con chat y número de seguimiento.',        color:'#7b5cd6', roles:COB_SOLO_ADMIN, conZona:true },
  { id:'efectivo',     ico:'💵', n:'Cobros en efectivo',  d:'Clientes que avisaron que tienen el efectivo listo para retirar.', color:'#2d8a4f' },
  { id:'planillas',    ico:'📋', n:'Planillas de rendición', d:'Las rendiciones de cobranzas que te envían los vendedores, por día.', color:'#b5802b' },
  { id:'tareas',       ico:'✅', n:'Tareas del equipo',   d:'Qué tiene que hacer cada una del equipo y qué quedó hecho.',      color:'#3b6fa0', roles:COB_SOLO_ADMIN },
];

let COB_TOKEN = null, COB_RESUMEN = {}, COB_VISTA = 'tablero';

const cq   = id => document.getElementById(id);
const cesc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const cnum = n => (n == null || n === '') ? '—' : '$ ' + Math.round(Number(n)).toLocaleString('es-AR');
// Ojo con las fechas "sueltas" (2026-08-31, sin hora): new Date() las lee como
// medianoche en Greenwich, y acá estamos tres horas atrás, así que se mostraban
// un día antes. Un vencimiento corrido un día en un panel de deuda no es un
// detalle. Las fechas con hora sí se pasan a hora local, que es lo correcto.
const cfec = d => {
  if (!d) return '—';
  const s = String(d), sola = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const x = sola ? new Date(+sola[1], +sola[2] - 1, +sola[3]) : new Date(s);
  if (isNaN(x)) return '—';
  return String(x.getDate()).padStart(2,'0') + '/' + String(x.getMonth()+1).padStart(2,'0') + '/' + x.getFullYear();
};
const choy = () => { const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const cerror = m => `<div class="aviso"><span>⚠️</span><div>${cesc(m)}</div></div>`;

async function cobApi(qs, opts) {
  const r = await fetch(COB_API + (qs || ''), {
    ...opts,
    headers: { Authorization: 'Bearer ' + COB_TOKEN, 'Content-Type': 'application/json', ...((opts||{}).headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
  return d;
}

// ── Tablero ────────────────────────────────────────────────
function cobChip(id) {
  const r = COB_RESUMEN;
  if (id === 'clientes')     return r.cuentas ? { t: Number(r.cuentas).toLocaleString('es-AR') + ' cuentas', c:'' } : null;
  if (id === 'comprobantes') return r.compPend ? { t: r.compPend + ' sin confirmar', c:'alerta' } : { t:'Al día', c:'ok' };
  if (id === 'bloquear')     return r.aBloquear ? { t: r.aBloquear + ' para revisar', c:'alerta' } : { t:'Sin pendientes', c:'ok' };
  if (id === 'reclamos')     return r.reclAbiertos ? { t: r.reclAbiertos + ' abierto' + (r.reclAbiertos>1?'s':''), c:'alerta' } : { t:'Sin abiertos', c:'ok' };
  if (id === 'efectivo')     return r.cobrosPend ? { t: r.cobrosPend + ' para retirar', c:'alerta' } : { t:'Sin pendientes', c:'ok' };
  if (id === 'estadisticas') return { t:'Ver resumen', c:'' };
  if (id === 'whatsapp')     return { t:'Ver la bandeja', c:'' };
  if (id === 'tareas')       return { t:'Ver el día', c:'' };
  return null;
}

function cobTablero() {
  COB_VISTA = 'tablero'; cobNav();
  if (window.COB_HASH && location.hash) history.replaceState(null, '', location.pathname);
  cq('cob').innerHTML = `
    <div class="head"><div>
      <h1>Cobranzas${COB_RESUMEN.zona ? ' · ' + cesc(COB_RESUMEN.zona) : ''}</h1>
      <div class="head-sub">${COB_RESUMEN.zona
        ? 'Cuenta corriente, comprobantes y reclamos de los clientes de ' + cesc(COB_RESUMEN.zona) + '.'
        : 'Cuenta corriente, comprobantes y reclamos' + (COB_SECCIONES.some(s => s.id === 'tareas' && cobVe(s)) ? ', más las tareas del equipo.' : '.')}</div>
    </div></div>
    <div class="cb-cards">
      ${cobEsTesoreria() ? (cobRevisionAdentro()
        ? `<button class="cb-card" style="border-top-color:#1f447f" onclick="cobAbrir('revision')">`
        : `<a class="cb-card" style="border-top-color:#1f447f;text-decoration:none;color:inherit" href="cobranzas-tesoreria.html">`) + `
          <div class="ico" style="background:#1f447f1a">💳</div>
          <h3>Revisión de cobranzas</h3><p>Pagos que ya pasó el vendedor: cruzarlos con el banco y aceptarlos o rechazarlos.</p>
          <span class="cb-chip">Abrir</span>${cobRevisionAdentro() ? '</button>' : '</a>'}` : ''}
      ${COB_SECCIONES.filter(cobVe).map(s => {
        const chip = cobChip(s.id);
        return `<button class="cb-card" style="border-top-color:${s.color}" onclick="cobAbrir('${s.id}')">
          <div class="ico" style="background:${s.color}1a">${s.ico}</div>
          <h3>${cesc(s.n)}</h3><p>${cesc(s.d)}</p>
          ${chip ? `<span class="cb-chip ${chip.c}">${cesc(chip.t)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;
}

// Tesorería trabaja en otra pantalla (Revisión de cobranzas: aceptar o rechazar
// pagos contra el banco). Se la ofrece desde acá para que no tenga que volver al Hub.
// Solo a tesorería: Dirección usa este mismo archivo dentro de su marco y no sale de él.
const cobEsTesoreria = () => String((COB_RESUMEN && COB_RESUMEN.rol) || '').toLowerCase() === 'tesoreria';

// Herramientas que la página suma al menú, además de las de cobranzas (06/10/2026):
// en panel-cobranzas.html, Agenda del equipo, Mi agenda y Mis reportes, que se abren
// adentro del panel. window.COB_EXTRA = [{ id, ico, n, abrir(), roles?, arriba? }]:
// `roles` = solo para esos roles; `arriba` = va pegada al Tablero (la Revisión de
// cobranzas de Mónica) y no en "Equipo y lo mío". Dirección no las usa.
const cobRol = () => String((COB_RESUMEN && COB_RESUMEN.rol) || '').toLowerCase();
// Qué secciones ve cada uno: las de su rol, y las marcadas conZona si su usuario tiene
// zona (Romina ve lo mismo que Mónica más Reclamos). Lo usan el menú, el tablero y el
// arranque por #seccion, así los tres muestran lo mismo.
const cobVe = s => !s.roles || s.roles.includes(cobRol()) || (!!s.conZona && !!(COB_RESUMEN && COB_RESUMEN.zona));
// ¿Esta persona tiene esa sección? Lo usan los botones que llevan a una sección desde
// otra (la ficha del cliente): si no la tiene en el menú, tampoco el atajo (19/10/2026).
const cobVeId = id => COB_SECCIONES.some(s => s.id === id && cobVe(s));
// Dirección (dir-cobranzas.html) mira sin operar: sin WhatsApp ni tildes en planillas.
const cobSoloLectura = () => !!window.COB_SOLO_LECTURA;
const cobExtra = () => (Array.isArray(window.COB_EXTRA) ? window.COB_EXTRA : [])
  .filter(s => !s.roles || s.roles.includes(cobRol()));
const cobRevisionAdentro = () => cobExtra().some(s => s.id === 'revision');

function cobNav() {
  const nav = cq('cob-nav'); if (!nav) return;
  const extra = cobExtra(), boton = s => `<button class="sb-item ${COB_VISTA===s.id?'on':''}" onclick="cobAbrir('${s.id}')"><span class="i">${s.ico}</span> ${cesc(s.n)}${s.id === 'efectivo' && _cobDotEfectivo ? ' <span class="cob-dot" title="Hay un cobro en efectivo nuevo"></span>' : ''}</button>`;
  const abajo = extra.filter(s => !s.arriba);
  nav.innerHTML = `<button class="sb-item ${COB_VISTA==='tablero'?'on':''}" onclick="cobTablero()"><span class="i">🏠</span> Tablero</button>` +
    (cobEsTesoreria() && !cobRevisionAdentro() ? `<a class="sb-item" href="cobranzas-tesoreria.html"><span class="i">💳</span> Revisión de cobranzas</a>` : '') +
    extra.filter(s => s.arriba).map(boton).join('') +
    COB_SECCIONES.filter(cobVe).map(boton).join('') +
    (abajo.length ? `<div class="sb-grupo">Equipo y lo mío</div>` + abajo.map(boton).join('') : '');
}

function cobAbrir(id) {
  COB_VISTA = id; cobNav();
  // Que la dirección diga en qué sección está (así un aviso o un enlace puede abrirla).
  if (window.COB_HASH) history.replaceState(null, '', id === 'tablero' ? location.pathname : '#' + id);
  const ex = cobExtra().find(s => s.id === id);
  if (ex) return ex.abrir();
  ({ clientes: cobClientes, bloquear: cobBloquear, efectivo: cobEfectivo,
     comprobantes: cobComprobantes, reclamos: cobReclamos, planillas: cobPlanillas,
     estadisticas: cobEstadisticas, whatsapp: cobWhatsapp,
     // eqTareas viene de equipo-admin.js, que el panel de Dirección (dir-cobranzas) no
     // carga: nombrarla directo tiraba un error y en ese panel no abría ninguna sección.
     tareas: window.eqTareas }[id] || cobTablero)();
}

const cobCabecera = (t, sub) => `
  <button class="cb-volver" onclick="cobTablero()">‹ Volver al tablero</button>
  <div class="head"><div><h1>${cesc(t)}</h1><div class="head-sub">${cesc(sub)}</div></div></div>`;

// ── 1 · Clientes ───────────────────────────────────────────
let _cPag = 0, _cQ = '', _cDeuda = false;
async function cobClientes(pag) {
  if (pag != null) _cPag = pag;
  cq('cob').innerHTML = cobCabecera('Clientes', 'Cuenta corriente de cada cliente.') +
    `<div class="buscador"><span class="lupa">🔎</span>
       <input id="c-q" type="text" placeholder="Buscar por código o nombre…" value="${cesc(_cQ)}"></div>
     <div class="cb-paginado" style="margin-top:10px">
       <button class="cb-b ${_cDeuda?'on':''}" onclick="_cDeuda=!_cDeuda;cobClientes(0)">${_cDeuda?'✓ ':''}Solo con deuda vencida</button>
     </div>
     <div id="c-lista"><div class="pv-vacio">Buscando…</div></div>`;
  const inp = cq('c-q');
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { _cQ = inp.value.trim(); cobClientes(0); } });
  try {
    const d = await cobApi('?que=clientes&pagina=' + _cPag + '&q=' + encodeURIComponent(_cQ) + (_cDeuda ? '&deuda=1' : ''));
    if (!d.filas.length) {
      cq('c-lista').innerHTML = `<div class="pv-vacio">${_cQ ? 'Ningún cliente coincide con “' + cesc(_cQ) + '”.' : 'No hay cuentas cargadas.'}</div>`;
      return;
    }
    const desde = d.pagina * d.porPagina + 1, hasta = Math.min(desde + d.filas.length - 1, d.total);
    cq('c-lista').innerHTML = `
      <table class="cb-tabla">
        <thead><tr><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Equipo</th><th class="num">Saldo</th><th class="num">Vencida</th><th></th></tr></thead>
        <tbody>${d.filas.map(c => `<tr>
          <td>${cesc(c.codigo || '—')}</td>
          <td><b>${cesc(c.nombre || '—')}</b></td>
          <td>${cesc(c.vendedor || '—')}</td>
          <td>${cesc(c.equipo || '—')}</td>
          <td class="num">${cnum(c.saldo)}</td>
          <td class="num ${Number(c.vencida) > 0 ? 'rojo' : ''}">${cnum(c.vencida)}</td>
          <td style="text-align:right"><button class="cb-b" onclick="cobFicha('${cesc(c.codigo)}')">Ver</button></td>
        </tr>`).join('')}</tbody>
      </table>
      <div class="cb-paginado">
        <button class="cb-b" onclick="cobClientes(${d.pagina-1})" ${d.pagina<=0?'disabled':''}>‹ Anteriores</button>
        <span style="font-size:12.5px;color:var(--muted)">${desde}–${hasta} de ${d.total.toLocaleString('es-AR')}</span>
        <button class="cb-b" onclick="cobClientes(${d.pagina+1})" ${hasta>=d.total?'disabled':''}>Siguientes ›</button>
      </div>`;
  } catch (e) { cq('c-lista').innerHTML = cerror(e.message); }
}

// Estados que puede tener un comprobante, en castellano.
const COB_REC_LBL = { abierto:'Abierto', en_curso:'En curso', resuelto:'Resuelto' };
const COMP_LBL = { pendiente:'Lo tiene el vendedor', procesado:'Lo tiene tesorería',
                   aceptado:'Aceptado', rechazado:'Rechazado', revisado:'Revisado' };
const cwa = t => String(t || '').replace(/\D/g, '');

async function cobFicha(codigo) {
  cq('cob').innerHTML = `<button class="cb-volver" onclick="cobClientes()">‹ Volver a clientes</button>
    <div id="f-cont"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=cliente&codigo=' + encodeURIComponent(codigo));
    if (!d.cuenta) { cq('f-cont').innerHTML = cerror('No encontré la cuenta ' + codigo + '.'); return; }
    const c = d.cuenta, f = d.ficha;
    const impagas = (d.facturas || []).filter(x => Number(x.saldo || 0) > 0);
    const hoy = choy();
    const tel = f && cwa(f.whatsapp);
    const bloqueado = f && f.estado === 'bloqueado';
    const cobrosPend = (d.cobros || []).filter(x => (x.estado || 'pendiente') === 'pendiente');

    cq('f-cont').innerHTML = `
      <div class="head"><div><h1>${cesc(c.nombre || c.codigo)}</h1>
        <div class="head-sub">Código ${cesc(c.codigo)}${c.vendedor ? ' · ' + cesc(c.vendedor) : ''}${c.equipo ? ' · ' + cesc(c.equipo) : ''}</div></div></div>

      <div class="pd-acts" style="margin-top:4px">
        ${tel && !cobSoloLectura() ? `<a class="cb-b ok" href="https://wa.me/${cesc(tel)}" target="_blank" rel="noopener">💬 Escribirle por WhatsApp</a>` : ''}
        ${f && cobVeId('bloquear') ? (bloqueado
          ? `<button class="cb-b ok" onclick="cobAccion('desbloquear','${f.id}',this,()=>cobFicha('${cesc(c.codigo)}'))">🔓 Dar de alta</button>`
          : `<button class="cb-b danger" onclick="cobAccion('bloquear','${f.id}',this,()=>cobFicha('${cesc(c.codigo)}'))">🔒 Bloquear la cuenta</button>`) : ''}
        ${!f && cobVeId('bloquear') ? `<span class="pd-cuando" style="margin:0">Sin ficha en el portal de clientes: no se puede bloquear ni escribirle desde acá.</span>` : ''}
      </div>

      <div class="cb-cards" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        <div class="cb-card" style="cursor:default"><h3>Saldo</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px">${cnum(c.saldo)}</div></div>
        <div class="cb-card" style="cursor:default;border-top-color:${Number(c.vencida)>0?'var(--red)':'var(--green)'}">
          <h3>Deuda vencida</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px" class="${Number(c.vencida)>0?'rojo':''}">${cnum(c.vencida)}</div></div>
        <div class="cb-card" style="cursor:default"><h3>Facturas impagas</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px">${impagas.length}</div>
          <p>de ${(d.facturas || []).length} en total</p></div>
        ${f ? `<div class="cb-card" style="cursor:default;border-top-color:${bloqueado ? 'var(--red)' : 'var(--green)'}">
          <h3>Estado de la cuenta</h3>
          <div style="font-size:20px;font-weight:800;margin-top:10px" class="${bloqueado ? 'rojo' : ''}">${bloqueado ? '🔒 Bloqueada' : '✅ Habilitada'}</div>
          <p>${cesc(f.comercio || f.nombre || '')}${f.whatsapp ? ' · ' + cesc(f.whatsapp) : ''}</p></div>` : ''}
      </div>

      ${cobrosPend.length ? `<div class="aviso"><span>💵</span><div>Avisó que tiene efectivo listo para retirar:
        <b>${cobrosPend.map(x => cnum(x.monto)).join(', ')}</b>. ${cobVeId('efectivo') ? 'Se gestiona en Cobros en efectivo.' : 'Lo gestiona Administración.'}</div></div>` : ''}

      <h2 style="font-size:16px;margin:26px 0 0">Facturas <span class="pv-n">${(d.facturas||[]).length}</span></h2>
      ${(d.facturas || []).length ? `
        <table class="cb-tabla">
          <thead><tr><th>Comprobante</th><th>Fecha</th><th>Vence</th><th class="num">Importe</th><th class="num">Saldo</th></tr></thead>
          <tbody>${d.facturas.map(x => {
            const vencida = Number(x.saldo || 0) > 0 && x.vencimiento && x.vencimiento < hoy;
            return `<tr>
              <td>${cesc((x.tipo || '') + ' ' + (x.numero || ''))}</td>
              <td>${cfec(x.fecha)}</td>
              <td class="${vencida ? 'rojo' : ''}">${cfec(x.vencimiento)}${vencida ? ' ⚠️' : ''}</td>
              <td class="num">${cnum(x.importe)}</td>
              <td class="num ${Number(x.saldo)>0?'rojo':''}">${cnum(x.saldo)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : `<div class="pv-vacio">Sin facturas cargadas para este cliente.</div>`}

      <h2 style="font-size:16px;margin:26px 0 0">Comprobantes que subió <span class="pv-n">${(d.comprobantes||[]).length}</span></h2>
      ${(d.comprobantes || []).length ? `
        <table class="cb-tabla">
          <thead><tr><th>Subió</th><th>Concepto</th><th class="num">Monto</th><th>Estado</th><th>Quién lo cerró</th><th></th></tr></thead>
          <tbody>${d.comprobantes.map(x => `<tr>
            <td>${cfec(x.created_at)}</td>
            <td>${cesc(x.concepto || (x.tipo === 'recibo' ? 'Recibo' : 'Pago'))}${x.factura ? `<div style="color:var(--muted);font-size:12px">factura ${cesc(x.factura)}</div>` : ''}</td>
            <td class="num">${cnum(x.monto)}</td>
            <td class="${x.estado === 'rechazado' ? 'rojo' : ''}">${cesc(COMP_LBL[x.estado] || x.estado || '—')}</td>
            <td>${cesc(x.revisado_por || '—')}</td>
            <td>${(Array.isArray(x.archivos) && x.archivos.length ? x.archivos : (x.archivo_url ? [x.archivo_url] : [])).map((u, i, a) => `<a class="cb-b" href="${cesc(u)}" target="_blank" rel="noopener" style="margin:1px">📎 ${a.length > 1 ? (i + 1) : 'Ver'}</a>`).join(' ')}</td>
          </tr>`).join('')}</tbody>
        </table>` : `<div class="pv-vacio">${f ? 'Este cliente no subió ningún comprobante.' : 'No tiene ficha en el portal de clientes, así que no puede subir comprobantes.'}</div>`}

      <h2 style="font-size:16px;margin:26px 0 0">Reclamos <span class="pv-n">${(d.reclamos||[]).length}</span></h2>
      ${(d.reclamos || []).length ? `
        <table class="cb-tabla">
          <thead><tr><th>Asunto</th><th>Factura</th><th>Estado</th><th>Última novedad</th>${cobVeId('reclamos') ? '<th></th>' : ''}</tr></thead>
          <tbody>${d.reclamos.map(x => `<tr>
            <td><b>${cesc(x.asunto || 'Reclamo')}</b></td>
            <td>${cesc(x.factura || '—')}</td>
            <td class="${x.estado === 'abierto' ? 'rojo' : ''}">${cesc(COB_REC_LBL[x.estado] || x.estado || '—')}</td>
            <td>${cfec(x.updated_at)}</td>
            ${cobVeId('reclamos') ? `<td><button class="cb-b" onclick="cobReclamo('${x.id}')">Abrir</button></td>` : ''}
          </tr>`).join('')}</tbody>
        </table>` : `<div class="pv-vacio">Sin reclamos.</div>`}`;
  } catch (e) { cq('f-cont').innerHTML = cerror(e.message); }
}

// ── 2 · Supervisión de cobranzas ───────────────────────────
// Aceptar o rechazar comprobantes lo opera tesorería (Mónica). Acá se supervisa el
// sector, así que no hay botones de acción: es una pantalla para mirar.
// El circuito tiene tres pasos: el cliente sube el comprobante, el vendedor lo
// confirma, y recién ahí tesorería lo cruza con el banco. Cada tramo se mide por
// separado, y se muestra en cuál de los dos quedó frenado cada uno.
let _supDias = 30;
const _horas = h => h == null ? '—' : h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' días';
const _dias  = d => d === 0 ? 'hoy' : d + ' día' + (d > 1 ? 's' : '');

async function cobComprobantes(dias) {
  if (dias) _supDias = dias;
  cq('cob').innerHTML = cobCabecera('Supervisión de cobranzas', 'Cómo viene la revisión de los comprobantes que suben los clientes.') +
    `<div class="cb-paginado">
       ${[7,30,90].map(d => `<button class="cb-b ${_supDias===d?'on':''}" onclick="cobComprobantes(${d})">${d} días</button>`).join('')}
     </div>
     <div id="sup-cont"><div class="pv-vacio">Calculando…</div></div>`;
  try {
    const d = await cobApi('?que=supervision&dias=' + _supDias);
    const ESTADO_LBL = { pendiente:'Lo tiene el vendedor', procesado:'Lo tiene tesorería', aceptado:'Aceptado', rechazado:'Rechazado' };

    cq('sup-cont').innerHTML = `
      <div class="cb-cards" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        <div class="cb-card" style="cursor:default"><h3>Entraron</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px">${d.total.toLocaleString('es-AR')}</div>
          <p>en los últimos ${d.dias} días</p></div>
        <div class="cb-card" style="cursor:default;border-top-color:${d.esperandoVendedor ? 'var(--red)' : 'var(--green)'}">
          <h3>Frenados en el vendedor</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px" class="${d.esperandoVendedor?'rojo':''}">${d.esperandoVendedor}</div>
          <p>el cliente los subió y todavía nadie los confirmó</p></div>
        <div class="cb-card" style="cursor:default;border-top-color:${d.esperandoTesoreria ? 'var(--gold)' : 'var(--green)'}">
          <h3>Esperando a tesorería</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px">${d.esperandoTesoreria}</div>
          <p>ya pasados, falta cruzarlos con el banco</p></div>
        <div class="cb-card" style="cursor:default"><h3>Tarda el vendedor</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px">${_horas(d.horasVendedor)}</div>
          <p>desde que el cliente lo sube hasta que lo confirma</p></div>
        <div class="cb-card" style="cursor:default"><h3>Tarda tesorería</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px">${_horas(d.horasTesoreria)}</div>
          <p>desde que el vendedor lo pasa hasta que se cierra</p></div>
      </div>
      ${d.cerradosSinRegistro ? `<p style="font-size:12.5px;color:var(--muted);margin:12px 0 0">
        De los ${d.cerrados} cerrados en el período, ${d.cerradosSinRegistro} son de antes de que se
        empezara a guardar quién los revisó, así que no entran en el promedio de tesorería.</p>` : ''}

      <h2 style="font-size:16px;margin:26px 0 0">En qué estado están</h2>
      ${d.porEstado.length ? `<table class="cb-tabla">
        <thead><tr><th>Estado</th><th class="num">Cantidad</th><th class="num">Monto</th></tr></thead>
        <tbody>${d.porEstado.map(e => `<tr>
          <td><b>${cesc(ESTADO_LBL[e.estado] || e.estado)}</b></td>
          <td class="num">${e.cantidad}</td>
          <td class="num">${cnum(e.monto)}</td></tr>`).join('')}</tbody></table>`
        : `<div class="pv-vacio">No entró ningún comprobante en este período.</div>`}

      <h2 style="font-size:16px;margin:26px 0 0">Los que están trabados</h2>
      ${d.trabados.length ? `<table class="cb-tabla">
        <thead><tr><th>Entró</th><th>Cliente</th><th>Lo tiene</th><th class="num">Monto</th><th class="num">Esperando</th></tr></thead>
        <tbody>${d.trabados.map(c => `<tr>
          <td>${cfec(c.created_at)}</td>
          <td>${cesc(c.cliente || '—')}</td>
          <td>${c.esperaA === 'tesoreria' ? 'Tesorería' : 'El vendedor'}</td>
          <td class="num">${cnum(c.monto)}</td>
          <td class="num ${c.dias >= 3 ? 'rojo' : ''}">${_dias(c.dias)}</td>
        </tr>`).join('')}</tbody></table>`
        : `<div class="pv-vacio">No quedó ninguno trabado. Al día.</div>`}

      <h2 style="font-size:16px;margin:26px 0 0">Quién los cerró en tesorería</h2>
      <p style="font-size:12.5px;color:var(--muted);margin:4px 0 0">
        El cruce con el banco: aceptar o rechazar. El tiempo se cuenta desde que el
        vendedor lo pasó.</p>
      ${d.revisores.length ? `<table class="cb-tabla">
        <thead><tr><th>Persona</th><th class="num">Cerrados</th><th class="num">Aceptados</th><th class="num">Rechazados</th><th class="num">Monto</th><th class="num">Tardó</th></tr></thead>
        <tbody>${d.revisores.map(v => `<tr>
          <td><b>${cesc(v.quien)}</b></td>
          <td class="num">${v.cantidad}</td>
          <td class="num">${v.aceptados}</td>
          <td class="num ${v.rechazados ? 'rojo' : ''}">${v.rechazados}</td>
          <td class="num">${cnum(v.monto)}</td>
          <td class="num">${_horas(v.horas)}</td></tr>`).join('')}</tbody></table>`
        : `<div class="pv-vacio">Todavía no se cerró ninguno con registro de quién lo revisó.</div>`}

      <h2 style="font-size:16px;margin:26px 0 0">Qué vendedor los confirmó</h2>
      <p style="font-size:12.5px;color:var(--muted);margin:4px 0 0">
        El paso previo: cuando el cliente le avisa al vendedor que pagó.</p>
      ${d.vendedores.length ? `<table class="cb-tabla">
        <thead><tr><th>Vendedor</th><th class="num">Confirmados</th><th class="num">Monto</th><th class="num">Tardó</th></tr></thead>
        <tbody>${d.vendedores.map(v => `<tr>
          <td><b>${cesc(v.nombre || 'Sin identificar')}</b>${v.codigo ? ` <span style="color:var(--muted);font-weight:600">${cesc(v.codigo)}</span>` : ''}</td>
          <td class="num">${v.cantidad}</td>
          <td class="num">${cnum(v.monto)}</td>
          <td class="num">${_horas(v.horas)}</td></tr>`).join('')}</tbody></table>`
        : `<div class="pv-vacio">Ningún vendedor confirmó comprobantes en este período.</div>`}`;
  } catch (e) { cq('sup-cont').innerHTML = cerror(e.message); }
}

// ── 3 · WhatsApp — bandeja estilo WhatsApp Web ──────────────
// Respuestas de los clientes + estado de envíos (lee wa_eventos vía cobranzas-panel).
// Regla de Meta: solo se puede responder con TEXTO libre dentro de las 24 hs del
// último mensaje del cliente; pasado ese plazo, solo con plantilla aprobada.
let _waConvs = [], _waSel = -1, _waFiltro = 'todas', _waBusca = '';
const WA_24H = 24 * 60; // minutos

function waFecha(v) {
  if (!v) return ''; const d = new Date(v); if (isNaN(d)) return '';
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function waEstado(e) { return ({ sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Falló' }[e] || e || ''); }

// Ventana de 24 hs desde el último mensaje ENTRANTE del cliente.
function waVentana(c) {
  const ins = (c.mensajes || []).filter(m => m.dir === 'in' && m.fecha);
  if (!ins.length) return { sinEntrantes: true, abierta: false, cerrada: false, porCerrar: false, mins: 0 };
  const ult = ins.reduce((a, b) => (a.fecha > b.fecha ? a : b)).fecha;
  const mins = Math.floor(WA_24H - (Date.now() - new Date(ult).getTime()) / 60000);
  return { ultimoIn: ult, mins, abierta: mins > 0, porCerrar: mins > 0 && mins <= 180, cerrada: mins <= 0, sinEntrantes: false };
}
function waRestTxt(m) { if (m <= 0) return 'cerrada'; const h = Math.floor(m / 60), mm = m % 60; return h ? `${h} h ${mm} min` : `${mm} min`; }
// La última de la conversación la escribió el cliente → falta responder.
function waSinResponder(c) { const m = c.mensajes || []; return !!(m.length && m[m.length - 1].dir === 'in'); }
function waIniciales(s) { const t = String(s || '').trim(); if (!t) return '#'; const p = t.split(/\s+/); return ((p[0][0] || '') + (p[1] ? p[1][0] : '')).toUpperCase(); }
function waBuscaOk(c) { if (!_waBusca) return true; const q = _waBusca.toLowerCase(); return (String(c.cliente || '') + ' ' + String(c.telefono || '') + ' ' + String(c.codigo || '')).toLowerCase().includes(q); }
function waPasaFiltro(c) {
  const v = waVentana(c), sr = waSinResponder(c);
  if (_waFiltro === 'sin') return sr && !v.cerrada;
  if (_waFiltro === 'pcerr') return sr && v.porCerrar;
  if (_waFiltro === 'cerr') return sr && v.cerrada;
  return true;
}

async function cobWhatsapp() {
  cobEscucharCambios(); _cobUltimo = Date.now();
  cq('cob').innerHTML = cobCabecera('WhatsApp', 'Bandeja de cobranzas — respuestas de los clientes y estado de los envíos.')
    + `<div id="wa-root"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=whatsapp');
    _waConvs = d.conversaciones || [];
    _waSel = -1;
    waRender();
  } catch (e) { const r = cq('wa-root'); if (r) r.innerHTML = cerror(e.message); }
}

function waContadores() {
  const total = _waConvs.length;
  const sin = _waConvs.filter(c => waSinResponder(c) && !waVentana(c).cerrada).length;
  const pcerr = _waConvs.filter(c => waSinResponder(c) && waVentana(c).porCerrar).length;
  const cerr = _waConvs.filter(c => waSinResponder(c) && waVentana(c).cerrada).length;
  return {
    stats: `
      <div class="wa-stat"><div class="n">${total}</div><div class="l">Conversaciones</div></div>
      <div class="wa-stat verde"><div class="n">${sin}</div><div class="l">Sin responder</div></div>
      <div class="wa-stat ambar"><div class="n">${pcerr}</div><div class="l">Ventana por cerrar</div></div>
      <div class="wa-stat rojo"><div class="n">${cerr}</div><div class="l">Ya no podés responder</div></div>`,
    filtros: `
      <button class="wa-chip ${_waFiltro === 'todas' ? 'on' : ''}" onclick="waSetFiltro('todas')">Todas <b>${total}</b></button>
      <button class="wa-chip ${_waFiltro === 'sin' ? 'on' : ''}" onclick="waSetFiltro('sin')">Sin responder <b>${sin}</b></button>
      <button class="wa-chip ${_waFiltro === 'pcerr' ? 'on' : ''}" onclick="waSetFiltro('pcerr')">Por cerrar <b>${pcerr}</b></button>
      <button class="wa-chip ${_waFiltro === 'cerr' ? 'on' : ''}" onclick="waSetFiltro('cerr')">Cerradas <b>${cerr}</b></button>`,
  };
}

function waRender() {
  const root = cq('wa-root'); if (!root) return;
  const k = waContadores();
  root.innerHTML = `
    <div class="wa-nota">📋 <b>Cómo funciona:</b> WhatsApp (Meta) solo te deja responder con <b>texto libre dentro de las 24 hs</b> del último mensaje del cliente. Pasado ese plazo la ventana se <b>cierra</b> y solo se puede escribir con una <b>plantilla aprobada</b>. Atendé primero lo marcado en <b style="color:var(--gold-d)">ámbar</b> (por cerrar) para que no pase a <b style="color:var(--red)">rojo</b>. Los mensajes nuevos aparecen solos, sin recargar la página.</div>
    <div class="wa-stats" id="wa-stats">${k.stats}</div>
    <div class="wa-app" id="wa-app">
      <div class="wa-side">
        <div class="wa-side-top">
          <input class="wa-search" id="wa-q" placeholder="Buscar cliente, teléfono o código…" value="${cesc(_waBusca)}" oninput="waBuscar(this.value)">
          <div class="wa-filtros" id="wa-filtros">${k.filtros}</div>
        </div>
        <div class="wa-list" id="wa-list"></div>
      </div>
      <div class="wa-chat" id="wa-chat"></div>
    </div>`;
  waLista(); waChatPane();
  if (_waSel >= 0) { const app = document.getElementById('wa-app'); if (app) app.classList.add('abierto'); }
}

// ── Actualización automática ────────────────────────────────
// Los datos vienen de una function del servidor (el navegador no puede leer
// esas tablas). Para que un mensaje aparezca apenas llega:
//  · La base de Cobranzas manda un aviso sin datos ("hubo un cambio") por un
//    canal de Realtime cada vez que entra un WhatsApp o un mensaje de reclamo
//    (triggers de db/avisos-realtime.sql). Al recibirlo se vuelven a pedir los
//    datos a la function, con el mismo control de usuario y rol de siempre.
//  · Respaldo: si el canal no está conectado, se consulta cada COB_REFRESCO ms;
//    con el canal conectado, cada COB_REFRESCO_RT ms por las dudas.
// Solo se repinta lo que cambió y sin tocar lo que Brenda está escribiendo
// (buscador, respuesta a medio escribir). Con la pestaña oculta no se consulta.
const COB_REFRESCO = 10000, COB_REFRESCO_RT = 60000;
const COB_RT_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const COB_RT_KEY = 'sb_publishable_FDuwwvOjBCAGOi1IoUHRKQ_UAD6IQaM'; // clave pública del proyecto de Cobranzas
let _cobRefrescando = false, _cobPendiente = false, _cobUltimo = 0, _cobRT = false, _cobCanal = null, _cobAvisoT = null;
// Aviso de cobro en efectivo nuevo: puntito rojo en el menú + sonido.
let _cobrosPendVistos = null, _cobDotEfectivo = false;

// Puntito rojo pulsante (se inyecta una sola vez).
(function () {
  if (typeof document === 'undefined' || document.getElementById('cob-dot-css')) return;
  const st = document.createElement('style'); st.id = 'cob-dot-css';
  st.textContent = '.cob-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e23b3b;margin-left:6px;vertical-align:middle;animation:cobDotPulse 1.3s infinite}@keyframes cobDotPulse{0%{box-shadow:0 0 0 0 rgba(226,59,59,.55)}70%{box-shadow:0 0 0 7px rgba(226,59,59,0)}100%{box-shadow:0 0 0 0 rgba(226,59,59,0)}}';
  document.head.appendChild(st);
})();

// Campanita (ding-dong) con Web Audio, sin archivo.
function cobBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    const ctx = new Ctx(); if (ctx.resume) ctx.resume();
    const tono = (f, t0, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
      o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.02);
    };
    tono(880, 0, 0.5); tono(1175, 0.18, 0.55);
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1000);
  } catch (_) {}
}

// Al llegar un aviso, mirar si hay un cobro en efectivo NUEVO (subió el pendiente).
async function cobChequearCobros() {
  try {
    const d = await cobApi('?que=resumen');
    const n = Number(d.cobrosPend || 0);
    if (_cobrosPendVistos != null && n > _cobrosPendVistos && cobVeId('efectivo')) {
      cobBeep();
      if (COB_VISTA !== 'efectivo') { _cobDotEfectivo = true; cobNav(); }
    }
    _cobrosPendVistos = n;
    COB_RESUMEN.cobrosPend = n;
  } catch (_) {}
}

function cobEscucharCambios() {
  if (_cobCanal || !window.supabase || !window.supabase.createClient) return;
  try {
    const sb = window.supabase.createClient(COB_RT_URL, COB_RT_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'gb-cobranzas-avisos' },
    });
    _cobCanal = sb.channel('cobranzas-avisos')
      .on('broadcast', { event: 'cambio' }, () => {
        // Varios avisos seguidos (ej. mensaje + su registro) → un solo pedido.
        clearTimeout(_cobAvisoT);
        _cobAvisoT = setTimeout(() => cobRefrescar(true), 400);
        // ¿Entró un cobro en efectivo nuevo? (sonido + puntito, mire donde mire).
        cobChequearCobros();
      })
      .subscribe(estado => { _cobRT = estado === 'SUBSCRIBED'; });
  } catch (e) { _cobCanal = null; }
}
const waFirma = c => [c.telefono, (c.mensajes || []).length, c.ultimaFecha, c.ultimoEstado, c.error].join('|');

async function waRefrescar() {
  if (!cq('wa-root') || !cq('wa-list')) return;
  const d = await cobApi('?que=whatsapp');
  const nuevas = d.conversaciones || [];
  const selTel = _waSel >= 0 && _waConvs[_waSel] ? _waConvs[_waSel].telefono : null;
  const antesSel = selTel ? waFirma(_waConvs[_waSel]) : null;
  const cambio = nuevas.length !== _waConvs.length || nuevas.some((c, i) => !_waConvs[i] || waFirma(c) !== waFirma(_waConvs[i]));
  _waConvs = nuevas;
  _waSel = selTel ? _waConvs.findIndex(c => c.telefono === selTel) : -1;
  // Los contadores de la ventana de 24 hs cambian con el tiempo aunque no lleguen mensajes.
  const k = waContadores();
  if (cq('wa-stats')) cq('wa-stats').innerHTML = k.stats;
  if (cq('wa-filtros')) cq('wa-filtros').innerHTML = k.filtros;
  waLista();
  const ahoraSel = _waSel >= 0 ? waFirma(_waConvs[_waSel]) : null;
  if (cambio && ahoraSel !== antesSel) waChatPane();
}

async function cobRefrescar(porAviso) {
  if (document.hidden || !COB_TOKEN) return;
  if (COB_VISTA !== 'whatsapp' && COB_VISTA !== 'reclamos' && COB_VISTA !== 'efectivo') return;
  // Si ya hay un pedido en curso y llega un aviso, se repite al terminar
  // (así no se pierde un mensaje que entró mientras se cargaba).
  if (_cobRefrescando) { if (porAviso) _cobPendiente = true; return; }
  _cobRefrescando = true; _cobUltimo = Date.now();
  try {
    if (COB_VISTA === 'whatsapp') await waRefrescar();
    else if (COB_VISTA === 'efectivo') await cobEfectivoRefrescar();
    else await recRefrescar();
  } catch (e) { /* si falla un refresco, se reintenta en el próximo */ }
  finally {
    _cobRefrescando = false;
    if (_cobPendiente) { _cobPendiente = false; cobRefrescar(true); }
  }
}
setInterval(() => {
  if (Date.now() - _cobUltimo >= (_cobRT ? COB_REFRESCO_RT : COB_REFRESCO)) cobRefrescar();
}, 2000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) cobRefrescar(); });

function waLista() {
  const box = document.getElementById('wa-list'); if (!box) return;
  const items = _waConvs.map((c, i) => ({ c, i })).filter(o => waBuscaOk(o.c) && waPasaFiltro(o.c));
  if (!items.length) { box.innerHTML = `<div class="pv-vacio" style="padding:26px 14px">No hay conversaciones${(_waFiltro !== 'todas' || _waBusca) ? ' con ese filtro' : ''}.</div>`; return; }
  box.innerHTML = items.map(({ c, i }) => {
    const v = waVentana(c), sr = waSinResponder(c), nom = c.cliente || c.telefono;
    const m = c.mensajes || []; const ultimo = m.length ? m[m.length - 1] : null;
    const preIco = ultimo && ultimo.dir === 'out' ? '✓ ' : '';
    const prev = ultimo ? (ultimo.texto || '') : (c.entrantes ? (c.ultimoTexto || '') : '— sin respuesta —');
    let pill = '';
    if (sr && v.cerrada) pill = `<span class="wa-pill cerr">🔒 cerrada</span>`;
    else if (sr && v.porCerrar) pill = `<span class="wa-pill pcerr">⏳ ${waRestTxt(v.mins)}</span>`;
    else if (sr) pill = `<span class="wa-pill nuevo">responder</span>`;
    return `<div class="wa-conv ${i === _waSel ? 'sel' : ''}" onclick="waAbrir(${i})">
      <div class="wa-av">${cesc(waIniciales(nom))}</div>
      <div class="wa-cm">
        <div class="wa-cm-top"><span class="wa-cm-nom">${cesc(nom)}</span><span class="wa-cm-hora">${waFecha(c.ultimaFecha)}</span></div>
        <div class="wa-cm-bot"><span class="wa-cm-prev">${cesc(preIco + prev)}</span>${pill}</div>
      </div>
    </div>`;
  }).join('');
}

function waBurbujas(msgs) {
  if (!msgs.length) return `<div class="wa-empty"><div>Este cliente todavía no respondió. Acá van a aparecer sus mensajes.</div></div>`;
  let out = '', dia = '';
  _waContactos = [];
  for (const m of msgs) {
    const d = m.fecha ? new Date(m.fecha) : null;
    const diaTxt = d && !isNaN(d) ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
    if (diaTxt && diaTxt !== dia) { dia = diaTxt; out += `<div class="wa-day">${diaTxt}</div>`; }
    const hora = d && !isNaN(d) ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
    let media = '';
    if (m.media && (m.media.id || m.media.url)) {
      const mm = m.media;
      const st = 'margin-top:7px;display:inline-flex;align-items:center;gap:6px;background:#1f8a4c;color:#fff;border:none;border-radius:9px;padding:7px 12px;font-size:12.5px;font-weight:700;cursor:pointer;text-decoration:none';
      if (mm.tipo === 'audio') {
        media = mm.url
          ? `<audio controls preload="none" style="margin-top:7px;max-width:250px;display:block" src="${cesc(mm.url)}"></audio>`
          : `<button type="button" class="wa-media-btn" style="${st}" onclick="waVerAudio('${mm.id}',this)">🎤 Escuchar audio</button>`;
      } else {
        const label = mm.tipo === 'image' ? '🖼️ Ver imagen' : '📄 Ver comprobante';
        media = mm.url
          ? `<a class="wa-media-btn" style="${st}" href="${cesc(mm.url)}" target="_blank" rel="noopener">${label}</a>`
          : `<button type="button" class="wa-media-btn" style="${st}" onclick="waVerMedia('${mm.id}','${encodeURIComponent(mm.filename || 'comprobante')}',this)">${label}</button>`;
      }
    }
    if (m.ubicacion) {
      const u = m.ubicacion, q = encodeURIComponent(u.lat + ',' + u.lng);
      media += `${u.direccion ? `<div style="font-size:12.5px;color:#54656f;margin-top:3px">${cesc(u.direccion)}</div>` : ''}<a class="wa-media-btn" style="margin-top:7px;display:inline-flex;align-items:center;gap:6px;background:#1f8a4c;color:#fff;border:none;border-radius:9px;padding:7px 12px;font-size:12.5px;font-weight:700;text-decoration:none" href="https://www.google.com/maps?q=${q}" target="_blank" rel="noopener">📍 Ver en el mapa</a>`;
    }
    const cuerpo = m.contactos && m.contactos.length ? m.contactos.map(waTarjetaContacto).join('') : cesc(m.texto || '');
    out += `<div class="wa-msg ${m.dir === 'in' ? 'in' : 'out'}">${cuerpo}${media}<div class="h">${hora}</div></div>`;
  }
  return out;
}

// Contacto que compartió el cliente (21/10/2026): tarjeta con nombre y número para
// escribirle, copiar el número o guardarlo (.vcf). Si el número ya es de un cliente, lo dice.
let _waContactos = [];
function waTarjetaContacto(k, n) {
  const i = _waContactos.push(k) - 1;
  const tels = k.telefonos || [];
  const nom = k.nombre || (tels[0] && tels[0].numero) || 'Contacto';
  const b = 'display:inline-flex;align-items:center;background:#fff;color:#1f8a4c;border:1px solid #1f8a4c;border-radius:8px;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none';
  const filas = tels.map((t, j) => `<div style="margin-top:8px">`
    + `<div style="font-size:13.5px;font-weight:600">${cesc(t.numero || '')}${t.tipo ? ` <span style="color:#667781;font-size:11px;font-weight:400">${cesc(t.tipo)}</span>` : ''}</div>`
    + (t.cliente ? `<div style="font-size:11.5px;color:#667781">Es cliente: ${cesc(t.cliente.nombre || '')} · Cód. ${cesc(t.cliente.codigo)}</div>` : '')
    + `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px">`
    + (t.wa ? `<a style="${b}" href="https://wa.me/${cesc(t.wa)}" target="_blank" rel="noopener">Escribirle por WhatsApp</a>` : '')
    + `<button type="button" style="${b}" onclick="waCopiarNumero(${i},${j},this)">Copiar número</button></div></div>`).join('');
  return `<div style="white-space:normal;min-width:220px${n ? ';border-top:1px solid #e9edef;margin-top:8px;padding-top:8px' : ''}">`
    + `<div style="display:flex;align-items:center;gap:9px"><div class="wa-av" style="width:34px;height:34px;font-size:13px;background:var(--navy,#1F447F)">${cesc(waIniciales(nom))}</div>`
    + `<div style="min-width:0"><div style="font-weight:700">${cesc(nom)}</div><div style="font-size:11.5px;color:#667781">${k.empresa ? cesc(k.empresa) + ' · ' : ''}Contacto compartido</div></div></div>`
    + (filas || `<div style="font-size:12.5px;color:#667781;margin-top:6px">El contacto vino sin número.</div>`)
    + ((k.emails || []).length ? `<div style="font-size:12.5px;margin-top:6px">${k.emails.map(cesc).join(' · ')}</div>` : '')
    + (k.vcard ? `<button type="button" style="${b};margin-top:8px" onclick="waGuardarContacto(${i})">Guardar contacto</button>` : '')
    + `</div>`;
}
function waCopiarNumero(i, j, btn) {
  const t = ((_waContactos[i] || {}).telefonos || [])[j]; if (!t) return;
  const num = t.numero || t.wa || '';
  const listo = () => { if (btn) { btn.textContent = 'Copiado'; setTimeout(() => { btn.textContent = 'Copiar número'; }, 1500); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(num).then(listo, () => prompt('Copiá el número:', num));
  else prompt('Copiá el número:', num);
}
function waGuardarContacto(i) {
  const k = _waContactos[i]; if (!k || !k.vcard) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([k.vcard], { type: 'text/vcard' }));
  a.download = String(k.nombre || 'contacto').replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.vcf';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Audio viejo (sin URL guardada): lo baja con wa-media y lo reproduce ahí mismo.
async function waVerAudio(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }
  try {
    const r = await fetch('https://grandbar-gestioncuenta.netlify.app/.netlify/functions/wa-media?id=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + COB_TOKEN } });
    if (!r.ok) { let m = 'No se pudo cargar el audio.'; try { const j = await r.json(); if (j && j.error) m = j.error; } catch (_) {} alert(m); if (btn) { btn.disabled = false; btn.textContent = '🎤 Escuchar audio'; } return; }
    const blob = await r.blob();
    const audio = document.createElement('audio');
    audio.controls = true; audio.src = URL.createObjectURL(blob);
    audio.style.cssText = 'margin-top:7px;max-width:250px;display:block';
    if (btn) btn.replaceWith(audio);
    audio.play().catch(() => {});
  } catch (e) { alert('Error al cargar el audio: ' + (e.message || e)); if (btn) { btn.disabled = false; btn.textContent = '🎤 Escuchar audio'; } }
}

// Baja el archivo que mandó el cliente (imagen/comprobante) con la sesión del Hub
// y lo abre. El binario viaja por wa-media (que lo pide a WhatsApp con el token).
async function waVerMedia(id, filenameEnc, btn) {
  const filename = decodeURIComponent(filenameEnc || 'comprobante');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Bajando…'; }
  try {
    const r = await fetch('https://grandbar-gestioncuenta.netlify.app/.netlify/functions/wa-media?id=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + COB_TOKEN } });
    if (!r.ok) {
      let msg = 'No se pudo abrir el archivo.';
      try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (_) {}
      alert(msg);
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) { const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    alert('Error al abrir el archivo: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

function waChatPane() {
  const pane = document.getElementById('wa-chat'); if (!pane) return;
  if (_waSel < 0 || !_waConvs[_waSel]) {
    pane.dataset.tel = '';
    pane.innerHTML = `<div class="wa-empty"><div class="ico">💬</div><div>Elegí una conversación de la izquierda para ver el chat y responder.</div></div>`;
    return;
  }
  const c = _waConvs[_waSel], v = waVentana(c);
  let vent;
  if (v.sinEntrantes) vent = `<div class="wa-vent pcerr">Este cliente todavía no te escribió. Solo podés iniciarle la conversación con una plantilla aprobada.</div>`;
  else if (v.cerrada) vent = `<div class="wa-vent cerr">🔒 Ventana cerrada — pasaron más de 24 hs desde el último mensaje del cliente. Meta no permite responder por texto; solo con una plantilla aprobada.</div>`;
  else if (v.porCerrar) vent = `<div class="wa-vent pcerr">⏳ La ventana cierra en ${waRestTxt(v.mins)}. Respondé ahora lo que tengas pendiente.</div>`;
  else vent = `<div class="wa-vent abi">✓ Ventana abierta — podés responder libremente por ${waRestTxt(v.mins)} más.</div>`;
  const puede = v.abierta;
  // Si se repinta la misma conversación (por el refresco automático), conservar
  // la respuesta que se estaba escribiendo y el foco.
  const taPrevio = document.getElementById('wa-resp');
  const borrador = taPrevio && pane.dataset.tel === String(c.telefono) ? { v: taPrevio.value, foco: document.activeElement === taPrevio, a: taPrevio.selectionStart, b: taPrevio.selectionEnd } : null;
  pane.dataset.tel = String(c.telefono);
  pane.innerHTML = `
    <div class="wa-chat-head">
      <button class="wa-back" onclick="waCerrar()">‹</button>
      <div class="wa-av">${cesc(waIniciales(c.cliente || c.telefono))}</div>
      <div style="min-width:0"><div class="nom">${cesc(c.cliente || c.telefono)}</div>
        <div class="sub">${cesc(c.telefono || '')}${c.codigo ? ' · Cód. ' + cesc(c.codigo) : ''} · Último envío: ${c.error ? '<span style="color:var(--red)">falló</span>' : (cesc(waEstado(c.ultimoEstado)) || '—')}</div></div>
    </div>
    ${vent}
    <div class="wa-body" id="wa-body">${waBurbujas(c.mensajes || [])}</div>
    <div id="wa-err" class="wa-vent cerr" style="display:none"></div>
    <div class="wa-compose">
      ${puede
        ? `<input type="file" id="wa-file" accept="image/*,application/pdf" style="display:none" onchange="cobWaEnviarArchivo(${_waSel}, this)">
           <button class="wa-send" id="wa-adj" title="Enviar una foto o un archivo" style="background:#eceff3;color:#334" onclick="document.getElementById('wa-file').click()">📎</button>
           <textarea class="wa-ta" id="wa-resp" rows="1" placeholder="Escribí tu respuesta…" oninput="waAutoGrow(this)"></textarea>
           <button class="wa-send" id="wa-send" title="Enviar" onclick="cobWaResponder(${_waSel})">➤</button>`
        : `<button id="wa-reabrir" type="button" style="flex:1;background:var(--blue,#1f447f);color:#fff;border:none;border-radius:10px;padding:12px 14px;font-size:14px;font-weight:700;cursor:pointer" onclick="cobWaReabrir(${_waSel})">${v.sinEntrantes ? '📨 Iniciar conversación' : '📨 Reabrir conversación'}</button>`}
    </div>`;
  const body = document.getElementById('wa-body'); if (body) body.scrollTop = body.scrollHeight;
  const ta = document.getElementById('wa-resp');
  if (borrador && ta && !ta.disabled) {
    ta.value = borrador.v; waAutoGrow(ta);
    if (borrador.foco) { ta.focus(); try { ta.setSelectionRange(borrador.a, borrador.b); } catch (_) {} }
  }
}

function waAbrir(i) { _waSel = i; const app = document.getElementById('wa-app'); if (app) app.classList.add('abierto'); waLista(); waChatPane(); }
function waCerrar() { _waSel = -1; const app = document.getElementById('wa-app'); if (app) app.classList.remove('abierto'); waLista(); waChatPane(); }
function waSetFiltro(f) { _waFiltro = f; waRender(); }
function waBuscar(v) { _waBusca = v; waLista(); }
function waAutoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }

async function cobWaResponder(i) {
  const c = _waConvs[i]; if (!c) return;
  const ta = document.getElementById('wa-resp'), err = document.getElementById('wa-err'), send = document.getElementById('wa-send');
  const texto = (ta && ta.value || '').trim(); if (!texto) { if (ta) ta.focus(); return; }
  const aviso = (t) => { if (err) { err.textContent = t; err.style.display = t ? 'block' : 'none'; } };
  aviso(''); if (send) send.disabled = true;
  try {
    const r = await fetch('https://grandbar-gestioncuenta.netlify.app/.netlify/functions/wa-responder', {
      method: 'POST', headers: { Authorization: 'Bearer ' + COB_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: c.telefono, texto }),
    });
    const j = await r.json();
    if (!j.ok) {
      const fuera = /24|reengag|window|outside/i.test(j.error || '');
      aviso('No se pudo enviar: ' + (j.error || 'error') + (fuera ? ' — pasaron más de 24 hs; ahí solo se puede con una plantilla aprobada.' : ''));
      if (send) send.disabled = false;
      return;
    }
    c.mensajes.push({ dir: 'out', texto, fecha: new Date().toISOString() });
    c.ultimaFecha = new Date().toISOString(); c.ultimoEstado = 'sent';
    if (ta) ta.value = ''; // ya se mandó: que el repintado no lo recupere como borrador
    waChatPane(); waLista();
  } catch (e) { aviso('Error de conexión: ' + (e.message || e)); if (send) send.disabled = false; }
}

// Enviar una FOTO o un ARCHIVO (PDF) al cliente. Solo dentro de la ventana de 24 hs,
// igual que el texto. Se sube al servidor y de ahí sale por WhatsApp.
async function cobWaEnviarArchivo(i, input) {
  const c = _waConvs[i]; const file = input && input.files && input.files[0];
  if (!c || !file) return;
  const err = document.getElementById('wa-err'), adj = document.getElementById('wa-adj');
  const aviso = (t, ok) => { if (err) { err.textContent = t; err.style.display = t ? 'block' : 'none'; err.className = 'wa-vent ' + (ok ? 'abi' : 'cerr'); } };
  aviso('');
  if (file.size > 5 * 1024 * 1024) { aviso('El archivo es muy grande (máx 5 MB). Mandá una versión más liviana.'); input.value = ''; return; }
  const esImg = /^image\//.test(file.type);
  if (!esImg && file.type !== 'application/pdf') { aviso('Por ahora solo se pueden enviar fotos (JPG/PNG) o PDF.'); input.value = ''; return; }
  const caption = (() => { const ta = document.getElementById('wa-resp'); return ta ? (ta.value || '').trim() : ''; })();
  if (!confirm('Enviar ' + (esImg ? 'la foto' : 'el archivo') + ' "' + file.name + '" a ' + (c.cliente || c.telefono) + (caption ? '\n\nCon el texto: "' + caption + '"' : '') + '?')) { input.value = ''; return; }
  if (adj) { adj.disabled = true; adj.textContent = '⏳'; }
  try {
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).replace(/^data:[^,]*,/, '')); fr.onerror = rej; fr.readAsDataURL(file); });
    const r = await fetch('https://grandbar-gestioncuenta.netlify.app/.netlify/functions/wa-responder-media', {
      method: 'POST', headers: { Authorization: 'Bearer ' + COB_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: c.telefono, file_base64: b64, mime: file.type, filename: file.name, caption }),
    });
    const j = await r.json();
    if (!j.ok) {
      const fuera = /24|reengag|window|outside/i.test(j.error || '');
      aviso('No se pudo enviar: ' + (j.error || 'error') + (fuera ? ' — pasaron más de 24 hs; ahí solo se puede con una plantilla aprobada.' : ''));
      if (adj) { adj.disabled = false; adj.textContent = '📎'; }
      input.value = ''; return;
    }
    c.mensajes.push({ dir: 'out', texto: caption || (esImg ? '📷 Foto enviada' : '📎 ' + file.name), fecha: new Date().toISOString(), media: { tipo: esImg ? 'image' : 'document', url: j.url, mime: file.type, filename: file.name } });
    c.ultimaFecha = new Date().toISOString(); c.ultimoEstado = 'sent';
    const ta = document.getElementById('wa-resp'); if (ta) ta.value = '';
    waChatPane(); waLista();
  } catch (e) { aviso('Error de conexión: ' + (e.message || e)); if (adj) { adj.disabled = false; adj.textContent = '📎'; } }
  input.value = '';
}

// Reabrir una conversación cerrada (+24 hs): manda una PLANTILLA aprobada. Cuando el
// cliente responde, la ventana se reabre y se puede escribir libremente.
async function cobWaReabrir(i) {
  const c = _waConvs[i]; if (!c) return;
  const nom = c.cliente || c.telefono;
  if (!confirm('Le vamos a mandar a ' + nom + ' un mensaje de contacto (plantilla aprobada) para reabrir la conversación.\n\nCuando el cliente responda, vas a poder escribirle libremente.\n\n¿Enviar?')) return;
  const err = document.getElementById('wa-err'), btn = document.getElementById('wa-reabrir');
  const aviso = (t, ok) => { if (err) { err.textContent = t; err.style.display = t ? 'block' : 'none'; err.className = 'wa-vent ' + (ok ? 'abi' : 'cerr'); } };
  aviso(''); if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try {
    const r = await fetch('https://grandbar-gestioncuenta.netlify.app/.netlify/functions/wa-responder-plantilla', {
      method: 'POST', headers: { Authorization: 'Bearer ' + COB_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: c.telefono, nombre: c.cliente || 'Cliente' }),
    });
    const j = await r.json();
    if (!j.ok) {
      const noAprob = /template|plantilla|does not exist|not approved|param/i.test(j.error || '');
      aviso('No se pudo enviar: ' + (j.error || 'error') + (noAprob ? ' — puede ser que la plantilla "reabrir_cuenta" todavía no esté aprobada por Meta.' : ''));
      if (btn) { btn.disabled = false; btn.textContent = '📨 Reabrir conversación'; }
      return;
    }
    c.mensajes.push({ dir: 'out', texto: '📨 Mensaje de contacto enviado para reabrir la conversación', fecha: new Date().toISOString() });
    c.ultimaFecha = new Date().toISOString(); c.ultimoEstado = 'sent';
    waChatPane(); waLista();
    aviso('✓ Mensaje enviado. Cuando el cliente responda, vas a poder escribirle libremente.', true);
  } catch (e) { aviso('Error de conexión: ' + (e.message || e)); if (btn) { btn.disabled = false; btn.textContent = '📨 Reabrir conversación'; } }
}

// ── 4 · Estadísticas ───────────────────────────────────────
async function cobEstadisticas() {
  cq('cob').innerHTML = cobCabecera('Estadísticas', 'Cartera y deuda vencida de toda la cuenta corriente.') +
    `<div id="e-cont"><div class="pv-vacio">Calculando…</div></div>`;
  try {
    const d = await cobApi('?que=estadisticas');
    const tabla = (titulo, filas, campo) => `
      <h2 style="font-size:16px;margin:26px 0 0">${titulo}</h2>
      <table class="cb-tabla">
        <thead><tr><th>${campo}</th><th class="num">Cuentas</th><th class="num">Cartera</th><th class="num">Vencida</th><th class="num">% vencido</th></tr></thead>
        <tbody>${filas.map(f => `<tr>
          <td><b>${cesc(f[campo.toLowerCase()] || '—')}</b></td>
          <td class="num">${f.cuentas.toLocaleString('es-AR')}</td>
          <td class="num">${cnum(f.cartera)}</td>
          <td class="num ${f.vencida>0?'rojo':''}">${cnum(f.vencida)}</td>
          <td class="num">${f.cartera ? Math.round(f.vencida / f.cartera * 100) + '%' : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    cq('e-cont').innerHTML = `
      <div class="cb-cards" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">
        <div class="cb-card" style="cursor:default"><h3>Cuentas</h3><div style="font-size:26px;font-weight:800;margin-top:6px">${d.total.toLocaleString('es-AR')}</div></div>
        <div class="cb-card" style="cursor:default"><h3>Cartera</h3><div style="font-size:26px;font-weight:800;margin-top:6px">${cnum(d.cartera)}</div></div>
        <div class="cb-card" style="cursor:default;border-top-color:var(--red)"><h3>Deuda vencida</h3>
          <div style="font-size:26px;font-weight:800;margin-top:6px" class="rojo">${cnum(d.vencida)}</div>
          <p>${d.cartera ? Math.round(d.vencida / d.cartera * 100) + '% de la cartera' : ''}</p></div>
        <div class="cb-card" style="cursor:default"><h3>Con deuda vencida</h3><div style="font-size:26px;font-weight:800;margin-top:6px">${d.conVencida.toLocaleString('es-AR')}</div>
          <p>de ${d.total.toLocaleString('es-AR')} cuentas</p></div>
      </div>
      ${tabla('Por equipo', d.equipos, 'Equipo')}
      ${(d.sinEquipo && d.sinEquipo.total) ? `
        <div class="aviso" style="margin-top:14px"><span>🏷️</span><div>
          <b>${d.sinEquipo.total.toLocaleString('es-AR')} cuentas vienen sin equipo</b> en el Excel de CUBO
          (${cnum(d.sinEquipo.cartera)} de cartera, ${cnum(d.sinEquipo.vencida)} vencida). No es un equipo:
          es esa celda vacía en la planilla.
          ${d.sinEquipo.conSaldo ? `De esas, <b>${d.sinEquipo.conSaldo.toLocaleString('es-AR')} tienen saldo</b> y ${d.sinEquipo.enCero.toLocaleString('es-AR')} están en cero — las que están en cero suelen ser cuentas viejas.` : 'Todas están en cero: son cuentas viejas, no un problema de clasificación.'}
          Se arregla completando la columna
          <b>Equipo</b> antes de importarla.</div></div>

        <h2 style="font-size:16px;margin:22px 0 0">De quién son esas cuentas</h2>
        <p style="font-size:12.5px;color:var(--muted);margin:4px 0 0">
          ${d.sinEquipo.seDeduce ? `A <b>${d.sinEquipo.seDeduce.toLocaleString('es-AR')}</b> se les puede deducir el equipo, porque ese mismo vendedor sí lo tiene cargado en otras cuentas. ` : ''}
          ${d.sinEquipo.sinVendedor ? `<b>${d.sinEquipo.sinVendedor.toLocaleString('es-AR')}</b> no tienen ni vendedor: esas hay que asignarlas a mano.` : ''}</p>
        ${d.sinEquipo.vendedores.length ? `<table class="cb-tabla">
          <thead><tr><th>Vendedor</th><th>Debería ser</th><th class="num">Cuentas</th><th class="num">Cartera</th><th class="num">Vencida</th></tr></thead>
          <tbody>${d.sinEquipo.vendedores.map(v => `<tr>
            <td><b>${cesc(v.vendedor)}</b></td>
            <td>${v.equipo ? cesc(v.equipo) : '<span style="color:var(--muted)">no se puede deducir</span>'}</td>
            <td class="num">${v.cuentas.toLocaleString('es-AR')}</td>
            <td class="num">${cnum(v.cartera)}</td>
            <td class="num ${v.vencida>0?'rojo':''}">${cnum(v.vencida)}</td>
          </tr>`).join('')}</tbody></table>` : ''}` : ''}
      ${tabla('Por vendedor <span class="pv-n">los 20 con más vencido</span>', d.vendedores, 'Vendedor')}`;
  } catch (e) { cq('e-cont').innerHTML = cerror(e.message); }
}

// ── 5 · Bloquear cuentas ───────────────────────────────────
async function cobBloquear() {
  cq('cob').innerHTML = cobCabecera('Bloquear cuentas', 'Clientes que pasaron su tope de deuda vencida.') +
    `<div id="b-lista"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=bloquear');
    const fila = (c, bloqueado) => `<tr>
      <td><b>${cesc(c.comercio || c.nombre || '—')}</b>${c.cuit ? `<div style="color:var(--muted);font-size:12px">${cesc(c.cuit)}</div>` : ''}</td>
      <td class="num rojo">${cnum(c.deuda_vencida)}</td>
      <td class="num">${cnum(c.tope_deuda_vencida)}</td>
      <td class="num">${cnum(c.saldo_cc)}</td>
      <td style="text-align:right">${bloqueado
        ? `<button class="cb-b ok" onclick="cobAccion('desbloquear','${c.id}',this,cobBloquear)">Dar de alta</button>`
        : `<button class="cb-b danger" onclick="cobAccion('bloquear','${c.id}',this,cobBloquear)">🔒 Bloquear</button>`}</td></tr>`;
    const cabecera = `<thead><tr><th>Cliente</th><th class="num">Deuda vencida</th><th class="num">Tope</th><th class="num">Saldo</th><th></th></tr></thead>`;
    cq('b-lista').innerHTML =
      (d.filas.length
        ? `<table class="cb-tabla">${cabecera}<tbody>${d.filas.map(c => fila(c,false)).join('')}</tbody></table>`
        : `<div class="pv-vacio">Ningún cliente pasó su tope. Todo en orden.</div>`) +
      (d.bloqueados.length
        ? `<h2 style="font-size:16px;margin:28px 0 0">Bloqueados <span class="pv-n">${d.bloqueados.length}</span></h2>
           <table class="cb-tabla">${cabecera}<tbody>${d.bloqueados.map(c => fila(c,true)).join('')}</tbody></table>` : '');
  } catch (e) { cq('b-lista').innerHTML = cerror(e.message); }
}

// ── 6 · Reclamos ───────────────────────────────────────────

async function cobReclamos() {
  cobEscucharCambios(); _cobUltimo = Date.now();
  const zona = COB_RESUMEN.zona;
  cq('cob').innerHTML = cobCabecera('Reclamos', zona
      ? 'Reclamos de los clientes de ' + zona + '. Cuando entra uno o el cliente responde, te llega a la campanita.'
      : cobSoloLectura() ? 'Qué reclaman los clientes y cómo se están atendiendo. Tocá uno para ver la conversación.'
      : 'Reclamos de clientes, con su historial.') +
    // Con zona (Romina): el aviso también puede llegar al celular o la compu (19/10/2026).
    (zona ? `<div id="pushMount" style="display:none;align-items:center;gap:12px;background:#ece9f8;border:1px solid #d4cdf0;border-radius:13px;padding:12px 15px;margin:0 0 16px"></div>` : '') +
    `<div id="r-lista"><div class="pv-vacio">Cargando…</div></div>`;
  if (zona && window.pushMount) window.pushMount(cq('pushMount'));
  try { recPintarLista(await cobApi('?que=reclamos')); }
  catch (e) { cq('r-lista').innerHTML = cerror(e.message); }
}

function recPintarLista(d) {
  if (cobSoloLectura()) return recVisualLista(d);
  const box = cq('r-lista'); if (!box) return;
  const firma = JSON.stringify(d.filas.map(r => [r.id, r.estado, r.updated_at]));
  if (box.dataset.firma === firma) return; // nada nuevo: no repintar
  box.dataset.firma = firma;
  if (!d.filas.length) { box.innerHTML = `<div class="pv-vacio">No hay reclamos.</div>`; return; }
  box.innerHTML = d.filas.map(r => `<article class="hh">
      <div class="hh-top"><span class="hh-ico">💬</span>
        <div class="hh-nom">${cesc(r.asunto || 'Sin asunto')}</div>
        <span class="cb-chip ${r.estado === 'resuelto' ? 'ok' : 'alerta'}">${cesc(COB_REC_LBL[r.estado] || r.estado || 'abierto')}</span></div>
      <div class="hh-desc">${cesc((r.cliente && (r.cliente.comercio || r.cliente.nombre)) || 'Sin cliente')}${r.factura ? ' · factura ' + cesc(r.factura) : ''} · ${cfec(r.updated_at)}</div>
      <div class="pd-acts">
        <button class="cb-b" onclick="cobReclamo('${r.id}')">Ver conversación</button>
        ${r.estado !== 'resuelto' ? `<button class="cb-b ok" onclick="cobEstadoReclamo('${r.id}','resuelto',this)">✅ Marcar resuelto</button>` : ''}
        ${r.estado === 'abierto' ? `<button class="cb-b" onclick="cobEstadoReclamo('${r.id}','en_curso',this)">▶️ En curso</button>` : ''}
        ${r.estado === 'resuelto' ? `<button class="cb-b" onclick="cobEstadoReclamo('${r.id}','abierto',this)">↩️ Reabrir</button>` : ''}
      </div></article>`).join('');
}

async function cobReclamo(id) {
  cobEscucharCambios(); _cobUltimo = Date.now();
  cq('cob').innerHTML = `<button class="cb-volver" onclick="cobReclamos()">‹ Volver a reclamos</button>
    <div id="r-det" data-id="${cesc(id)}"><div class="pv-vacio">Cargando…</div></div>`;
  try { recPintarDetalle(await cobApi('?que=reclamos&id=' + encodeURIComponent(id))); }
  catch (e) { cq('r-det').innerHTML = cerror(e.message); }
}

// Refresco automático de Reclamos: la lista o la conversación abierta.
async function recRefrescar() {
  const det = cq('r-det');
  if (det && det.dataset.id) return recPintarDetalle(await cobApi('?que=reclamos&id=' + encodeURIComponent(det.dataset.id)));
  if (cq('r-lista')) return recPintarLista(await cobApi('?que=reclamos'));
}

function recPintarDetalle(d) {
  if (cobSoloLectura()) return recVisualDetalle(d);
  const box = cq('r-det'); if (!box) return;
  const r = d.reclamo;
  if (!r) { box.innerHTML = cerror('No encontré ese reclamo.'); return; }
  const firma = JSON.stringify([r.estado, r.updated_at, (d.mensajes || []).map(m => m.id || m.created_at)]);
  if (box.dataset.firma === firma) return; // nada nuevo: no repintar
  const primera = !box.dataset.firma;
  // Si Brenda estaba escribiendo una respuesta y llega un mensaje nuevo, no perderla.
  const taPrev = document.getElementById('r-resp');
  const borrador = taPrev ? taPrev.value : '';
  box.dataset.firma = firma;
  const est = r.estado || 'abierto';
  box.innerHTML = `
      <div class="head"><div><h1>${cesc(r.asunto || 'Reclamo')}</h1>
        <div class="head-sub">${cesc((r.cliente && (r.cliente.comercio || r.cliente.nombre)) || '')}${r.factura ? ' · factura ' + cesc(r.factura) : ''} · <b>${cesc(COB_REC_LBL[est] || est)}</b></div></div></div>
      ${(d.mensajes || []).length ? d.mensajes.map(m => `
        <article class="hh" style="margin-left:${m.autor === 'admin' ? '40px' : '0'}">
          <div class="hh-top"><span class="hh-ico">${m.autor === 'admin' ? '🏢' : '👤'}</span>
            <div class="hh-nom">${m.autor === 'admin' ? 'Nosotros' : 'El cliente'}</div>
            <span class="pd-cuando">${cfec(m.created_at)}</span></div>
          ${m.texto ? `<div class="pd-detalle">${cesc(m.texto)}</div>` : ''}
          ${m.archivo_url ? `<div class="pd-acts"><a class="cb-b" href="${cesc(m.archivo_url)}" target="_blank" rel="noopener">📎 Ver adjunto</a></div>` : ''}
        </article>`).join('') : `<div class="pv-vacio">Todavía no hay mensajes en este reclamo. Podés escribirle al cliente acá abajo.</div>`}
      <div id="r-err" class="aviso" style="display:none;background:#fde8e8;border-color:#f3b4b4"></div>
      <div class="rec-resp" style="margin-top:16px;border-top:1px solid var(--line,#e6e6e6);padding-top:14px">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px">✍️ Responderle al cliente</div>
        <textarea id="r-resp" rows="3" placeholder="Escribí tu respuesta… la va a ver en su portal, en este mismo reclamo." style="width:100%;box-sizing:border-box;border:1px solid var(--line,#ccc);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;resize:vertical"></textarea>
        <input type="file" id="r-file" accept="image/*,application/pdf" style="display:none" onchange="recAdjNombre(this)">
        <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
          <button class="cb-b" type="button" onclick="document.getElementById('r-file').click()">📎 Adjuntar</button>
          <span id="r-adj-nom" style="font-size:12px;color:var(--muted,#777)"></span>
          <span style="flex:1"></span>
          <button class="cb-b ok" id="r-send" type="button" onclick="recResponder('${r.id}')" style="padding:9px 18px;background:var(--green,#2f6f5e);border-color:var(--green,#2f6f5e);color:#fff">Enviar respuesta</button>
        </div>
      </div>
      <div class="pd-acts" style="margin-top:14px">
        ${est !== 'resuelto' ? `<button class="cb-b ok" onclick="cobEstadoReclamo('${r.id}','resuelto',this)">✅ Marcar resuelto</button>` : ''}
        ${est === 'abierto' ? `<button class="cb-b" onclick="cobEstadoReclamo('${r.id}','en_curso',this)">▶️ Marcar en curso</button>` : ''}
        ${est === 'resuelto' ? `<button class="cb-b" onclick="cobEstadoReclamo('${r.id}','abierto',this)">↩️ Reabrir</button>` : ''}
      </div>`;
  const ta = document.getElementById('r-resp'); if (ta && borrador) ta.value = borrador;
}

// ── Reclamos para Dirección (23/10/2026): solo mirar, bien visual ──────────────
// Fernando no opera: arriba los números grandes (sin resolver, resueltos, todos y
// cuánto tardan), que también filtran; cada reclamo es una tarjeta del color de su
// estado y, al tocarla, la conversación como un chat. Sin responder ni cambiar el
// estado: el servidor (cobranzas-panel) tampoco se lo deja a Dirección.
let _rvFiltro = 'abiertos', _rvFilas = [];
const recHoras = r => { const h = (new Date(r.updated_at || r.created_at) - new Date(r.created_at || r.updated_at)) / 36e5; return isFinite(h) && h >= 0 ? h : null; };
const recDice = h => h == null ? '—' : h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' días';
const recHace = f => recDice((Date.now() - new Date(f).getTime()) / 36e5);
const recCli = r => (r.cliente && (r.cliente.comercio || r.cliente.nombre)) || 'Sin cliente';
const recCuando = f => { const x = new Date(f); return isNaN(x) ? '' : x.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }); };
// Clases propias (rv-…): 'rojo' ya existe en cobranzas.css y pintaba todo el texto.
const REC_COLOR = { abierto: 'rv-rojo', en_curso: 'rv-ambar', resuelto: 'rv-verde' };

function recVisualLista(d) {
  const box = cq('r-lista'); if (!box) return;
  const filas = d.filas || [];
  const firma = JSON.stringify([_rvFiltro, filas.map(r => [r.id, r.estado, r.updated_at])]);
  if (box.dataset.firma === firma) return; // nada nuevo: no repintar
  box.dataset.firma = firma;
  _rvFilas = filas;
  if (!filas.length) { box.innerHTML = `<div class="pv-vacio">Todavía no hay reclamos de clientes.</div>`; return; }
  const sin = filas.filter(r => r.estado !== 'resuelto'), res = filas.filter(r => r.estado === 'resuelto');
  const dem = res.map(recHoras).filter(h => h != null);
  const prom = dem.length ? dem.reduce((a, b) => a + b, 0) / dem.length : null;
  const ver = _rvFiltro === 'abiertos' ? sin : _rvFiltro === 'resueltos' ? res : filas;
  const tile = (n, lbl, cls, f) => `<button type="button" class="rv-tile ${cls}${_rvFiltro === f ? ' on' : ''}" onclick="recFiltro('${f}')"><b>${n}</b><span>${lbl}</span></button>`;
  box.innerHTML = `
    <div class="rv-tiles">
      ${tile(sin.length, 'Sin resolver', sin.length ? 'rv-rojo' : 'rv-verde', 'abiertos')}
      ${tile(res.length, 'Resueltos', 'rv-verde', 'resueltos')}
      ${tile(filas.length, 'Todos', 'rv-neutro', 'todos')}
      <div class="rv-tile rv-neutro fijo"><b>${recDice(prom)}</b><span>Tardan en resolverse, en promedio</span></div>
    </div>
    ${ver.length ? `<div class="rv-lista">${ver.map(r => { const est = r.estado || 'abierto'; return `
      <button type="button" class="rv-card ${REC_COLOR[est] || 'rv-rojo'}" onclick="cobReclamo('${cesc(r.id)}')">
        <span class="rv-cli">${cesc(recCli(r))}</span>
        <span class="rv-asunto">${cesc(r.asunto || 'Sin asunto')}${r.factura ? ' · factura ' + cesc(r.factura) : ''}</span>
        <span class="rv-pie"><span class="rv-est">${cesc(COB_REC_LBL[est] || est)}</span>
          <span class="rv-cuando">${est === 'resuelto' ? 'Se resolvió en ' + recDice(recHoras(r)) : 'Abierto hace ' + recHace(r.created_at || r.updated_at)}</span>
          <span class="rv-ver">Ver conversación ›</span></span>
      </button>`; }).join('')}</div>`
    : `<div class="pv-vacio">${_rvFiltro === 'abiertos' ? 'No hay reclamos sin resolver: todo al día.' : 'No hay reclamos en esta lista.'}</div>`}`;
}
function recFiltro(f) { _rvFiltro = f; const box = cq('r-lista'); if (box) box.dataset.firma = ''; recVisualLista({ filas: _rvFilas }); }

function recVisualDetalle(d) {
  const box = cq('r-det'); if (!box) return;
  const r = d.reclamo;
  if (!r) { box.innerHTML = cerror('No encontré ese reclamo.'); return; }
  const msgs = d.mensajes || [];
  const firma = JSON.stringify([r.estado, r.updated_at, msgs.map(m => m.id || m.created_at)]);
  if (box.dataset.firma === firma) return; // nada nuevo: no repintar
  box.dataset.firma = firma;
  const est = r.estado || 'abierto';
  box.innerHTML = `
    <div class="rv-head ${REC_COLOR[est] || 'rv-rojo'}">
      <span class="rv-cli">${cesc(recCli(r))}</span>
      <span class="rv-asunto">${cesc(r.asunto || 'Reclamo')}${r.factura ? ' · factura ' + cesc(r.factura) : ''}</span>
      <span class="rv-pie"><span class="rv-est">${cesc(COB_REC_LBL[est] || est)}</span>
        <span class="rv-cuando">Lo abrió el ${cfec(r.created_at || r.updated_at)} · ${est === 'resuelto' ? 'se resolvió en ' + recDice(recHoras(r)) : 'hace ' + recHace(r.created_at || r.updated_at)}</span></span>
    </div>
    <div class="rv-chat">${msgs.length ? msgs.map(m => { const nos = m.autor === 'admin'; return `
      <div class="rv-msg ${nos ? 'nos' : 'cli'}">
        <div class="rv-quien">${nos ? 'GrandBar' : cesc(recCli(r))}</div>
        ${m.texto ? `<div class="rv-texto">${cesc(m.texto)}</div>` : ''}
        ${m.archivo_url ? `<a class="rv-adj" href="${cesc(m.archivo_url)}" target="_blank" rel="noopener">📎 Ver adjunto</a>` : ''}
        <div class="rv-hora">${recCuando(m.created_at)}</div>
      </div>`; }).join('') : `<div class="pv-vacio">Todavía no hay mensajes en este reclamo.</div>`}</div>
    <div class="rv-nota">Los reclamos los atiende Administración. Desde acá se miran.</div>`;
}

// Muestra el nombre del archivo elegido para adjuntar en la respuesta del reclamo.
function recAdjNombre(input) {
  const n = document.getElementById('r-adj-nom'); if (!n) return;
  n.textContent = input.files && input.files[0] ? ('📎 ' + input.files[0].name) : '';
}

// Enviar la respuesta al cliente: se guarda en el reclamo (lo ve en su portal).
async function recResponder(id) {
  const ta = document.getElementById('r-resp'), file = document.getElementById('r-file'), send = document.getElementById('r-send'), err = document.getElementById('r-err');
  const texto = (ta && ta.value || '').trim();
  const f = file && file.files && file.files[0];
  const aviso = (t) => { if (err) { err.textContent = t; err.style.display = t ? 'block' : 'none'; } };
  if (!texto && !f) { if (ta) ta.focus(); return; }
  if (f && f.size > 5 * 1024 * 1024) { aviso('El adjunto es muy grande (máx 5 MB).'); return; }
  aviso(''); if (send) { send.disabled = true; send.textContent = 'Enviando…'; }
  try {
    const payload = { accion: 'reclamo-responder', id, texto };
    if (f) {
      payload.archivo_base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).replace(/^data:[^,]*,/, '')); fr.onerror = rej; fr.readAsDataURL(f); });
      payload.archivo_mime = f.type; payload.archivo_nombre = f.name;
    }
    await cobApi('', { method: 'POST', body: JSON.stringify(payload) });
    const det = cq('r-det'); if (det) det.dataset.firma = ''; // forzar repintado con el mensaje nuevo
    recPintarDetalle(await cobApi('?que=reclamos&id=' + encodeURIComponent(id)));
  } catch (e) {
    aviso('No se pudo enviar: ' + (e.message || e));
    if (send) { send.disabled = false; send.textContent = 'Enviar respuesta'; }
  }
}

function cobEstadoReclamo(id, estado, btn) {
  cobAccion('reclamo-estado', id, btn, cobReclamos, { estado });
}

// ── 7 · Cobros en efectivo ─────────────────────────────────
async function cobEfectivo() {
  cobEscucharCambios(); _cobUltimo = Date.now();
  _cobDotEfectivo = false; cobNav(); // al abrir la sección, se apaga el puntito
  cq('cob').innerHTML = cobCabecera('Cobros en efectivo', 'Clientes que avisaron que tienen el efectivo listo. Se actualiza solo cuando avisa un cliente.') +
    `<div id="ef-lista"><div class="pv-vacio">Cargando…</div></div>`;
  try { cobEfectivoPintar(await cobApi('?que=efectivo')); }
  catch (e) { cq('ef-lista').innerHTML = cerror(e.message); }
}

function cobEfectivoPintar(d) {
  const box = cq('ef-lista'); if (!box) return;
  const filas = d.filas || [];
  // No repintar si nada cambió (evita parpadeos en el auto-refresco).
  const firma = JSON.stringify(filas.map(c => [c.id, c.estado, c.monto]));
  if (box.dataset.firma === firma) return;
  box.dataset.firma = firma;
  const pend = filas.filter(c => (c.estado || 'pendiente') === 'pendiente');
  const resto = filas.filter(c => (c.estado || 'pendiente') !== 'pendiente');
  _cobrosPendVistos = pend.length; // estando en la sección, ya los "vimos"
  const card = c => {
    let facturas = '';
    try { const f = typeof c.facturas === 'string' ? JSON.parse(c.facturas) : c.facturas;
      if (Array.isArray(f) && f.length) facturas = f.map(x => (x.tipo || '') + ' ' + (x.numero || '')).join(', ');
    } catch (e) {}
    return `<article class="hh">
      <div class="hh-top"><span class="hh-ico">💵</span>
        <div class="hh-nom">${cesc(c.cliente_nombre || c.codigo || 'Sin nombre')}</div>
        <span class="cb-chip ${c.estado === 'cobrado' ? 'ok' : c.estado === 'cancelado' ? '' : 'alerta'}">${cesc(c.estado || 'pendiente')}</span></div>
      <div class="hh-desc">${cesc(c.codigo || '')}${c.vendedor ? ' · ' + cesc(c.vendedor) : ''} · avisó el ${cfec(c.created_at)}</div>
      <div style="font-size:22px;font-weight:800;margin-top:8px">${cnum(c.monto)}</div>
      ${facturas ? `<div class="hh-desc">Facturas: ${cesc(facturas)}</div>` : ''}
      ${c.nota ? `<div class="pd-detalle">${cesc(c.nota)}</div>` : ''}
      <div class="pd-acts">
        ${c.telefono ? `<a class="cb-b" href="https://wa.me/${cesc(String(c.telefono).replace(/\D/g,''))}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
        ${(c.estado || 'pendiente') === 'pendiente' ? `
          <button class="cb-b ok" onclick="cobAccion('cobro-cobrado','${c.id}',this,cobEfectivo)">✅ Cobrado</button>
          <button class="cb-b danger" onclick="cobAccion('cobro-cancelado','${c.id}',this,cobEfectivo)">✕ Cancelar</button>` : ''}
      </div></article>`;
  };
  box.innerHTML =
    (pend.length ? pend.map(card).join('') : `<div class="pv-vacio">No hay cobros pendientes de retirar.</div>`) +
    (resto.length ? `<h2 style="font-size:16px;margin:28px 0 0">Ya resueltos <span class="pv-n">${resto.length}</span></h2>` + resto.map(card).join('') : '');
}

async function cobEfectivoRefrescar() {
  if (!cq('ef-lista')) return;
  cobEfectivoPintar(await cobApi('?que=efectivo'));
}

// ── Planillas de rendición (las que envían los vendedores) ─
async function cobPlanillas() {
  cq('cob').innerHTML = cobCabecera('Planillas de rendición', 'Las rendiciones de cobranzas que te envían los vendedores. Entrá a una para ver el detalle y los comprobantes.') +
    `<div id="pla-lista"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=planillas');
    const filas = d.filas || [];
    if (!filas.length) { cq('pla-lista').innerHTML = `<div class="pv-vacio">Todavía no te enviaron ninguna planilla.</div>`; return; }
    const lbl = { efectivo: 'Efectivo', cheques: 'Cheques', retenciones: 'Retenc.', transferencia: 'Transf/MP', tarjeta: 'Tarjeta', echeq: 'E-cheq' };
    const completa = e => (e.filas > 0 && (e.procesadas || 0) >= e.filas);   // todas procesadas
    const card = e => {
      const t = e.totales || {};
      const tot = Object.keys(lbl).filter(k => Number(t[k]) > 0).map(k => `${lbl[k]}: <b>${cnum(t[k])}</b>`).join(' · ');
      const ok = completa(e), col = ok ? '#1f8a4c' : '#d0402e';
      const chip = ok
        ? `<span class="cb-chip" style="background:#e7f1ea;color:#1f6b3d">✓ Procesada</span>`
        : `<span class="cb-chip" style="background:#fde8e6;color:#b23120">⏳ ${e.procesadas || 0}/${e.filas} procesadas</span>`;
      return `<article class="hh" style="cursor:pointer;border-left:5px solid ${col}" onclick="cobPlanillaDet('${cesc(String(e.vendedor))}','${cesc(String(e.fecha_rendicion))}')">
        <div class="hh-top"><span class="hh-ico">📋</span>
          <div class="hh-nom">${cesc(e.vendedor_nombre || ('Vendedor ' + e.vendedor))}</div>${chip}</div>
        <div class="hh-desc">${e.filas} fila${e.filas === 1 ? '' : 's'} · Importe total: <b>${cnum(t.importe || 0)}</b></div>
        ${tot ? `<div class="hh-desc">${tot}</div>` : ''}</article>`;
    };
    // Agrupar por FECHA DE RENDICIÓN: la de hoy abierta, las anteriores "archivadas" (colapsadas).
    const hoy = (() => { const t = new Date(), z = n => String(n).padStart(2, '0'); return t.getFullYear() + '-' + z(t.getMonth() + 1) + '-' + z(t.getDate()); })();
    const porFecha = {}; filas.forEach(e => { (porFecha[e.fecha_rendicion] = porFecha[e.fecha_rendicion] || []).push(e); });
    const fechas = Object.keys(porFecha).sort().reverse();
    // Total del día (22/10/2026, pedido para Mónica): suma por medio de pago de las filas
    // que ella ya aprobó (procesadas) en todas las planillas de esa fecha. Lo que falta
    // aprobar no se suma: va aparte. Retenciones y tarjeta solo aparecen si hubo.
    const totalDia = grupo => {
      const s = {}; let faltan = 0, pend = 0;
      grupo.forEach(e => {
        const t = e.aprobado || {};
        Object.keys(lbl).forEach(k => { s[k] = (s[k] || 0) + (Number(t[k]) || 0); });
        faltan += Number(e.sinAprobar) || 0; pend += Number(e.pendiente) || 0;
      });
      const medios = ['efectivo', 'transferencia', 'echeq', 'cheques'].concat(['retenciones', 'tarjeta'].filter(k => s[k] > 0));
      const resto = faltan ? `<div style="font-size:12px;font-weight:600;color:#b23120;margin-top:2px">Falta aprobar: ${faltan} fila${faltan === 1 ? '' : 's'} por <b>${cnum(pend)}</b> (no está sumado)</div>` : '';
      return `<div style="font-size:13px;font-weight:600;text-transform:none;letter-spacing:0;color:var(--ink,#1d2a3a);margin-top:5px">Total aprobado del día: ${medios.map(k => `<span style="white-space:nowrap">${lbl[k]} <b>${cnum(s[k])}</b></span>`).join(' · ')}${resto}</div>`;
    };
    let html = '';
    for (const f of fechas) {
      const grupo = porFecha[f], cards = grupo.map(card).join('');
      const pend = grupo.filter(e => !completa(e)).length;
      if (f === hoy || (fechas.length === 1)) {
        html += `<div style="font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:4px 0 8px">${f === hoy ? 'Hoy · ' : ''}${cfec(f)}${totalDia(grupo)}</div>${cards}`;
      } else {
        const estado = pend ? `<b style="color:#b23120">${pend} con pendientes</b>` : `<span style="color:#1f6b3d">todas procesadas ✓</span>`;
        html += `<details class="pla-arch" style="margin:6px 0;border:1px solid var(--line,#e6e6e6);border-radius:12px;overflow:hidden">
          <summary style="cursor:pointer;padding:12px 14px;font-weight:700;list-style:none;background:var(--cream,#f5f1e8)">📁 ${cfec(f)} · ${grupo.length} planilla${grupo.length > 1 ? 's' : ''} · ${estado}${totalDia(grupo)}</summary>
          <div style="padding:10px 12px">${cards}</div></details>`;
      }
    }
    cq('pla-lista').innerHTML = html;
  } catch (e) { cq('pla-lista').innerHTML = cerror(e.message); }
}

async function cobPlanillaDet(vendedor, fecha) {
  window._plaDet = { vendedor, fecha };  // para recargarla después de borrar una fila
  cq('cob').innerHTML = `<button class="cb-volver" onclick="cobPlanillas()">‹ Volver a planillas</button>
    <div id="pla-det"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=planilla-det&vendedor=' + encodeURIComponent(vendedor) + '&fecha=' + encodeURIComponent(fecha));
    const filas = d.filas || [], env = d.envio;
    const MONEY = ['importe', 'efectivo', 'cheques', 'retenciones', 'transferencia', 'tarjeta', 'echeq'];
    const t = {}; MONEY.forEach(k => t[k] = 0); filas.forEach(f => MONEY.forEach(k => t[k] += Number(f[k]) || 0));
    const nProc = filas.filter(f => f.procesado).length;
    const money = v => (Number(v) || 0) ? cnum(v) : '';
    // Transferencia/cheques con varios importes: muestra el total + el desglose en tooltip.
    const mDet = (val, det) => {
      const v = money(val);
      if (Array.isArray(det) && det.length > 1) return `<div style="font-weight:700">${v}</div><div style="font-size:10.5px;color:var(--muted);font-weight:400;white-space:normal;line-height:1.35;max-width:150px;margin-left:auto">${det.map(x => cnum(x)).join(' + ')}</div>`;
      return v;
    };
    // Celda de monto: en solo-lectura (Dirección) muestra el número; para Moni/administración
    // es un campo editable, para corregir cuando el vendedor se confundió y el arqueo no da.
    const celMoney = (f, campo, det) => {
      const raw = Number(f[campo]) || 0;
      if (cobSoloLectura()) return det ? mDet(raw, det) : money(raw);
      const nota = (Array.isArray(det) && det.length > 1) ? `<div style="font-size:9.5px;color:var(--muted);font-weight:400">era ${det.map(x => cnum(x)).join(' + ')}</div>` : '';
      return `<input class="pl-money" data-col="${campo}" value="${raw ? raw : ''}" inputmode="decimal" title="Corregir ${campo}" onchange="cobPlanillaEditar('${f.id}','${campo}',this.value,this)" style="width:92px;text-align:right;border:1px solid #d7d7d7;border-radius:7px;padding:5px 7px;font:inherit;font-size:12.5px">${nota}`;
    };
    const arch = u => u ? `<a class="cb-b" href="${cesc(u)}" target="_blank" rel="noopener">👁 Ver</a>` : '<span style="color:var(--muted)">—</span>';
    // Comprobantes: pueden ser varios por fila.
    const archComp = f => { const arr = (f.comprobante_url ? [{ url: f.comprobante_url }] : []).concat(Array.isArray(f.comprobantes) ? f.comprobantes : []); return arr.length ? arr.map((c, i) => `<a class="cb-b" href="${cesc(c.url)}" target="_blank" rel="noopener" style="margin:1px">👁${arr.length > 1 ? (' ' + (i + 1)) : ''}</a>`).join(' ') : '<span style="color:var(--muted)">—</span>'; };
    const nomVend = (env && env.vendedor_nombre) || ('Vendedor ' + vendedor);
    const th = (h, r) => `<th style="padding:9px 11px;text-align:${r ? 'right' : 'left'};font-size:11px;text-transform:uppercase">${h}</th>`;
    const td = (v, r) => `<td style="padding:8px 11px;text-align:${r ? 'right' : 'left'}">${v}</td>`;
    cq('pla-det').innerHTML = `
      <div class="head"><div><h1>Rendición · ${cesc(nomVend)}</h1>
        <div class="head-sub">${cfec(fecha)}${env && env.enviada_at ? ' · enviada ' + cfec(env.enviada_at) : ''} · ${filas.length} fila${filas.length === 1 ? '' : 's'} · <b style="color:var(--green-d,#245647)">${nProc} procesada${nProc === 1 ? '' : 's'}</b></div></div></div>
      ${cobSoloLectura()
        ? `<div class="wa-nota" style="margin-top:4px">Las filas tildadas en <b>Procesado</b> ya las pasó tesorería; debajo del tilde figura quién.</div>`
        : `<div class="wa-nota" style="margin-top:4px">Tildá <b>Procesado</b> en cada fila a medida que la vas pasando, y dejá una <b>observación</b> si hace falta. Si un vendedor cargó mal un monto, <b>editalo directo en la celda</b> (los totales se recalculan solos); si una fila sobra (ej. cargada dos veces), eliminala con 🗑. Las que queden sin tildar son las que te faltan.</div>`}
      <div style="overflow-x:auto;border:1px solid #e6e6e6;border-radius:12px;margin-top:12px">
      <table style="border-collapse:collapse;width:100%;font-size:13px;white-space:nowrap">
        <thead><tr style="background:#0d2238;color:#eaf0f4">
          ${th('Código')}${th('Razón social')}${th('Factura')}${th('Importe', 1)}${th('Efectivo', 1)}${th('Cheques', 1)}${th('Retenc.', 1)}${th('Transf/MP', 1)}${th('Tarjeta', 1)}${th('E-cheq', 1)}${th('Fecha')}${th('Comprob.')}${th('Recepción')}${th('Observaciones')}${th('Procesado')}${cobSoloLectura() ? '' : th('')}
        </tr></thead>
        <tbody>${filas.length ? filas.map(f => `<tr style="border-top:1px solid #eee;${f.procesado ? 'background:#e7f1ea' : ''}">
          ${td(cesc(f.codigo || ''))}
          ${td(cesc(f.razon_social || ''))}
          ${td(cesc(f.factura || ''))}
          ${td(celMoney(f, 'importe'), 1)}${td(celMoney(f, 'efectivo'), 1)}${td(celMoney(f, 'cheques', f.cheques_detalle), 1)}${td(celMoney(f, 'retenciones'), 1)}${td(celMoney(f, 'transferencia', f.transferencia_detalle), 1)}${td(celMoney(f, 'tarjeta'), 1)}${td(celMoney(f, 'echeq', f.echeq_detalle), 1)}
          ${td((f.fecha_pago ? cfec(f.fecha_pago) : '') + (f.fecha_cheque ? `<div style="font-size:10.5px;color:var(--muted)">ch/e-cheq: ${cfec(f.fecha_cheque)}</div>` : ''))}${td(archComp(f))}${td(arch(f.recepcion_url))}
          <td style="padding:5px 8px"><input value="${cesc(f.observaciones || '')}" placeholder="…" ${cobSoloLectura() ? 'disabled' : ''} onchange="cobPlanillaMarcar('${f.id}','observaciones',this.value,this)" style="border:1px solid #d7d7d7;border-radius:7px;padding:5px 8px;font:inherit;font-size:12.5px;width:160px"></td>
          <td style="padding:5px 8px;text-align:center"><input type="checkbox" ${f.procesado ? 'checked' : ''} ${cobSoloLectura() ? 'disabled' : ''} onchange="cobPlanillaMarcar('${f.id}','procesado',this.checked,this)" style="width:18px;height:18px;cursor:pointer">${f.procesado && f.procesado_por ? `<div style="font-size:9.5px;color:var(--muted)">${cesc(f.procesado_por)}</div>` : ''}</td>
          ${cobSoloLectura() ? '' : `<td style="padding:5px 8px;text-align:center"><button type="button" title="Eliminar esta fila" onclick="cobPlanillaBorrar('${f.id}',this)" style="background:#fff;border:1px solid #e3b4a8;color:#c0392b;border-radius:7px;padding:4px 8px;cursor:pointer;font-size:13px">🗑</button></td>`}
        </tr>`).join('') : `<tr><td colspan="16" style="padding:20px;text-align:center;color:var(--muted)">Sin filas.</td></tr>`}</tbody>
        <tfoot><tr style="background:#f7efda;font-weight:800;border-top:2px solid #c9a13b">
          <td colspan="3" style="padding:9px 11px;text-align:right">TOTALES</td>
          ${['importe', 'efectivo', 'cheques', 'retenciones', 'transferencia', 'tarjeta', 'echeq'].map(k => `<td id="plt-${k}" style="padding:8px 11px;text-align:right">${cnum(t[k])}</td>`).join('')}
          <td colspan="${cobSoloLectura() ? 5 : 6}"></td>
        </tr></tfoot>
      </table></div>`;
  } catch (e) { cq('pla-det').innerHTML = cerror(e.message); }
}

// Moni marca una fila como procesada / deja observaciones (en el detalle de la planilla).
async function cobPlanillaMarcar(id, campo, valor, el) {
  const body = { accion: 'planilla-marcar', id }; body[campo] = valor;
  try {
    await cobApi('', { method: 'POST', body: JSON.stringify(body) });
    if (campo === 'procesado' && el) {
      const tr = el.closest('tr'); if (tr) tr.style.background = valor ? '#e7f1ea' : '';
      // actualizar el contador del subtítulo
      const sub = cq('pla-det') && cq('pla-det').querySelector('.head-sub b');
      if (sub) { const n = cq('pla-det').querySelectorAll('tbody input[type=checkbox]:checked').length; sub.textContent = n + ' procesada' + (n === 1 ? '' : 's'); }
    }
  } catch (e) {
    alert('No se pudo guardar: ' + (e.message || e));
    if (campo === 'procesado' && el) el.checked = !valor;
  }
}

// Moni corrige un monto de una fila (cuando el vendedor se confundió). La coma son
// centavos. Al guardar, recalcula los totales del pie en vivo (para que el arqueo cierre).
function _plParseMonto(str) {
  let s = String(str == null ? '' : str).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const hasC = s.indexOf(',') > -1, hasD = s.indexOf('.') > -1;
  if (hasC && hasD) { s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); }
  else if (hasC) { const p = s.split(','); s = (p.length === 2 && p[1].length <= 2) ? (p[0] + '.' + p[1]) : s.replace(/,/g, ''); }
  const n = Number(s); return isFinite(n) ? n : 0;
}
function cobPlanillaRecalcTot() {
  const cols = ['importe', 'efectivo', 'cheques', 'retenciones', 'transferencia', 'tarjeta', 'echeq'];
  const sum = {}; cols.forEach(c => sum[c] = 0);
  document.querySelectorAll('#pla-det .pl-money').forEach(inp => { const c = inp.getAttribute('data-col'); sum[c] = (sum[c] || 0) + _plParseMonto(inp.value); });
  cols.forEach(c => { const el = document.getElementById('plt-' + c); if (el) el.textContent = cnum(sum[c]); });
}
async function cobPlanillaEditar(id, campo, valor, el) {
  const val = _plParseMonto(valor);
  try {
    await cobApi('', { method: 'POST', body: JSON.stringify({ accion: 'planilla-editar', id, campos: { [campo]: val } }) });
    if (el) { el.value = val ? val : ''; const nota = el.parentNode && el.parentNode.querySelector('div'); if (nota) nota.remove(); }
    cobPlanillaRecalcTot();
  } catch (e) {
    alert('No se pudo guardar la corrección: ' + (e.message || e));
  }
}

// Moni elimina una fila de la planilla (ej. cargada dos veces). Pide confirmación; el
// servidor guarda una copia de respaldo antes de borrar. Después recarga la planilla.
async function cobPlanillaBorrar(id, btn) {
  const tr = btn && btn.closest('tr');
  const desc = tr ? Array.from(tr.children).slice(0, 3).map(td => td.textContent.trim()).filter(Boolean).join(' · ') : '';
  if (!confirm('¿Eliminar esta fila de la planilla?' + (desc ? '\n\n' + desc : '') + '\n\nQueda guardada una copia de respaldo.')) return;
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await cobApi('', { method: 'POST', body: JSON.stringify({ accion: 'planilla-borrar', id }) });
    const p = window._plaDet;
    if (p) cobPlanillaDet(p.vendedor, p.fecha); else if (tr) { tr.remove(); cobPlanillaRecalcTot(); }
  } catch (e) {
    alert('No se pudo eliminar: ' + (e.message || e));
    if (btn) { btn.disabled = false; btn.textContent = '🗑'; }
  }
}

// ── Acciones (todas pasan por acá) ─────────────────────────
async function cobAccion(accion, id, btn, volver, extra) {
  const textos = {
    bloquear: '¿Bloquear esta cuenta?\n\nNo va a poder hacer pedidos desde el portal hasta que la des de alta. Puede seguir entrando para ver su cuenta y pagar. En Conquer no cambia nada.',
    desbloquear: '¿Dar de alta esta cuenta?',
    'cobro-cancelado': '¿Cancelar este cobro?',
  };
  if (textos[accion] && !confirm(textos[accion])) return;
  const antes = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  try {
    await cobApi('', { method:'POST', body: JSON.stringify({ accion, id, ...(extra || {}) }) });
    await cobCargarResumen();
    if (volver) await volver();
  } catch (e) {
    alert('No se pudo: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = antes; }
  }
}

// ── Arranque ───────────────────────────────────────────────
async function cobCargarResumen() {
  try { COB_RESUMEN = await cobApi('?que=resumen'); } catch (e) { COB_RESUMEN = { _error: e.message }; }
}

async function montarCobranzas() {
  const s = await GBAuth.requireAuth();
  if (!s) return;
  const ses = await GBAuth.client.auth.getSession();
  COB_TOKEN = ses.data.session ? ses.data.session.access_token : null;
  const quien = cq('cob-quien'); if (quien) quien.textContent = s.nombre || '';

  await cobCargarResumen();
  // Con zona (Romina, San Luis), que se vea debajo del nombre.
  if (quien && COB_RESUMEN.zona) quien.textContent = (s.nombre || '') + ' · ' + COB_RESUMEN.zona;
  // La guía de San Luis (guia-cobranzas-sl.html), en el menú solo para esa zona.
  const guia = cq('cob-guia'); if (guia && COB_RESUMEN.zona === 'San Luis') guia.style.display = '';
  _cobrosPendVistos = Number((COB_RESUMEN && COB_RESUMEN.cobrosPend) || 0); // base, para no sonar al entrar
  if (COB_RESUMEN._error) {
    cobNav();
    cq('cob').innerHTML = `<div class="head"><div><h1>Cobranzas</h1></div></div>` + cerror(COB_RESUMEN._error);
    return;
  }
  // Si se llegó con #seccion (desde un aviso o un enlace), se abre esa sección.
  // Si no, la sección con la que arranca cada rol (window.COB_INICIO, ej. tesorería → revisión).
  const pedida = (location.hash || '').slice(1) || ((window.COB_INICIO || {})[cobRol()] || '');
  if (pedida && (COB_SECCIONES.some(s => s.id === pedida && cobVe(s)) || cobExtra().some(s => s.id === pedida))) cobAbrir(pedida);
  else cobTablero();
}
