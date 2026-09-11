// ============================================================
//  Manual de DISCOS · herramientas de la visita (las usa visita.html)
//
//  Salen de la reunión de discos (minuta de septiembre 2026):
//   · El FORMATO del boliche se define la primera vez y queda en la ficha del
//     cliente (clientes.perfil): con previa = cena desde las 21 h + boliche;
//     sin previa = solo boliche nocturno. La sección CARTA solo aparece en los
//     boliches con previa.
//   · Los ACUERDOS son un relevamiento (volumen, marcas preferidas, fee, plata
//     solicitada), no un documento cerrado: Comercial los define después.
//   · SUNSET va dentro de Acuerdos, con la pregunta previa de si lo hace
//     (la respuesta también queda en la ficha).
//   · Activaciones en el PDV (siempre con evidencia en redes), materiales
//     restringidos que se piden con motivo, y los eventos propios del cliente.
//
//  Cada herramienta se engancha por el CÓDIGO de su subsección (dc_*), que crea
//  manual-disco-v2.sql. Si Luciana renombra una sección no pasa nada; si le
//  cambia el código, la herramienta deja de aparecer.
//  Lo que carga el vendedor se guarda con la visita, en progreso._disco.
// ============================================================

// Marcas con formulario de relevamiento. Los modelos de acuerdo de cada una los
// traen Florencia y Milena (pendiente de la minuta); cuando lleguen, van acá.
const DC_MARCAS   = ['Pernod Ricard', 'Campari', 'Viajero'];
const DC_OTRA     = 'Otra marca';
const DC_RECURSOS = ['Bartender', 'Bandejas de shot', 'Tragos regalados', 'Merchandise de marca', 'Precintos'];

// Qué herramienta va en cada subsección (código → herramienta).
const DC_WIDGETS = {
  dc_intro:            'dc_formato',
  dc_acuerdos_marca:   'dc_marcas',
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
  marcas: {},             // { 'Campari': { volumen, preferidas, fee, plata, notas } }
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

// ── Render ──────────────────────────────────────────────────
const _dcAttr = s => esc(String(s == null ? '' : s));

function dcCampo(label, path, valor, ph, tipo) {
  return `<div class="cierre-field"><label>${esc(label)}</label>
    <input type="${tipo || 'text'}"${tipo === 'number' ? ' inputmode="numeric" min="0"' : ''} value="${_dcAttr(valor)}"
      placeholder="${_dcAttr(ph)}" data-p="${_dcAttr(path)}" oninput="dcSet(this.dataset.p, this.value)"></div>`;
}

// La llama widgetSlotHtml() de visita.html.
function dcRender(tipo) {
  return `<div class="esp-block dc-block" id="dc-${tipo}">${dcHtml(tipo)}</div>`;
}
function dcPintar(tipo) {
  const el = document.getElementById('dc-' + tipo);
  if (el) el.innerHTML = dcHtml(tipo);
}
function dcHtml(tipo) {
  switch (tipo) {
    case 'dc_formato':      return dcHtmlFormato();
    case 'dc_marcas':       return dcHtmlMarcas();
    case 'dc_sunset':       return dcHtmlSunset();
    case 'dc_activacion':   return dcHtmlActivacion();
    case 'dc_restringidos': return dcHtmlLista('restringidos');
    case 'dc_eventos':      return dcHtmlLista('eventos');
  }
  return '';
}

function dcHtmlFormato() {
  const op = (v, ico, tit, sub) => `<button type="button" class="dc-op${DC.formato === v ? ' on' : ''}" onclick="dcElegirFormato('${v}')">
      <b>${ico} ${tit}</b><small>${sub}</small></button>`;
  return `<div class="cafe-q-label">¿Cómo trabaja este boliche?</div>
    <div class="dc-ops">${op('con_previa', '🍽️', 'Con previa', 'Cena desde las 21 h + boliche')}${op('sin_previa', '🌙', 'Sin previa', 'Solo boliche nocturno')}</div>
    <div class="dc-nota">${DC.formato
      ? 'Queda guardado en la ficha: la próxima visita ya aparece elegido. La sección Carta se muestra solo con previa.'
      : 'Se elige la primera vez y queda guardado para las próximas visitas.'}</div>`;
}

function dcHtmlMarcas() {
  const chips = [...DC_MARCAS, DC_OTRA].map(m =>
    `<span class="sega-chip${DC.marcas[m] ? ' sel' : ''}" data-m="${_dcAttr(m)}" onclick="dcToggleMarca(this.dataset.m)">${esc(m)}</span>`).join('');
  const fichas = Object.keys(DC.marcas).map(m => {
    const d = DC.marcas[m], p = 'marcas.' + m + '.';
    return `<div class="dc-ficha"><div class="dc-ficha-tit">${esc(m)}</div>
      ${m === DC_OTRA ? dcCampo('¿Qué marca?', p + 'nombre', d.nombre, 'Nombre de la marca') : ''}
      ${dcCampo('Volumen de consumo', p + 'volumen', d.volumen, 'Ej: 15 cajas por mes')}
      ${dcCampo('Marcas / productos que prefiere', p + 'preferidas', d.preferidas, 'Ej: Absolut, Jameson')}
      <div class="dc-fila">${dcCampo('Fee que pide', p + 'fee', d.fee, '$', 'number')}${dcCampo('Plata que solicita', p + 'plata', d.plata, '$', 'number')}</div>
      ${dcCampo('Notas', p + 'notas', d.notas, 'Condiciones, exclusividad, fechas…')}
    </div>`;
  }).join('');
  return `<div class="cafe-q-label">¿Con qué marcas quiere trabajar?</div>
    <div class="sega-chips">${chips}</div>
    ${fichas}
    <div class="dc-nota">Es un relevamiento: no cierres montos. Comercial define el acuerdo después con esta información.</div>`;
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

// Carta solo en los boliches con previa. Sin formato elegido todavía, se muestra.
function dcAplicarFormato() {
  const el = document.getElementById('sec-dc_carta');
  if (el) el.style.display = DC.formato === 'sin_previa' ? 'none' : '';
}

async function dcElegirFormato(v) {
  DC.formato = v;
  dcPintar('dc_formato'); dcAplicarFormato(); dcCambio();
  await dcGuardarPerfil({ formato: v });
}
async function dcElegirSunset(v) {
  DC.sunset = v;
  dcPintar('dc_sunset'); dcCambio();
  await dcGuardarPerfil({ sunset: v });
}

// Guarda en la ficha del cliente (clientes.perfil), sumando a lo que ya tenía.
// Con RLS un update bloqueado vuelve sin error y sin filas: por eso el select.
async function dcGuardarPerfil(cambios) {
  const perfil = { ...(cliente.perfil || {}), ...cambios };
  try {
    const { data, error } = await sb.from('clientes').update({ perfil }).eq('id', cliente.id).select('id');
    if (error || !data || !data.length) throw new Error(error ? error.message : 'sin permiso');
    cliente.perfil = perfil;
    if (typeof persistClienteSession === 'function') persistClienteSession();
    showToast('✓ Guardado en la ficha del cliente', 'success');
  } catch (e) {
    console.warn('[discos] no se pudo guardar el perfil:', e.message);
    showToast('No se pudo guardar en la ficha (queda solo en esta visita)', 'error');
  }
}

// ── Guardar y resumir ───────────────────────────────────────
// Lo que va a progreso._disco al guardar la visita (null si no es un disco).
function dcProgreso() {
  if (typeof checklist === 'undefined' || !checklist || checklist.id !== 'disco') return null;
  const lleno = o => Object.values(o || {}).some(v => String(v == null ? '' : v).trim() !== '');
  const a = DC.activacion;
  return {
    formato: DC.formato,
    sunset: DC.sunset,
    sunset_info: DC.sunset ? DC.sunsetInfo : null,
    marcas: Object.entries(DC.marcas).map(([m, d]) => ({ ...d, marca: m === DC_OTRA ? (d.nombre || DC_OTRA) : m })),
    activacion: (a.recursos.length || a.marca || a.fecha || a.nota) ? a : null,
    restringidos: DC.restringidos.filter(lleno),
    eventos_cliente: DC.eventos.filter(lleno),
  };
}

// Bloques para la minuta del cierre (recibe el armador de bloques de visita.html).
function dcMinuta(bloque) {
  const d = dcProgreso();
  if (!d) return '';
  const pesos = n => n ? '$' + Number(n).toLocaleString('es-AR') : '';
  const unir  = a => a.filter(Boolean).join(' · ');
  const fecha = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '';
  const FORMATO = { con_previa: 'Con previa (cena + boliche)', sin_previa: 'Sin previa (solo boliche)' };
  const s = d.sunset_info || {};
  return bloque('Formato del boliche', d.formato ? [FORMATO[d.formato]] : [])
    + bloque('Relevamiento por marca', d.marcas.map(m => `${m.marca}: ` + (unir([
        m.volumen, m.preferidas && 'prefiere ' + m.preferidas, m.fee && 'fee ' + pesos(m.fee), m.plata && 'pide ' + pesos(m.plata),
      ]) || 'sin datos todavía')))
    + bloque('Sunset', d.sunset ? [unir(['Hace sunset', s.dias, s.publico && s.publico + ' personas', s.necesita])] : [])
    + bloque('Activación pedida', d.activacion ? [unir([d.activacion.recursos.join(', '), d.activacion.marca, fecha(d.activacion.fecha), d.activacion.nota])] : [])
    + bloque('Materiales restringidos (a aprobar)', d.restringidos.map(r => unir([r.material, r.cantidad && r.cantidad + ' u.', r.motivo])))
    + bloque('Eventos del cliente', d.eventos_cliente.map(e => unir([fecha(e.fecha), e.evento, e.necesita])));
}

// ── Arranque (lo llama init() de visita.html) ───────────────
async function dcInit() {
  if (typeof checklist === 'undefined' || !checklist || checklist.id !== 'disco') return;
  // La ficha que viene de la lista puede no traer el perfil: se lee acá.
  try {
    const { data, error } = await sb.from('clientes').select('perfil').eq('id', cliente.id).maybeSingle();
    if (!error && data) cliente.perfil = data.perfil || {};
  } catch (e) { /* sin columna perfil todavía: se pregunta igual, queda solo en la visita */ }
  const p = cliente.perfil || {};
  DC.formato = p.formato || null;
  if (typeof p.sunset === 'boolean') DC.sunset = p.sunset;
  dcPintar('dc_formato'); dcPintar('dc_sunset');
  dcAplicarFormato();
  // Primera visita: abrir la introducción para que el vendedor elija el formato.
  if (!DC.formato) {
    const sec = document.getElementById('sec-dc_intro');
    if (sec && !sec.classList.contains('expanded') && typeof toggleSec === 'function') toggleSec('dc_intro');
  }
}

// ── Estilos ─────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
  .dc-block { background: var(--crema); border: 1px solid rgba(31,68,127,.12); }
  .dc-ops { display: flex; gap: 8px; }
  .dc-op { flex: 1; display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 11px 12px;
    background: #fff; border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm);
    font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .dc-op b { font-size: 13.5px; color: var(--azul); }
  .dc-op small { font-size: 11.5px; color: var(--text3); line-height: 1.35; }
  .dc-op.on { background: var(--azul); border-color: var(--azul); }
  .dc-op.on b, .dc-op.on small { color: #fff; }
  .dc-nota { font-size: 11.5px; color: var(--text3); margin-top: 9px; line-height: 1.45; }
  .dc-ficha { background: #fff; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; margin-top: 10px; }
  .dc-ficha-tit { font-weight: 800; color: var(--azul); font-size: 13px; }
  .dc-fila { display: flex; gap: 8px; }
  .dc-fila > .cierre-field { flex: 1; min-width: 0; }
  .dc-add { margin-top: 10px; width: 100%; padding: 10px; background: none; border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-sm); font-family: inherit; font-size: 13px; font-weight: 700; color: var(--azul); cursor: pointer; }
  .dc-quitar { margin-top: 8px; background: none; border: 0; padding: 0; font-family: inherit; font-size: 11.5px;
    font-weight: 700; color: #b3261e; cursor: pointer; }
</style>`);
