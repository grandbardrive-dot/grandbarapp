// ============================================================
//  Manual de DISCOS · herramientas de la visita (las usa visita.html)
//
//  Recorrido que definió el usuario (12/09/2026, manual-disco-v3.sql):
//   introducción → vinos → spirits (con aperitivos, cervezas y RTD) →
//   activaciones y fechas especiales → materiales y visibilidad →
//   eventos pre armados → acuerdos con partners → cierre.
//
//   · CON PREVIA o SIN PREVIA: al entrar al manual de un boliche se elige cómo
//     trabaja ("Boliche con previa" o "Boliche sin previa", sin más detalle: así
//     lo pidió el usuario). Queda en la ficha del cliente (clientes.perfil) y las
//     próximas visitas ya entran con eso. El manual se arma SIN las secciones
//     que no corresponden: cada sección dice en qué caso se muestra
//     (checklist_secciones.solo_formato, se edita en Secciones → Discos).
//   · EVENTOS PRE ARMADOS: los carga Luciana como planes en "Eventos para
//     ofrecer". El vendedor toca "Cerrar evento" y queda vendido para ese
//     cliente (evento_ventas). Un evento se le puede vender a todos.
//   · ACUERDOS CON PARTNERS: pedido a la marca (qué necesita el cliente,
//     volumen, marcas, fee, plata). Queda 'pendiente' hasta que lo valida el
//     supervisor en el Hub (supervisor-pedidos.html); después solo queda
//     registrado (partner_pedidos).
//
//  Cada herramienta se engancha por el CÓDIGO de su subsección (DC_WIDGETS),
//  y solo en el manual de discos: varios códigos son los mismos que en bares.
//  Lo que carga el vendedor se guarda con la visita, en progreso._disco.
// ============================================================

// Marcas partner de spirits. Los modelos de acuerdo de cada una los traen
// Florencia y Milena (pendiente de la minuta); cuando lleguen, van acá.
const DC_MARCAS   = ['Pernod Ricard', 'Campari', 'Viajero'];
const DC_OTRA     = 'Otra marca';
const DC_RECURSOS = ['Bartender', 'Bandejas de shot', 'Tragos regalados', 'Merchandise de marca', 'Precintos'];

const DC_FORMATOS = {
  con_previa: { ico: '🍽️', nombre: 'Boliche con previa' },
  sin_previa: { ico: '🌙', nombre: 'Boliche sin previa' },
};

const DC_ESTADOS = {
  pendiente: { ico: '⏳', txt: 'Pendiente de validación', cls: 'pend' },
  aprobado:  { ico: '✅', txt: 'Aprobado',                 cls: 'ok' },
  rechazado: { ico: '✖',  txt: 'Rechazado',                cls: 'no' },
};

// Qué va en cada subsección del manual de discos (código → herramienta).
// Un texto es una herramienta de este archivo; un objeto es un widget de visita.html.
const DC_WIDGETS = {
  incorporaciones_2:   { tipo: 'propuestas', categoria: 'vino' },         // VINOS > Acciones de Incorporación
  incorporaciones:     { tipo: 'propuestas', categoria: 'spirit' },       // SPIRITS > Acciones de Incorporación
  dc_cervezas_rtd:     { tipo: 'ofertas', dataKey: 'dc_cervezas_rtd' },   // SPIRITS > Cervezas y RTD (catálogo: cervezas)
  proponer_activacion: 'dc_activacion',                                   // ACTIVACIONES > Proponer Activación
  dc_eventos_mes:      'dc_eventos_pa',                                   // EVENTOS PRE ARMADOS
  dc_acuerdos_marca:   'dc_marcas',                                       // ACUERDOS CON PARTNERS
  // Apagadas en el recorrido actual; quedan por si se vuelven a prender.
  dc_sunset:           'dc_sunset',
  dc_activaciones:     'dc_activacion',
  dc_mat_restringidos: 'dc_restringidos',
  dc_eventos_cliente:  'dc_eventos',
};

// Lo que va cargando el vendedor en esta visita.
const DC = {
  formato: null,          // 'con_previa' | 'sin_previa'
  sunset: null,           // true | false
  sunsetInfo: {},
  marcas: {},             // pedidos que se están armando: { 'Campari': { necesita, volumen, … } }
  pedidos: [],            // pedidos de este cliente (partner_pedidos), el más nuevo primero
  enviados: [],           // ids de los pedidos enviados en esta visita
  planesEventos: [],      // eventos pre armados (planes de "Eventos para ofrecer")
  ventas: {},             // plan_id → venta (evento_ventas) de este cliente
  cerrados: [],           // plan_ids vendidos en esta visita
  activacion: { recursos: [], marca: '', fecha: '', nota: '' },
  restringidos: [],       // [{ material, cantidad, motivo }]
  eventos: [],            // [{ fecha, evento, necesita }]
};

const DC_LISTAS = {
  restringidos: {
    tipo: 'dc_restringidos', titulo: '¿Qué material restringido pide?', boton: '+ Agregar material',
    nota: 'Estos materiales necesitan aprobación: anotá para qué los quiere.',
    cols: [['material', 'Material', 'Ej: heladera exhibidora'], ['cantidad', 'Cantidad', '1', 'number'], ['motivo', 'Para qué', 'Ej: fiesta aniversario']],
  },
  eventos: {
    tipo: 'dc_eventos', titulo: 'Eventos propios del cliente', boton: '+ Agregar evento',
    nota: 'Aniversarios, fiestas temáticas, fechas fuertes del boliche: sirven para ofrecerle el evento o la activación justa.',
    cols: [['fecha', 'Fecha', '', 'date'], ['evento', 'Evento', 'Ej: aniversario 10 años'], ['necesita', 'Qué necesita', 'Ej: botellas con bengala']],
  },
};

// Solo el manual NUEVO de discos (tiene secciones dc_*). Con el manual viejo
// (la copia de bares) no se pregunta nada ni se engancha ninguna herramienta.
const _esDisco = cl => !!cl && cl.id === 'disco'
  && (cl.secciones || []).some(s => String(s.id || '').startsWith('dc_'));

const _dcNum   = v => { const n = Number(v); return (v === '' || v == null || isNaN(n)) ? null : n; };
const _dcFecha = f => { try { return new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };
const _dcVend  = () => (typeof vendedor !== 'undefined' && vendedor) ? vendedor : {};

// La llama widgetDe() de visita.html: qué widget va en esta subsección.
function dcWidgetDe(sec) {
  if (typeof checklist === 'undefined' || !_esDisco(checklist)) return null;
  const w = DC_WIDGETS[sec.id];
  if (!w) return null;
  return typeof w === 'string' ? { tipo: w } : w;
}

// ── Con previa / sin previa ─────────────────────────────────
// Lo llama init() de visita.html ANTES de dibujar el manual. Si el boliche
// todavía no tiene formato, pregunta y espera la respuesta. Devuelve el manual
// sin las secciones que no corresponden (una copia: el original queda en caché).
async function dcPrepararChecklist(cl) {
  if (!_esDisco(cl)) return cl;
  // La ficha que viene de la lista puede no traer el perfil: se lee acá.
  try {
    const { data, error } = await sb.from('clientes').select('perfil').eq('id', cliente.id).maybeSingle();
    if (!error && data) cliente.perfil = data.perfil || {};
  } catch (e) { /* sin columna perfil todavía: se usa lo que haya en la sesión */ }
  const p = cliente.perfil || {};
  DC.formato = DC_FORMATOS[p.formato] ? p.formato : null;
  if (typeof p.sunset === 'boolean') DC.sunset = p.sunset;
  if (!DC.formato) {
    DC.formato = await dcPedirFormato(false);
    dcGuardarPerfil({ formato: DC.formato });   // no hace falta esperarlo para seguir
  }
  return dcFiltrar(cl, DC.formato);
}

// Saca las secciones marcadas para el otro formato. Una sección madre que se
// queda sin subsecciones (y no tiene tareas propias) sale también.
function dcFiltrar(cl, formato) {
  const va = s => !s.soloFormato || !formato || s.soloFormato === formato;
  const secciones = cl.secciones.filter(va).map(m => {
    if (!m.subsecciones || !m.subsecciones.length) return m;
    return { ...m, subsecciones: m.subsecciones.filter(va) };
  }).filter(m => !(m.subsecciones && !m.subsecciones.length && !(m.items && m.items.length) && !m.especial));
  return { ...cl, secciones };
}

// Ventana para elegir el formato. Devuelve una promesa con 'con_previa' |
// 'sin_previa', o null si se canceló (solo cuando se está cambiando).
function dcPedirFormato(cancelable) {
  return new Promise(resolve => {
    document.getElementById('dc-modal')?.remove();
    const op = v => { const f = DC_FORMATOS[v];
      return `<button type="button" class="dc-op${DC.formato === v ? ' on' : ''}" data-v="${v}"><b>${f.ico} ${f.nombre}</b></button>`; };
    document.body.insertAdjacentHTML('beforeend', `
      <div class="dc-modal-ov" id="dc-modal"><div class="dc-modal" role="dialog" aria-modal="true">
        <div class="dc-modal-tit">¿Cómo trabaja ${esc((cliente && cliente.nombre) || 'este boliche')}?</div>
        <div class="dc-modal-sub">Según esto, el manual te muestra qué ofrecerle. Queda guardado para las próximas visitas.</div>
        <div class="dc-ops">${op('con_previa')}${op('sin_previa')}</div>
        ${cancelable ? '<button type="button" class="dc-modal-x" data-v="">Cancelar</button>' : ''}
      </div></div>`);
    const ov = document.getElementById('dc-modal');
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      ov.remove();
      resolve(b.dataset.v || null);
    });
  });
}

// Barra arriba del manual con el formato elegido y el botón para cambiarlo.
function dcPintarBarra() {
  const cont = document.getElementById('checklist-container');
  if (!cont || !DC.formato) return;
  let barra = document.getElementById('dc-barra');
  if (!barra) { cont.insertAdjacentHTML('beforebegin', '<div class="dc-barra" id="dc-barra"></div>'); barra = document.getElementById('dc-barra'); }
  const f = DC_FORMATOS[DC.formato];
  barra.innerHTML = `<span class="dc-barra-ico">${f.ico}</span>
    <div class="dc-barra-txt"><b>${f.nombre}</b></div>
    <button type="button" class="dc-barra-btn" onclick="dcCambiarFormato()">Cambiar</button>`;
}

// Cambiar el formato en medio de una visita vuelve a armar el manual (se recarga).
async function dcCambiarFormato() {
  const v = await dcPedirFormato(true);
  if (!v || v === DC.formato) return;
  if (!confirm('El manual se vuelve a armar con lo que corresponde a "' + DC_FORMATOS[v].nombre +
               '".\nLo que marcaste en esta visita se pierde. ¿Seguir?')) return;
  await dcGuardarPerfil({ formato: v });
  location.reload();
}

// ── Render de las herramientas ──────────────────────────────
const _dcAttr = s => esc(String(s == null ? '' : s));

function dcCampo(label, path, valor, ph, tipo) {
  return `<div class="cierre-field"><label>${esc(label)}</label>
    <input type="${tipo || 'text'}"${tipo === 'number' ? ' inputmode="numeric" min="0"' : ''} value="${_dcAttr(valor)}"
      placeholder="${_dcAttr(ph)}" data-p="${_dcAttr(path)}" oninput="dcSet(this.dataset.p, this.value)"></div>`;
}

// La llama widgetSlotHtml() de visita.html.
function dcRender(tipo, sec) {
  return `<div class="esp-block dc-block" id="dc-${tipo}">${dcHtml(tipo, sec)}</div>`;
}
function dcPintar(tipo) {
  const el = document.getElementById('dc-' + tipo);
  if (el) el.innerHTML = dcHtml(tipo);
}
function dcHtml(tipo, sec) {
  switch (tipo) {
    case 'dc_marcas':       return dcHtmlMarcas();
    case 'dc_eventos_pa':   return dcHtmlEventosPA(sec);
    case 'dc_sunset':       return dcHtmlSunset();
    case 'dc_activacion':   return dcHtmlActivacion();
    case 'dc_restringidos': return dcHtmlLista('restringidos');
    case 'dc_eventos':      return dcHtmlLista('eventos');
  }
  return '';
}

// ACUERDOS CON PARTNERS: pedido a la marca + los pedidos que ya tiene el cliente.
function dcHtmlMarcas() {
  const chips = [...DC_MARCAS, DC_OTRA].map(m =>
    `<span class="sega-chip${DC.marcas[m] ? ' sel' : ''}" data-m="${_dcAttr(m)}" onclick="dcToggleMarca(this.dataset.m)">${esc(m)}</span>`).join('');
  const fichas = Object.keys(DC.marcas).map(m => {
    const d = DC.marcas[m], p = 'marcas.' + m + '.';
    return `<div class="dc-ficha"><div class="dc-ficha-tit">${esc(m)}</div>
      ${m === DC_OTRA ? dcCampo('¿Qué marca?', p + 'nombre', d.nombre, 'Nombre de la marca') : ''}
      ${dcCampo('Qué necesita el cliente de la marca', p + 'necesita', d.necesita, 'Ej: 2 bartenders y 30 botellas para la apertura')}
      ${dcCampo('Volumen de consumo', p + 'volumen', d.volumen, 'Ej: 15 cajas por mes')}
      ${dcCampo('Marcas / productos que prefiere', p + 'preferidas', d.preferidas, 'Ej: Absolut, Jameson')}
      <div class="dc-fila">${dcCampo('Fee que pide', p + 'fee', d.fee, '$', 'number')}${dcCampo('Plata que solicita', p + 'plata', d.plata, '$', 'number')}</div>
      ${dcCampo('Notas', p + 'notas', d.notas, 'Condiciones, exclusividad, fechas…')}
      <button type="button" class="dc-enviar" data-m="${_dcAttr(m)}" onclick="dcEnviarPedido(this.dataset.m, this)">📨 Enviar a validar</button>
    </div>`;
  }).join('');
  return `<div class="cafe-q-label">¿Qué le pide el cliente a la marca?</div>
    <div class="sega-chips">${chips}</div>
    ${fichas}
    <div class="dc-nota">El pedido de acción le llega al supervisor para validarlo. Hasta que lo apruebe, queda pendiente.</div>
    ${dcHtmlPedidos()}`;
}

function dcHtmlPedidos() {
  if (!DC.pedidos.length) return '';
  return `<div class="dc-ped-tit">Pedidos de acción de este cliente</div>` + DC.pedidos.map(p => {
    const e = DC_ESTADOS[p.estado] || DC_ESTADOS.pendiente;
    return `<div class="dc-ped">
      <div class="dc-ped-info"><b>${esc(p.marca)}</b>
        <small>${esc(_dcFecha(p.created_at))}${p.vendedor_nombre ? ' · ' + esc(p.vendedor_nombre) : ''}</small>
        ${p.necesita ? `<small>${esc(p.necesita)}</small>` : ''}
        ${p.nota_supervisor ? `<small class="dc-ped-nota">Supervisor: ${esc(p.nota_supervisor)}</small>` : ''}</div>
      <span class="dc-est ${e.cls}">${e.ico} ${e.txt}</span></div>`;
  }).join('');
}

// EVENTOS PRE ARMADOS: los planes que cargó Luciana en esta sección.
function dcHtmlEventosPA(sec) {
  if (sec && Array.isArray(sec.planes)) DC.planesEventos = sec.planes;
  const planes = DC.planesEventos;
  if (!planes.length) return `<div class="dc-nota" style="margin-top:0">Todavía no hay eventos cargados. Los carga Luciana desde <b>Planes</b>, en Discos → Eventos pre armados.</div>`;
  return `<div class="cafe-q-label">Eventos para ofrecerle</div>` + planes.map(p => {
    const v = DC.ventas[p.id];
    const estado = v
      ? `<div class="dc-vendido">✅ Vendido · ${esc(_dcFecha(v.created_at))}${v.vendedor_nombre ? ' · ' + esc(v.vendedor_nombre) : ''}
           ${DC.cerrados.includes(p.id) ? `<button type="button" class="dc-quitar" data-id="${_dcAttr(p.id)}" onclick="dcDeshacerEvento(this.dataset.id)">Deshacer</button>` : ''}</div>`
      : `<button type="button" class="dc-enviar" data-id="${_dcAttr(p.id)}" onclick="dcCerrarEvento(this.dataset.id, this)">🤝 Cerrar evento</button>`;
    const sub = [p.subtitulo, p.pill !== 'Plan' ? p.pill : ''].filter(Boolean).join(' · ');
    return `<div class="dc-ficha dc-evento${v ? ' vendido' : ''}">
      <div class="dc-ficha-tit">${esc(p.titulo)}</div>
      ${sub ? `<small class="dc-ev-sub">${esc(sub)}</small>` : ''}
      ${p.desc ? `<div class="dc-ev-desc">${esc(p.desc)}</div>` : ''}
      ${(p.tags || []).length ? `<div class="sega-chips" style="margin-top:6px">${p.tags.map(t => `<span class="sega-chip" style="cursor:default">${esc(t)}</span>`).join('')}</div>` : ''}
      ${p.pdf_url ? `<a class="dc-ev-pdf" href="${_dcAttr(p.pdf_url)}" target="_blank" rel="noopener">📄 Ver el evento</a>` : ''}
      ${estado}</div>`;
  }).join('');
}

function dcHtmlSunset() {
  const b = (v, t) => `<button type="button" class="cafe-q-btn${DC.sunset === v ? ' active' : ''}" onclick="dcElegirSunset(${v})">${t}</button>`;
  const s = DC.sunsetInfo;
  return `<div class="cafe-q-label">¿El cliente hace sunset?</div>
    <div class="cafe-q-sino">${b(true, 'Sí, hace')}${b(false, 'No')}</div>
    ${DC.sunset === true ? `
      <div class="dc-fila">${dcCampo('Días y horario', 'sunsetInfo.dias', s.dias, 'Ej: domingos de 18 a 23 h')}${dcCampo('Público estimado', 'sunsetInfo.publico', s.publico, 'Personas', 'number')}</div>
      ${dcCampo('Marcas que usa en el sunset', 'sunsetInfo.marcas', s.marcas, 'Ej: Aperol, Campari')}
      ${dcCampo('Qué necesita', 'sunsetInfo.necesita', s.necesita, 'Ej: barra de spritz, bartender')}` : ''}
    <div class="dc-nota">La respuesta queda en la ficha del cliente.</div>`;
}

function dcHtmlActivacion() {
  const a = DC.activacion;
  const chips = DC_RECURSOS.map(r =>
    `<span class="sega-chip${a.recursos.includes(r) ? ' sel' : ''}" data-r="${_dcAttr(r)}" onclick="dcToggleRecurso(this.dataset.r)">${esc(r)}</span>`).join('');
  return `<div class="cafe-q-label">¿Qué necesita para la activación?</div>
    <div class="sega-chips">${chips}</div>
    <div class="dc-fila">${dcCampo('Marca', 'activacion.marca', a.marca, 'Ej: Campari')}${dcCampo('Fecha', 'activacion.fecha', a.fecha, '', 'date')}</div>
    ${dcCampo('Detalle', 'activacion.nota', a.nota, 'Ej: 2 bartenders, 200 shots de bienvenida')}
    <div class="dc-nota">📸 Toda acción lleva evidencia: el cliente publica la foto en sus redes.</div>`;
}

function dcHtmlLista(clave) {
  const L = DC_LISTAS[clave];
  return `<div class="cafe-q-label">${esc(L.titulo)}</div>
    ${DC[clave].map((f, i) => `<div class="dc-ficha">
      ${L.cols.map(([k, lab, ph, tipo]) => dcCampo(lab, `${clave}.${i}.${k}`, f[k], ph, tipo)).join('')}
      <button type="button" class="dc-quitar" onclick="dcQuitar('${clave}', ${i})">Quitar</button></div>`).join('')}
    <button type="button" class="dc-add" onclick="dcAgregar('${clave}')">${esc(L.boton)}</button>
    <div class="dc-nota">${esc(L.nota)}</div>`;
}

// ── Acciones ────────────────────────────────────────────────
function dcCambio() {
  if (typeof actualizarCierreMinuta === 'function') actualizarCierreMinuta();
}
// Los campos de texto solo actualizan el estado (sin redibujar, para no perder el foco).
function dcSet(path, v) {
  const k = path.split('.');
  let o = DC;
  for (let i = 0; i < k.length - 1; i++) o = o[k[i]] = o[k[i]] || {};
  o[k[k.length - 1]] = v;
  dcCambio();
}
function dcToggleMarca(m) {
  if (DC.marcas[m]) delete DC.marcas[m]; else DC.marcas[m] = {};
  dcPintar('dc_marcas'); dcCambio();
}
function dcToggleRecurso(r) {
  const a = DC.activacion.recursos, i = a.indexOf(r);
  if (i >= 0) a.splice(i, 1); else a.push(r);
  dcPintar('dc_activacion'); dcCambio();
}
function dcAgregar(clave) { DC[clave].push({}); dcPintar(DC_LISTAS[clave].tipo); }
function dcQuitar(clave, i) { DC[clave].splice(i, 1); dcPintar(DC_LISTAS[clave].tipo); dcCambio(); }

async function dcElegirSunset(v) {
  DC.sunset = v;
  dcPintar('dc_sunset'); dcCambio();
  await dcGuardarPerfil({ sunset: v });
}

// Manda el pedido a validar: queda en partner_pedidos como 'pendiente'.
// Con RLS un insert bloqueado vuelve sin error y sin filas: por eso el select.
async function dcEnviarPedido(m, btn) {
  const d = DC.marcas[m] || {};
  const marca = m === DC_OTRA ? String(d.nombre || '').trim() : m;
  if (!marca) { showToast('Poné el nombre de la marca', 'error'); return; }
  if (!String(d.necesita || '').trim()) { showToast('Contá qué necesita el cliente de la marca', 'error'); return; }
  const v = _dcVend();
  const fila = {
    cliente_id: cliente.id, cliente_nombre: cliente.nombre || null,
    vendedor_id: v.id || null, vendedor_codigo: v.codigo || null, vendedor_nombre: v.nombre || null,
    marca, necesita: String(d.necesita).trim(),
    volumen: d.volumen || null, preferidas: d.preferidas || null,
    fee: _dcNum(d.fee), plata: _dcNum(d.plata), notas: d.notas || null,
  };
  if (btn) btn.disabled = true;
  try {
    const { data, error } = await sb.from('partner_pedidos').insert(fila).select('*');
    if (error || !data || !data.length) throw new Error(error ? error.message : 'sin permiso');
    DC.pedidos.unshift(data[0]);
    DC.enviados.push(data[0].id);
    delete DC.marcas[m];
    dcPintar('dc_marcas'); dcCambio();
    showToast('📨 Pedido de acción enviado al supervisor', 'success');
  } catch (e) {
    console.warn('[discos] no se pudo enviar el pedido:', e.message);
    if (btn) btn.disabled = false;
    showToast('No se pudo enviar el pedido de acción', 'error');
  }
}

// Cierra un evento pre armado: queda vendido para este cliente.
async function dcCerrarEvento(planId, btn) {
  const p = DC.planesEventos.find(x => String(x.id) === String(planId));
  if (!p || !confirm(`¿${cliente.nombre} tomó "${p.titulo}"?\nQueda como vendido para este cliente.`)) return;
  if (btn) btn.disabled = true;
  const v = _dcVend();
  try {
    const { data, error } = await sb.from('evento_ventas')
      .insert({ plan_id: p.id, cliente_id: cliente.id, vendedor_id: v.id || null, vendedor_nombre: v.nombre || null }).select('*');
    if (error && error.code === '23505') {          // ya estaba vendido a este cliente
      await dcCargarVentas(); dcPintar('dc_eventos_pa');
      showToast('Ese evento ya figuraba vendido a este cliente', 'success');
      return;
    }
    if (error || !data || !data.length) throw new Error(error ? error.message : 'sin permiso');
    DC.ventas[p.id] = data[0];
    DC.cerrados.push(p.id);
    dcPintar('dc_eventos_pa'); dcCambio();
    showToast('✅ Evento vendido', 'success');
  } catch (e) {
    console.warn('[discos] no se pudo cerrar el evento:', e.message);
    if (btn) btn.disabled = false;
    showToast('No se pudo cerrar el evento', 'error');
  }
}
// Solo lo vendido en ESTA visita se puede deshacer (por si se tocó sin querer).
async function dcDeshacerEvento(planId) {
  const v = DC.ventas[planId];
  if (!v || !confirm('¿Deshacer la venta de este evento?')) return;
  const { data, error } = await sb.from('evento_ventas').delete().eq('id', v.id).select('id');
  if (error || !data || !data.length) { showToast('No se pudo deshacer', 'error'); return; }
  delete DC.ventas[planId];
  DC.cerrados = DC.cerrados.filter(x => x !== planId);
  dcPintar('dc_eventos_pa'); dcCambio();
}

async function dcCargarPedidos() {
  try {
    const { data, error } = await sb.from('partner_pedidos').select('*')
      .eq('cliente_id', cliente.id).order('created_at', { ascending: false }).limit(20);
    if (!error) DC.pedidos = data || [];
  } catch (e) { /* sin tabla todavía (falta manual-disco-v3.sql) */ }
}
async function dcCargarVentas() {
  try {
    const { data, error } = await sb.from('evento_ventas').select('*').eq('cliente_id', cliente.id);
    if (!error) { DC.ventas = {}; (data || []).forEach(x => { DC.ventas[x.plan_id] = x; }); }
  } catch (e) { /* sin tabla todavía */ }
}

// Guarda en la ficha del cliente (clientes.perfil), sumando a lo que ya tenía.
// Con RLS un update bloqueado vuelve sin error y sin filas: por eso el select.
// Aunque no se pueda guardar en la base, queda en la sesión: así un cambio de
// formato sobrevive a la recarga del manual.
async function dcGuardarPerfil(cambios) {
  const perfil = { ...(cliente.perfil || {}), ...cambios };
  cliente.perfil = perfil;
  if (typeof persistClienteSession === 'function') persistClienteSession();
  try {
    const { data, error } = await sb.from('clientes').update({ perfil }).eq('id', cliente.id).select('id');
    if (error || !data || !data.length) throw new Error(error ? error.message : 'sin permiso');
    showToast('✓ Guardado en la ficha del cliente', 'success');
  } catch (e) {
    console.warn('[discos] no se pudo guardar el perfil:', e.message);
    showToast('No se pudo guardar en la ficha (queda solo por hoy)', 'error');
  }
}

// ── Guardar y resumir ───────────────────────────────────────
// Lo que va a progreso._disco al guardar la visita (null si no es un disco).
function dcProgreso() {
  if (typeof checklist === 'undefined' || !_esDisco(checklist)) return null;
  const lleno = o => Object.values(o || {}).some(v => String(v == null ? '' : v).trim() !== '');
  const a = DC.activacion;
  const nombreEvento = id => { const p = DC.planesEventos.find(x => String(x.id) === String(id)); return p ? p.titulo : ''; };
  return {
    formato: DC.formato,
    pedidos_enviados: DC.pedidos.filter(p => DC.enviados.includes(p.id)).map(p => ({ id: p.id, marca: p.marca, necesita: p.necesita })),
    pedidos_sin_enviar: Object.entries(DC.marcas).map(([m, d]) => ({ ...d, marca: m === DC_OTRA ? (d.nombre || DC_OTRA) : m })),
    eventos_vendidos: DC.cerrados.map(id => ({ plan_id: id, nombre: nombreEvento(id) })),
    activacion: (a.recursos.length || a.marca || a.fecha || a.nota) ? a : null,
    sunset: DC.sunset,
    sunset_info: DC.sunset ? DC.sunsetInfo : null,
    restringidos: DC.restringidos.filter(lleno),
    eventos_cliente: DC.eventos.filter(lleno),
  };
}

// Bloques para la minuta del cierre (recibe el armador de bloques de visita.html).
function dcMinuta(bloque) {
  const d = dcProgreso();
  if (!d) return '';
  const unir  = a => a.filter(Boolean).join(' · ');
  const fecha = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '';
  const f = DC_FORMATOS[d.formato];
  const s = d.sunset_info || {};
  return bloque('Formato del boliche', f ? [f.nombre] : [])
    + bloque('Eventos vendidos', d.eventos_vendidos.map(e => e.nombre))
    + bloque('Pedidos de acción (a validar)', d.pedidos_enviados.map(p => unir([p.marca, p.necesita])))
    + bloque('Pedidos de acción sin enviar', d.pedidos_sin_enviar.map(p => p.marca + ': todavía no se mandó a validar'))
    + bloque('Activación pedida', d.activacion ? [unir([d.activacion.recursos.join(', '), d.activacion.marca, fecha(d.activacion.fecha), d.activacion.nota])] : [])
    + bloque('Sunset', d.sunset ? [unir(['Hace sunset', s.dias, s.publico && s.publico + ' personas', s.necesita])] : [])
    + bloque('Materiales restringidos (a aprobar)', d.restringidos.map(r => unir([r.material, r.cantidad && r.cantidad + ' u.', r.motivo])))
    + bloque('Eventos del cliente', d.eventos_cliente.map(e => unir([fecha(e.fecha), e.evento, e.necesita])));
}

// ── Después de dibujar el manual (lo llama init() de visita.html) ──
async function dcInit() {
  if (typeof checklist === 'undefined' || !_esDisco(checklist)) return;
  dcPintarBarra();
  dcPintar('dc_sunset');
  await Promise.all([dcCargarPedidos(), dcCargarVentas()]);
  dcPintar('dc_marcas');
  dcPintar('dc_eventos_pa');
}

// ── Estilos ─────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
  .dc-block { background: var(--crema); border: 1px solid rgba(31,68,127,.12); }
  .dc-ops { display: flex; gap: 8px; }
  .dc-op { flex: 1; display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 12px;
    background: #fff; border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm);
    font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .dc-op b { font-size: 14px; color: var(--azul); }
  .dc-op.on { background: var(--azul); border-color: var(--azul); }
  .dc-op.on b { color: #fff; }
  .dc-nota { font-size: 11.5px; color: var(--text3); margin-top: 9px; line-height: 1.45; }
  .dc-ficha { background: #fff; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; margin-top: 10px; }
  .dc-ficha-tit { font-weight: 800; color: var(--azul); font-size: 13px; }
  .dc-fila { display: flex; gap: 8px; }
  .dc-fila > .cierre-field { flex: 1; min-width: 0; }
  .dc-add { margin-top: 10px; width: 100%; padding: 10px; background: none; border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-sm); font-family: inherit; font-size: 13px; font-weight: 700; color: var(--azul); cursor: pointer; }
  .dc-quitar { margin-top: 8px; background: none; border: 0; padding: 0; font-family: inherit; font-size: 11.5px;
    font-weight: 700; color: #b3261e; cursor: pointer; }
  .dc-enviar { margin-top: 12px; width: 100%; padding: 11px; background: var(--azul); color: #fff; border: 0;
    border-bottom: 3px solid var(--dorado); border-radius: var(--radius-sm); font-family: inherit; font-size: 13px;
    font-weight: 700; cursor: pointer; }
  .dc-enviar:disabled { opacity: .5; cursor: default; }

  /* Pedidos del cliente */
  .dc-ped-tit { font-size: 11px; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: .04em; margin: 14px 0 6px; }
  .dc-ped { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; background: #fff;
    border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 11px; margin-top: 6px; }
  .dc-ped-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .dc-ped-info b { font-size: 13px; color: var(--azul); }
  .dc-ped-info small { font-size: 11.5px; color: var(--text3); line-height: 1.35; }
  .dc-ped-nota { color: var(--text2) !important; font-style: italic; }
  .dc-est { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
  .dc-est.pend { background: #fbf1d9; color: #8a6412; }
  .dc-est.ok   { background: #e3f1e7; color: #1f6b3a; }
  .dc-est.no   { background: #fbe4df; color: #a2321f; }

  /* Eventos pre armados */
  .dc-evento.vendido { border-color: #9fcfae; background: #f3faf5; }
  .dc-ev-sub { display: block; font-size: 11.5px; color: var(--text3); margin-top: 2px; }
  .dc-ev-desc { font-size: 12.5px; color: var(--text2); margin-top: 6px; line-height: 1.45; white-space: pre-line; }
  .dc-ev-pdf { display: inline-block; margin-top: 8px; font-size: 12px; font-weight: 700; color: var(--azul); }
  .dc-vendido { margin-top: 10px; font-size: 12.5px; font-weight: 700; color: #1f6b3a; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .dc-vendido .dc-quitar { margin-top: 0; }

  /* Ventana "¿con previa o sin previa?" */
  .dc-modal-ov { position: fixed; inset: 0; z-index: 9999; background: rgba(13,34,56,.55);
    display: flex; align-items: flex-end; justify-content: center; padding: 16px; }
  .dc-modal { width: 100%; max-width: 440px; background: var(--surface, #fff); border-radius: 16px;
    padding: 20px 18px 18px; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
  .dc-modal-tit { font-size: 17px; font-weight: 800; color: var(--azul); line-height: 1.3; }
  .dc-modal-sub { font-size: 12.5px; color: var(--text3); margin: 6px 0 14px; line-height: 1.45; }
  .dc-modal .dc-ops { flex-direction: column; }
  .dc-modal .dc-op { padding: 15px 14px; }
  .dc-modal-x { margin-top: 12px; width: 100%; padding: 10px; background: none; border: 0; font-family: inherit;
    font-size: 13px; font-weight: 700; color: var(--text2); cursor: pointer; }
  @media (min-width: 600px) { .dc-modal-ov { align-items: center; } }

  /* Barra arriba del manual */
  .dc-barra { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; padding: 10px 12px;
    background: var(--crema); border: 1px solid rgba(31,68,127,.14); border-radius: var(--radius-sm); }
  .dc-barra-ico { font-size: 22px; }
  .dc-barra-txt { flex: 1; }
  .dc-barra-txt b { font-size: 13.5px; color: var(--azul); }
  .dc-barra-btn { background: #fff; border: 1.5px solid var(--border-strong); border-radius: 20px; padding: 6px 13px;
    font-family: inherit; font-size: 12px; font-weight: 700; color: var(--azul); cursor: pointer; }
</style>`);
