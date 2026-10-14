// ─── Manuales de visita ─────────────────────────────────────────────────────
// El recorrido de cada manual se arma desde la base (checklist_secciones) con
// getChecklistDynamic(). Hasta el 13/10/2026 acá había un checklist escrito a mano
// (restaurantes, vinotecas, autoservicios) con planes, condiciones y márgenes de
// ejemplo; lo seguían leyendo el detalle de visita del supervisor y del panel viejo,
// que mostraban tareas que no existen. Se sacó: queda solo el subtítulo de cada uno.
// Tipos sin manual propio usan 'restaurante' (ver manualDe).

const CHECKLISTS = {
  restaurante:  { id: 'restaurante',  label: 'Restaurantes',  heroSubtitulo: 'Checklist de visita al punto de venta.', secciones: [] },
  vinoteca:     { id: 'vinoteca',     label: 'Vinotecas',     heroSubtitulo: 'Checklist de visita a vinotecas — recorrido físico del local.', secciones: [] },
  autoservicio: { id: 'autoservicio', label: 'Autoservicios', heroSubtitulo: 'Checklist de visita a autoservicios.', secciones: [] },
};

// Manual del rubro sin secciones (síncrono). El real se trae con getChecklistDynamic().
function getChecklist(tipo) {
  return CHECKLISTS[(tipo || '').toLowerCase()] || CHECKLISTS['restaurante'];
}

// Cache por canal para evitar re-fetch en la misma sesión
const _clCache = {};

// Retorna el checklist desde Supabase si las tablas existen, sino fallback al hardcodeado
// Requiere que `sb` (cliente Supabase) esté disponible globalmente
// Tipo de cliente → manual que le corresponde. Los manuales editables son dos
// (ON TRADE y vinotecas), pero los clientes vienen con muchos tipos: bar, hotel,
// mayorista, "otros"… Sin este mapa, esos clientes caían al checklist viejo escrito
// en el código y NO veían nada de lo que se carga desde el panel (secciones nuevas,
// campañas por sección). Mismo criterio que usa el asistente de campañas.
const MANUAL_POR_TIPO = {
  vinoteca: 'vinoteca',
  'tienda de bebidas': 'tienda_bebidas',   // rubro propio (manual separado)
  'tienda_bebidas': 'tienda_bebidas',
  'tienda de bebida': 'tienda_bebidas',
  'tiendas de bebidas': 'tienda_bebidas',
  tienda: 'tienda_bebidas',
  autoservicio: 'autoservicio',   // todavía tiene su checklist propio en el código
  kiosco: 'autoservicio',
  hotel: 'hotel',                 // rubros separados: cada uno su propio manual
  bar: 'bar',
  disco: 'disco',
  discoteca: 'disco',
  mayorista: 'mayorista',         // manual propio
  evento: 'evento',               // Eventos: tipo de cliente con manual propio (15/09/2026)
  eventos: 'evento',
  prueba_zzz: 'prueba_zzz',       // solo pruebas: un cliente de prueba abre el manual de prueba (09/10/2026)
};
// Nombre lindo de cada rubro (para el manual vacío recién creado).
const RUBRO_LABELS = { restaurante: 'Restaurantes', vinoteca: 'Vinotecas', tienda_bebidas: 'Tienda de Bebidas', autoservicio: 'Autoservicios', hotel: 'Hoteles', bar: 'Bares', disco: 'Discos', mayorista: 'Mayoristas', evento: 'Eventos' };
function manualDe(tipo) {
  const t = String(tipo || '').toLowerCase();
  return MANUAL_POR_TIPO[t] || 'restaurante';   // sin mapeo (mayorista, otros…) → Restaurantes
}

// La zona sale del vendedor logueado (el login guarda su ficha completa). Mendoza es
// el default: si un vendedor no tiene zona cargada, ve el manual de siempre.
function zonaActual() {
  try {
    const v = JSON.parse(sessionStorage.getItem('vendedor') || '{}');
    const z = String(v.zona || '').trim().toLowerCase();
    return z === 'sanluis' ? 'sanluis' : 'mendoza';
  } catch (e) { return 'mendoza'; }
}

// Segmentación que marca Luciana en cada acción o plan (_segmentacion.js):
//   secciones uuid[] (checklist_secciones.id) y zonas text[] ('mendoza'/'sanluis').
// Vacío = se ve como siempre. secUuid = la sección donde se está mostrando (null =
// solo se mira la zona).
function segMarcado(item) {
  return !!(item && Array.isArray(item.secciones) && item.secciones.length);
}
function segVa(item, secUuid) {
  if (!item) return false;
  const zonas = Array.isArray(item.zonas) ? item.zonas : [];
  if (zonas.length && !zonas.includes(zonaActual())) return false;
  if (segMarcado(item) && secUuid && !item.secciones.includes(secUuid)) return false;
  return true;
}

async function getChecklistDynamic(tipo, zonaPedida) {
  const canal = manualDe(tipo);
  const zona  = zonaPedida || zonaActual();
  const clave = canal + '|' + zona;

  // Devolver cache si ya se cargó
  if (_clCache[clave]) return _clCache[clave];

  // Trae las secciones de esa zona. San Luis que todavía no tenga nada cargado para
  // ese rubro cae en las de Mendoza, para que el vendedor no se quede sin manual
  // mientras se está armando.
  //
  // Si la columna `zona` todavía no existe (falta correr zona-sanluis-setup.sql),
  // se consulta sin ella: así el manual sigue andando igual que antes en vez de
  // quedar en blanco por un cambio que todavía no se aplicó en la base.
  let _sinColumnaZona = false;
  async function traer(z) {
    if (!_sinColumnaZona) {
      const r = await sb.from('checklist_secciones').select('*')
        .eq('canal', canal).eq('zona', z).eq('activa', true).order('orden');
      if (r.error && /column .*zona.* does not exist/i.test(r.error.message || '')) {
        _sinColumnaZona = true;                       // no reintentar en cada llamada
        console.warn('[checklist] Falta la columna zona: se usa el manual único.');
      } else {
        return (r.error || !r.data?.length) ? null : r.data;
      }
    }
    if (z !== 'mendoza') return null;                 // sin columna, hay un solo manual
    const r2 = await sb.from('checklist_secciones').select('*')
      .eq('canal', canal).eq('activa', true).order('orden');
    return (r2.error || !r2.data?.length) ? null : r2.data;
  }

  try {
    let secciones = await traer(zona);
    if (!secciones && zona !== 'mendoza') secciones = await traer('mendoza');

    // Si falla (tablas no existen) o no hay datos → fallback.
    // Rubros con checklist hardcodeado (restaurante/vinoteca/autoservicio) usan ese;
    // los rubros separados sin secciones cargadas (hotel/bar/disco/mayorista) se muestran
    // VACÍOS — NO caen al manual de Restaurantes.
    if (!secciones) {
      // Sin secciones cargadas: manual vacío. Ya no se usa el checklist escrito en el
      // código (tenía productos, precios y condiciones de ejemplo que no son reales).
      _clCache[clave] = { id: canal, label: RUBRO_LABELS[canal] || canal, heroSubtitulo: '', secciones: [] };
      return _clCache[clave];
    }

    const secIds = secciones.map(s => s.id);
    const [itemsRes, planesRes] = await Promise.all([
      sb.from('checklist_items').select('*').in('seccion_id', secIds).eq('activo', true).order('orden'),
      // Traemos todos los planes activos: un plan puede aparecer en varias secciones (columna `secciones`).
      sb.from('checklist_planes').select('*').eq('activo', true).order('created_at'),
    ]);

    const itemsPorSec  = {};
    const planesPorSec = {};
    (itemsRes.data  || []).forEach(i => {
      if (!itemsPorSec[i.seccion_id])  itemsPorSec[i.seccion_id]  = [];
      itemsPorSec[i.seccion_id].push(i);
    });
    const secIdSet = new Set(secIds);
    (planesRes.data || []).forEach(p => {
      if (Array.isArray(p.zonas) && p.zonas.length && !p.zonas.includes(zona)) return;   // plan solo para la otra zona
      // Vigencia (opcional): un plan vencido o que todavía no empezó no se muestra.
      const hoyLocal = new Date(); const hoyStr = hoyLocal.getFullYear() + '-' + String(hoyLocal.getMonth() + 1).padStart(2, '0') + '-' + String(hoyLocal.getDate()).padStart(2, '0');
      if (p.fecha_fin && String(p.fecha_fin).slice(0, 10) < hoyStr) return;
      if (p.fecha_inicio && String(p.fecha_inicio).slice(0, 10) > hoyStr) return;
      // Un plan puede tener varias secciones (columna `secciones`); si no, usa seccion_id.
      // Solo lo agrupamos en las secciones que pertenecen a este canal.
      const secs = (Array.isArray(p.secciones) && p.secciones.length) ? p.secciones : (p.seccion_id ? [p.seccion_id] : []);
      secs.forEach(sid => {
        if (!secIdSet.has(sid)) return;
        if (!planesPorSec[sid]) planesPorSec[sid] = [];
        planesPorSec[sid].push(p);
      });
    });

    const base = CHECKLISTS[canal] || CHECKLISTS['restaurante'];

    // Armar nodos planos (uno por sección, madre o hija)
    const nodos = secciones.map(sec => ({
      // Usar codigo (string ID original) para compatibilidad con progreso guardado
      id:         sec.codigo || sec.id,
      _uuid:      sec.id,
      _parentUuid: sec.parent_id || null,
      _orden:     sec.orden ?? 0,
      titulo:     sec.nombre,
      subtitulo:  sec.descripcion || '',
      icono:      sec.icono       || '📋',
      iconoBg:    sec.icono_bg    || '#EAF2FB',
      iconoColor: sec.icono_color || '#1A5C9A',
      // Una sección madre "Cierre de visita" sin herramienta elegida usa el cierre con
      // resumen, PDF, envío y próxima acción (en hoteles y autoservicios de San Luis
      // quedaba vacía: auditoría 22/09/2026).
      especial:   sec.especial || (!sec.parent_id && /^\s*cierre\b/i.test(sec.nombre || '') ? 'cierre_resumen' : undefined),
      intro:      sec.intro       || '',
      pdf_url:    sec.pdf_url      || null,   // PDF por sección (ej: propuestas de vidriera)
      soloFormato: sec.solo_formato || null,  // discos: 'con_previa' | 'sin_previa' | null = siempre
      items: (itemsPorSec[sec.id] || []).map(i => ({
        texto:   i.texto,
        detalle: i.descripcion || '',
      })),
      planes: (planesPorSec[sec.id] || []).map(p => ({
        id:        p.id,
        pill:      p.condicion || 'Plan',
        pillColor: 'green',
        titulo:    p.nombre,
        proveedor: p.proveedor || '',
        // Proveedor y hasta cuándo vale (antes el mes iba escrito en la condición)
        subtitulo: [p.proveedor, p.fecha_fin ? 'hasta el ' + new Date(String(p.fecha_fin).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '']
          .filter(Boolean).join(' · '),
        desc:      p.descripcion || '',
        tags:      p.lineas_participantes || [],
        pdf_url:   p.pdf_url   || null,
        requiere_evidencia: p.requiere_evidencia === true,   // casilla de Luciana (14/10/2026)
      })),
    }));

    // Anidar: las que tienen parent_id van a subsecciones[] de su madre
    const porUuid = {};
    nodos.forEach(n => { porUuid[n._uuid] = n; });
    const topLevel = [];
    nodos.forEach(n => {
      const madre = n._parentUuid ? porUuid[n._parentUuid] : null;
      if (madre) (madre.subsecciones = madre.subsecciones || []).push(n);
      // Una subsección cuya madre está OCULTA no se muestra, igual que en el panel de
      // Secciones. Antes quedaba suelta como sección propia: en Autoservicios de Mendoza
      // aparecían "GRUPO CAMPARI", "PERNOD RICARD" y "DIAGEO" sueltas (06/10/2026).
      else if (!n._parentUuid) topLevel.push(n);
    });
    // Ordenar madres por orden y, dentro de cada madre, sus hijas por orden
    topLevel.sort((a, b) => a._orden - b._orden);
    topLevel.forEach(m => { if (m.subsecciones) m.subsecciones.sort((a, b) => a._orden - b._orden); });

    const result = {
      id:            canal,
      label:         RUBRO_LABELS[canal] || base.label || canal,
      heroSubtitulo: (CHECKLISTS[canal] || {}).heroSubtitulo || '',
      secciones:     topLevel,
    };

    _clCache[clave] = result;
    return result;

  } catch(e) {
    // Si falla la conexión NO se muestra un manual inventado: queda vacío y la visita
    // avisa que no se pudo cargar. No se guarda en caché para reintentar al volver.
    console.warn('[checklist] No se pudo leer el manual:', e.message);
    return { id: canal, label: RUBRO_LABELS[canal] || canal, heroSubtitulo: '', secciones: [], errorCarga: true };
  }
}

// Invalidar cache (llamar después de editar en admin). La cache va por canal+zona,
// así que borrar un canal borra sus dos zonas.
function invalidarCacheChecklist(canal) {
  if (canal) Object.keys(_clCache).forEach(k => { if (k === canal || k.startsWith(canal + '|')) delete _clCache[k]; });
  else Object.keys(_clCache).forEach(k => delete _clCache[k]);
}

// Devuelve las secciones HOJA (las que tienen ítems): las madres se reemplazan
// por sus subsecciones. Soporta checklists planos y con subsecciones.
function seccionesHoja(cl) {
  const out = [];
  cl.secciones.forEach(s => {
    // Una madre puede tener ítems PROPIOS además de subsecciones (caso mixto):
    // se cuenta a sí misma si tiene ítems, y siempre a sus hijas con ítems.
    if (s.items && s.items.length) out.push(s);
    if (s.subsecciones && s.subsecciones.length) {
      // También las hijas SIN ítems: una subsección recién creada desde el panel todavía
      // no tiene checklist, pero igual tiene que poder recibir campañas.
      s.subsecciones.forEach(ss => out.push(ss));
    } else if (!(s.items && s.items.length)) {
      out.push(s); // sección sin ítems ni subsecciones (raro): empujar igual por compatibilidad
    }
  });
  return out;
}

// Cuenta el total de ítems de un checklist (solo hojas)
function totalItems(cl) {
  return seccionesHoja(cl).reduce((acc, s) => acc + s.items.length, 0);
}

// Calcula el porcentaje a partir del objeto progreso { sId: { checks: [bool], obs: '' } }
// Cuenta solo las secciones hoja (las madres son solo agregado visual).
function calcPorcentaje(cl, progreso) {
  let total = 0, done = 0;
  seccionesHoja(cl).forEach(s => {
    s.items.forEach((_, i) => {
      total++;
      if (progreso[s.id]?.checks?.[i]) done++;
    });
  });
  if (!total && Array.isArray(progreso._trabajadas)) {
    // Manual sin ítems para tildar: % de secciones trabajadas
    const hojas = seccionesHoja(cl);
    const hechas = hojas.filter(s => progreso._trabajadas.includes(s.id)).length;
    return hojas.length ? Math.round(hechas / hojas.length * 100) : 0;
  }
  return total ? Math.round(done / total * 100) : 0;
}

// Lo que el vendedor hizo en cada sección de una visita guardada, según el manual
// real de la base (no el checklist viejo del código). Para el detalle de la visita
// en el panel del supervisor y en el panel viejo (13/10/2026).
// Devuelve [{ id, nombre, icono, trabajada, obs }] en el orden del manual.
async function seccionesDeVisita(tipo, zona, progreso) {
  progreso = progreso || {};
  let cl = null;
  try { cl = await getChecklistDynamic(tipo, zona || undefined); } catch (e) { cl = null; }
  if (!cl || !cl.secciones || !cl.secciones.length) return [];
  const trabajadas = new Set(Array.isArray(progreso._trabajadas) ? progreso._trabajadas : []);
  const out = [];
  cl.secciones.forEach(m => {
    const hojas = (m.subsecciones && m.subsecciones.length) ? m.subsecciones.map(s => ({ s, nombre: m.titulo + ' › ' + s.titulo })) : [{ s: m, nombre: m.titulo }];
    hojas.forEach(({ s, nombre }) => {
      const p = progreso[s.id] || {};
      out.push({
        id: s.id, nombre, icono: s.icono || m.icono || '📋',
        trabajada: trabajadas.has(s.id) || (Array.isArray(p.checks) && p.checks.some(Boolean)),
        obs: String(p.obs || '').trim(),
      });
    });
  });
  return out;
}
