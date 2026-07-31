// ─── Render compartido de Acciones Mensuales ────────────────────────────────
// Usado en visita.html, admin.html y supervisor.html

// Inyectar CSS una sola vez
(function () {
  if (document.getElementById('_am-styles')) return;
  const s = document.createElement('style');
  s.id = '_am-styles';
  s.textContent = `
    /* ── Separador categoría principal ── */
    .am-cat-sep {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: #9E9B96;
      display: flex; align-items: center; gap: 8px;
      margin: 16px 0 10px;
    }
    .am-cat-sep::after { content:''; flex:1; height:1px; background:rgba(31,68,127,.12); }

    /* ── Separador subcategoría ── */
    .am-subcat-sep {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: #1F447F;
      display: flex; align-items: center; gap: 7px;
      margin: 12px 0 7px; opacity: .75;
    }
    .am-subcat-sep::after { content:''; flex:1; height:1px; background:rgba(31,68,127,.15); }

    /* ── Card base ── */
    .am-card {
      display: flex; gap: 0; align-items: stretch;
      background: #fff;
      border: 1px solid rgba(203,184,106,.35);
      border-left: 4px solid #CBB86A;
      border-radius: 12px;
      margin-bottom: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
      overflow: hidden;
      transition: border-color .2s, background .2s, box-shadow .2s;
      -webkit-tap-highlight-color: transparent;
    }
    /* Estado: seleccionada */
    .am-card.am-seleccionada {
      border-color: #2D6A4F;
      border-left-color: #2D6A4F;
      background: #F0FAF4;
      box-shadow: 0 2px 12px rgba(45,106,79,.18);
    }

    /* ── Imagen (30%) ── */
    .am-card-img {
      width: 30%; flex-shrink: 0;
      background: #f7f5f2;
      display: flex; align-items: center; justify-content: center;
      padding: 10px 8px; min-height: 120px;
    }
    .am-card.am-seleccionada .am-card-img { background: #E8F5EE; }
    .am-card-img img {
      width: 100%; max-height: 130px;
      object-fit: contain; display: block; border-radius: 6px;
    }
    .am-placeholder {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 4px;
    }
    .am-placeholder svg { opacity: .35; }
    .am-placeholder span { font-size: 9px; text-transform: uppercase; letter-spacing:.05em; color:#c5c0b8; }

    /* ── Body (70%) ── */
    .am-card-body {
      flex: 1; padding: 11px 13px 11px 10px;
      display: flex; flex-direction: column; gap: 5px; min-width: 0;
    }
    .am-card-nombre  { font-size:14px; font-weight:700; color:#1F447F; line-height:1.25; }
    .am-card-sub     { font-size:10px; color:#9E9B96; text-transform:uppercase; letter-spacing:.05em; }
    .am-card-varietales { font-size:11px; color:#7a756e; line-height:1.35; }
    .am-badge-accion {
      display: inline-block;
      background: #1B4332; color: #fff;
      font-size: 12px; font-weight: 800;
      padding: 3px 11px; border-radius: 20px;
      align-self: flex-start;
    }
    .am-precio-wrap  { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
    .am-precio-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9E9B96; }
    .am-precio-val   { font-family:'DM Mono',monospace; font-size:18px; font-weight:700; color:#1F447F; line-height:1; }
    .am-precio-regular { font-family:'DM Mono',monospace; font-size:11px; color:#b5b0a8; text-decoration:line-through; }

    /* ── Botón Agregar ── */
    .am-btn-agregar {
      display: inline-flex; align-items: center; gap: 5px;
      background: #1F447F; color: #fff;
      border: none; border-radius: 20px;
      font-family: system-ui,sans-serif; font-size: 11px; font-weight: 700;
      padding: 6px 13px; cursor: pointer; align-self: flex-start;
      transition: background .15s, transform .1s; margin-top: 2px;
      -webkit-tap-highlight-color: transparent;
    }
    .am-btn-agregar:active { transform: scale(.97); }
    .am-btn-agregar.agregada {
      background: #2D6A4F; letter-spacing: .01em;
    }

    /* ── Resumen dinámico ── */
    .am-resumen-wrap {
      margin-top: 16px;
      background: #fff;
      border: 1.5px solid #2D6A4F;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(45,106,79,.12);
    }
    .am-resumen-header {
      background: #2D6A4F; padding: 10px 14px;
      display: flex; align-items: center; justify-content: space-between; gap:8px;
    }
    .am-resumen-title { font-size:12px; font-weight:700; color:#fff; }
    .am-resumen-count {
      background: rgba(255,255,255,.25); color:#fff;
      font-size:11px; font-weight:700; padding:2px 9px;
      border-radius:20px; flex-shrink:0;
    }
    .am-resumen-lista { padding: 8px 14px 4px; }
    .am-resumen-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 6px 0; border-bottom: 1px solid rgba(45,106,79,.1);
      font-size: 12px;
    }
    .am-resumen-item:last-child { border-bottom: none; }
    .am-resumen-item-icon { font-size:14px; flex-shrink:0; line-height:1.2; }
    .am-resumen-item-info { flex:1; min-width:0; }
    .am-resumen-item-nombre { font-weight:600; color:#1F447F; }
    .am-resumen-item-cond   { font-size:10px; color:#5a5650; margin-top:1px; }
    .am-resumen-footer { padding: 10px 14px; display:flex; gap:8px; flex-wrap:wrap; }
    .am-btn-ver-resumen {
      flex:1; padding:9px; background:#1F447F; color:#fff; border:none;
      border-radius:8px; font-family:system-ui,sans-serif; font-size:12px;
      font-weight:700; cursor:pointer; min-width:120px;
    }
    .am-resumen-empty { padding:12px 14px; font-size:12px; color:#9E9B96; font-style:italic; }

    /* ── Modal resumen completo ── */
    #am-modal-resumen {
      display:none; position:fixed; inset:0; z-index:600;
      background:rgba(0,0,0,.6); overflow-y:auto; padding:20px 14px;
    }
    #am-modal-resumen.open { display:block; }
    .am-modal-box {
      background:#fff; border-radius:14px; max-width:520px;
      margin:0 auto; overflow:hidden;
      box-shadow:0 16px 48px rgba(0,0,0,.25);
    }
    .am-modal-head {
      background:#1F447F; border-bottom:3px solid #CBB86A;
      padding:14px 16px; display:flex; align-items:center; justify-content:space-between;
    }
    .am-modal-head span { font-size:15px; font-weight:700; color:#fff; }
    .am-modal-close {
      background:rgba(255,255,255,.15); border:none; color:#fff;
      width:30px; height:30px; border-radius:8px; font-size:16px; cursor:pointer;
    }
    .am-modal-body { padding:16px; }
    .am-modal-item {
      display:flex; gap:10px; align-items:flex-start;
      padding:10px 0; border-bottom:1px solid rgba(31,68,127,.09);
    }
    .am-modal-item:last-child { border-bottom:none; }
    .am-modal-item-img {
      width:44px; height:56px; border-radius:6px;
      background:#f7f5f2; flex-shrink:0; overflow:hidden;
      display:flex; align-items:center; justify-content:center;
    }
    .am-modal-item-img img { width:100%; height:100%; object-fit:contain; }
    .am-modal-item-info { flex:1; min-width:0; }
    .am-modal-item-nombre { font-size:13px; font-weight:700; color:#1F447F; }
    .am-modal-item-accion {
      display:inline-block; margin-top:4px;
      background:#1B4332; color:#fff; font-size:11px; font-weight:700;
      padding:2px 10px; border-radius:20px;
    }
    .am-modal-item-precio { font-family:'DM Mono',monospace; font-size:13px; font-weight:700; color:#1F447F; margin-top:4px; }
    .am-modal-item-rm {
      background:none; border:none; color:#B91C1C; font-size:16px;
      cursor:pointer; padding:4px; flex-shrink:0; line-height:1;
    }
    .am-modal-subtotal {
      background:rgba(31,68,127,.06); border-radius:8px;
      padding:10px 14px; margin-top:12px;
      display:flex; justify-content:space-between; align-items:center;
    }
    .am-modal-subtotal-lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9E9B96; }
    .am-modal-subtotal-val { font-family:'DM Mono',monospace; font-size:20px; font-weight:700; color:#1F447F; }
    .am-modal-actions { padding:0 16px 16px; display:flex; gap:8px; flex-wrap:wrap; }
    .am-modal-btn-guardar {
      flex:1; padding:11px; background:#1F447F; color:#fff; border:none;
      border-radius:8px; font-family:system-ui,sans-serif; font-size:13px;
      font-weight:700; cursor:pointer; min-width:140px;
    }
    .am-modal-btn-wa {
      flex:1; padding:11px; background:#25D366; color:#fff; border:none;
      border-radius:8px; font-family:system-ui,sans-serif; font-size:13px;
      font-weight:700; cursor:pointer; min-width:140px;
      display:flex; align-items:center; justify-content:center; gap:6px;
    }
    .am-modal-status { padding:0 16px 12px; font-size:12px; color:#2D6A4F; text-align:center; font-weight:600; }

    /* Sin acciones */
    .am-empty-cat { font-size:12px; color:#9E9B96; font-style:italic; padding:4px 0 8px; }
  `;
  document.head.appendChild(s);

  // Inyectar modal resumen (una sola vez en el DOM)
  if (!document.getElementById('am-modal-resumen')) {
    const m = document.createElement('div');
    m.id = 'am-modal-resumen';
    m.innerHTML = `
      <div class="am-modal-box">
        <div class="am-modal-head">
          <span>📋 Acciones seleccionadas</span>
          <button class="am-modal-close" onclick="amCerrarModal()">✕</button>
        </div>
        <div class="am-modal-body" id="am-modal-body"></div>
        <div class="am-modal-actions">
          <button class="am-modal-btn-guardar" onclick="amGuardarEnVisita()">💾 Guardar en visita</button>
          <button class="am-modal-btn-wa" onclick="amCompartirWA()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Compartir por WhatsApp
          </button>
        </div>
        <div class="am-modal-status" id="am-modal-status"></div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) amCerrarModal(); });
  }
})();

// ── Estado global de acciones seleccionadas ──────────────────────────────────
// Map: id → acción completa
const _amSeleccionadas = new Map();

// Callbacks registrables desde visita.html
let _amOnGuardar  = null;  // fn(seleccionadas[]) → Promise — llamado al "Guardar en visita"
let _amClienteCtx = null;  // { nombre, telefono } del cliente actual

function amRegistrarCallbacks({ onGuardar, cliente }) {
  _amOnGuardar  = onGuardar  || null;
  _amClienteCtx = cliente    || null;
}

// ── Constantes ───────────────────────────────────────────────────────────────
const AM_CATS = [
  { id: 'vinos',    label: '🍷 Vinos'    },
  { id: 'spirits',  label: '🥃 Spirits'  },
  { id: 'cervezas', label: '🍺 Cervezas' },
];
const AM_CAT_ICON = { vinos: '🍾', spirits: '🥃', cervezas: '🍺' };

const AM_SPIRITS_SUBS = [
  { id: 'Vodka',                      label: '🍸 Vodka'                      },
  { id: 'Gin',                        label: '🌿 Gin'                        },
  { id: 'Whisky',                     label: '🥃 Whisky'                     },
  { id: 'Ron',                        label: '🍹 Ron'                        },
  { id: 'Aperitivos',                 label: '🍊 Aperitivos'                 },
  { id: 'Licores',                    label: '🍬 Licores'                    },
  { id: 'Nacionales/Internacionales', label: '🌍 Nacionales/Internacionales' },
];

function _amSpiritsSubcat(producto) {
  const p = (producto || '').toLowerCase();
  if (/absolut|smirnoff|vodka/.test(p))                                   return 'Vodka';
  if (/gordon|beefeater|bulldog|monkey|botanist|ally|lillet|gin/.test(p)) return 'Gin';
  if (/jameson|ballantine|balantine|chivas|jack daniel|blenders/.test(p)) return 'Whisky';
  if (/malibu|havana|appleton|ron /.test(p))                              return 'Ron';
  if (/campari|aperol|skyy|cynar|ramazzotti|fernet/.test(p))              return 'Aperitivos';
  if (/cusenier|tia maria|tia creamy|curacao|dulce de leche/.test(p))     return 'Licores';
  if (/nacional|internacional/.test(p))                                   return 'Nacionales/Internacionales';
  return 'Spirits';
}

// ── SVG placeholder botella ──────────────────────────────────────────────────
const _AM_BOTTLE_SVG = `<svg width="28" height="44" viewBox="0 0 32 52" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="1" width="8" height="8" rx="2" fill="#d4d0ca"/>
  <path d="M10 9 C6 14 4 18 4 24 L4 46 C4 49 7 51 16 51 C25 51 28 49 28 46 L28 24 C28 18 26 14 22 9 Z"
        fill="#e8e4de" stroke="#ccc8c2" stroke-width="1"/>
  <rect x="8" y="28" width="16" height="1.5" rx="1" fill="#ccc8c2" opacity=".6"/>
  <rect x="8" y="32" width="16" height="1.5" rx="1" fill="#ccc8c2" opacity=".6"/>
</svg>`;

// ── Toggle selección de una acción ────────────────────────────────────────────
function amToggle(id, accionJson) {
  const accion = typeof accionJson === 'string' ? JSON.parse(decodeURIComponent(accionJson)) : accionJson;
  const card   = document.getElementById(`am-card-${id}`);
  const btn    = document.getElementById(`am-btn-${id}`);
  if (!card || !btn) return;

  if (_amSeleccionadas.has(id)) {
    // Deseleccionar
    _amSeleccionadas.delete(id);
    card.classList.remove('am-seleccionada');
    btn.textContent = '+ Agregar';
    btn.classList.remove('agregada');
  } else {
    // Seleccionar
    _amSeleccionadas.set(id, accion);
    card.classList.add('am-seleccionada');
    btn.innerHTML = '✓ Agregada';
    btn.classList.add('agregada');
  }
  _amActualizarResumen();
}

// ── Actualizar el resumen dinámico en el DOM ──────────────────────────────────
function _amActualizarResumen() {
  const wrap = document.getElementById('am-resumen-dinamico');
  if (!wrap) return;

  const items = [..._amSeleccionadas.values()];
  const count = items.length;

  document.getElementById('am-resumen-count').textContent = `${count} seleccionada${count !== 1 ? 's' : ''}`;

  const listaEl = document.getElementById('am-resumen-lista');
  if (!count) {
    listaEl.innerHTML = `<div class="am-resumen-empty">Tocá "+ Agregar" en las acciones que vas a gestionar con este cliente.</div>`;
    document.getElementById('am-resumen-footer').style.display = 'none';
    return;
  }

  document.getElementById('am-resumen-footer').style.display = 'flex';
  listaEl.innerHTML = items.map(a => `
    <div class="am-resumen-item">
      <span class="am-resumen-item-icon">${a.categoria === 'vinos' ? '🍷' : '🥃'}</span>
      <div class="am-resumen-item-info">
        <div class="am-resumen-item-nombre">${_amEsc(a.producto)}</div>
        <div class="am-resumen-item-cond">${_amEsc(a.accion)}${a.precio_accionado ? ' · $' + Number(a.precio_accionado).toLocaleString('es-AR') : ''}</div>
      </div>
    </div>`).join('');
}

// ── Render de tarjeta individual ─────────────────────────────────────────────
// opts.seleccionable: true → muestra botón Agregar (contexto visita)
function renderAccionCard(a, opts = {}) {
  const seleccionable = opts.seleccionable !== false ? !!_amOnGuardar || opts.seleccionable : false;
  const precio = a.precio_accionado
    ? '$ ' + Number(a.precio_accionado).toLocaleString('es-AR')
    : null;
  const subcat = a.subcategoria || (a.categoria === 'spirits' ? _amSpiritsSubcat(a.producto) : null);
  const yaAgregada = _amSeleccionadas.has(a.id);

  const imgHtml = a.imagen_url
    ? `<img src="${_amEsc(a.imagen_url)}" alt="${_amEsc(a.producto)}" loading="lazy"
            onerror="this.parentElement.innerHTML='${_AM_BOTTLE_SVG.replace(/'/g,"\\'")} ';">`
    : `<div class="am-placeholder">${_AM_BOTTLE_SVG}<span>Sin imagen</span></div>`;

  // Payload para el toggle (serializado en data attribute)
  const payloadEnc = seleccionable
    ? encodeURIComponent(JSON.stringify({ id:a.id, producto:a.producto, accion:a.accion,
        precio_accionado:a.precio_accionado, categoria:a.categoria, imagen_url:a.imagen_url||null }))
    : '';

  const btnHtml = seleccionable
    ? `<button id="am-btn-${_amEsc(a.id)}"
         class="am-btn-agregar${yaAgregada ? ' agregada' : ''}"
         onclick="amToggle('${_amEsc(a.id)}','${payloadEnc}')">
         ${yaAgregada ? '✓ Agregada' : '+ Agregar'}
       </button>`
    : `<a class="am-btn-agregar" style="background:#25D366;text-decoration:none"
         href="https://wa.me/5492612123696?text=${encodeURIComponent('Hola! Consulto por ' + (a.producto||'') + ' - ' + (a.accion||''))}"
         target="_blank" rel="noopener">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
         Consultar
       </a>`;

  return `
    <div class="am-card${yaAgregada ? ' am-seleccionada' : ''}" id="am-card-${_amEsc(a.id)}">
      <div class="am-card-img">${imgHtml}</div>
      <div class="am-card-body">
        <div class="am-card-nombre">${_amEsc(a.producto)}</div>
        ${subcat ? `<div class="am-card-sub">${_amEsc(subcat)}</div>` : ''}
        ${a.varietales ? `<div class="am-card-varietales">${_amEsc(a.varietales)}</div>` : ''}
        <span class="am-badge-accion">${_amEsc(a.accion)}</span>
        ${precio ? `<div class="am-precio-wrap">
          <span class="am-precio-label">Precio accionado</span>
          <span class="am-precio-val">${precio}</span>
        </div>` : ''}
        ${btnHtml}
      </div>
    </div>`;
}

// ── Render resumen dinámico (contenedor ─────────────────────────────────────
function _amRenderResumen() {
  return `
    <div class="am-resumen-wrap" id="am-resumen-dinamico" style="display:${_amOnGuardar ? 'block' : 'none'}">
      <div class="am-resumen-header">
        <span class="am-resumen-title">🛒 Acciones seleccionadas para este cliente</span>
        <span class="am-resumen-count" id="am-resumen-count">0 seleccionadas</span>
      </div>
      <div class="am-resumen-lista" id="am-resumen-lista">
        <div class="am-resumen-empty">Tocá "+ Agregar" en las acciones que vas a gestionar con este cliente.</div>
      </div>
      <div class="am-resumen-footer" id="am-resumen-footer" style="display:none">
        <button class="am-btn-ver-resumen" onclick="amAbrirModal()">📋 Ver resumen completo</button>
      </div>
    </div>`;
}

// ── Render agrupado (con subcategorías para spirits) ─────────────────────────
function renderAccionesGrupo(acciones, opts = {}) {
  if (!acciones?.length) return '<div class="am-empty-cat">Sin acciones activas este mes.</div>';

  const grupos = {};
  acciones.forEach(a => {
    // normalizar a minúscula: las campañas del asistente traen 'Vinos'/'Spirits'/'Cervezas'
    // (mayúscula) y AM_CATS usa minúscula. Sin esto, la tarjeta se descartaba.
    const cat = String(a.categoria || 'vinos').toLowerCase();
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(a);
  });

  // Categorías no previstas en AM_CATS (ej. 'otros') → no se pierden, van al final.
  const _catIdsConocidas = AM_CATS.map(c => c.id);
  const _catsExtra = Object.keys(grupos).filter(id => !_catIdsConocidas.includes(id));
  const extraHtml = _catsExtra.map(id => `
        <div class="am-cat-sep">${id.charAt(0).toUpperCase() + id.slice(1)}</div>
        ${grupos[id].map(a => renderAccionCard(a, opts)).join('')}`).join('');

  const cardsHtml = AM_CATS
    .filter(cat => grupos[cat.id]?.length)
    .map(cat => {
      if (cat.id === 'spirits') {
        const subGrupos = {};
        grupos['spirits'].forEach(a => {
          const sub = a.subcategoria || _amSpiritsSubcat(a.producto);
          if (!subGrupos[sub]) subGrupos[sub] = [];
          subGrupos[sub].push(a);
        });
        return `
          <div class="am-cat-sep">${cat.label}</div>
          ${AM_SPIRITS_SUBS.filter(s => subGrupos[s.id]?.length).map(s => `
            <div class="am-subcat-sep">${s.label}</div>
            ${subGrupos[s.id].map(a => renderAccionCard(a, opts)).join('')}
          `).join('')}`;
      }
      return `
        <div class="am-cat-sep">${cat.label}</div>
        ${grupos[cat.id].map(a => renderAccionCard(a, opts)).join('')}`;
    }).join('');

  return cardsHtml + extraHtml + _amRenderResumen();
}

// ── Modal: abrir ─────────────────────────────────────────────────────────────
function amAbrirModal() {
  const items  = [..._amSeleccionadas.values()];
  const bodyEl = document.getElementById('am-modal-body');
  const statusEl = document.getElementById('am-modal-status');
  statusEl.textContent = '';

  if (!items.length) {
    bodyEl.innerHTML = `<div style="padding:20px;text-align:center;color:#9E9B96;font-style:italic">No hay acciones seleccionadas todavía.</div>`;
  } else {
    let subtotal = 0;
    const itemsHtml = items.map(a => {
      if (a.precio_accionado) subtotal += Number(a.precio_accionado);
      return `
        <div class="am-modal-item">
          <div class="am-modal-item-img">
            ${a.imagen_url
              ? `<img src="${_amEsc(a.imagen_url)}" loading="lazy" onerror="this.style.display='none'">`
              : _AM_BOTTLE_SVG}
          </div>
          <div class="am-modal-item-info">
            <div class="am-modal-item-nombre">${_amEsc(a.producto)}</div>
            <span class="am-modal-item-accion">${_amEsc(a.accion)}</span>
            ${a.precio_accionado ? `<div class="am-modal-item-precio">$ ${Number(a.precio_accionado).toLocaleString('es-AR')}</div>` : ''}
          </div>
          <button class="am-modal-item-rm" onclick="amQuitarDelModal('${_amEsc(a.id)}')" title="Quitar">✕</button>
        </div>`;
    }).join('');

    const subtotalHtml = subtotal > 0 ? `
      <div class="am-modal-subtotal">
        <span class="am-modal-subtotal-lbl">Inversión estimada</span>
        <span class="am-modal-subtotal-val">$ ${subtotal.toLocaleString('es-AR')}</span>
      </div>` : '';

    bodyEl.innerHTML = itemsHtml + subtotalHtml;
  }

  document.getElementById('am-modal-resumen').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function amCerrarModal() {
  document.getElementById('am-modal-resumen').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Modal: quitar item ───────────────────────────────────────────────────────
function amQuitarDelModal(id) {
  amToggle(id, _amSeleccionadas.get(id)); // deselecciona
  if (_amSeleccionadas.size === 0) { amCerrarModal(); return; }
  amAbrirModal(); // refrescar modal
}

// ── Modal: Guardar en visita ──────────────────────────────────────────────────
async function amGuardarEnVisita() {
  const statusEl = document.getElementById('am-modal-status');
  const btn      = document.querySelector('.am-modal-btn-guardar');
  const items    = [..._amSeleccionadas.values()];

  if (!items.length) { statusEl.textContent = 'No hay acciones seleccionadas.'; return; }
  if (!_amOnGuardar) { statusEl.textContent = 'Esta función solo está disponible en el checklist de visita.'; return; }

  btn.disabled = true; statusEl.textContent = 'Guardando…';
  try {
    await _amOnGuardar(items);
    statusEl.textContent = '✅ Acciones guardadas en la visita.';
    setTimeout(() => amCerrarModal(), 1200);
  } catch(e) {
    statusEl.textContent = '❌ Error: ' + (e.message || e);
    btn.disabled = false;
  }
}

// ── Modal: Compartir por WhatsApp ─────────────────────────────────────────────
function amCompartirWA() {
  const items   = [..._amSeleccionadas.values()];
  if (!items.length) return;

  const cliente = _amClienteCtx?.nombre ? `para *${_amClienteCtx.nombre}*` : '';
  const tel     = _amClienteCtx?.telefono || '5492612123696';

  const lineas  = items.map((a, i) =>
    `${i+1}. *${a.producto}* — ${a.accion}${a.precio_accionado ? ' ($' + Number(a.precio_accionado).toLocaleString('es-AR') + ')' : ''}`
  ).join('\n');

  const msg = `Hola! Te comparto las acciones del mes ${cliente}:\n\n${lineas}\n\n_GrandBar Distribuciones_`;
  window.open(`https://wa.me/${tel.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── API pública para visita.html ──────────────────────────────────────────────
function amGetSeleccionadas() {
  return [..._amSeleccionadas.values()];
}
function amLimpiarSeleccion() {
  _amSeleccionadas.clear();
}

// ── Descarga de placa ────────────────────────────────────────────────────────
function dlPlaca(url, nombre) {
  const a = document.createElement('a');
  a.href = url;
  a.download = (nombre || 'placa').replace(/[^a-zA-Z0-9_\-]/g, '_') + '.jpg';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Helper ───────────────────────────────────────────────────────────────────
function _amEsc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
