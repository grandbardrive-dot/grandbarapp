// ============================================================
//  GrandBar Hub · Function · acciones-evidencias  (14/10/2026)
//   Evidencias de las acciones de Luciana (campañas, planes, fechas especiales,
//   catálogo de clientes, vinos sobre la mesa, punteras, volumen y degustaciones).
//   - POST cargar (vendedor): fotos del punto de venta + comentario. Se carga en la
//     visita siguiente a la del cierre (el día del cierre el pedido no llegó).
//     La acción, su condición y su proveedor salen de la base, no del celular.
//     Avisa (campanita + push) a Trade Marketing (rol torneo, Juan Pablo Sepúlveda)
//     y a los usuarios del proveedor de la acción.
//   - GET: Trade Marketing y el equipo comercial ven todas; el proveedor, las suyas;
//     el vendedor, las de un cliente (?vista=cliente&cliente_id=) para saber qué falta.
//   - POST revisar (Trade Marketing): la marca como revisada.
//   - POST borrar (quien la cargó, mientras no esté revisada).
//   La tabla acciones_evidencias y la carpeta acciones-evidencias son privadas.
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const CAT_URL = 'https://zlwnoqdxendsgbfvfyue.supabase.co';
const CAT_KEY = 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4';
const BUCKET = 'acciones-evidencias';
const MAX_FOTOS = 3, MAX_BYTES = 3 * 1024 * 1024;

const CARGAN = ['ventas', 'mayorista', 'desarrollo', 'diseno'];          // vendedores (y quienes prueban el sistema)
const VEN_TODO = ['torneo', 'compras', 'marketing', 'desarrollo', 'diseno', 'direccion', 'admin'];
const REVISAN = ['torneo', 'desarrollo', 'diseno'];

const { pushA } = require('./_notificar');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => { const s = String(v == null ? '' : v).trim().slice(0, max); return s || null; };
const esUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
// Nombre de proveedor para comparar: sin acentos ni "grupo/group/bodega(s)".
const nrmProv = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(grupo|group|bodegas?|s\.?a\.?)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ilikeExacto = s => encodeURIComponent(String(s).replace(/[%_\\]/g, m => '\\' + m));

// De qué tabla sale cada tipo de acción y cómo se lee.
const TIPOS = {
  campania:    { db: 'man', tabla: 'acciones_mensuales', sel: 'id,producto,accion,proveedor', m: r => ({ titulo: r.producto, condicion: r.accion, proveedor: r.proveedor }) },
  plan:        { db: 'man', tabla: 'checklist_planes',   sel: 'id,nombre,condicion,proveedor', m: r => ({ titulo: r.nombre, condicion: r.condicion, proveedor: r.proveedor }) },
  fecha:       { db: 'man', tabla: 'acciones_fechas',    sel: 'id,nombre,condicion,propuesta_id', m: r => ({ titulo: r.nombre, condicion: r.condicion, propuesta_id: r.propuesta_id }) },
  catalogo:    { db: 'cat', tabla: 'catalogo_acciones',  sel: 'id,nombre_producto,mecanica,proveedor_id', m: r => ({ titulo: r.nombre_producto, condicion: r.mecanica, proveedor_id: r.proveedor_id }) },
  vino_mesa:   { db: 'hub', tabla: 'vinos_sobre_mesa',   sel: 'id,nombre,condicion,proveedor', m: r => ({ titulo: r.nombre, condicion: r.condicion, proveedor: r.proveedor }) },
  puntera:     { db: 'hub', tabla: 'acciones_herramientas', sel: 'id,nombre,condicion,proveedor', m: r => ({ titulo: r.nombre, condicion: r.condicion, proveedor: r.proveedor }) },
  volumen:     { db: 'hub', tabla: 'acciones_herramientas', sel: 'id,nombre,condicion,proveedor', m: r => ({ titulo: r.nombre, condicion: r.condicion, proveedor: r.proveedor }) },
  degustacion: { db: 'hub', tabla: 'acciones_herramientas', sel: 'id,nombre,condicion,proveedor', m: r => ({ titulo: r.nombre, condicion: r.condicion, proveedor: r.proveedor }) },
};

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || token === 'null' || token === 'undefined') return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const cab = (extra) => Object.assign({ apikey: srole, Authorization: 'Bearer ' + srole }, extra || {});
    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts, headers: cab({ 'Content-Type': 'application/json', ...(opts.headers || {}) }) });
    const st = (path, opts = {}) => fetch(HUB_URL + '/storage/v1/' + path, { ...opts, headers: cab(opts.headers) });
    const leer = async (base, key, path) => { const r = await fetch(base + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } }); return r.ok ? r.json() : []; };
    const man = path => leer(MAN_URL, MAN_KEY, path);
    const cat = path => leer(CAT_URL, CAT_KEY, path);
    const hub = async path => { const r = await sb(path); return r.ok ? r.json() : []; };

    const perfil = (await hub('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,empresa,codigo_vendedor,activo'))[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();

    // Links temporales (1 hora) para ver las fotos: la carpeta es privada.
    async function conFotos(filas) {
      const paths = [].concat(...filas.map(f => f.fotos || []));
      const url = {};
      if (paths.length) {
        const r = await st('object/sign/' + BUCKET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600, paths }) });
        const lista = r.ok ? await r.json() : [];
        (Array.isArray(lista) ? lista : []).forEach(x => { if (x && x.signedURL) url[x.path] = HUB_URL + '/storage/v1' + x.signedURL; });
      }
      return filas.map(f => ({ ...f, fotos_url: (f.fotos || []).map(p => url[p]).filter(Boolean) }));
    }
    async function notificar(destId, n) {
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: '📷', titulo: n.titulo, detalle: n.detalle, link: n.link }) }); } catch (e) {}
      try { await pushA(sb, destId, { title: '📷 ' + n.titulo, body: n.detalle, url: n.link }); } catch (e) {}
    }

    // ---------------- GET ----------------
    if (event.httpMethod === 'GET') {
      const qp = event.queryStringParameters || {};
      // Vendedor: qué evidencias ya tiene un cliente (para la lista de pendientes).
      if (qp.vista === 'cliente') {
        if (!CARGAN.includes(rol) && !VEN_TODO.includes(rol)) return json(403, { error: 'No autorizado.' });
        if (!esUuid(qp.cliente_id)) return json(400, { error: 'Falta el cliente.' });
        const filas = await hub('acciones_evidencias?cliente_id=eq.' + qp.cliente_id + '&select=id,tipo,accion_id,accion_titulo,fecha_cierre,created_at,vendedor_nombre,estado&order=created_at.desc&limit=300');
        return json(200, { evidencias: Array.isArray(filas) ? filas : [] });
      }
      let q = 'acciones_evidencias?select=*&order=created_at.desc&limit=500';
      if (rol === 'proveedor') {
        const empresa = perfil.empresa || perfil.nombre;
        if (!empresa) return json(200, { evidencias: [] });
        q += '&proveedor_empresa=ilike.' + ilikeExacto(empresa);
      } else if (VEN_TODO.includes(rol)) {
        if (qp.estado === 'nueva' || qp.estado === 'revisada') q += '&estado=eq.' + qp.estado;
      } else return json(403, { error: 'No autorizado.' });
      const filas = await hub(q);
      if (!Array.isArray(filas)) return json(502, { error: 'No se pudieron leer las evidencias. ¿Ya se corrió acciones-evidencias-setup.sql?' });
      return json(200, { evidencias: await conFotos(filas) });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' });
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }

    // ---------------- Revisar (Trade Marketing) ----------------
    if (b.accion === 'revisar') {
      if (!REVISAN.includes(rol)) return json(403, { error: 'Solo Trade Marketing marca las evidencias.' });
      if (!esUuid(b.id)) return json(400, { error: 'Falta la evidencia.' });
      const cambios = b.estado === 'nueva' ? { estado: 'nueva', revisado_por: null, revisado_at: null }
        : { estado: 'revisada', revisado_por: perfil.nombre || user.email, revisado_at: new Date().toISOString() };
      const r = await sb('acciones_evidencias?id=eq.' + b.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(cambios) });
      if (!r.ok) return json(502, { error: 'No se pudo guardar.' });
      return json(200, { ok: true });
    }

    // ---------------- Borrar (quien la cargó, si no está revisada) ----------------
    if (b.accion === 'borrar') {
      if (!esUuid(b.id)) return json(400, { error: 'Falta la evidencia.' });
      const f = (await hub('acciones_evidencias?id=eq.' + b.id + '&select=id,usuario_id,estado,fotos'))[0];
      if (!f || f.usuario_id !== user.id) return json(403, { error: 'Solo quien la cargó la puede borrar.' });
      if (f.estado === 'revisada') return json(400, { error: 'Ya la revisó Trade Marketing: no se puede borrar.' });
      await sb('acciones_evidencias?id=eq.' + b.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      if ((f.fotos || []).length) await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: f.fotos }) }).catch(() => {});
      return json(200, { ok: true });
    }

    // ---------------- Cargar (vendedor) ----------------
    if (b.accion !== 'cargar') return json(400, { error: 'Acción inválida.' });
    if (!CARGAN.includes(rol)) return json(403, { error: 'Solo los vendedores cargan evidencias.' });
    const T = TIPOS[b.tipo];
    if (!T) return json(400, { error: 'Tipo de acción desconocido.' });
    const aid = String(b.accion_id || '');
    if (!/^[\w-]{1,64}$/.test(aid)) return json(400, { error: 'Falta la acción.' });

    // La acción, de la base.
    const path = T.tabla + '?id=eq.' + encodeURIComponent(aid) + '&select=' + T.sel;
    const fila = (T.db === 'man' ? await man(path) : T.db === 'cat' ? await cat(path) : await hub(path))[0];
    if (!fila) return json(404, { error: 'No encontré la acción (¿la sacaron?).' });
    const acc = T.m(fila);
    if (b.tipo === 'catalogo' && acc.proveedor_id) acc.proveedor = ((await cat('catalogo_proveedores?id=eq.' + encodeURIComponent(acc.proveedor_id) + '&select=nombre'))[0] || {}).nombre || null;
    if (b.tipo === 'fecha' && esUuid(acc.propuesta_id)) acc.proveedor = ((await man('propuestas_acciones?id=eq.' + acc.propuesta_id + '&select=autor_empresa,autor_nombre'))[0] || {}).autor_empresa || null;

    // El cliente, de la base.
    const cli = esUuid(b.cliente_id) ? (await man('clientes?id=eq.' + b.cliente_id + '&select=id,codigo_cliente,nombre,tipo'))[0] : null;
    if (!cli) return json(400, { error: 'No encontré el cliente.' });

    const fecha = String(b.fecha_cierre || '');
    const fechaCierre = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= hoyAR() ? fecha : null;
    const fotos = Array.isArray(b.fotos) ? b.fotos.slice(0, MAX_FOTOS) : [];
    if (!fotos.length) return json(400, { error: 'Sumá al menos una foto.' });

    // Proveedor del portal que la recibe (mismo nombre, sin "Grupo", "Bodega"…).
    const provs = await hub('usuarios?rol=eq.proveedor&select=id,nombre,empresa,activo');
    const pn = nrmProv(acc.proveedor);
    const destProv = (Array.isArray(provs) ? provs : []).filter(u => {
      if (u.activo === false || !pn || pn.length < 4) return false;
      const en = nrmProv(u.empresa || u.nombre);
      return en.length >= 4 && (en === pn || en.includes(pn) || pn.includes(en));
    });
    const empresa = destProv.length ? (destProv[0].empresa || destProv[0].nombre) : null;

    // Fotos a la carpeta privada.
    const subidas = [];
    const base = String(cli.codigo_cliente || 'sin-codigo').replace(/[^\w-]/g, '') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    for (let i = 0; i < fotos.length; i++) {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(fotos[i] || ''));
      if (!m) return json(400, { error: 'Una de las fotos no es una imagen.' });
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length || buf.length > MAX_BYTES) return json(400, { error: 'Una de las fotos es demasiado pesada.' });
      const p = base + '-' + (i + 1) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
      const up = await st('object/' + BUCKET + '/' + p, { method: 'POST', headers: { 'Content-Type': 'image/' + m[1], 'x-upsert': 'false' }, body: buf });
      if (!up.ok) {
        if (subidas.length) await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: subidas }) }).catch(() => {});
        return json(502, { error: 'No se pudo subir la foto. ¿Ya se corrió acciones-evidencias-setup.sql?' });
      }
      subidas.push(p);
    }

    const nueva = {
      tipo: b.tipo, accion_id: aid, accion_titulo: texto(acc.titulo, 200) || 'Acción', accion_condicion: texto(acc.condicion, 200),
      proveedor: texto(acc.proveedor, 120), proveedor_empresa: empresa,
      cliente_id: cli.id, cliente_codigo: texto(cli.codigo_cliente, 30), cliente_nombre: texto(cli.nombre, 200), cliente_tipo: texto(cli.tipo, 40),
      vendedor_codigo: texto(perfil.codigo_vendedor, 20), vendedor_nombre: texto(perfil.nombre, 120), usuario_id: user.id,
      fecha_cierre: fechaCierre, fotos: subidas, comentario: texto(b.comentario, 500),
    };
    const ins = await sb('acciones_evidencias', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(nueva) });
    if (!ins.ok) {
      await st('object/' + BUCKET, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: subidas }) }).catch(() => {});
      return json(502, { error: 'No se pudo guardar la evidencia. ¿Ya se corrió acciones-evidencias-setup.sql?' });
    }
    const guardada = (await ins.json())[0] || nueva;

    // Avisos: Trade Marketing y el proveedor.
    const titulo = 'Evidencia: ' + nueva.accion_titulo;
    const detalle = nueva.cliente_nombre + (nueva.cliente_codigo ? ' (' + nueva.cliente_codigo + ')' : '') + (nueva.vendedor_nombre ? ' · ' + nueva.vendedor_nombre : '');
    let avisados = 0;
    const trade = await hub('usuarios?rol=eq.torneo&select=id,activo');
    for (const u of (Array.isArray(trade) ? trade : []).filter(u => u.activo !== false)) { await notificar(u.id, { titulo, detalle, link: '/trade-evidencias.html' }); avisados++; }
    for (const u of destProv) { await notificar(u.id, { titulo, detalle, link: '/manual-vendedores/proveedor.html#evidencias' }); avisados++; }
    return json(200, { ok: true, evidencia: { id: guardada.id }, proveedor: empresa, avisados });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

// Estado del sistema: los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('acciones-evidencias', module.exports.handler);
