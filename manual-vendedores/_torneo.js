// ─── Torneo Doña Paula — Constantes y helpers compartidos ───────────────────
const TORNEO_ID  = 'dona_paula_2025';
const TORNEO_FIN = new Date('2026-07-31T23:59:59-03:00');
const TORNEO_MES_INICIO = 5; // Mayo

// ── Líneas de volumen ────────────────────────────────────────────────────────
const LINEAS_VOLUMEN = [
  { id: 'los_cardos',    nombre: 'Los Cardos',           pts: 1 },
  { id: 'los_cardos_pr', nombre: 'Los Cardos PR',         pts: 3 },
  { id: 'estate',        nombre: 'Estate',                pts: 4 },
  { id: 'sv',            nombre: 'Single Vineyard (SV)',  pts: 5 },
  { id: 'altitude',      nombre: 'Altitude / Altaluvia',  pts: 6 },
  { id: 'parcel',        nombre: 'Parcel / SDB',          pts: 8 },
];

// ── Tipos de cobertura ───────────────────────────────────────────────────────
const TIPOS_COBERTURA = [
  { id: 'activo',    label: 'Cliente activo con compra', pts: 1 },
  { id: 'upselling', label: 'Up selling',                 pts: 3 },
  { id: 'nuevo',     label: 'Cliente nuevo',              pts: 5 },
];

// ── Activaciones ─────────────────────────────────────────────────────────────
const TIPOS_ACT_ON = [
  { id: 'copa',        label: 'Vino por copa',       pts: 5  },
  { id: 'degustacion', label: 'Degustación / Evento', pts: 8  },
  { id: 'carta',       label: 'Presencia en carta',   pts: 10 },
];
const TIPOS_ACT_OFF = [
  { id: 'sampling', label: 'Sampling',  pts: 2 },
  { id: 'puntera',  label: 'Puntera',   pts: 4 },
];

// ── Ligas ─────────────────────────────────────────────────────────────────────
const LIGA_ON_TIPOS  = ['restaurante', 'bar', 'hotel', 'disco', 'evento'];
const LIGA_OFF_TIPOS = ['vinoteca', 'autoservicio'];

function getLiga(tipo) {
  const t = (tipo || '').toLowerCase();
  if (LIGA_ON_TIPOS.includes(t))  return 'ON';
  if (LIGA_OFF_TIPOS.includes(t)) return 'OFF';
  return 'ON';
}

// ── Cálculo de puntos ─────────────────────────────────────────────────────────
function calcPuntosTorneo(tipoReg, detalle) {
  if (tipoReg === 'volumen') {
    const linea = LINEAS_VOLUMEN.find(l => l.id === detalle.linea);
    return (linea?.pts || 0) * (Number(detalle.cajas) || 0);
  }
  if (tipoReg === 'cobertura') {
    return TIPOS_COBERTURA.find(t => t.id === detalle.tipo)?.pts || 0;
  }
  if (tipoReg === 'activacion') {
    const all = [...TIPOS_ACT_ON, ...TIPOS_ACT_OFF];
    return all.find(t => t.id === detalle.tipo)?.pts || 0;
  }
  return 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMesActual()  { return new Date().getMonth() + 1; }

function diasRestantes() {
  return Math.max(0, Math.ceil((TORNEO_FIN - new Date()) / 86400000));
}

function nombreMes(n) {
  return ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][n] || '';
}

function fmtPts(n) { return `${n} pt${n !== 1 ? 's' : ''}`; }

// Etiqueta legible para un registro
function labelRegistro(r) {
  if (r.tipo === 'volumen') {
    const linea = LINEAS_VOLUMEN.find(l => l.id === r.detalle?.linea);
    return `📦 ${linea?.nombre || r.detalle?.linea} — ${r.detalle?.cajas} caja${r.detalle?.cajas != 1 ? 's' : ''}`;
  }
  if (r.tipo === 'cobertura') {
    const t = TIPOS_COBERTURA.find(t => t.id === r.detalle?.tipo);
    return `🎯 Cobertura — ${t?.label || r.detalle?.tipo}`;
  }
  if (r.tipo === 'activacion') {
    const all = [...TIPOS_ACT_ON, ...TIPOS_ACT_OFF];
    const t = all.find(t => t.id === r.detalle?.tipo);
    return `⚡ Activación — ${t?.label || r.detalle?.tipo}`;
  }
  return '—';
}

// Subir foto a Supabase Storage
async function subirFotoTorneo(file, vendedorId) {
  const ext  = file.name.split('.').pop() || 'jpg';
  const path = `${vendedorId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('Activaciones').upload(path, file, {
    cacheControl: '3600', upsert: false
  });
  if (error) return null;
  const { data } = sb.storage.from('Activaciones').getPublicUrl(path);
  return data?.publicUrl || null;
}
