// ============================================================
//  Manual de DISCOS · herramientas de la visita (las usa visita.html)
//
//  Salen de la reunión de discos (minuta de septiembre 2026):
//   · CON PREVIA o SIN PREVIA: al entrar al manual de un boliche se elige cómo
//     trabaja ("Boliche con previa" o "Boliche sin previa", sin más detalle: así lo(?
)//     pidió el usuario). Queda en la ficha del cliente (clientes.perfil) y las
//     próximas visitas ya entran con eso. Según la respuesta, el manual se arma
//     SIN las secciones que no corresponden: cada sección dice en qué caso se
//     muestra (checklist_secciones.solo_formato, se edita en Secciones → Discos).
//     Ej: Carta (Vino por Copa, Mix Ideal…) va solo con previa.
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

const DC_FORMATOS = {
  con_previa: { ico: '🍽️', nombre: 'Boliche con previa' },
  sin_previa: { ico: '🌙', nombre: 'Boliche sin previa' },
};

// Qué herramienta va en cada subsección (código → herramienta).
const DC_WIDGETS = {
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

const _esDisco = cl => !!cl && cl.id === 'disco';

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
function dcRender(tipo) {
  return `<div class="esp-block dc-block" id="dc-${tipo}">${dcHtml(tipo)}</div>`;
}
function dcPintar(tipo) {
  const el = document.getElementById('dc-' + tipo);
  if (el) el.innerHTML = dcHtml(tipo);
}
function dcHtml(tipo) {
  switch (tipo) {
    case 'dc_marcas':       return dcHtmlMarcas();
    case 'dc_sunset':       return dcHtmlSunset();
    case 'dc_activacion':   return dcHtmlActivacion();
    case 'dc_restringidos': return dcHtmlLista('restringidos');
    case 'dc_eventos':      return dcHtmlLista('eventos');
  }
  return '';
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

async function dcElegirSunset(v) {
  DC.sunset = v;
  dcPintar('dc_sunset'); dcCambio();
  await dcGuardarPerfil({ sunset: v });
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
  const f = DC_FORMATOS[d.formato];
  const s = d.sunset_info || {};
  return bloque('Formato del boliche', f ? [f.nombre] : [])
    + bloque('Relevamiento por marca', d.marcas.map(m => `${m.marca}: ` + (unir([
        m.volumen, m.preferidas && 'prefiere ' + m.preferidas, m.fee && 'fee ' + pesos(m.fee), m.plata && 'pide ' + pesos(m.plata),
      ]) || 'sin datos todavía')))
    + bloque('Sunset', d.sunset ? [unir(['Hace sunset', s.dias, s.publico && s.publico + ' personas', s.necesita])] : [])
    + bloque('Activación pedida', d.activacion ? [unir([d.activacion.recursos.join(', '), d.activacion.marca, fecha(d.activacion.fecha), d.activacion.nota])] : [])
    + bloque('Materiales restringidos (a aprobar)', d.restringidos.map(r => unir([r.material, r.cantidad && r.cantidad + ' u.', r.motivo])))
    + bloque('Eventos del cliente', d.eventos_cliente.map(e => unir([fecha(e.fecha), e.evento, e.necesita])));
}

// ── Después de dibujar el manual (lo llama init() de visita.html) ──
function dcInit() {
  if (typeof checklist === 'undefined' || !_esDisco(checklist)) return;
  dcPintarBarra();
  dcPintar('dc_sunset');
}

// ── Estilos ─────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
  .dc-block { background: var(--crema); border: 1px solid rgba(31,68,127,.12); }
  .dc-ops { display: flex; gap: 8px; }
  .dc-op { flex: 1; display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 12px;
    background: #fff; border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm);
    font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .dc-op b { font-size: 14px; color: var(--azul); }
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

  /* Ventana "¿con previa o sin previa?" */
  .dc-modal-ov { position: fixed; inset: 0; z-index: 9999; background: rgba(13,34,56,.55);
    display: flex; align-items: flex-end; justify-content: center; padding: 16px; }
  .dc-modal { width: 100%; max-width: 440px; background: var(--surface, #fff); border-radius: 16px;
    padding: 20px 18px 18px; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
  .dc-modal-tit { font-size: 17px; font-weight: 800; color: var(--azul); line-height: 1.3; }
  .dc-modal-sub { font-size: 12.5px; color: var(--text3); margin: 6px 0 14px; line-height: 1.45; }
  .dc-modal .dc-ops { flex-direction: column; }
  .dc-modal .dc-op { padding: 14px; }
  .dc-modal-x { margin-top: 12px; width: 100%; padding: 10px; background: none; border: 0; font-family: inherit;
    font-size: 13px; font-weight: 700; color: var(--text2); cursor: pointer; }
  @media (min-width: 600px) { .dc-modal-ov { align-items: center; } }

  /* Barra arriba del manual */
  .dc-barra { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; padding: 10px 12px;
    background: var(--crema); border: 1px solid rgba(31,68,127,.14); border-radius: var(--radius-sm); }
  .dc-barra-ico { font-size: 22px; }
  .dc-barra-txt { flex: 1; display: flex; flex-direction: column; }
  .dc-barra-txt b { font-size: 13.5px; color: var(--azul); }
  .dc-barra-txt small { font-size: 11.5px; color: var(--text3); }
  .dc-barra-btn { background: #fff; border: 1.5px solid var(--border-strong); border-radius: 20px; padding: 6px 13px;
    font-family: inherit; font-size: 12px; font-weight: 700; color: var(--azul); cursor: pointer; }
</style>`);
