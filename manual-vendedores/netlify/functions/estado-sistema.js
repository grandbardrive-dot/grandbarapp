// ============================================================
//  GrandBar Hub · Function · estado-sistema  (10/10/2026)
//   Un solo pedido que dice si todo anda. Lo consulta n8n cada 15 minutos (y
//   avisa por WhatsApp cuando algo se rompe o se arregla) y lo muestra el panel
//   de Diseño y Desarrollo en "Estado del sistema".
//
//   Revisa:
//    · Tareas automáticas: cada una anota sus corridas en sistema_corridas
//      (_corrida.js). Falla si dejó de correr o si sus últimas corridas fallaron.
//    · Sitios: Portal, Portal del Cliente y los 3 catálogos responden.
//    · Bases: las 4 de Supabase contestan.
//    · Planillas de Drive que se leen en vivo (Avance Ventas, Torneo Doña Paula).
//    · Ventas: que la última venta cargada no sea vieja.
//
//   Acceso: encabezado x-monitor-key = MONITOR_KEY (n8n), o sesión del Portal
//   con rol desarrollo / diseno (panel).
//   Env: HUB_SERVICE_ROLE, COBRANZAS_SERVICE_ROLE, MONITOR_KEY
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const CAT_URL = 'https://zlwnoqdxendsgbfvfyue.supabase.co';
const CAT_KEY = 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4';
const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const VEN_PANEL = ['desarrollo', 'diseno'];

// Tareas automáticas: cada cuánto corren y cuánto puede pasar sin una corrida buena.
// fallasSeguidas: cuántas corridas fallidas seguidas hacen falta para avisar (las
// frecuentes pueden fallar una vez por un corte de red y arreglarse solas).
const TAREAS = [
  { id: 'sync-clientes',  nombre: 'Clientes desde CUBO',            cada: 'cada hora',      maxMin: 150,     fallasSeguidas: 2 },
  { id: 'sync-ventas',    nombre: 'Ventas del ERP',                 cada: 'cada 20 minutos', maxMin: 80,     fallasSeguidas: 2 },
  { id: 'push-cron',      nombre: 'Avisos de reuniones al celular', cada: 'cada 15 minutos', maxMin: 50,     fallasSeguidas: 2 },
  { id: 'sync-productos', nombre: 'Artículos y stock del ERP',      cada: '1 vez por día',  maxMin: 26 * 60, fallasSeguidas: 1 },
  { id: 'cazar-clientes', nombre: 'Cazador de clientes',            cada: '1 vez por día',  maxMin: 26 * 60, fallasSeguidas: 1 },
];
const SITIOS = [
  { id: 'sitio-portal',          nombre: 'Portal (portalgrandbar.com)',               url: 'https://portalgrandbar.com/' },
  { id: 'sitio-portal-cliente',  nombre: 'Portal del Cliente (portalclientegrandbar.com)', url: 'https://portalclientegrandbar.com/' },
  { id: 'sitio-catalogo-on',     nombre: 'Catálogo ON (catalogoon.com)',              url: 'https://catalogoon.com/',               marca: 'data-canal="on"' },
  { id: 'sitio-catalogo-off',    nombre: 'Catálogo OFF (catalogooff.com)',            url: 'https://catalogooff.com/',              marca: 'data-canal="off"' },
  { id: 'sitio-catalogo-may',    nombre: 'Catálogo Mayorista (catalogo-mayorista-gb.com)', url: 'https://catalogo-mayorista-gb.com/', marca: 'data-canal="mayorista"' },
];
const ESPERA_MS = 6500;   // todo en paralelo: entra en los 10 s de una función de Netlify

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

async function pedir(url, opts) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ESPERA_MS);
  try { return await fetch(url, { ...(opts || {}), signal: ctl.signal }); }
  finally { clearTimeout(t); }
}
const motivo = (e) => (e && e.name === 'AbortError') ? 'no respondió en ' + (ESPERA_MS / 1000) + ' s' : ((e && e.message) || String(e));
function hace(min) {
  if (min < 90) return Math.round(min) + ' min';
  if (min < 48 * 60) return Math.round(min / 60) + ' h';
  return Math.round(min / 1440) + ' días';
}

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const hub = (path, opts = {}) => pedir(HUB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    // ---------- acceso ----------
    const h = event.headers || {};
    const clave = h['x-monitor-key'] || h['X-Monitor-Key'] || '';
    let autorizado = !!(process.env.MONITOR_KEY && clave && clave === process.env.MONITOR_KEY);
    if (!autorizado) {
      const token = (h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json(401, { error: 'Sin acceso' });
      const u = await pedir(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
      if (!u.ok) return json(401, { error: 'Sesión inválida' });
      const user = await u.json();
      const p = (await (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,activo')).json())[0] || {};
      if (p.activo === false || !VEN_PANEL.includes(String(p.rol || '').toLowerCase())) return json(403, { error: 'No autorizado' });
      autorizado = true;
    }

    const ahora = Date.now();
    const checks = [];

    // ---------- tareas automáticas ----------
    const tareas = TAREAS.map(async (t) => {
      const base = { id: 'tarea-' + t.id, grupo: 'Tareas automáticas', nombre: t.nombre, cada: t.cada };
      try {
        const r = await hub('sistema_corridas?tarea=eq.' + t.id + '&select=inicio,fin,ok,detalle&order=inicio.desc&limit=6');
        if (!r.ok) return { ...base, estado: 'falla', detalle: 'No se pudo leer el registro de corridas (¿falta correr sistema-corridas-setup.sql?)' };
        const filas = await r.json();
        if (!filas.length) return { ...base, estado: 'sin_datos', detalle: 'Todavía no registró ninguna corrida.' };
        const ultima = filas[0];
        const ultimaOk = filas.find(f => f.ok);
        let seguidas = 0; for (const f of filas) { if (f.ok) break; seguidas++; }
        const minDesdeOk = ultimaOk ? (ahora - new Date(ultimaOk.inicio).getTime()) / 60000 : null;
        const extra = { ultima_corrida: ultima.inicio, ultima_ok: ultimaOk ? ultimaOk.inicio : null };
        if (seguidas >= t.fallasSeguidas) return { ...base, ...extra, estado: 'falla', detalle: (seguidas > 1 ? 'Fallaron las últimas ' + seguidas + ' corridas' : 'Falló la última corrida') + ': ' + (ultima.detalle || 'sin detalle') };
        // Sin corrida buena en el tiempo esperado: dejó de correr (o corre y falla siempre).
        const desdeUltima = (ahora - new Date(ultima.inicio).getTime()) / 60000;
        if (desdeUltima > t.maxMin) return { ...base, ...extra, estado: 'falla', detalle: 'No corre desde hace ' + hace(desdeUltima) + ' (tiene que correr ' + t.cada + ').' };
        if (minDesdeOk !== null && minDesdeOk > t.maxMin) return { ...base, ...extra, estado: 'falla', detalle: 'Sin una corrida buena desde hace ' + hace(minDesdeOk) + '.' };
        if (minDesdeOk === null) return { ...base, ...extra, estado: 'sin_datos', detalle: 'La única corrida registrada falló; se espera la próxima: ' + (ultima.detalle || 'sin detalle') };
        return { ...base, ...extra, estado: 'ok', detalle: 'Última corrida buena hace ' + hace(minDesdeOk) + '.' };
      } catch (e) { return { ...base, estado: 'falla', detalle: 'No se pudo revisar: ' + motivo(e) }; }
    });

    // ---------- sitios ----------
    const sitios = SITIOS.map(async (s) => {
      const base = { id: s.id, grupo: 'Sitios', nombre: s.nombre };
      try {
        const r = await pedir(s.url, { headers: { 'User-Agent': 'GrandBar-monitor' } });
        if (!r.ok) return { ...base, estado: 'falla', detalle: 'Responde con error ' + r.status + '.' };
        if (s.marca) { const tx = await r.text(); if (!tx.includes(s.marca)) return { ...base, estado: 'falla', detalle: 'Abre, pero no muestra el catálogo que corresponde.' }; }
        return { ...base, estado: 'ok', detalle: 'Responde bien.' };
      } catch (e) { return { ...base, estado: 'falla', detalle: 'No abre: ' + motivo(e) + '.' }; }
    });

    // ---------- bases ----------
    const cob = process.env.COBRANZAS_SERVICE_ROLE;
    const BASES = [
      { id: 'base-hub',       nombre: 'Base del Portal (Hub)',       url: HUB_URL + '/rest/v1/usuarios?select=id&limit=1',            key: srole },
      { id: 'base-manual',    nombre: 'Base del Manual',             url: MAN_URL + '/rest/v1/clientes?select=id&limit=1',            key: MAN_KEY },
      { id: 'base-catalogo',  nombre: 'Base del Catálogo',           url: CAT_URL + '/rest/v1/catalogo_proveedores?select=id&limit=1', key: CAT_KEY },
      { id: 'base-cobranzas', nombre: 'Base del Portal del Cliente', url: COB_URL + '/rest/v1/cuentas_cubo?select=codigo&limit=1',    key: cob },
    ];
    const bases = BASES.map(async (b) => {
      const base = { id: b.id, grupo: 'Bases de datos', nombre: b.nombre };
      if (!b.key) return { ...base, estado: 'sin_datos', detalle: 'Falta la clave para revisarla.' };
      try {
        const r = await pedir(b.url, { headers: { apikey: b.key, Authorization: 'Bearer ' + b.key } });
        if (!r.ok) return { ...base, estado: 'falla', detalle: 'Contesta con error ' + r.status + '.' };
        return { ...base, estado: 'ok', detalle: 'Contesta bien.' };
      } catch (e) { return { ...base, estado: 'falla', detalle: 'No contesta: ' + motivo(e) + '.' }; }
    });

    // ---------- planillas de Drive ----------
    const PLANILLAS = [
      { id: 'drive-avance-ventas', nombre: 'Planilla Avance Ventas (Drive)', url: 'https://docs.google.com/spreadsheets/d/1oMIgtZ5KI83_1oyP9TFLKV2fAEpJY_Hc/gviz/tq?tqx=out:csv&tq=' + encodeURIComponent('select A limit 1') },
      { id: 'drive-torneo',        nombre: 'Planilla del Torneo Doña Paula (Drive)', url: 'https://drive.google.com/uc?export=download&id=14vGtRYjcr-0E-5eSSf-5auj3y_WEv9K8' },
    ];
    const planillas = PLANILLAS.map(async (p) => {
      const base = { id: p.id, grupo: 'Planillas de Drive', nombre: p.nombre };
      try {
        const r = await pedir(p.url, { redirect: 'follow' });
        if (!r.ok) return { ...base, estado: 'falla', detalle: 'Drive responde con error ' + r.status + ' (¿cambió el link o los permisos?).' };
        const tx = (await r.text()).slice(0, 400).toLowerCase();
        if (tx.includes('<html') || !tx.trim()) return { ...base, estado: 'falla', detalle: 'Drive no devuelve la planilla (¿la sacaron de "cualquiera con el link"?).' };
        return { ...base, estado: 'ok', detalle: 'Se lee bien.' };
      } catch (e) { return { ...base, estado: 'falla', detalle: 'No se pudo leer: ' + motivo(e) + '.' }; }
    });

    // ---------- datos al día ----------
    const datos = (async () => {
      const base = { id: 'datos-ventas', grupo: 'Datos al día', nombre: 'Última venta cargada' };
      try {
        const r = await pedir(MAN_URL + '/rest/v1/ventas_articulos?select=fecha&order=fecha.desc&limit=1', { headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY } });
        if (!r.ok) return { ...base, estado: 'falla', detalle: 'No se pudo leer: error ' + r.status + '.' };
        const f = ((await r.json())[0] || {}).fecha;
        if (!f) return { ...base, estado: 'sin_datos', detalle: 'No hay ventas cargadas.' };
        const dias = Math.floor((ahora - new Date(String(f).slice(0, 10) + 'T12:00:00-03:00').getTime()) / 86400000);
        // Fines de semana y feriados no hay ventas: recién a los 4 días es raro.
        if (dias > 4) return { ...base, estado: 'falla', detalle: 'La última venta cargada es del ' + String(f).slice(0, 10) + ' (hace ' + dias + ' días).' };
        return { ...base, estado: 'ok', detalle: 'Última venta del ' + String(f).slice(0, 10) + '.' };
      } catch (e) { return { ...base, estado: 'falla', detalle: 'No se pudo revisar: ' + motivo(e) + '.' }; }
    })();

    checks.push(...await Promise.all([...tareas, ...sitios, ...bases, ...planillas, datos]));

    // Limpieza: corridas de más de 30 días (no frena la respuesta si falla).
    try { await hub('sistema_corridas?inicio=lt.' + new Date(ahora - 30 * 86400000).toISOString(), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } catch (e) {}

    const fallas = checks.filter(c => c.estado === 'falla');
    return json(200, {
      ok: fallas.length === 0,
      revisado_at: new Date(ahora).toISOString(),
      fallas: fallas.map(c => ({ id: c.id, nombre: c.nombre, detalle: c.detalle })),
      checks,
    });
  } catch (e) {
    return json(500, { error: motivo(e) });
  }
};
