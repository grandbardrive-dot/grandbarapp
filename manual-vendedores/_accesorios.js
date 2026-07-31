// ─── Sistema de "looks" por NIVELES de progreso — GrandBar ──────────────────
// MODELO: cada look es una imagen del avatar del vendedor con un atuendo (PNG transparente).
// El vendedor equipa UN look a la vez. Los looks se agrupan por NIVEL (bronce/plata/oro/
// platino) según las visitas finalizadas. Toda la info del look (nombre, nivel, imagen)
// vive en la tabla `looks_avatar`; acá solo se define la escala de niveles (umbrales/colores).
//
// Tablas: looks_avatar(vendedor_codigo, accesorio_id, nombre, nivel, look_url),
//         avatar_accesorios(vendedor_codigo, equipado jsonb = {"look": accesorio_id}),
//         avatares(codigo, avatar_url) = avatar base.
// Requiere `sb` global. Reutiliza _conCacheBust() de _avatar.js.

// ════════════════════ EDITAR ACÁ: criterio y NIVELES ════════════════════
// ⚠️ BANDERA DE TESTING — desbloquea TODOS los looks sin importar las visitas.
//    true  = todo desbloqueado/equipable (modo prueba).
//    false = funcionamiento normal (cada look según visitas y su nivel).
//    👉 Para volver a la normalidad cuando termines de probar: poné esta línea en false y redeploy.
const DESBLOQUEAR_TODO_TESTING = true;

const VISITA_FINALIZADA_MIN = 80;   // % mínimo para contar una visita como "finalizada"

// Escala de niveles: umbral de visitas + ícono + color de acento. Orden = progresión.
const NIVELES = [
  { id:'bronce',  label:'Bronce',  icono:'🥉', visitas:1,  color:'#A87A4B' },
  { id:'plata',   label:'Plata',   icono:'🥈', visitas:3,  color:'#9AA3AD' },
  { id:'oro',     label:'Oro',     icono:'🥇', visitas:6,  color:'#CBB86A' },   // dorado branding
  { id:'platino', label:'Platino', icono:'💎', visitas:10, color:'#4FA3C7' },
];
// ═════════════════════════════════════════════════════════════════════════

function getNivel(nivelId)          { return NIVELES.find(n => n.id === nivelId) || null; }
function visitasDeNivel(nivelId)    { const n = getNivel(nivelId); return n ? n.visitas : Infinity; }
function nivelDesbloqueado(nivelId, visitasFinalizadas) {
  if (DESBLOQUEAR_TODO_TESTING) return true;             // bandera de testing: todo desbloqueado
  return visitasFinalizadas >= visitasDeNivel(nivelId);  // lógica real (intacta detrás de la bandera)
}

// ── Conteo de visitas finalizadas (>= umbral) de todo el historial ──────────
async function contarVisitasFinalizadas(vendedorId) {
  if (!vendedorId) return 0;
  try {
    const { count } = await sb.from('visitas')
      .select('id', { count: 'exact', head: true })
      .eq('vendedor_id', vendedorId)
      .gte('porcentaje_total', VISITA_FINALIZADA_MIN);
    return count || 0;
  } catch { return 0; }
}

// ── Looks del vendedor (array de filas de looks_avatar) ─────────────────────
// Devuelve [{ accesorio_id, nombre, nivel, look_url }]. [] si no tiene.
async function getLooksVendedor(vendedorCodigo) {
  if (!vendedorCodigo) return [];
  const key = String(vendedorCodigo).trim().toUpperCase();
  try {
    const { data } = await sb.from('looks_avatar')
      .select('accesorio_id,nombre,nivel,look_url').eq('vendedor_codigo', key);
    return data || [];
  } catch { return []; }
}

// Cuántos looks desbloqueados / totales para ese vendedor con N visitas.
function resumenLooks(looks, visitasFinalizadas) {
  const total = looks.length;
  const desbloqueados = looks.filter(l => nivelDesbloqueado(l.nivel, visitasFinalizadas)).length;
  return { desbloqueados, total };
}

// ── Look equipado (avatar_accesorios.equipado = {"look": id}) ────────────────
async function getLookEquipado(vendedorCodigo) {
  if (!vendedorCodigo) return null;
  const key = String(vendedorCodigo).trim().toUpperCase();
  try {
    const { data } = await sb.from('avatar_accesorios').select('equipado').eq('vendedor_codigo', key).maybeSingle();
    return data?.equipado?.look || null;
  } catch { return null; }
}
// Equipa UN look (reemplaza). accesorioId=null → saca el look (vuelve al base). true si guardó.
async function equiparLook(vendedorCodigo, accesorioId) {
  if (!vendedorCodigo) return false;
  const key = String(vendedorCodigo).trim().toUpperCase();
  const equipado = accesorioId ? { look: accesorioId } : {};
  try {
    const { error } = await sb.from('avatar_accesorios')
      .upsert({ vendedor_codigo: key, equipado, updated_at: new Date().toISOString() },
              { onConflict: 'vendedor_codigo' });
    return !error;
  } catch { return false; }
}

// URL del avatar BASE (sin look). Para volver al base al "sacarse" el look.
async function getAvatarBaseUrl(codigo) {
  if (!codigo) return null;
  const key = String(codigo).trim().toUpperCase();
  try {
    const { data } = await sb.from('avatares').select('avatar_url').eq('codigo', key).maybeSingle();
    return data?.avatar_url || null;
  } catch { return null; }
}
