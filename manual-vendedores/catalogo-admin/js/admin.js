// ============================================================
//  GrandBar · Catálogo · Panel Admin (Fase 2)
// ============================================================
import {
  supabase,
  STORAGE_BUCKET,
  PATH_LOGOS,
  PATH_PRODUCTOS,
  PATH_BANNERS,
} from './supabase.js';

// ---- constantes de dominio ----
const CAT_ORDER = { spirits: 0, vinos: 1, cervezas: 2 };
const CATEGORIAS = ['spirits', 'vinos', 'cervezas'];
const CANALES = ['on', 'off', 'ambos', 'mayorista'];
const TIPOS_BANNER = ['carrusel', 'popup'];
const FLAGS = [
  { v: '', t: 'ninguno' },
  { v: 'new', t: 'new' },
  { v: 'ultimas_unidades', t: 'últimas unidades' },
];

// ---- estado ----
const state = {
  session: null,
  proveedores: [],       // cache de proveedores
  acciones: [],          // acciones (con proveedor embebido)
  banners: [],           // banners publicitarios
  config: {},            // config clave->valor (modo mantenimiento, etc.)
  tab: 'acciones',
  filtroCat: 'todas',
  filtroCanal: 'todos',
  filtroProv: 'todos',   // id de proveedor o 'todos'
};

const app = document.getElementById('app');

// ============================================================
//  HELPERS
// ============================================================
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
};

const numOrNull = (v) => {
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (v) => {
  const s = String(v).trim();
  return s === '' ? null : s;
};
const money = (n) => (n == null ? '' : n);

// ---- carga perezosa de SheetJS (para exportar a Excel) ----
let xlsxPromise = null;
function cargarScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
function asegurarXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxPromise) xlsxPromise = cargarScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
  return xlsxPromise;
}

function flashStatus(statusEl, ok, msg) {
  statusEl.className = 'row-status ' + (ok ? 'ok' : 'err');
  statusEl.textContent = ok ? '✓ guardado' : '✕ ' + (msg || 'error');
  if (ok) setTimeout(() => { statusEl.className = 'row-status'; }, 1600);
}

// ============================================================
//  AUTH
// ============================================================
async function init() {
  // Integrado en el panel de Luciana: sin login, entra directo al panel.
  render();
}

function render() {
  app.innerHTML = '';
  app.appendChild(renderPanel());
}

function renderLogin() {
  const errBox = el('div', { class: 'login-err' });
  const email = el('input', { type: 'email', placeholder: 'admin@grandbar.com', autocomplete: 'username' });
  const pass = el('input', { type: 'password', placeholder: '••••••••', autocomplete: 'current-password' });
  const btn = el('button', { class: 'btn btn-block', type: 'submit' }, 'Entrar');

  const doLogin = async (e) => {
    e.preventDefault();
    errBox.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Entrando…';
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: pass.value,
    });
    if (error) {
      errBox.textContent = error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : error.message;
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
    // si sale OK, onAuthStateChange re-renderiza solo.
  };

  const form = el('form', { onsubmit: doLogin }, [
    el('h1', {}, 'GrandBar'),
    el('div', { class: 'sub' }, 'Panel de catálogo'),
    el('label', {}, 'Email'), email,
    el('label', {}, 'Contraseña'), pass,
    btn,
    errBox,
  ]);
  return el('div', { class: 'login-wrap' }, el('div', { class: 'login-card' }, form));
}

// ============================================================
//  PANEL
// ============================================================
function renderPanel() {
  const wrap = el('div');

  // topbar (sin login: integrado en el panel de Luciana)
  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('div', { class: 'brand', html: 'GrandBar <small>· catálogo de clientes</small>' }),
  ]));

  // tabs
  const mkTab = (id, label) => el('button', {
    class: 'tab' + (state.tab === id ? ' active' : ''),
    onclick: () => { state.tab = id; render(); },
  }, label);
  wrap.appendChild(el('div', { class: 'tabs' }, [
    mkTab('acciones', 'ACCIONES'),
    mkTab('proveedores', 'PROVEEDORES'),
    mkTab('banners', 'BANNERS'),
    mkTab('ajustes', 'AJUSTES'),
  ]));

  const panel = el('div', { class: 'panel', id: 'panel-body' });
  wrap.appendChild(panel);

  // carga de datos + render de la tab activa
  loadAll().then(() => {
    panel.innerHTML = '';
    if (state.tab === 'acciones') panel.appendChild(renderAccionesTab());
    else if (state.tab === 'proveedores') panel.appendChild(renderProveedoresTab());
    else if (state.tab === 'banners') panel.appendChild(renderBannersTab());
    else panel.appendChild(renderAjustesTab());
  });
  panel.appendChild(el('div', { class: 'muted' }, 'Cargando…'));

  return wrap;
}

async function loadAll() {
  const [prov, acc, ban, cfg] = await Promise.all([
    supabase.from('catalogo_proveedores').select('*').order('categoria').order('orden'),
    supabase.from('catalogo_acciones').select('*, proveedor:catalogo_proveedores(id,nombre,categoria)'),
    supabase.from('catalogo_banners').select('*').order('orden'),
    supabase.from('catalogo_config').select('clave, valor'),
  ]);
  state.proveedores = prov.data || [];
  state.acciones = acc.data || [];
  state.banners = ban.data || [];
  state.config = {};
  (cfg.data || []).forEach((r) => { state.config[r.clave] = r.valor; });
  sortAcciones();
}

function sortAcciones() {
  state.acciones.sort((a, b) => {
    const ca = CAT_ORDER[a.proveedor?.categoria] ?? 9;
    const cb = CAT_ORDER[b.proveedor?.categoria] ?? 9;
    if (ca !== cb) return ca - cb;
    return (a.orden ?? 0) - (b.orden ?? 0);
  });
}

// ============================================================
//  STORAGE (subida de imágenes)
// ============================================================
async function subirImagen(file, carpeta, id) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${carpeta}/${id}_${Date.now()}.${ext}`;
  const up = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: '3600',
  });
  if (up.error) throw up.error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`; // cache-busting
}

// ============================================================
//  EXPORTAR ACCIONES A EXCEL (por catálogo + proveedor)
// ============================================================
function accionMatchCanal(a, sel) {
  if (sel === 'todos') return true;
  const rc = a.canal || 'ambos';
  if (sel === 'on' || sel === 'off') return rc === sel || rc === 'ambos';
  return rc === sel;
}

async function exportarAccionesExcel(canalSel, provSel, provNombre) {
  const filas = state.acciones
    .filter((a) => accionMatchCanal(a, canalSel) && (provSel === 'todos' || a.proveedor_id === provSel))
    .sort((a, b) => (a.proveedor?.nombre || '').localeCompare(b.proveedor?.nombre || '')
      || (a.nombre_producto || '').localeCompare(b.nombre_producto || ''));
  if (!filas.length) { alert('No hay acciones para ese catálogo/proveedor.'); return; }
  await asegurarXLSX();
  const data = filas.map((a) => ({
    'Proveedor': a.proveedor?.nombre || '',
    'Categoría': a.proveedor?.categoria || '',
    'Producto': a.nombre_producto || '',
    'Precio regular': numOrNull(a.precio_regular) ?? '',
    'Precio accionado': numOrNull(a.precio_accionado) ?? '',
    '% OFF': numOrNull(a.porcentaje_off) ?? '',
    'Sugerido venta': numOrNull(a.sugerido_venta) ?? '',
    'Mecánica': a.mecanica || '',
    'SKU promo': a.sku_promo || '',
    'Info adicional': a.info_adicional || '',
    'Canal': a.canal || 'ambos',
    'Flag': a.flag || '',
    'Activo': a.activo ? 'Sí' : 'No',
  }));
  const ws = window.XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 34 }, { wch: 13 }, { wch: 15 }, { wch: 8 }, { wch: 13 }, { wch: 40 }, { wch: 14 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 8 }];
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Acciones');
  const catLabel = canalSel === 'todos' ? 'Todos' : canalSel.toUpperCase();
  const provLabel = (provSel === 'todos' ? 'Todos' : (provNombre || 'Proveedor')).replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  window.XLSX.writeFile(wb, `Acciones - ${catLabel} - ${provLabel}.xlsx`);
}

function abrirExportarAcciones() {
  const back = el('div', { class: 'modal-back' });
  const cerrar = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back) cerrar(); });

  const selC = el('select', {});
  [['todos', 'Todos los catálogos'], ['on', 'ON'], ['off', 'OFF'], ['mayorista', 'Mayorista'], ['ambos', 'Ambos (on + off)']]
    .forEach(([v, t]) => selC.appendChild(el('option', { value: v }, t)));

  const selP = el('select', {});
  selP.appendChild(el('option', { value: 'todos' }, 'Todos los proveedores'));
  [...state.proveedores]
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
    .forEach((p) => selP.appendChild(el('option', { value: p.id }, (p.nombre || '—') + (p.categoria ? ` (${p.categoria})` : ''))));

  const btn = el('button', { class: 'btn', type: 'button' }, '⬇ Descargar Excel');
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Generando…';
    try {
      const provNombre = selP.value === 'todos' ? '' : selP.options[selP.selectedIndex].textContent.replace(/\s*\(.*\)$/, '');
      await exportarAccionesExcel(selC.value, selP.value, provNombre);
      cerrar();
    } catch (e) { alert('No se pudo exportar: ' + (e.message || e)); btn.disabled = false; btn.textContent = '⬇ Descargar Excel'; }
  });

  back.appendChild(el('div', { class: 'modal', style: 'max-width:420px' }, [
    el('h3', {}, 'Exportar acciones a Excel'),
    el('div', { class: 'muted', style: 'margin-bottom:12px' }, 'Elegí de qué catálogo y proveedor querés descargar las acciones.'),
    el('label', {}, 'Catálogo'), selC,
    el('label', {}, 'Proveedor'), selP,
    el('div', { class: 'actions' }, [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: cerrar }, 'Cancelar'),
      btn,
    ]),
  ]));
  document.body.appendChild(back);
}

// ============================================================
//  TAB A · ACCIONES
// ============================================================
function accionesFiltradas() {
  return state.acciones.filter((a) => {
    if (state.filtroCat !== 'todas' && a.proveedor?.categoria !== state.filtroCat) return false;
    if (state.filtroCanal !== 'todos' && (a.canal || 'ambos') !== state.filtroCanal) return false;
    if (state.filtroProv !== 'todos' && a.proveedor_id !== state.filtroProv) return false;
    return true;
  });
}

function renderAccionesTab() {
  const cont = el('div');

  // ---- toolbar / filtros ----
  const selCat = el('select', { onchange: (e) => { state.filtroCat = e.target.value; refreshAcciones(); } });
  ['todas', ...CATEGORIAS].forEach((c) =>
    selCat.appendChild(el('option', { value: c, ...(state.filtroCat === c ? { selected: '' } : {}) }, c)));

  const selCanal = el('select', { onchange: (e) => { state.filtroCanal = e.target.value; refreshAcciones(); } });
  ['todos', ...CANALES].forEach((c) =>
    selCanal.appendChild(el('option', { value: c, ...(state.filtroCanal === c ? { selected: '' } : {}) }, c)));

  // filtro por proveedor (ordenado por categoría y orden)
  const selProv = el('select', { onchange: (e) => { state.filtroProv = e.target.value; refreshAcciones(); } });
  selProv.appendChild(el('option', { value: 'todos', ...(state.filtroProv === 'todos' ? { selected: '' } : {}) }, 'todos'));
  proveedoresOrdenados().forEach((p) =>
    selProv.appendChild(el('option', { value: p.id, ...(state.filtroProv === p.id ? { selected: '' } : {}) },
      `${p.nombre} (${p.categoria})`)));

  cont.appendChild(el('div', { class: 'toolbar' }, [
    el('div', { class: 'filter' }, [el('span', {}, 'Categoría:'), selCat]),
    el('div', { class: 'filter' }, [el('span', {}, 'Canal:'), selCanal]),
    el('div', { class: 'filter' }, [el('span', {}, 'Proveedor:'), selProv]),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: abrirExportarAcciones }, '⬇ Exportar (Excel)'),
    el('button', { class: 'btn btn-sm', onclick: abrirNuevaAccion }, '+ Nueva acción'),
  ]));

  // ---- tabla ----
  const cols = ['estado', 'proveedor', 'producto', 'sku promo', 'accionado', 'regular', 'sugerido', '% off',
    'mecánica', 'info adicional', 'canal', 'flag', 'foto', 'placa', 'activo', 'orden', ''];
  const thead = el('thead', {}, el('tr', {}, cols.map((c) => el('th', {}, c))));
  const tbody = el('tbody', { id: 'acc-body' });
  accionesFiltradas().forEach((a) => tbody.appendChild(filaAccion(a)));

  cont.appendChild(el('div', { class: 'table-wrap' }, el('table', { class: 'grid' }, [thead, tbody])));
  if (accionesFiltradas().length === 0)
    cont.appendChild(el('div', { class: 'muted', style: 'padding:14px' }, 'No hay acciones con estos filtros.'));
  return cont;
}

function refreshAcciones() {
  const body = document.getElementById('acc-body');
  if (!body) return;
  body.innerHTML = '';
  accionesFiltradas().forEach((a) => body.appendChild(filaAccion(a)));
}

async function updateAccion(id, patch, statusEl) {
  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from('catalogo_acciones').update(patch).eq('id', id);
  // reflejar en cache local
  const a = state.acciones.find((x) => x.id === id);
  if (a && !error) Object.assign(a, patch);
  if (statusEl) flashStatus(statusEl, !error, error?.message);
  return !error;
}

function filaAccion(a) {
  const tr = el('tr', { class: a.activo ? '' : 'inactiva' });
  const status = el('span', { class: 'row-status' });

  // helper para inputs con auto-save on blur/change
  const inNum = (field, cls = '') => {
    const inp = el('input', { class: 'cell-in num w-num ' + cls, value: money(a[field]) });
    inp.addEventListener('blur', () => updateAccion(a.id, { [field]: numOrNull(inp.value) }, status));
    return inp;
  };
  const inTxt = (field, cls = '') => {
    const inp = el('input', { class: 'cell-in ' + cls, value: a[field] ?? '' });
    inp.addEventListener('blur', () => updateAccion(a.id, { [field]: strOrNull(inp.value) }, status));
    return inp;
  };

  // proveedor dropdown
  const selProv = el('select', { class: 'cell-in' });
  state.proveedores.forEach((p) =>
    selProv.appendChild(el('option', { value: p.id, ...(p.id === a.proveedor_id ? { selected: '' } : {}) },
      `${p.nombre} (${p.categoria})`)));
  selProv.addEventListener('change', async () => {
    const ok = await updateAccion(a.id, { proveedor_id: selProv.value }, status);
    if (ok) { // reordenar por si cambió de categoría
      const p = state.proveedores.find((x) => x.id === selProv.value);
      a.proveedor = { id: p.id, nombre: p.nombre, categoria: p.categoria };
      sortAcciones(); refreshAcciones();
    }
  });

  // % off + auto
  const offInp = el('input', { class: 'cell-in num', value: money(a.porcentaje_off) });
  offInp.addEventListener('blur', () => updateAccion(a.id, { porcentaje_off: numOrNull(offInp.value) }, status));
  const offAuto = el('button', { class: 'btn-sm btn-ghost', title: 'Calcular desde precios', type: 'button' }, 'auto');
  offAuto.addEventListener('click', () => {
    const acc = numOrNull(a.precio_accionado);
    const reg = numOrNull(a.precio_regular);
    if (!acc || !reg) { flashStatus(status, false, 'faltan precios'); return; }
    const off = Math.round((1 - acc / reg) * 100);
    offInp.value = off;
    updateAccion(a.id, { porcentaje_off: off }, status);
  });

  // canal dropdown
  const selCanal = el('select', { class: 'cell-in' });
  CANALES.forEach((c) => selCanal.appendChild(
    el('option', { value: c, ...((a.canal || 'ambos') === c ? { selected: '' } : {}) }, c)));
  selCanal.addEventListener('change', () => updateAccion(a.id, { canal: selCanal.value }, status));

  // flag dropdown
  const selFlag = el('select', { class: 'cell-in' });
  FLAGS.forEach((f) => selFlag.appendChild(
    el('option', { value: f.v, ...((a.flag || '') === f.v ? { selected: '' } : {}) }, f.t)));
  selFlag.addEventListener('change', () => updateAccion(a.id, { flag: strOrNull(selFlag.value) }, status));

  // foto
  const thumb = el('img', { class: 'thumb', src: a.imagen_url || '', alt: '', style: a.imagen_url ? '' : 'display:none' });
  const fileInp = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  const btnFoto = el('button', { class: 'btn-sm btn-ghost', type: 'button' }, a.imagen_url ? 'cambiar' : 'subir');
  btnFoto.addEventListener('click', () => fileInp.click());
  fileInp.addEventListener('change', async () => {
    const f = fileInp.files[0];
    if (!f) return;
    btnFoto.textContent = '…';
    try {
      const url = await subirImagen(f, PATH_PRODUCTOS, a.id);
      await updateAccion(a.id, { imagen_url: url }, status);
      thumb.src = url; thumb.style.display = '';
      btnFoto.textContent = 'cambiar';
    } catch (err) {
      flashStatus(status, false, err.message);
      btnFoto.textContent = 'subir';
    }
    fileInp.value = '';
  });

  // placa descargable (imagen o PDF que el cliente baja)
  const fileP = el('input', { type: 'file', accept: 'image/*,application/pdf', class: 'hidden' });
  const verP = el('a', { class: 'btn-sm btn-ghost', href: a.placa_url || '#', target: '_blank', rel: 'noopener', style: a.placa_url ? '' : 'display:none' }, 'ver');
  const btnP = el('button', { class: 'btn-sm btn-ghost', type: 'button' }, a.placa_url ? 'cambiar' : 'subir');
  btnP.addEventListener('click', () => fileP.click());
  fileP.addEventListener('change', async () => {
    const f = fileP.files[0];
    if (!f) return;
    btnP.textContent = '…';
    try {
      const url = await subirImagen(f, 'catalogo/placas', a.id);
      await updateAccion(a.id, { placa_url: url }, status);
      a.placa_url = url;
      verP.href = url; verP.style.display = '';
      btnP.textContent = 'cambiar';
    } catch (err) {
      flashStatus(status, false, err.message);
      btnP.textContent = 'subir';
    }
    fileP.value = '';
  });

  // activo toggle
  const chk = el('input', { type: 'checkbox', ...(a.activo ? { checked: '' } : {}) });
  chk.addEventListener('change', async () => {
    const ok = await updateAccion(a.id, { activo: chk.checked }, status);
    if (ok) tr.className = chk.checked ? '' : 'inactiva';
  });
  const toggle = el('label', { class: 'toggle' }, [chk, el('span', { class: 'track' })]);

  // orden ↑↓
  const ord = el('div', { class: 'ord' }, [
    el('button', { type: 'button', title: 'subir', onclick: () => moverAccion(a, -1) }, '▲'),
    el('button', { type: 'button', title: 'bajar', onclick: () => moverAccion(a, 1) }, '▼'),
  ]);

  // eliminar
  const del = el('button', { class: 'btn-sm btn-danger', type: 'button', onclick: () => eliminarAccion(a) }, '✕');

  tr.append(
    el('td', {}, status),
    el('td', {}, selProv),
    el('td', {}, inTxt('nombre_producto', 'w-nombre')),
    el('td', {}, inTxt('sku_promo')),
    el('td', {}, inNum('precio_accionado')),
    el('td', {}, inNum('precio_regular')),
    el('td', {}, inNum('sugerido_venta')),
    el('td', {}, el('div', { class: 'off-group' }, [offInp, offAuto])),
    el('td', {}, inTxt('mecanica', 'w-mecanica')),
    el('td', {}, inTxt('info_adicional', 'w-mecanica')),
    el('td', {}, selCanal),
    el('td', {}, selFlag),
    el('td', {}, el('div', { class: 'thumb-cell' }, [thumb, btnFoto, fileInp])),
    el('td', {}, el('div', { class: 'thumb-cell' }, [verP, btnP, fileP])),
    el('td', {}, toggle),
    el('td', {}, ord),
    el('td', {}, del),
  );
  return tr;
}

// mover dentro de la MISMA categoría, intercambiando `orden` con el vecino
async function moverAccion(a, dir) {
  const mismos = state.acciones.filter((x) => x.proveedor?.categoria === a.proveedor?.categoria);
  const i = mismos.indexOf(a);
  const j = i + dir;
  if (j < 0 || j >= mismos.length) return;
  const b = mismos[j];
  const oa = a.orden ?? 0, ob = b.orden ?? 0;
  await Promise.all([
    supabase.from('catalogo_acciones').update({ orden: ob }).eq('id', a.id),
    supabase.from('catalogo_acciones').update({ orden: oa }).eq('id', b.id),
  ]);
  a.orden = ob; b.orden = oa;
  sortAcciones(); refreshAcciones();
}

async function eliminarAccion(a) {
  if (!confirm(`¿Eliminar la acción "${a.nombre_producto}"?`)) return;
  const { error } = await supabase.from('catalogo_acciones').delete().eq('id', a.id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  state.acciones = state.acciones.filter((x) => x.id !== a.id);
  refreshAcciones();
}

function abrirNuevaAccion() {
  const selProv = el('select', {});
  state.proveedores.forEach((p) =>
    selProv.appendChild(el('option', { value: p.id }, `${p.nombre} (${p.categoria})`)));
  const nombre = el('input', { type: 'text', placeholder: 'Ej: FERNET BUHERO NEGRO' });
  const sku = el('input', { type: 'text', placeholder: 'SKU promo (opcional)' });
  const accionado = el('input', { type: 'number', placeholder: 'precio accionado' });
  const regular = el('input', { type: 'number', placeholder: 'precio regular (opcional)' });
  const mecanica = el('input', { type: 'text', placeholder: 'mecánica (ej: 5+1)' });
  const infoAd = el('input', { type: 'text', placeholder: 'info adicional (opcional)' });
  const selCanal = el('select', {});
  CANALES.forEach((c) => selCanal.appendChild(el('option', { value: c, ...(c === 'ambos' ? { selected: '' } : {}) }, c)));
  const err = el('div', { class: 'login-err' });

  const back = el('div', { class: 'modal-back' });
  const cerrar = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back) cerrar(); });

  const crear = async () => {
    if (!selProv.value) { err.textContent = 'Elegí un proveedor.'; return; }
    if (!nombre.value.trim()) { err.textContent = 'Poné un nombre de producto.'; return; }
    const { data, error } = await supabase.from('catalogo_acciones').insert({
      proveedor_id: selProv.value,
      nombre_producto: nombre.value.trim(),
      sku_promo: strOrNull(sku.value),
      precio_accionado: numOrNull(accionado.value),
      precio_regular: numOrNull(regular.value),
      mecanica: strOrNull(mecanica.value),
      info_adicional: strOrNull(infoAd.value),
      canal: selCanal.value,
    }).select('*, proveedor:catalogo_proveedores(id,nombre,categoria)').single();
    if (error) { err.textContent = error.message; return; }
    state.acciones.push(data);
    sortAcciones();
    cerrar();
    // asegurar que se vea con los filtros actuales
    if (state.filtroCat !== 'todas') state.filtroCat = data.proveedor.categoria;
    document.querySelector('#panel-body').innerHTML = '';
    document.querySelector('#panel-body').appendChild(renderAccionesTab());
  };

  back.appendChild(el('div', { class: 'modal' }, [
    el('h3', {}, 'Nueva acción'),
    el('label', {}, 'Proveedor'), selProv,
    el('label', {}, 'Producto'), nombre,
    el('label', {}, 'SKU promo'), sku,
    el('label', {}, 'Precio accionado'), accionado,
    el('label', {}, 'Precio regular'), regular,
    el('label', {}, 'Mecánica'), mecanica,
    el('label', {}, 'Info adicional'), infoAd,
    el('label', {}, 'Canal'), selCanal,
    err,
    el('div', { class: 'actions' }, [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: cerrar }, 'Cancelar'),
      el('button', { class: 'btn', type: 'button', onclick: crear }, 'Crear'),
    ]),
  ]));
  document.body.appendChild(back);
}

// ============================================================
//  TAB B · PROVEEDORES
// ============================================================
function proveedoresOrdenados() {
  return [...state.proveedores].sort((a, b) => {
    const ca = CAT_ORDER[a.categoria] ?? 9, cb = CAT_ORDER[b.categoria] ?? 9;
    if (ca !== cb) return ca - cb;
    return (a.orden ?? 0) - (b.orden ?? 0);
  });
}

function renderProveedoresTab() {
  state.proveedores = proveedoresOrdenados();
  const cont = el('div');
  cont.appendChild(el('div', { class: 'toolbar' }, [
    el('div', { class: 'muted' }, `${state.proveedores.length} proveedores`),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-sm', onclick: abrirNuevoProveedor }, '+ Nuevo proveedor'),
  ]));

  const cols = ['estado', 'nombre', 'categoría', 'logo', 'flag', 'activo', 'orden', ''];
  const thead = el('thead', {}, el('tr', {}, cols.map((c) => el('th', {}, c))));
  const tbody = el('tbody', { id: 'prov-body' });
  state.proveedores.forEach((p) => tbody.appendChild(filaProveedor(p)));
  cont.appendChild(el('div', { class: 'table-wrap' }, el('table', { class: 'grid' }, [thead, tbody])));
  return cont;
}

function refreshProveedores() {
  const body = document.getElementById('prov-body');
  if (!body) return;
  state.proveedores = proveedoresOrdenados();
  body.innerHTML = '';
  state.proveedores.forEach((p) => body.appendChild(filaProveedor(p)));
}

async function updateProveedor(id, patch, statusEl) {
  const { error } = await supabase.from('catalogo_proveedores').update(patch).eq('id', id);
  const p = state.proveedores.find((x) => x.id === id);
  if (p && !error) Object.assign(p, patch);
  if (statusEl) flashStatus(statusEl, !error, error?.message);
  return !error;
}

function filaProveedor(p) {
  const tr = el('tr', { class: p.activo ? '' : 'inactiva' });
  const status = el('span', { class: 'row-status' });

  const nombre = el('input', { class: 'cell-in w-nombre', value: p.nombre ?? '' });
  nombre.addEventListener('blur', () => updateProveedor(p.id, { nombre: strOrNull(nombre.value) }, status));

  const selCat = el('select', { class: 'cell-in' });
  CATEGORIAS.forEach((c) => selCat.appendChild(
    el('option', { value: c, ...(p.categoria === c ? { selected: '' } : {}) }, c)));
  selCat.addEventListener('change', async () => {
    const ok = await updateProveedor(p.id, { categoria: selCat.value }, status);
    if (ok) refreshProveedores();
  });

  // logo
  const thumb = el('img', { class: 'thumb logo', src: p.logo_url || '', alt: '', style: p.logo_url ? '' : 'display:none' });
  const fileInp = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  const btnLogo = el('button', { class: 'btn-sm btn-ghost', type: 'button' }, p.logo_url ? 'cambiar' : 'subir');
  btnLogo.addEventListener('click', () => fileInp.click());
  fileInp.addEventListener('change', async () => {
    const f = fileInp.files[0];
    if (!f) return;
    btnLogo.textContent = '…';
    try {
      const url = await subirImagen(f, PATH_LOGOS, p.id);
      await updateProveedor(p.id, { logo_url: url }, status);
      thumb.src = url; thumb.style.display = '';
      btnLogo.textContent = 'cambiar';
    } catch (err) {
      flashStatus(status, false, err.message);
      btnLogo.textContent = 'subir';
    }
    fileInp.value = '';
  });

  const selFlag = el('select', { class: 'cell-in' });
  FLAGS.forEach((f) => selFlag.appendChild(
    el('option', { value: f.v, ...((p.flag || '') === f.v ? { selected: '' } : {}) }, f.t)));
  selFlag.addEventListener('change', () => updateProveedor(p.id, { flag: strOrNull(selFlag.value) }, status));

  const chk = el('input', { type: 'checkbox', ...(p.activo ? { checked: '' } : {}) });
  chk.addEventListener('change', async () => {
    const ok = await updateProveedor(p.id, { activo: chk.checked }, status);
    if (ok) tr.className = chk.checked ? '' : 'inactiva';
  });
  const toggle = el('label', { class: 'toggle' }, [chk, el('span', { class: 'track' })]);

  const ord = el('div', { class: 'ord' }, [
    el('button', { type: 'button', title: 'subir', onclick: () => moverProveedor(p, -1) }, '▲'),
    el('button', { type: 'button', title: 'bajar', onclick: () => moverProveedor(p, 1) }, '▼'),
  ]);

  const del = el('button', { class: 'btn-sm btn-danger', type: 'button', onclick: () => eliminarProveedor(p) }, '✕');

  tr.append(
    el('td', {}, status),
    el('td', {}, nombre),
    el('td', {}, selCat),
    el('td', {}, el('div', { class: 'thumb-cell' }, [thumb, btnLogo, fileInp])),
    el('td', {}, selFlag),
    el('td', {}, toggle),
    el('td', {}, ord),
    el('td', {}, del),
  );
  return tr;
}

async function moverProveedor(p, dir) {
  const mismos = proveedoresOrdenados().filter((x) => x.categoria === p.categoria);
  const i = mismos.indexOf(mismos.find((x) => x.id === p.id));
  const j = i + dir;
  if (j < 0 || j >= mismos.length) return;
  const b = mismos[j];
  const oa = p.orden ?? 0, ob = b.orden ?? 0;
  await Promise.all([
    supabase.from('catalogo_proveedores').update({ orden: ob }).eq('id', p.id),
    supabase.from('catalogo_proveedores').update({ orden: oa }).eq('id', b.id),
  ]);
  p.orden = ob; b.orden = oa;
  refreshProveedores();
}

async function eliminarProveedor(p) {
  if (!confirm(`¿Eliminar "${p.nombre}"?\nSe borran también TODAS sus acciones (cascade).`)) return;
  const { error } = await supabase.from('catalogo_proveedores').delete().eq('id', p.id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  state.proveedores = state.proveedores.filter((x) => x.id !== p.id);
  state.acciones = state.acciones.filter((x) => x.proveedor_id !== p.id);
  refreshProveedores();
}

function abrirNuevoProveedor() {
  const nombre = el('input', { type: 'text', placeholder: 'Nombre del proveedor' });
  const selCat = el('select', {});
  CATEGORIAS.forEach((c) => selCat.appendChild(el('option', { value: c }, c)));
  const selFlag = el('select', {});
  FLAGS.forEach((f) => selFlag.appendChild(el('option', { value: f.v }, f.t)));
  const err = el('div', { class: 'login-err' });

  const back = el('div', { class: 'modal-back' });
  const cerrar = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back) cerrar(); });

  const crear = async () => {
    if (!nombre.value.trim()) { err.textContent = 'Poné un nombre.'; return; }
    // orden = último de su categoría + 1
    const mismos = state.proveedores.filter((x) => x.categoria === selCat.value);
    const orden = mismos.reduce((m, x) => Math.max(m, x.orden ?? 0), 0) + 1;
    const { data, error } = await supabase.from('catalogo_proveedores').insert({
      nombre: nombre.value.trim(),
      categoria: selCat.value,
      flag: strOrNull(selFlag.value),
      orden,
    }).select('*').single();
    if (error) { err.textContent = error.message; return; }
    state.proveedores.push(data);
    cerrar();
    refreshProveedores();
  };

  back.appendChild(el('div', { class: 'modal' }, [
    el('h3', {}, 'Nuevo proveedor'),
    el('label', {}, 'Nombre'), nombre,
    el('label', {}, 'Categoría'), selCat,
    el('label', {}, 'Flag'), selFlag,
    err,
    el('div', { class: 'actions' }, [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: cerrar }, 'Cancelar'),
      el('button', { class: 'btn', type: 'button', onclick: crear }, 'Crear'),
    ]),
  ]));
  document.body.appendChild(back);
}

// ============================================================
//  TAB C · BANNERS
// ============================================================
function bannersOrdenados() {
  return [...state.banners].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

function renderBannersTab() {
  state.banners = bannersOrdenados();
  const cont = el('div');
  cont.appendChild(el('div', { class: 'toolbar' }, [
    el('div', { class: 'muted' },
      'Carrusel = banners que rotan arriba de la portada · Popup = aparece al abrir el link'),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-sm', onclick: abrirNuevoBanner }, '+ Nuevo banner'),
  ]));

  const cols = ['estado', 'imagen', 'tipo', 'link (opcional)', 'activo', 'orden', ''];
  const thead = el('thead', {}, el('tr', {}, cols.map((c) => el('th', {}, c))));
  const tbody = el('tbody', { id: 'ban-body' });
  state.banners.forEach((b) => tbody.appendChild(filaBanner(b)));
  cont.appendChild(el('div', { class: 'table-wrap' }, el('table', { class: 'grid' }, [thead, tbody])));
  if (state.banners.length === 0)
    cont.appendChild(el('div', { class: 'muted', style: 'padding:14px' }, 'Todavía no hay banners.'));
  return cont;
}

function refreshBanners() {
  const body = document.getElementById('ban-body');
  if (!body) return;
  state.banners = bannersOrdenados();
  body.innerHTML = '';
  state.banners.forEach((b) => body.appendChild(filaBanner(b)));
}

async function updateBanner(id, patch, statusEl) {
  const { error } = await supabase.from('catalogo_banners').update(patch).eq('id', id);
  const b = state.banners.find((x) => x.id === id);
  if (b && !error) Object.assign(b, patch);
  if (statusEl) flashStatus(statusEl, !error, error?.message);
  return !error;
}

function filaBanner(b) {
  const tr = el('tr', { class: b.activo ? '' : 'inactiva' });
  const status = el('span', { class: 'row-status' });

  // imagen (thumb + subir/cambiar)
  const thumb = el('img', { class: 'thumb', src: b.imagen_url || '', alt: '', style: b.imagen_url ? '' : 'display:none' });
  const fileInp = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  const btnImg = el('button', { class: 'btn-sm btn-ghost', type: 'button' }, b.imagen_url ? 'cambiar' : 'subir');
  btnImg.addEventListener('click', () => fileInp.click());
  fileInp.addEventListener('change', async () => {
    const f = fileInp.files[0];
    if (!f) return;
    btnImg.textContent = '…';
    try {
      const url = await subirImagen(f, PATH_BANNERS, b.id);
      await updateBanner(b.id, { imagen_url: url }, status);
      thumb.src = url; thumb.style.display = '';
      btnImg.textContent = 'cambiar';
    } catch (err) {
      flashStatus(status, false, err.message);
      btnImg.textContent = 'subir';
    }
    fileInp.value = '';
  });

  // tipo
  const selTipo = el('select', { class: 'cell-in' });
  TIPOS_BANNER.forEach((t) => selTipo.appendChild(
    el('option', { value: t, ...((b.tipo || 'carrusel') === t ? { selected: '' } : {}) }, t)));
  selTipo.addEventListener('change', () => updateBanner(b.id, { tipo: selTipo.value }, status));

  // link
  const link = el('input', { class: 'cell-in w-mecanica', value: b.link_url ?? '', placeholder: 'https://…' });
  link.addEventListener('blur', () => updateBanner(b.id, { link_url: strOrNull(link.value) }, status));

  // activo
  const chk = el('input', { type: 'checkbox', ...(b.activo ? { checked: '' } : {}) });
  chk.addEventListener('change', async () => {
    const ok = await updateBanner(b.id, { activo: chk.checked }, status);
    if (ok) tr.className = chk.checked ? '' : 'inactiva';
  });
  const toggle = el('label', { class: 'toggle' }, [chk, el('span', { class: 'track' })]);

  // orden ↑↓
  const ord = el('div', { class: 'ord' }, [
    el('button', { type: 'button', title: 'subir', onclick: () => moverBanner(b, -1) }, '▲'),
    el('button', { type: 'button', title: 'bajar', onclick: () => moverBanner(b, 1) }, '▼'),
  ]);

  const del = el('button', { class: 'btn-sm btn-danger', type: 'button', onclick: () => eliminarBanner(b) }, '✕');

  tr.append(
    el('td', {}, status),
    el('td', {}, el('div', { class: 'thumb-cell' }, [thumb, btnImg, fileInp])),
    el('td', {}, selTipo),
    el('td', {}, link),
    el('td', {}, toggle),
    el('td', {}, ord),
    el('td', {}, del),
  );
  return tr;
}

async function moverBanner(b, dir) {
  const orden = bannersOrdenados();
  const i = orden.indexOf(orden.find((x) => x.id === b.id));
  const j = i + dir;
  if (j < 0 || j >= orden.length) return;
  const o = orden[j];
  const ob = b.orden ?? 0, oo = o.orden ?? 0;
  await Promise.all([
    supabase.from('catalogo_banners').update({ orden: oo }).eq('id', b.id),
    supabase.from('catalogo_banners').update({ orden: ob }).eq('id', o.id),
  ]);
  b.orden = oo; o.orden = ob;
  refreshBanners();
}

async function eliminarBanner(b) {
  if (!confirm('¿Eliminar este banner?')) return;
  const { error } = await supabase.from('catalogo_banners').delete().eq('id', b.id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  state.banners = state.banners.filter((x) => x.id !== b.id);
  refreshBanners();
}

function abrirNuevoBanner() {
  const selTipo = el('select', {});
  TIPOS_BANNER.forEach((t) => selTipo.appendChild(el('option', { value: t }, t)));
  const link = el('input', { type: 'text', placeholder: 'Link (opcional): https://…' });
  const err = el('div', { class: 'login-err' });

  const back = el('div', { class: 'modal-back' });
  const cerrar = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back) cerrar(); });

  const crear = async () => {
    const orden = state.banners.reduce((m, x) => Math.max(m, x.orden ?? 0), 0) + 1;
    const { data, error } = await supabase.from('catalogo_banners').insert({
      tipo: selTipo.value,
      link_url: strOrNull(link.value),
      orden,
    }).select('*').single();
    if (error) { err.textContent = error.message; return; }
    state.banners.push(data);
    cerrar();
    refreshBanners();
  };

  back.appendChild(el('div', { class: 'modal' }, [
    el('h3', {}, 'Nuevo banner'),
    el('div', { class: 'muted', style: 'margin-bottom:6px' }, 'Creá el banner y después subí la imagen desde la tabla.'),
    el('label', {}, 'Tipo'), selTipo,
    el('label', {}, 'Link (opcional)'), link,
    err,
    el('div', { class: 'actions' }, [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: cerrar }, 'Cancelar'),
      el('button', { class: 'btn', type: 'button', onclick: crear }, 'Crear'),
    ]),
  ]));
  document.body.appendChild(back);
}

// ============================================================
//  TAB D · AJUSTES (modo mantenimiento)
// ============================================================
async function setConfig(clave, valor) {
  const { error } = await supabase
    .from('catalogo_config')
    .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' });
  if (!error) state.config[clave] = valor;
  return { error };
}

function renderAjustesTab() {
  const cont = el('div', { style: 'max-width:640px' });
  const enPausa = state.config.mantenimiento === 'true';

  // cartel de estado
  const estado = el('div', { class: 'estado-web ' + (enPausa ? 'pausa' : 'activa') });
  const pintarEstado = (pausa) => {
    estado.className = 'estado-web ' + (pausa ? 'pausa' : 'activa');
    estado.textContent = pausa
      ? '🔴 La web está EN PAUSA — los clientes ven el cartel de "estamos actualizando".'
      : '🟢 La web está ACTIVA — los clientes ven el catálogo normalmente.';
  };
  pintarEstado(enPausa);

  const status = el('span', { class: 'row-status' });

  // toggle prende/apaga
  const chk = el('input', { type: 'checkbox', ...(enPausa ? { checked: '' } : {}) });
  chk.addEventListener('change', async () => {
    const val = chk.checked ? 'true' : 'false';
    const { error } = await setConfig('mantenimiento', val);
    if (error) { flashStatus(status, false, error.message); chk.checked = !chk.checked; return; }
    pintarEstado(chk.checked);
    flashStatus(status, true);
  });
  const toggle = el('label', { class: 'toggle toggle-mant' }, [chk, el('span', { class: 'track' })]);

  // mensaje editable
  const msj = el('textarea', {
    class: 'cfg-textarea',
    rows: '4',
    placeholder: 'Mensaje que ven los clientes cuando la web está en pausa…',
  });
  msj.value = state.config.mant_mensaje || '';
  msj.addEventListener('blur', async () => {
    const { error } = await setConfig('mant_mensaje', msj.value.trim());
    flashStatus(status, !error, error?.message);
  });

  cont.appendChild(el('h2', { class: 'cfg-title' }, 'Estado de la web pública'));
  cont.appendChild(estado);
  cont.appendChild(el('div', { class: 'cfg-row' }, [
    toggle,
    el('span', {}, 'Poner la web en pausa (modo mantenimiento)'),
    status,
  ]));
  cont.appendChild(el('div', { class: 'muted', style: 'margin:18px 0 4px' },
    'Mensaje que se muestra a los clientes durante la pausa:'));
  cont.appendChild(msj);
  cont.appendChild(el('div', { class: 'muted', style: 'margin-top:8px' },
    'Los cambios impactan al instante: el cliente los ve al recargar la página. No hace falta redeployar.'));
  return cont;
}

// ============================================================
init();
