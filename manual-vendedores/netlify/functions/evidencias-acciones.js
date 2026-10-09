// ============================================================
//  GrandBar Hub · Function · evidencias-acciones
//   Evidencias de las acciones de proveedores que piden evidencia (09/10/2026).
//   - POST (vendedor): le mandó al cliente la placa de la acción, con su logo.
//     Se guarda qué acción, qué cliente, cuándo y quién, y al proveedor le llega
//     el aviso (campanita + push).
//   - GET (proveedor): sus evidencias. Quienes mantienen el panel comercial y el
//     sistema ven todas (?proveedor= para filtrar).
//   La tabla `evidencias_acciones` (proyecto del Hub) no se lee desde el navegador:
//   RLS sin reglas, todo pasa por acá con la clave de servicio.
//   Env: HUB_SERVICE_ROLE
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
// Manual: la propuesta, el cliente y la placa viven ahí (clave pública, solo lectura acá).
const MAN_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const PLACAS = MAN_URL + '/storage/v1/object/public/Activaciones/evidencias-placas/';
// Los vendedores, y Diseño y Desarrollo para poder probar el circuito.
const VENDEN = ['ventas', 'mayorista', 'desarrollo', 'diseno'];
const VEN_TODO = ['compras', 'marketing', 'desarrollo', 'diseno', 'direccion', 'admin', 'duenio'];

const { pushA } = require('./_notificar');

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const texto = (v, max) => { const s = String(v == null ? '' : v).trim().slice(0, max); return s || null; };
const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const esUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
// ilike sin comodines = igual sin mirar mayúsculas (se escapan los comodines del nombre).
const ilikeExacto = s => encodeURIComponent(String(s).replace(/[%_\\]/g, m => '\\' + m));

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
    const man = async (path) => { const r = await fetch(MAN_URL + '/rest/v1/' + path, { headers: { apikey: MAN_KEY, Authorization: 'Bearer ' + MAN_KEY } }); return r.ok ? r.json() : []; };

    const perfil = (await (await sb('usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=nombre,rol,empresa,codigo_vendedor,activo')).json())[0] || {};
    if (perfil.activo === false) return json(403, { error: 'Tu usuario está desactivado.' });
    const rol = String(perfil.rol || '').toLowerCase();

    // ---------------- GET: las evidencias ----------------
    if (event.httpMethod === 'GET') {
      const qp = event.queryStringParameters || {};
      let q = 'evidencias_acciones?select=*&order=accionado_at.desc&limit=500';
      if (rol === 'proveedor') {
        const empresa = perfil.empresa || perfil.nombre;
        if (!empresa) return json(200, { evidencias: [] });
        q += '&proveedor_empresa=ilike.' + ilikeExacto(empresa);
      } else if (VEN_TODO.includes(rol)) {
        if (qp.proveedor) q += '&proveedor_empresa=ilike.' + ilikeExacto(qp.proveedor);
      } else return json(403, { error: 'No autorizado.' });
      const r = await sb(q);
      if (!r.ok) return json(502, { error: 'No se pudieron leer las evidencias. ¿Ya se corrió evidencias-acciones-setup.sql?' });
      return json(200, { evidencias: await r.json() });
    }

    // ---------------- POST: el vendedor mandó la placa ----------------
    if (event.httpMethod === 'POST') {
      if (!VENDEN.includes(rol)) return json(403, { error: 'Solo los vendedores registran evidencias.' });
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Datos inválidos.' }); }
      if (!esUuid(b.propuesta_id)) return json(400, { error: 'Falta la acción.' });

      // La acción y el proveedor salen de la base, no de lo que manda el navegador.
      const p = (await man('propuestas_acciones?id=eq.' + b.propuesta_id + '&select=id,titulo,condicion,rubro,seccion,subseccion,autor_empresa,autor_nombre,requiere_placa,placa_url'))[0];
      if (!p) return json(404, { error: 'No encontré la acción.' });
      if (!p.requiere_placa && !p.placa_url) return json(400, { error: 'Esa acción no pide evidencia.' });
      const empresa = p.autor_empresa || p.autor_nombre;
      if (!empresa) return json(400, { error: 'La acción no tiene proveedor.' });

      // El cliente, también de la base.
      const cid = b.cliente && b.cliente.id;
      const cli = esUuid(cid) ? (await man('clientes?id=eq.' + cid + '&select=id,codigo_cliente,nombre,tipo,direccion'))[0] : null;
      if (!cli) return json(400, { error: 'No encontré el cliente.' });

      // Solo placas subidas desde el manual, a la carpeta de evidencias.
      const placa = String(b.placa_url || '');
      if (placa && !placa.startsWith(PLACAS)) return json(400, { error: 'La placa no es válida.' });

      const fila = {
        propuesta_id: p.id, proveedor_empresa: empresa,
        accion_titulo: texto(p.titulo, 200), accion_condicion: texto(p.condicion, 200),
        rubro: texto(p.rubro, 40), seccion: texto([p.seccion, p.subseccion].filter(Boolean).join(' › '), 200),
        cliente_id: cli.id, cliente_codigo: texto(cli.codigo_cliente, 30), cliente_nombre: texto(cli.nombre, 200),
        cliente_tipo: texto(cli.tipo, 40), cliente_direccion: texto(cli.direccion, 300),
        vendedor_codigo: texto(perfil.codigo_vendedor || (b.vendedor && b.vendedor.codigo), 20),
        vendedor_nombre: texto(perfil.nombre || (b.vendedor && b.vendedor.nombre), 120),
        usuario_id: user.id, placa_url: placa || null, con_logo: !!b.con_logo,
        medio: ['compartir', 'whatsapp'].includes(b.medio) ? b.medio : null,
      };
      const ins = await sb('evidencias_acciones', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
      if (!ins.ok) return json(502, { error: 'No se pudo guardar la evidencia. ¿Ya se corrió evidencias-acciones-setup.sql?' });
      const guardada = (await ins.json())[0] || fila;

      // Aviso a cada usuario del proveedor (rol proveedor con esa empresa).
      let avisados = 0;
      try {
        const provs = await (await sb('usuarios?rol=eq.proveedor&select=id,nombre,empresa,activo')).json();
        const destinos = (Array.isArray(provs) ? provs : []).filter(u => u.activo !== false && nrm(u.empresa || u.nombre) === nrm(empresa));
        const cuando = new Date(guardada.accionado_at || Date.now()).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const link = '/manual-vendedores/proveedor.html#evidencias';
        const titulo = 'Evidencia: ' + (fila.accion_titulo || 'tu acción');
        const detalle = fila.cliente_nombre + (fila.cliente_codigo ? ' (' + fila.cliente_codigo + ')' : '') + ' · ' + cuando + (fila.vendedor_nombre ? ' · ' + fila.vendedor_nombre : '');
        for (const d of destinos) {
          try {
            await sb('notificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ destinatario_id: d.id, icono: '📸', titulo, detalle, link }) });
            avisados++;
          } catch (e) {}
          try { await pushA(sb, d.id, { title: '📸 ' + titulo, body: detalle, url: link }); } catch (e) {}
        }
      } catch (e) {}
      return json(200, { ok: true, evidencia: guardada, proveedor: empresa, avisados });
    }

    return json(405, { error: 'Método no permitido.' });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
