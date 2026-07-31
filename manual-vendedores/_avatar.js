// ─── Sistema de avatares de vendedor/supervisor — GrandBar ──────────────────
// Paso base: cargar y mostrar el avatar (muñeco cabezón, PNG transparente) por código.
// Reutilizable desde cualquier pantalla. Requiere `sb` (cliente Supabase) global.
//
// TODO(camino/vestidor): sobre esta base se construirá más adelante:
//   - el "camino" (el avatar recorriendo las secciones del checklist), y
//   - el "vestidor" (accesorios desbloqueables sobre el avatar).
//   Engancharlo acá: getAvatarVendedor() ya da la URL base; los accesorios/progreso
//   se sumarán como capas/sprites encima de esta imagen.

const AVATAR_BUCKET = 'Activaciones';     // bucket reutilizado; carpeta: avatares/
const _avatarCache = {};                  // codigo → url cruda|null (cache en memoria)

// Cache-busting: un único valor fijo por CARGA de página. Al reemplazar un PNG en Storage
// con el mismo nombre, el navegador mostraría la versión vieja cacheada; agregar "?v=" fuerza
// traer la actual en cada refresh. Al ser fijo por sesión, NO re-descarga en cada render
// (header/perfil/camino comparten el mismo valor). Mejora futura (cero re-descargas):
// versionar la URL guardada en la tabla (".../007.png?v=2") y subir el número al reemplazar.
const _avatarVer = Date.now();
function _conCacheBust(url) {
  if (!url) return url;                                   // null → sigue null (placeholder de iniciales)
  return url + (url.includes('?') ? '&' : '?') + 'v=' + _avatarVer;
}

// Devuelve la URL del avatar de un código (vendedor/supervisor/owner) o null. Cacheado.
// Resuelve: si tiene un LOOK equipado → su look_url; si no → el avatar base. null → placeholder.
async function getAvatarVendedor(codigo) {
  if (!codigo) return null;
  const key = String(codigo).trim().toUpperCase();
  if (!(key in _avatarCache)) {
    _avatarCache[key] = await _resolverAvatarUrl(key);   // cacheamos la URL CRUDA resuelta
  }
  return _conCacheBust(_avatarCache[key]);                // el cache-bust se aplica al devolver
}

// Look equipado (tabla avatar_accesorios) → look_url (tabla looks_avatar); si no, avatar base.
// Tolerante a que las tablas de looks no existan aún (cae al base sin romper nada).
async function _resolverAvatarUrl(key) {
  try {
    const { data: eq } = await sb.from('avatar_accesorios').select('equipado').eq('vendedor_codigo', key).maybeSingle();
    const accId = eq?.equipado?.look;
    if (accId) {
      const { data: lk } = await sb.from('looks_avatar').select('look_url')
        .eq('vendedor_codigo', key).eq('accesorio_id', accId).maybeSingle();
      if (lk?.look_url) return lk.look_url;               // ← muestra el LOOK
    }
  } catch { /* sin tablas de looks → base */ }
  try {
    const { data } = await sb.from('avatares').select('avatar_url').eq('codigo', key).maybeSingle();
    return data?.avatar_url || null;                      // ← avatar base de siempre
  } catch { return null; }
}

// Iniciales para el placeholder (máx 2)
function _avatarIniciales(nombre) {
  return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => (p[0] || '')).join('').toUpperCase() || '?';
}

// Inyecta el avatar en un contenedor: <img> transparente si hay, o placeholder con iniciales.
async function pintarAvatarVendedor(containerEl, codigo, nombre) {
  if (!containerEl) return;
  containerEl.classList.add('avatar-vend');
  const ini = _avatarIniciales(nombre);
  const url = await getAvatarVendedor(codigo);
  if (url) {
    containerEl.classList.remove('avatar-vend-ph');
    containerEl.innerHTML = `<img class="avatar-vend-img" src="${url}" alt="${(nombre || '').replace(/"/g, '')}"
      onerror="this.parentElement.classList.add('avatar-vend-ph');this.parentElement.textContent='${ini}'">`;
  } else {
    containerEl.classList.add('avatar-vend-ph');
    containerEl.textContent = ini;
  }
}

// CSS del avatar (se inyecta una vez; sirve a cualquier página que incluya este archivo)
(function _avatarInjectCSS() {
  if (document.getElementById('_avatar-css')) return;
  const st = document.createElement('style');
  st.id = '_avatar-css';
  st.textContent = `
    /* ─── Tipografía oficial GrandBar: "Parginer" (solo títulos/encabezados) ───
       Archivo: vendedores-app/fonts/Parginer_Regular.otf  (ruta absoluta /fonts/…
       para que resuelva igual en dev y en Netlify, donde la raíz es vendedores-app).
       Fallback sans-serif: si no carga, todo sigue legible. */
    @font-face {
      font-family: 'Parginer';
      src: url('/fonts/Parginer_Regular.otf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;   /* muestra el fallback al instante en mobile y cambia al cargar */
    }
    /* Aplicar Parginer SOLO a títulos/encabezados (no al texto corrido). Cada selector
       solo "matchea" donde existe esa clase, así sirve a clientes/visita/supervisor. */
    .perfil-hero .perfil-nombre, .vend-name, .vend-nombre,
    .top-bar-client-name, .ficha-nombre,
    .sec-info h3, .camino-titulo, .estacion-nombre,
    .hero h2 { font-family: 'Parginer', sans-serif; }

    /* Base + tamaños (modificadores). object-fit:contain mantiene el aspect ratio del PNG. */
    .avatar-vend { width:40px; height:40px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:14px; }
    .avatar-vend--md { width:56px; height:56px; font-size:22px; }   /* encabezado */
    .avatar-vend--xl { width:128px; height:128px; font-size:44px; } /* perfil / dashboard */
    .avatar-vend-img { width:100%; height:100%; object-fit:contain; display:block; }      /* PNG transparente, sin recuadro */
    .avatar-vend.avatar-vend-ph { border-radius:50%; background:#1F447F; color:#CBB86A; font-weight:800; font-family:system-ui,sans-serif; border:1.5px solid rgba(203,184,106,.5); }

    /* Perfil hero: el vendedor/supervisor se ve a sí mismo (avatar protagonista).
       Base para el futuro camino/vestidor: el avatar grande vivirá acá. */
    .perfil-hero { display:flex; align-items:center; gap:14px; background:var(--crema,#F1EDE8); border:1px solid rgba(31,68,127,.13); border-left:3px solid #CBB86A; border-radius:12px; padding:14px 16px; margin-bottom:10px; }
    .perfil-hero .perfil-info { min-width:0; }
    /* Texto del encabezado en BLANCO: el perfil-hero va sobre fondo oscuro (fondoo + --crema translúcido). */
    .perfil-hero .perfil-nombre { font-size:18px; color:#fff; line-height:1.2; text-shadow:0 1px 2px rgba(0,0,0,.35); }
    .perfil-hero .perfil-sub { font-size:12px; color:rgba(255,255,255,.78); margin-top:3px; }
  `;
  document.head.appendChild(st);
})();
