// ============================================================
//  GrandBar Hub · Function · ejecuciones  (26/11/2026)
//   Plan de puntos por ejecución (exhibiciones, barras, punteras, etc.).
//   El vendedor arma la ejecución en el cliente, saca la foto y la carga;
//   Juan Pablo Sepúlveda (Trade, rol 'torneo') la valida (aprobar / pedir
//   rehacer / rechazar). Las aprobadas suman puntos → billetera del vendedor →
//   se convierten en plata (valor del punto configurable).
//   Arranca con Campari. Catálogo editable (ejecuciones_tipos).
//
//   Tablas (HUB): ejecuciones_tipos, ejecuciones, ejecuciones_config.
//   Fotos en el bucket privado acciones-evidencias, carpeta ejec/.
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const BUCKET = 'acciones-evidencias';
const PREF = 'ejec/';
const MAX_FOTOS = 3, MAX_BYTES = 3 * 1024 * 1024;

const CARGAN = ['ventas', 'mayorista', 'desarrollo', 'diseno'];
const KAF = ['kaf'];
const VALIDAN = ['torneo', 'desarrollo', 'diseno'];
const ADMIN = ['compras', 'admin', 'direccion', 'desarrollo', 'diseno', 'marketing'];
const VEN_COLA = ['torneo', 'compras', 'admin', 'direccion', 'desarrollo', 'diseno', 'marketing'];

// Cuestionario de resultado (fijo, Campari). Lo completan el KAF y el vendedor.
// Orden pedido por Fernando: Antecedente → Qué se hizo → Resultado.
const PREGUNTAS = [
  { k: 'copas_normal', t: '¿Cuántas copas/tragos vendía por semana ANTES, sin la acción?', tipo: 'num', seccion: 'Antecedente' },
  { k: 'precio_antes', t: '¿A qué precio lo vendía antes? ($)', tipo: 'num', seccion: 'Antecedente' },
  { k: 'producto', t: '¿Qué producto/marca se trabajó?', tipo: 'texto', max: 60, seccion: 'Qué se hizo' },
  { k: 'que_se_hizo', t: '¿Qué se hizo en el punto de venta?', tipo: 'texto', max: 300, seccion: 'Qué se hizo' },
  { k: 'copas_accion', t: '¿Cuántas copas/tragos vendió DURANTE la acción?', tipo: 'num', seccion: 'Resultado' },
  { k: 'precio', t: '¿A qué precio la vendió durante la acción? ($)', tipo: 'num', seccion: 'Resultado' },
  { k: 'botellas', t: '¿Cuántas botellas de la marca compró por la acción?', tipo: 'num', seccion: 'Resultado' },
  { k: 'repetiria', t: '¿Repetiría la acción?', tipo: 'texto', max: 20, seccion: 'Resultado' },
  { k: 'comentario_cliente', t: 'Comentario del cliente', tipo: 'texto', max: 400, seccion: 'Resultado' },
];
// El vendedor carga poco (en la visita no hay tiempo): 3 datos y el resultado se calcula solo.
const PREGUNTAS_VEND = [
  { k: 'producto', t: '¿Qué producto/marca se trabajó?', tipo: 'texto', max: 60 },
  { k: 'copas_normal', t: '¿Cuántas copas/tragos vende por semana normalmente?', tipo: 'num' },
  { k: 'copas_accion', t: '¿Cuántas vendió con la acción?', tipo: 'num' },
];
function limpiarResultado(r) {
  if (!r || typeof r !== 'object') return null;
  const out = {}; let hay = false;
  for (const p of PREGUNTAS) {
    let v = r[p.k];
    if (v == null || v === '') continue;
    if (p.tipo === 'num') { v = Number(v); if (!Number.isFinite(v)) continue; }
    else v = String(v).trim().slice(0, p.max || 200);
    out[p.k] = v; hay = true;
  }
  return hay ? out : null;
}

let pushA = null;
try { ({ pushA } = require('./_notificar')); } catch (e) { pushA = async () => {}; }

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => { const s = String(v == null ? '' : v).trim().slice(0, max); return s || null; };
const esUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
const intOf = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const numOf = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const arrTxt = (v, max, n) => (Array.isArray(v) ? v : []).map(x => texto(x, max)).filter(Boolean).slice(0, n || 30);
const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token === 'null' || token === 'undefined') return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida. Entrá al manual desde el Portal.' });
    const user = await uRes.json();

    const cab = (extra) => Object.assign({ apikey: srole, Authorization: 'Bearer ' + srole }, extra || {});
    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: cab({ 'Content-Type': 'application/json', ...(opts.headers || {}) }) });
    const st = (path, opts = {}) => fetch(HUB_URL + '/storage/v1/' + path, { ...opts, headers: cab(opts.headers) });
    const hub = async path => { const r = await sb(path); return r.ok ? r.json() : []; };
    const man = async path => { const r = await fetch(MAN_URL + '/rest/v1/' + path, { headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY } }); return r.ok ? r.json() : []; };

    const perfil = (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,codigo_vendedor,canal,activo'))[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const esVend = CARGAN.includes(rol), esKaf = KAF.includes(rol), esValida = VALIDAN.includes(rol), esAdmin = ADMIN.includes(rol), verCola = VEN_COLA.includes(rol);
    // El vendedor ve las ejecuciones de SU canal (ON/OFF) + las 'ambos'. El KAF las ve todas.
    const canal = String(perfil.canal || '').toLowerCase();
    const fCanal = (!esKaf && (canal === 'on' || canal === 'off')) ? '&or=(canal.eq.ambos,canal.eq.' + canal + ')' : '';

    async function config() {
      const c = (await hub('ejecuciones_config?id=eq.1&select=valor_punto,nota'))[0] || {};
      return { valor_punto: numOf(c.valor_punto, 100), nota: c.nota || null };
    }
    // Links temporales (1 h) para las fotos de la carpeta privada.
    async function firmar(filas) {
      const todos = [].concat(...filas.map(f => (f.fotos || [])));
      const url = {};
      // Las que ya son URL pública (ej. fotos de ejemplo) pasan tal cual; el resto se firma.
      todos.forEach(p => { if (/^https?:\/\//i.test(String(p))) url[p] = p; });
      const paths = todos.filter(p => !/^https?:\/\//i.test(String(p)));
      if (paths.length) {
        const r = await st('object/sign/' + BUCKET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600, paths }) });
        const lista = r.ok ? await r.json() : [];
        (Array.isArray(lista) ? lista : []).forEach(x => { if (x && x.signedURL) url[x.path] = HUB_URL + '/storage/v1' + x.signedURL; });
      }
      return filas.map(f => ({ ...f, fotos_url: (f.fotos || []).map(p => url[p]).filter(Boolean) }));
    }
    const puntosDe = async (uid) => {
      const r = await hub('ejecuciones?usuario_id=eq.' + encodeURIComponent(uid) + '&estado=eq.aprobada&select=proveedor,puntos');
      const map = {};
      (Array.isArray(r) ? r : []).forEach(e => { map[e.proveedor || 'Campari'] = (map[e.proveedor || 'Campari'] || 0) + (e.puntos || 0); });
      return map;
    };
    async function notificar(destId, n) {
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono || '🏆', titulo: n.titulo, detalle: n.detalle, link: n.link }) }); } catch (e) {}
      try { await pushA(sb, destId, { title: (n.icono || '🏆') + ' ' + n.titulo, body: n.detalle, url: n.link }); } catch (e) {}
    }

    // ============ GET ============
    if (event.httpMethod === 'GET') {
      const qp = event.queryStringParameters || {};

      // Pantalla de proveedores (con logo) para elegir antes del catálogo.
      if (qp.vista === 'proveedores') {
        if (!esVend && !esKaf) return json(403, { error: 'No autorizado.' });
        const tt = await hub('ejecuciones_tipos?activo=eq.true' + fCanal + '&select=proveedor');
        const cont = {}; (Array.isArray(tt) ? tt : []).forEach(t => { if (t.proveedor) cont[t.proveedor] = (cont[t.proveedor] || 0) + 1; });
        const logos = await man('proveedores?select=nombre,logo_url');
        const logoDe = (nombre) => {
          const n = nrm(nombre);
          const hit = (Array.isArray(logos) ? logos : []).find(p => { const pn = nrm(p.nombre); return pn && (pn === n || pn.includes(n) || n.includes(pn)); });
          return hit ? hit.logo_url : null;
        };
        const lista = Object.keys(cont).map(p => ({ proveedor: p, logo: logoDe(p), tipos: cont[p] })).sort((a, b) => a.proveedor.localeCompare(b.proveedor));
        return json(200, { proveedores: lista, esKaf });
      }

      if (qp.vista === 'vendedor') {
        if (!esVend && !esKaf) return json(403, { error: 'Solo los vendedores y el KAF cargan ejecuciones.' });
        const prov = texto(qp.proveedor, 120);
        const fProv = prov ? '&proveedor=eq.' + encodeURIComponent(prov) : '';
        const tipos = await hub('ejecuciones_tipos?activo=eq.true' + fProv + fCanal + '&select=id,proveedor,nombre,categoria,canal,descripcion,puntos,icono,manual_objetivo,manual_si,manual_no,foto_si,foto_no,orden&order=orden.asc,nombre.asc');
        const mias0 = await hub('ejecuciones?usuario_id=eq.' + encodeURIComponent(user.id) + fProv + '&select=id,tipo_nombre,proveedor,puntos,cliente_nombre,fotos,estado,validacion_comentario,resultado,created_at,validado_at&order=created_at.desc&limit=100');
        return json(200, { config: await config(), proveedor: prov || null, tipos: Array.isArray(tipos) ? tipos : [], mias: await firmar(Array.isArray(mias0) ? mias0 : []), puntos: await puntosDe(user.id), esKaf, preguntas: esKaf ? PREGUNTAS : PREGUNTAS_VEND, vendedor: { nombre: perfil.nombre, codigo: perfil.codigo_vendedor } });
      }

      if (qp.vista === 'cola') {
        if (!verCola) return json(403, { error: 'No autorizado.' });
        let q = 'ejecuciones?select=*&order=created_at.desc&limit=400';
        if (qp.estado === 'pendiente' || qp.estado === 'aprobada' || qp.estado === 'rechazada' || qp.estado === 'rehacer') q = 'ejecuciones?estado=eq.' + qp.estado + '&select=*&order=created_at.desc&limit=400';
        const filas = await hub(q);
        if (!Array.isArray(filas)) return json(502, { error: 'No se pudieron leer las ejecuciones.' });
        return json(200, { config: await config(), ejecuciones: await firmar(filas), puedeValidar: esValida });
      }

      if (qp.vista === 'catalogo') {
        if (!esAdmin) return json(403, { error: 'No autorizado.' });
        const tipos = await hub('ejecuciones_tipos?select=*&order=proveedor.asc,orden.asc');
        return json(200, { config: await config(), tipos: Array.isArray(tipos) ? tipos : [] });
      }

      // Presentaciones guardadas (lista).
      if (qp.vista === 'presentaciones') {
        if (!esAdmin) return json(403, { error: 'No autorizado.' });
        const l = await hub('presentaciones?select=id,proveedor,periodo,titulo,total,generado_por,created_at&order=created_at.desc&limit=100');
        return json(200, { presentaciones: Array.isArray(l) ? l : [] });
      }
      // Una presentación, con las fotos firmadas para el deck.
      if (qp.vista === 'presentacion') {
        if (!esAdmin) return json(403, { error: 'No autorizado.' });
        if (!esUuid(qp.id)) return json(400, { error: 'Falta la presentación.' });
        const p = (await hub('presentaciones?id=eq.' + qp.id + '&select=*'))[0];
        if (!p) return json(404, { error: 'No encontré la presentación.' });
        const items = Array.isArray(p.datos) ? p.datos : [];
        const conFotos = await firmar(items);
        return json(200, { presentacion: { ...p, datos: conFotos }, preguntas: PREGUNTAS });
      }

      // Ranking simple por proveedor (opcional, para motivar).
      if (qp.vista === 'ranking') {
        if (!esVend && !verCola) return json(403, { error: 'No autorizado.' });
        const prov = texto(qp.proveedor, 60) || 'Campari';
        const r = await hub('ejecuciones?estado=eq.aprobada&proveedor=eq.' + encodeURIComponent(prov) + '&select=vendedor_codigo,vendedor_nombre,puntos');
        const map = {};
        (Array.isArray(r) ? r : []).forEach(e => { const k = e.vendedor_codigo || e.vendedor_nombre || '—'; (map[k] = map[k] || { codigo: e.vendedor_codigo, nombre: e.vendedor_nombre, puntos: 0 }).puntos += (e.puntos || 0); });
        const lista = Object.values(map).sort((a, b) => b.puntos - a.puntos).slice(0, 30);
        return json(200, { ranking: lista });
      }

      return json(400, { error: 'Vista desconocida.' });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' });
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }

    // ============ Cargar (vendedor) ============
    if (b.accion === 'cargar') {
      if (!esVend && !esKaf) return json(403, { error: 'Solo los vendedores y el KAF cargan ejecuciones.' });
      if (!esUuid(b.tipo_id)) return json(400, { error: 'Elegí la ejecución.' });
      const tipo = (await hub('ejecuciones_tipos?id=eq.' + b.tipo_id + '&select=id,nombre,proveedor,puntos,activo'))[0];
      if (!tipo || tipo.activo === false) return json(404, { error: 'Esa ejecución ya no está disponible.' });
      const fotos = Array.isArray(b.fotos) ? b.fotos.slice(0, MAX_FOTOS) : [];
      if (!fotos.length) return json(400, { error: 'Sumá al menos una foto.' });

      // Cliente: opcional para el vendedor; obligatorio para el KAF.
      let cli = null;
      if (b.cliente_codigo && /^[\w-]{1,20}$/.test(String(b.cliente_codigo))) cli = (await man('clientes?codigo_cliente=eq.' + encodeURIComponent(b.cliente_codigo) + '&select=id,codigo_cliente,nombre'))[0] || null;
      const cliNombre = cli ? cli.nombre : texto(b.cliente_nombre, 200);
      if (esKaf && !cliNombre) return json(400, { error: 'Elegí el punto de venta.' });
      const resultado = limpiarResultado(b.resultado);
      // El resultado (levante) se calcula solo: copas con la acción vs lo normal.
      if (resultado && resultado.copas_normal != null && resultado.copas_accion != null) {
        const base = Number(resultado.copas_normal), act = Number(resultado.copas_accion);
        resultado.uplift = Math.round(act - base);
        resultado.uplift_pct = base > 0 ? Math.round((act / base - 1) * 100) : null;
      }

      // Subir fotos.
      const subidas = [];
      const borrar = () => st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: subidas }) }).catch(() => {});
      const base = PREF + (texto(perfil.codigo_vendedor, 20) || 'sin') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      for (let i = 0; i < fotos.length; i++) {
        const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(fotos[i] || ''));
        if (!m) { await borrar(); return json(400, { error: 'Una de las fotos no es una imagen.' }); }
        const buf = Buffer.from(m[2], 'base64');
        if (!buf.length || buf.length > MAX_BYTES) { await borrar(); return json(400, { error: 'Una de las fotos es demasiado pesada.' }); }
        const p = base + '-' + (i + 1) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
        const up = await st('object/' + BUCKET + '/' + p, { method: 'POST', headers: { 'Content-Type': 'image/' + m[1], 'x-upsert': 'false' }, body: buf });
        if (!up.ok) { await borrar(); return json(502, { error: 'No se pudo subir la foto. Probá de nuevo.' }); }
        subidas.push(p);
      }

      const nueva = {
        tipo_id: tipo.id, tipo_nombre: texto(tipo.nombre, 200), proveedor: texto(tipo.proveedor, 120),
        puntos: esKaf ? 0 : intOf(tipo.puntos, 0), fuente: esKaf ? 'kaf' : 'vendedor',
        usuario_id: user.id, vendedor_codigo: texto(perfil.codigo_vendedor, 20), vendedor_nombre: texto(perfil.nombre, 120),
        cliente_id: cli ? cli.id : null, cliente_codigo: cli ? texto(cli.codigo_cliente, 30) : null, cliente_nombre: cliNombre,
        fotos: subidas, comentario: texto(b.comentario, 500), resultado, estado: esKaf ? 'aprobada' : 'pendiente',
      };
      const ins = await sb('ejecuciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(nueva) });
      if (!ins.ok) { await borrar(); return json(502, { error: 'No se pudo guardar la ejecución.' }); }
      const guardada = (await ins.json())[0] || nueva;

      // El KAF no pasa por validación (no suma puntos). El vendedor sí: avisar a Trade.
      if (!esKaf) {
        const tit = 'Ejecución para validar';
        const det = tipo.nombre + (cliNombre ? ' · ' + cliNombre : '') + (nueva.vendedor_nombre ? ' · ' + nueva.vendedor_nombre : '');
        const valid = await hub('usuarios?rol=eq.torneo&select=id,activo');
        for (const u of (Array.isArray(valid) ? valid : []).filter(u => u.activo !== false)) await notificar(u.id, { icono: '🏆', titulo: tit, detalle: det, link: '/manual-vendedores/trade-ejecuciones.html' });
      }
      return json(200, { ok: true, ejecucion: (await firmar([guardada]))[0] });
    }

    // ============ Validar (Trade) ============
    if (b.accion === 'validar') {
      if (!esValida) return json(403, { error: 'Solo Trade valida las ejecuciones.' });
      if (!esUuid(b.id)) return json(400, { error: 'Falta la ejecución.' });
      const nuevo = String(b.estado || '');
      if (!['aprobada', 'rechazada', 'rehacer'].includes(nuevo)) return json(400, { error: 'Estado inválido.' });
      const coment = texto(b.comentario, 500);
      if ((nuevo === 'rehacer' || nuevo === 'rechazada') && !coment) return json(400, { error: 'Escribí el motivo para que el vendedor sepa qué corregir.' });
      const f = (await hub('ejecuciones?id=eq.' + b.id + '&select=*'))[0];
      if (!f) return json(404, { error: 'No encontré la ejecución.' });
      const patch = { estado: nuevo, validado_por: perfil.nombre || user.email, validado_at: new Date().toISOString(), validacion_comentario: coment };
      const r = await sb('ejecuciones?id=eq.' + b.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
      if (!r.ok) return json(502, { error: 'No se pudo guardar.' });
      // Avisar al vendedor.
      if (f.usuario_id) {
        const txt = nuevo === 'aprobada' ? ('¡Sumaste ' + (f.puntos || 0) + ' pts! ' + (f.tipo_nombre || '')) : nuevo === 'rehacer' ? ('Rehacé: ' + (f.tipo_nombre || '') + (coment ? ' · ' + coment : '')) : ('No aprobada: ' + (f.tipo_nombre || '') + (coment ? ' · ' + coment : ''));
        await notificar(f.usuario_id, { icono: nuevo === 'aprobada' ? '🏆' : '📷', titulo: nuevo === 'aprobada' ? 'Ejecución aprobada' : (nuevo === 'rehacer' ? 'Rehacé la ejecución' : 'Ejecución no aprobada'), detalle: txt, link: '/manual-vendedores/ejecuciones.html' });
      }
      return json(200, { ok: true });
    }

    // ============ Borrar (quien la cargó, si sigue pendiente) ============
    if (b.accion === 'borrar') {
      if (!esUuid(b.id)) return json(400, { error: 'Falta la ejecución.' });
      const f = (await hub('ejecuciones?id=eq.' + b.id + '&select=*'))[0];
      if (!f || f.usuario_id !== user.id) return json(403, { error: 'Solo quien la cargó la puede borrar.' });
      if (f.estado === 'aprobada') return json(400, { error: 'Ya está aprobada: no se puede borrar.' });
      await sb('ejecuciones?id=eq.' + b.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      if ((f.fotos || []).length) await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: f.fotos }) }).catch(() => {});
      return json(200, { ok: true });
    }

    // ============ Catálogo: guardar tipo (admin) ============
    if (b.accion === 'tipo_guardar') {
      if (!esAdmin) return json(403, { error: 'No autorizado.' });
      const fila = {
        proveedor: texto(b.proveedor, 120) || 'Campari', nombre: texto(b.nombre, 200), descripcion: texto(b.descripcion, 300),
        puntos: intOf(b.puntos, 0), icono: texto(b.icono, 8), orden: intOf(b.orden, 0), activo: b.activo !== false,
        manual_objetivo: texto(b.manual_objetivo, 400), manual_si: arrTxt(b.manual_si, 200, 12), manual_no: arrTxt(b.manual_no, 200, 12),
        foto_si: texto(b.foto_si, 500), foto_no: texto(b.foto_no, 500),
      };
      if (!fila.nombre) return json(400, { error: 'Poné el nombre de la ejecución.' });
      let r;
      if (esUuid(b.id)) r = await sb('ejecuciones_tipos?id=eq.' + b.id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
      else r = await sb('ejecuciones_tipos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
      if (!r.ok) return json(502, { error: 'No se pudo guardar.' });
      return json(200, { ok: true, tipo: (await r.json())[0] });
    }
    if (b.accion === 'tipo_borrar') {
      if (!esAdmin) return json(403, { error: 'No autorizado.' });
      if (!esUuid(b.id)) return json(400, { error: 'Falta el tipo.' });
      await sb('ejecuciones_tipos?id=eq.' + b.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return json(200, { ok: true });
    }

    // ============ Config: valor del punto (admin) ============
    if (b.accion === 'config') {
      if (!esAdmin) return json(403, { error: 'No autorizado.' });
      const patch = { valor_punto: numOf(b.valor_punto, 100), nota: texto(b.nota, 200), updated_at: new Date().toISOString() };
      const r = await sb('ejecuciones_config?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
      if (!r.ok) return json(502, { error: 'No se pudo guardar.' });
      return json(200, { ok: true });
    }

    // ============ Generar presentación del mes (admin) ============
    if (b.accion === 'pres_generar') {
      if (!esAdmin) return json(403, { error: 'No autorizado.' });
      const prov = texto(b.proveedor, 120) || 'Campari';
      const hoy = new Date(Date.now() - 3 * 3600000);
      let periodo = String(b.periodo || '');
      if (!/^\d{4}-\d{2}$/.test(periodo)) periodo = hoy.toISOString().slice(0, 7);
      const [yy, mm] = periodo.split('-').map(Number);
      const desde = periodo + '-01';
      const hasta = (mm === 12 ? (yy + 1) + '-01-01' : yy + '-' + String(mm + 1).padStart(2, '0') + '-01');
      const filas = await hub('ejecuciones?proveedor=eq.' + encodeURIComponent(prov) + '&estado=eq.aprobada&created_at=gte.' + desde + '&created_at=lt.' + hasta + '&select=tipo_nombre,cliente_nombre,vendedor_nombre,fuente,comentario,resultado,fotos,created_at&order=created_at.asc&limit=2000');
      const datos = (Array.isArray(filas) ? filas : []).map(f => ({
        tipo_nombre: f.tipo_nombre, cliente_nombre: f.cliente_nombre, vendedor_nombre: f.vendedor_nombre,
        fuente: f.fuente, comentario: f.comentario, resultado: f.resultado, fotos: f.fotos || [], created_at: f.created_at,
      }));
      const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const titulo = texto(b.titulo, 160) || ('Ejecuciones ' + MES[mm - 1] + ' ' + yy);
      const fila = { proveedor: prov, periodo, titulo, total: datos.length, generado_por: perfil.nombre || user.email, generado_por_id: user.id, datos };
      const ins = await sb('presentaciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
      if (!ins.ok) return json(502, { error: 'No se pudo generar la presentación.' });
      const g = (await ins.json())[0] || fila;
      return json(200, { ok: true, presentacion: { id: g.id, titulo: g.titulo, total: g.total } });
    }
    // ============ Borrar presentación (admin) ============
    if (b.accion === 'pres_borrar') {
      if (!esAdmin) return json(403, { error: 'No autorizado.' });
      if (!esUuid(b.id)) return json(400, { error: 'Falta la presentación.' });
      await sb('presentaciones?id=eq.' + b.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return json(200, { ok: true });
    }

    return json(400, { error: 'Acción inválida.' });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

try { module.exports.handler = require('./_errores').conErrores('ejecuciones', module.exports.handler); } catch (e) {}
