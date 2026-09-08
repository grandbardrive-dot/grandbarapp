/* ===========================================================
   GrandBar — sección Cobranzas del Portal
   -----------------------------------------------------------
   Las 7 opciones del sistema de cuenta corriente, adentro del
   Portal. Los datos los sirve la function cobranzas-panel, que
   lee del lado del servidor y verifica quién pregunta.

   Uso: <div id="cob"></div> + montarCobranzas()
   =========================================================== */
const COB_API = '/.netlify/functions/cobranzas-panel';

const COB_SECCIONES = [
  { id:'clientes',     ico:'👥', n:'Clientes',            d:'Buscá un cliente y mirá su cuenta corriente, facturas y datos.', color:'#e0567f' },
  { id:'comprobantes', ico:'🧾', n:'Supervisión de cobranzas', d:'Cómo vienen los comprobantes que suben los clientes: dónde se frenan y cuánto tardan.', color:'#69a531' },
  { id:'whatsapp',     ico:'📲', n:'WhatsApp',            d:'Lo que responden los clientes y cómo llegaron los avisos. Es de lectura.', color:'#e0533c' },
  { id:'estadisticas', ico:'📊', n:'Estadísticas',        d:'Cartera, cobranzas y comparativas del período.',                 color:'#2f6db0' },
  { id:'bloquear',     ico:'🔒', n:'Bloquear cuentas',    d:'Clientes que superaron su límite: bloqueá o dá de alta.',        color:'#d6a52b' },
  { id:'reclamos',     ico:'💬', n:'Reclamos',            d:'Reclamos de clientes, con chat y número de seguimiento.',        color:'#7b5cd6' },
  { id:'efectivo',     ico:'💵', n:'Cobros en efectivo',  d:'Clientes que avisaron que tienen el efectivo listo para retirar.', color:'#2d8a4f' },
  { id:'tareas',       ico:'✅', n:'Tareas del equipo',   d:'Qué tiene que hacer cada una del equipo y qué quedó hecho.',      color:'#3b6fa0' },
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
  cq('cob').innerHTML = `
    <div class="head"><div>
      <h1>Cobranzas</h1>
      <div class="head-sub">Cuenta corriente, comprobantes y reclamos, más las tareas del equipo.</div>
    </div></div>
    <div class="cb-cards">
      ${COB_SECCIONES.map(s => {
        const chip = cobChip(s.id);
        return `<button class="cb-card" style="border-top-color:${s.color}" onclick="cobAbrir('${s.id}')">
          <div class="ico" style="background:${s.color}1a">${s.ico}</div>
          <h3>${cesc(s.n)}</h3><p>${cesc(s.d)}</p>
          ${chip ? `<span class="cb-chip ${chip.c}">${cesc(chip.t)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;
}

function cobNav() {
  const nav = cq('cob-nav'); if (!nav) return;
  nav.innerHTML = `<button class="sb-item ${COB_VISTA==='tablero'?'on':''}" onclick="cobTablero()"><span class="i">🏠</span> Tablero</button>` +
    COB_SECCIONES.map(s => `<button class="sb-item ${COB_VISTA===s.id?'on':''}" onclick="cobAbrir('${s.id}')"><span class="i">${s.ico}</span> ${cesc(s.n)}</button>`).join('');
}

function cobAbrir(id) {
  COB_VISTA = id; cobNav();
  ({ clientes: cobClientes, bloquear: cobBloquear, efectivo: cobEfectivo,
     comprobantes: cobComprobantes, reclamos: cobReclamos,
     estadisticas: cobEstadisticas, whatsapp: cobWhatsapp,
     tareas: eqTareas }[id] || cobTablero)();
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
        ${tel ? `<a class="cb-b ok" href="https://wa.me/${cesc(tel)}" target="_blank" rel="noopener">💬 Escribirle por WhatsApp</a>` : ''}
        ${f ? (bloqueado
          ? `<button class="cb-b ok" onclick="cobAccion('desbloquear','${f.id}',this,()=>cobFicha('${cesc(c.codigo)}'))">🔓 Dar de alta</button>`
          : `<button class="cb-b danger" onclick="cobAccion('bloquear','${f.id}',this,()=>cobFicha('${cesc(c.codigo)}'))">🔒 Bloquear la cuenta</button>`) : ''}
        ${!f ? `<span class="pd-cuando" style="margin:0">Sin ficha en el portal de clientes: no se puede bloquear ni escribirle desde acá.</span>` : ''}
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
        <b>${cobrosPend.map(x => cnum(x.monto)).join(', ')}</b>. Se gestiona en Cobros en efectivo.</div></div>` : ''}

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
            <td>${x.archivo_url ? `<a class="cb-b" href="${cesc(x.archivo_url)}" target="_blank" rel="noopener">📎 Ver</a>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table>` : `<div class="pv-vacio">${f ? 'Este cliente no subió ningún comprobante.' : 'No tiene ficha en el portal de clientes, así que no puede subir comprobantes.'}</div>`}

      <h2 style="font-size:16px;margin:26px 0 0">Reclamos <span class="pv-n">${(d.reclamos||[]).length}</span></h2>
      ${(d.reclamos || []).length ? `
        <table class="cb-tabla">
          <thead><tr><th>Asunto</th><th>Factura</th><th>Estado</th><th>Última novedad</th><th></th></tr></thead>
          <tbody>${d.reclamos.map(x => `<tr>
            <td><b>${cesc(x.asunto || 'Reclamo')}</b></td>
            <td>${cesc(x.factura || '—')}</td>
            <td class="${x.estado === 'abierto' ? 'rojo' : ''}">${cesc(COB_REC_LBL[x.estado] || x.estado || '—')}</td>
            <td>${cfec(x.updated_at)}</td>
            <td><button class="cb-b" onclick="cobReclamo('${x.id}')">Abrir</button></td>
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

// ── 3 · WhatsApp ───────────────────────────────────────────
// Bandeja: respuestas de los clientes + estado de los envíos (lee wa_eventos).
let _waConvs = [];
function waFecha(v) {
  if (!v) return ''; const d = new Date(v); if (isNaN(d)) return '';
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function waEstado(e) { return ({ sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Falló' }[e] || e || ''); }
async function cobWhatsapp() {
  cq('cob').innerHTML = cobCabecera('WhatsApp', 'Respuestas de los clientes y estado de los mensajes enviados.') +
    `<div id="wa-lista"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=whatsapp');
    _waConvs = d.conversaciones || [];
    if (!_waConvs.length) { cq('wa-lista').innerHTML = `<div class="pv-vacio">Todavía no hay mensajes de WhatsApp.</div>`; return; }
    cq('wa-lista').innerHTML = `<table class="cb-tabla"><thead><tr><th>Cliente</th><th>Último mensaje</th><th>Cuándo</th><th>Envío</th></tr></thead><tbody>` +
      _waConvs.map((c, i) => `<tr style="cursor:pointer" onclick="cobWaChat(${i})">
        <td><b>${cesc(c.cliente || c.telefono)}</b>${c.codigo ? `<div style="font-size:11px;color:var(--muted)">Cód. ${cesc(c.codigo)}</div>` : ''}</td>
        <td>${c.entrantes ? '💬 ' + cesc(c.ultimoTexto || '') : '<span style="color:var(--muted)">— sin respuesta —</span>'}</td>
        <td style="white-space:nowrap">${waFecha(c.ultimaFecha)}</td>
        <td>${c.error ? '<span class="rojo">⚠️ Falló</span>' : cesc(waEstado(c.ultimoEstado))}</td>
      </tr>`).join('') + `</tbody></table>`;
  } catch (e) { cq('wa-lista').innerHTML = cerror(e.message); }
}
function cobWaChat(i) {
  const c = _waConvs[i]; if (!c) return;
  const burbujas = (c.mensajes || []).map(m => `<div style="max-width:75%;padding:8px 11px;border-radius:12px;font-size:13.5px;line-height:1.4;white-space:pre-wrap;word-break:break-word;${m.dir === 'in' ? 'background:#fff;align-self:flex-start;border:1px solid var(--line)' : 'background:#d9fdd3;align-self:flex-end'}">${cesc(m.texto)}<div style="font-size:10.5px;color:var(--muted);text-align:right;margin-top:3px">${waFecha(m.fecha)}</div></div>`).join('')
    || `<div class="pv-vacio">Este cliente todavía no respondió. Acá vas a ver sus respuestas.</div>`;
  cq('cob').innerHTML = `<button class="cb-volver" onclick="cobWhatsapp()">‹ Volver a WhatsApp</button>` +
    cobCabecera(c.cliente || c.telefono, cesc(c.telefono) + (c.codigo ? ' · Cód. ' + cesc(c.codigo) : '')) +
    `<div style="display:flex;flex-direction:column;gap:5px;padding:16px;background:#efe7d8;border-radius:14px;max-height:52vh;overflow:auto">${burbujas}</div>
     <div style="display:flex;gap:8px;margin-top:10px">
       <textarea id="wa-resp" rows="2" placeholder="Escribí tu respuesta…" style="flex:1;padding:9px 11px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:13.5px;resize:vertical"></textarea>
       <button class="cb-b on" style="padding:0 18px" onclick="cobWaResponder(${i})">Enviar</button>
     </div>
     <div id="wa-resp-msg" class="pv-vacio" style="text-align:left;margin-top:6px;font-size:12.5px">${c.error ? '⚠️ Último envío: ' + cesc(c.error) + '. ' : ''}Se puede responder por texto solo dentro de las 24 hs del último mensaje del cliente.</div>`;
}
async function cobWaResponder(i) {
  const c = _waConvs[i]; if (!c) return;
  const ta = document.getElementById('wa-resp'), msg = document.getElementById('wa-resp-msg');
  const texto = (ta && ta.value || '').trim(); if (!texto) { if (ta) ta.focus(); return; }
  const aviso = (t, err) => { if (msg) { msg.textContent = t; msg.style.color = err ? '#c0392b' : ''; } };
  aviso('Enviando…');
  try {
    const r = await fetch('https://grandbar-gestioncuenta.netlify.app/.netlify/functions/wa-responder', {
      method: 'POST', headers: { Authorization: 'Bearer ' + COB_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: c.telefono, texto }),
    });
    const j = await r.json();
    if (!j.ok) {
      const fuera = /24|reengag|window|outside/i.test(j.error || '');
      aviso('No se pudo enviar: ' + (j.error || 'error') + (fuera ? ' — pasaron más de 24 hs desde el último mensaje del cliente; ahí solo se puede con una plantilla.' : ''), true);
      return;
    }
    c.mensajes.push({ dir: 'out', texto, fecha: new Date().toISOString() });
    ta.value = ''; cobWaChat(i);
  } catch (e) { aviso('Error de conexión: ' + (e.message || e), true); }
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
  cq('cob').innerHTML = cobCabecera('Reclamos', 'Reclamos de clientes, con su historial.') +
    `<div id="r-lista"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=reclamos');
    if (!d.filas.length) { cq('r-lista').innerHTML = `<div class="pv-vacio">No hay reclamos.</div>`; return; }
    cq('r-lista').innerHTML = d.filas.map(r => `<article class="hh">
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
  } catch (e) { cq('r-lista').innerHTML = cerror(e.message); }
}

async function cobReclamo(id) {
  cq('cob').innerHTML = `<button class="cb-volver" onclick="cobReclamos()">‹ Volver a reclamos</button>
    <div id="r-det"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=reclamos&id=' + encodeURIComponent(id));
    const r = d.reclamo;
    if (!r) { cq('r-det').innerHTML = cerror('No encontré ese reclamo.'); return; }
    cq('r-det').innerHTML = `
      <div class="head"><div><h1>${cesc(r.asunto || 'Reclamo')}</h1>
        <div class="head-sub">${cesc((r.cliente && (r.cliente.comercio || r.cliente.nombre)) || '')}${r.factura ? ' · factura ' + cesc(r.factura) : ''}</div></div></div>
      ${(d.mensajes || []).length ? d.mensajes.map(m => `
        <article class="hh" style="margin-left:${m.autor === 'admin' ? '40px' : '0'}">
          <div class="hh-top"><span class="hh-ico">${m.autor === 'admin' ? '🏢' : '👤'}</span>
            <div class="hh-nom">${m.autor === 'admin' ? 'Nosotros' : 'El cliente'}</div>
            <span class="pd-cuando">${cfec(m.created_at)}</span></div>
          ${m.texto ? `<div class="pd-detalle">${cesc(m.texto)}</div>` : ''}
          ${m.archivo_url ? `<div class="pd-acts"><a class="cb-b" href="${cesc(m.archivo_url)}" target="_blank" rel="noopener">📎 Ver adjunto</a></div>` : ''}
        </article>`).join('') : `<div class="pv-vacio">Sin mensajes.</div>`}
      <div class="aviso"><span>✍️</span><div>Para <b>responderle al cliente</b> hay que entrar al sistema de cobranzas: la respuesta le
        dispara un aviso por WhatsApp, y esa parte todavía no está en el Portal.</div></div>`;
  } catch (e) { cq('r-det').innerHTML = cerror(e.message); }
}

function cobEstadoReclamo(id, estado, btn) {
  cobAccion('reclamo-estado', id, btn, cobReclamos, { estado });
}

// ── 7 · Cobros en efectivo ─────────────────────────────────
async function cobEfectivo() {
  cq('cob').innerHTML = cobCabecera('Cobros en efectivo', 'Clientes que avisaron que tienen el efectivo listo.') +
    `<div id="ef-lista"><div class="pv-vacio">Cargando…</div></div>`;
  try {
    const d = await cobApi('?que=efectivo');
    const pend = d.filas.filter(c => (c.estado || 'pendiente') === 'pendiente');
    const resto = d.filas.filter(c => (c.estado || 'pendiente') !== 'pendiente');
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
    cq('ef-lista').innerHTML =
      (pend.length ? pend.map(card).join('') : `<div class="pv-vacio">No hay cobros pendientes de retirar.</div>`) +
      (resto.length ? `<h2 style="font-size:16px;margin:28px 0 0">Ya resueltos <span class="pv-n">${resto.length}</span></h2>` + resto.map(card).join('') : '');
  } catch (e) { cq('ef-lista').innerHTML = cerror(e.message); }
}

// ── Acciones (todas pasan por acá) ─────────────────────────
async function cobAccion(accion, id, btn, volver, extra) {
  const textos = {
    bloquear: '¿Bloquear esta cuenta?\n\nNo va a poder comprar hasta que la des de alta.',
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
  if (COB_RESUMEN._error) {
    cobNav();
    cq('cob').innerHTML = `<div class="head"><div><h1>Cobranzas</h1></div></div>` + cerror(COB_RESUMEN._error);
    return;
  }
  cobTablero();
}
