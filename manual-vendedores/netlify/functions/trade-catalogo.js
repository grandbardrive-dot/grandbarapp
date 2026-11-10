// ============================================================
//  GrandBar Hub · Function · trade-catalogo
//   Acciones del catálogo que propone Trade Marketing (10/11/2026).
//   - Juan Pablo Sepúlveda (rol "torneo") carga una acción con el mismo formulario
//     que usa Luciana en el catálogo de clientes (crear). No se publica: queda
//     pendiente y le llega el aviso a Luciana.
//   - Luciana (rol compras, y quienes mantienen el panel comercial) la revisa:
//     la edita, le hace observaciones (vuelve a Juan Pablo, que la corrige y la
//     reenvía), la rechaza o la aprueba. Al aprobarla se crea en catalogo_acciones
//     (base del catálogo) y desde ahí sale en el catálogo y en el manual.
//   Tabla trade_catalogo_propuestas del Hub, cerrada al navegador
//   (trade-catalogo-setup.sql).
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
// Base del catálogo: el panel de Luciana la escribe con esta misma clave pública.
const CAT_URL = 'https://zlwnoqdxendsgbfvfyue.supabase.co';
const CAT_KEY = 'sb_publishable_gnrx5YRX7paRt0rYPB180A_733_UOZ4';
const TRADE = ['torneo', 'desarrollo', 'diseno'];                  // quien propone
const COMERCIAL = ['compras', 'desarrollo', 'diseno', 'marketing']; // quien revisa
const ABIERTAS = ['pendiente', 'observada'];
const CANALES = ['on', 'off', 'ambos', 'mayorista'];
const LINK_LUCIANA = '/manual-vendedores/admin-trade-catalogo.html';
const LINK_TRADE = '/trade-catalogo.html';

const { traerTodo } = require('./_paginar');
const { pushA } = require('./_notificar');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Solo los campos de catalogo_acciones que se cargan al crear una acción, limpios.
function limpiar(d) {
  d = d && typeof d === 'object' ? d : {};
  const txt = (v, max) => texto(v, max) || null;
  const numero = (v) => { const s = String(v == null ? '' : v).trim().replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const off = numero(d.porcentaje_off);
  const img = txt(d.imagen_url, 600);
  return {
    proveedor_id: txt(d.proveedor_id, 40),
    nombre_producto: txt(d.nombre_producto, 200),
    sku_promo: txt(d.sku_promo, 80),
    precio_accionado: numero(d.precio_accionado),
    precio_regular: numero(d.precio_regular),
    sugerido_venta: numero(d.sugerido_venta),
    porcentaje_off: off == null ? null : Math.round(off),
    mecanica: txt(d.mecanica, 400),
    info_adicional: txt(d.info_adicional, 600),
    canal: CANALES.includes(d.canal) ? d.canal : 'ambos',
    requiere_evidencia: d.requiere_evidencia === true,
    secciones: (Array.isArray(d.secciones) ? d.secciones : []).map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 300),
    zonas: (Array.isArray(d.zonas) ? d.zonas : []).map(String).filter((z) => z === 'mendoza' || z === 'sanluis'),
    // La foto se sube al almacenamiento del catálogo (el mismo de las fotos de Luciana).
    imagen_url: img && img.startsWith(CAT_URL + '/storage/v1/object/public/') ? img : null,
  };
}

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'Falta HUB_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();

    const sb = (path, opts = {}) => fetch(HUB_URL + '/rest/v1/' + path, { ...opts,
      headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const cat = (path, opts = {}) => fetch(CAT_URL + '/rest/v1/' + path, { ...opts,
      headers: { apikey: CAT_KEY, Authorization: 'Bearer ' + CAT_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,email,rol,activo')).json())[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();
    const esTrade = TRADE.includes(rol), esComercial = COMERCIAL.includes(rol);
    if (!esTrade && !esComercial) return json(403, { error: 'No autorizado.' });
    const quien = perfil.nombre || perfil.email || 'Portal';

    async function notificar(destId, n) {
      if (!destId) return;
      try { await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: destId, icono: n.icono, titulo: n.titulo, detalle: n.detalle || null, link: n.link || null }) }); } catch (e) {}
      try { await pushA(sb, destId, { title: n.icono + ' ' + n.titulo, body: n.detalle || '', url: n.link || '/' }); } catch (e) {}
    }
    async function avisarComercial(n) {
      try {
        const dest = await (await sb('usuarios?rol=eq.compras&select=id,activo')).json();
        for (const u of (Array.isArray(dest) ? dest : []).filter((u) => u.activo !== false)) await notificar(u.id, n);
      } catch (e) {}
    }
    const evento = (que, txt) => ({ fecha: new Date().toISOString(), quien, que, ...(txt ? { texto: txt } : {}) });
    const nombreDe = (f) => (f.datos && f.datos.nombre_producto) || 'Acción';
    const provDe = (f) => (f.datos && f.datos.proveedor_nombre) ? ' (' + f.datos.proveedor_nombre + ')' : '';

    // El proveedor tiene que existir en el catálogo; se guarda su nombre para mostrarlo.
    async function validar(d) {
      if (!d.proveedor_id) return 'Elegí un proveedor.';
      if (!d.nombre_producto) return 'Poné un nombre de producto.';
      const r = await cat('catalogo_proveedores?id=eq.' + encodeURIComponent(d.proveedor_id) + '&select=nombre,categoria');
      const p = r.ok ? (await r.json())[0] : null;
      if (!p) return 'Ese proveedor no está en el catálogo.';
      d.proveedor_nombre = p.nombre || ''; d.proveedor_categoria = p.categoria || '';
      return null;
    }
    async function leer(id) {
      const r = await sb('trade_catalogo_propuestas?id=eq.' + encodeURIComponent(id) + '&select=*');
      return r.ok ? (await r.json())[0] : null;
    }
    async function guardar(id, cambios, filtro = '') {
      const r = await sb('trade_catalogo_propuestas?id=eq.' + encodeURIComponent(id) + filtro, { method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...cambios, updated_at: new Date().toISOString() }) });
      return r.ok ? (await r.json())[0] : null;
    }

    // ---------------- GET ----------------
    if (event.httpMethod === 'GET') {
      const qp = event.queryStringParameters || {};
      if (qp.vista === 'contar') {
        if (!esComercial) return json(200, { pendientes: 0 });
        const r = await sb('trade_catalogo_propuestas?select=id&estado=eq.pendiente', { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } });
        if (!r.ok) return json(502, { error: 'No se pudieron contar las acciones.' });
        return json(200, { pendientes: Number(((r.headers.get('content-range') || '').split('/')[1])) || 0 });
      }
      // Luciana ve todas; Juan Pablo, las suyas. Primero se confirma que la tabla exista:
      // traerTodo devuelve [] si la consulta falla y parecería que no hay nada.
      const prueba = await sb('trade_catalogo_propuestas?select=id&limit=1');
      if (!prueba.ok) return json(502, { error: 'No se pudieron leer las acciones. ¿Ya se corrió trade-catalogo-setup.sql?' });
      const filtro = esComercial ? '' : '&autor_id=eq.' + encodeURIComponent(user.id);
      const filas = await traerTodo(sb, 'trade_catalogo_propuestas?select=*' + filtro + '&order=created_at.desc');
      return json(200, { propuestas: filas, puede: { proponer: esTrade, revisar: esComercial } });
    }

    // ---------------- POST ----------------
    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }

      if (b.accion === 'crear') {
        if (!esTrade) return json(403, { error: 'Solo Trade Marketing carga acciones acá.' });
        const datos = limpiar(b.datos);
        const err = await validar(datos);
        if (err) return json(400, { error: err });
        const nota = texto(b.nota, 1500) || null;
        const fila = { autor_id: user.id, autor_nombre: quien, estado: 'pendiente', datos, nota, historial: [evento('envio', nota)] };
        const r = await sb('trade_catalogo_propuestas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
        if (!r.ok) return json(502, { error: 'No se pudo guardar la acción. ¿Ya se corrió trade-catalogo-setup.sql?' });
        const guardada = (await r.json())[0];
        await avisarComercial({ icono: '📝', titulo: quien + ' te mandó una acción para el catálogo', detalle: nombreDe(guardada) + provDe(guardada) + (nota ? ' — ' + nota.slice(0, 120) : ''), link: LINK_LUCIANA });
        return json(200, { ok: true, propuesta: guardada });
      }

      const f = b.id ? await leer(b.id) : null;
      if (!f) return json(404, { error: 'No encontré la acción.' });
      const esAutor = f.autor_id === user.id;

      if (b.accion === 'editar') {
        if (!ABIERTAS.includes(f.estado)) return json(409, { error: 'Esta acción ya fue ' + (f.estado === 'aprobada' ? 'aprobada' : 'rechazada') + ': no se puede editar.' });
        if (!(esAutor && esTrade) && !esComercial) return json(403, { error: 'No autorizado.' });
        const datos = limpiar(b.datos);
        const err = await validar(datos);
        if (err) return json(400, { error: err });
        if (esAutor && esTrade) {
          // Juan Pablo la corrige: vuelve a quedar pendiente para Luciana.
          const nota = texto(b.nota, 1500) || null;
          const reenvio = f.estado === 'observada';
          const g = await guardar(f.id, { datos, nota, estado: 'pendiente', historial: [...(f.historial || []), evento(reenvio ? 'reenvio' : 'edito', nota)] });
          if (!g) return json(502, { error: 'No se pudo guardar.' });
          if (reenvio) await avisarComercial({ icono: '📝', titulo: quien + ' corrigió una acción para el catálogo', detalle: nombreDe(g) + provDe(g) + (nota ? ' — ' + nota.slice(0, 120) : ''), link: LINK_LUCIANA });
          return json(200, { ok: true, propuesta: g });
        }
        // Luciana la edita: queda como estaba (sigue en su lista hasta que la apruebe).
        const g = await guardar(f.id, { datos, historial: [...(f.historial || []), evento('edito_revision')] });
        if (!g) return json(502, { error: 'No se pudo guardar.' });
        return json(200, { ok: true, propuesta: g });
      }

      if (b.accion === 'observar' || b.accion === 'rechazar') {
        if (!esComercial) return json(403, { error: 'Solo el panel comercial revisa estas acciones.' });
        if (!ABIERTAS.includes(f.estado)) return json(409, { error: 'Esta acción ya fue revisada.' });
        const obs = texto(b.observacion, 2000);
        if (b.accion === 'observar' && !obs) return json(400, { error: 'Escribí las observaciones.' });
        const estado = b.accion === 'observar' ? 'observada' : 'rechazada';
        const g = await guardar(f.id, { estado, observacion: obs || null, revisado_por: quien, revisado_at: new Date().toISOString(),
          historial: [...(f.historial || []), evento(b.accion === 'observar' ? 'observo' : 'rechazo', obs)] });
        if (!g) return json(502, { error: 'No se pudo guardar.' });
        await notificar(f.autor_id, b.accion === 'observar'
          ? { icono: '💬', titulo: quien + ' te hizo observaciones sobre una acción', detalle: nombreDe(g) + ' — ' + obs.slice(0, 140), link: LINK_TRADE }
          : { icono: '✕', titulo: quien + ' no aprobó una acción', detalle: nombreDe(g) + (obs ? ' — ' + obs.slice(0, 140) : ''), link: LINK_TRADE });
        return json(200, { ok: true, propuesta: g });
      }

      if (b.accion === 'aprobar') {
        if (!esComercial) return json(403, { error: 'Solo el panel comercial aprueba estas acciones.' });
        if (!ABIERTAS.includes(f.estado)) return json(409, { error: 'Esta acción ya fue revisada.' });
        // Si Luciana la corrigió en el mismo paso, vale lo que mandó.
        let datos = f.datos || {};
        if (b.datos) {
          datos = limpiar(b.datos);
          const err = await validar(datos);
          if (err) return json(400, { error: err });
        }
        // Primero se toma la acción (solo si sigue abierta): dos clics no la cargan dos veces.
        const antes = f.estado;
        const tomada = await guardar(f.id, { estado: 'aprobada', datos, revisado_por: quien, revisado_at: new Date().toISOString() }, '&estado=in.(pendiente,observada)');
        if (!tomada) return json(409, { error: 'Esta acción ya fue revisada.' });
        const { proveedor_nombre, proveedor_categoria, ...accion } = datos;
        const r = await cat('catalogo_acciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(accion) });
        const creada = r.ok ? (await r.json())[0] : null;
        if (!creada) {
          const det = r.ok ? '' : (await r.text()).slice(0, 160);
          await guardar(f.id, { estado: antes, revisado_por: f.revisado_por, revisado_at: f.revisado_at });
          return json(502, { error: 'No se pudo cargar en el catálogo. ' + det });
        }
        const g = await guardar(f.id, { accion_id: creada.id, historial: [...(f.historial || []), evento('aprobo')] });
        await notificar(f.autor_id, { icono: '✅', titulo: quien + ' aprobó tu acción: ya está en el catálogo', detalle: nombreDe(tomada) + provDe(tomada), link: LINK_TRADE });
        return json(200, { ok: true, propuesta: g || tomada, accion: creada });
      }

      if (b.accion === 'borrar') {
        // Quien la mandó la puede sacar mientras no esté aprobada.
        if (!esAutor) return json(403, { error: 'No autorizado.' });
        if (f.estado === 'aprobada') return json(409, { error: 'Ya está aprobada: se saca desde el catálogo.' });
        await sb('trade_catalogo_propuestas?id=eq.' + encodeURIComponent(f.id), { method: 'DELETE' });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción desconocida.' });
    }
    return json(405, { error: 'Método no permitido' });
  } catch (e) {
    return json(500, { error: 'Error: ' + (e.message || e) });
  }
};

// Estado del sistema: los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('trade-catalogo', module.exports.handler);
