// ============================================================
//  GrandBar Hub · Function · cobranzas-analisis
//  Datos del TABLERO DE ANÁLISIS de Cobranzas (cobranzas-analisis.html): cartera,
//  uso del portal de clientes, comprobantes, cobros en efectivo, reclamos,
//  planillas de rendición, notas de crédito usadas y WhatsApp. Todo crudo pero
//  compacto: el tablero filtra (zona, canal, vendedor, período) en el navegador.
//
//  Fuentes (proyecto Cobranzas qpaoyfubyaloyhepatlm, con la llave de servicio):
//    cuentas_cubo, clientes, comprobantes, cobros_efectivo, reclamos(+mensajes),
//    planilla_cobranzas/envios/borradas, nc_usos, wa_eventos y los usuarios de
//    acceso del portal (auth: "<codigo>@grandbar.cuenta", last_sign_in_at).
//  Del Manual: nombres de vendedores y los clientes QUITADOS (se marcan).
//
//  Quién: área de cobranzas/administración y Dirección. Con región en el perfil
//  (Romina = san_luis) se recorta TODO en el servidor a esa zona.
//  Deuda vencida: se usa la que guarda la sincronización, no se recalcula
//  (hay dos reglas en discusión, ver cobranzas-regla-vencida).
//
//  Env: COBRANZAS_SERVICE_ROLE
// ============================================================

const { zonaDe, armarZona } = require('./_zona-cobranzas');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const ROLES_OK = ['tesoreria', 'administracion', 'admin', 'desarrollo', 'diseno', 'direccion', 'duenio'];

const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const dig = v => String(v == null ? '' : v).replace(/\D/g, '');
const padCod = v => { const d = dig(v); return d ? d.padStart(5, '0') : ''; };
const sinCeros = v => dig(v).replace(/^0+/, '');
const tel10 = v => { const d = dig(v); return d.length >= 10 ? d.slice(-10) : ''; };
const ts = v => { if (!v) return null; const t = Date.parse(v); return isFinite(t) ? Math.round(t / 1000) : null; };
const n2 = v => { const x = Number(v); return isFinite(x) ? Math.round(x * 100) / 100 : 0; };

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta COBRANZAS_SERVICE_ROLE en Netlify.' });

    // ── Quién pregunta ──
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'Sin sesión.' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión. Volvé a entrar al Portal.' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,nombre,region', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    if (!ROLES_OK.includes(rol)) return json(403, { error: 'El análisis de cobranzas es del área de administración y Dirección.' });

    const cob = (path, opts = {}) => fetch(COB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: service, Authorization: 'Bearer ' + service, ...(opts.headers || {}) } });
    // La base corta en 1000 filas y no avisa: todo se pide por páginas.
    const leerTodo = async (path, tope = 60000) => {
      const filas = [], tam = 1000;
      for (let desde = 0; desde < tope; desde += tam) {
        const r = await cob(path, { headers: { 'Range-Unit': 'items', Range: desde + '-' + (desde + tam - 1) } });
        if (!r.ok) { if (desde === 0) throw new Error('No pude leer ' + path.split('?')[0] + ': ' + (await r.text()).slice(0, 120)); break; }
        const lote = await r.json();
        if (!Array.isArray(lote) || !lote.length) break;
        filas.push(...lote);
        if (lote.length < tam) break;
      }
      return filas;
    };
    const man = async (path) => { try { const r = await fetch(MAN_URL + '/rest/v1/' + path, { headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON } }); return r.ok ? await r.json() : []; } catch (_) { return []; } };
    // Usuarios de acceso del portal de clientes (auth de Supabase, paginado).
    const usuariosPortal = async () => {
      const out = [];
      for (let page = 1; page <= 40; page++) {
        const r = await fetch(COB_URL + '/auth/v1/admin/users?page=' + page + '&per_page=500', { headers: { apikey: service, Authorization: 'Bearer ' + service } });
        if (!r.ok) break;
        const j = await r.json().catch(() => ({}));
        const arr = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
        out.push(...arr);
        if (arr.length < 500) break;
      }
      return out;
    };
    // Última vez que cada cliente USÓ la app (29/10/2026): si dejó la sesión abierta y volvió
    // otro día, la app renueva el token y eso cuenta, aunque no haya vuelto a iniciar sesión.
    // Sale de portal_ultima_actividad() (cobranzas-ultima-actividad.sql); si todavía no está
    // creada, la lista viene vacía y queda el último inicio de sesión, como antes.
    const actividadPortal = async () => { try { return await leerTodo('rpc/portal_ultima_actividad?select=user_id,ultima&order=user_id'); } catch (_) { return []; } };

    const [cuentas, fichas, comp, cobros, recl, recMsg, pla, env, borr, nc, wa, users, quit, vends, act] = await Promise.all([
      leerTodo('cuentas_cubo?select=codigo,nombre,vendedor,equipo,rubro,saldo,vencida,telefono&order=codigo'),
      leerTodo('clientes?select=id,codigo_cubo,whatsapp&order=id'),
      leerTodo('comprobantes?select=cliente_id,vendedor,estado,monto,created_at,procesado_at,revisado_at&order=created_at'),
      leerTodo('cobros_efectivo?select=codigo,cliente_id,vendedor,estado,monto,created_at,cobrado_at&order=created_at'),
      leerTodo('reclamos?select=id,nro,cliente_id,codigo,asunto,estado,created_at,updated_at&order=created_at'),
      leerTodo('reclamos_mensajes?select=reclamo_id,autor,created_at&order=created_at'),
      leerTodo('planilla_cobranzas?select=vendedor,fecha_rendicion,codigo,importe,efectivo,cheques,retenciones,transferencia,tarjeta,echeq,created_at,procesado,procesado_at,editado_at&order=created_at'),
      leerTodo('planilla_envios?select=vendedor,fecha_rendicion,enviada_at,filas&order=enviada_at'),
      leerTodo('planilla_borradas?select=vendedor,fecha_rendicion,borrado_at&order=borrado_at'),
      leerTodo('nc_usos?select=codigo,cliente_id,vendedor,estado,monto,created_at,aplicado_at&order=created_at'),
      leerTodo('wa_eventos?select=tipo,estado,telefono,wa_id,message_id,error_titulo,created_at,cod:crudo->>codigo&order=created_at'),
      usuariosPortal(),
      man('clientes_estado?select=codigo&activo=eq.false'),
      man('vendedores?select=codigo,nombre,zona'),
      actividadPortal(),
    ]);

    // ── Índices ──
    const codDeFicha = {};                         // id de ficha del portal → código
    fichas.forEach(f => { if (f.codigo_cubo) codDeFicha[String(f.id)] = padCod(f.codigo_cubo); });
    const quitados = new Set((quit || []).map(x => sinCeros(x.codigo)));
    // teléfono (últimos 10) → código: de la cartera, de las fichas y de los envíos con código.
    const codDeTel = {};
    cuentas.forEach(c => { const t = tel10(c.telefono); if (t && !codDeTel[t]) codDeTel[t] = padCod(c.codigo); });
    fichas.forEach(f => { const t = tel10(f.whatsapp); if (t && f.codigo_cubo) codDeTel[t] = padCod(f.codigo_cubo); });
    wa.forEach(e => { if (e.tipo === 'saliente' && e.cod) { const t = tel10(e.telefono || e.wa_id); if (t) codDeTel[t] = padCod(e.cod); } });

    // ── Zona forzada por el perfil (Romina → San Luis) ──
    const zona = zonaDe(perfil);
    const Z = zona ? await armarZona(zona, leerTodo) : null;
    const okCod = c => !Z || Z.codOk(c);
    const okVend = v => !Z || Z.vendOk(v);

    const cu = cuentas.filter(c => okCod(c.codigo)).map(c => [
      padCod(c.codigo), c.nombre || '', String(c.vendedor || '').trim(), String(c.equipo || '').trim().toUpperCase(),
      String(c.rubro || '').trim(), n2(c.saldo), n2(c.vencida), quitados.has(sinCeros(c.codigo)) ? 1 : 0,
    ]);

    // Último ingreso = lo más reciente entre el último inicio de sesión y la última vez que
    // la sesión estuvo activa (ver actividadPortal).
    const ultAct = {};
    (Array.isArray(act) ? act : []).forEach(a => { if (a && a.user_id) ultAct[a.user_id] = ts(a.ultima); });
    const ultimoUso = u => { const a = ts(u.last_sign_in_at), b = ultAct[u.id] || null; return (a || b) ? Math.max(a || 0, b || 0) : null; };
    const po = users.filter(u => u && typeof u.email === 'string' && u.email.endsWith('@grandbar.cuenta'))
      .map(u => [padCod(u.email.split('@')[0]), ts(u.created_at), ultimoUso(u)])
      .filter(r => r[0] && okCod(r[0]));

    const co = comp.map(x => [codDeFicha[String(x.cliente_id)] || '', String(x.vendedor || ''), x.estado || '', n2(x.monto), ts(x.created_at), ts(x.procesado_at), ts(x.revisado_at)])
      .filter(r => !Z || (r[0] && okCod(r[0])));

    const ef = cobros.map(x => [padCod(x.codigo) || codDeFicha[String(x.cliente_id)] || '', String(x.vendedor || ''), x.estado || '', n2(x.monto), ts(x.created_at), ts(x.cobrado_at)])
      .filter(r => !Z || (r[0] && okCod(r[0])));

    // Reclamos: primera respuesta = primer mensaje nuestro (autor admin) después del primero del cliente.
    const msgsDe = {};
    recMsg.forEach(m => { (msgsDe[m.reclamo_id] = msgsDe[m.reclamo_id] || []).push(m); });
    const re = recl.map(r => {
      const ms = msgsDe[r.id] || [];
      const primerCli = ms.find(m => m.autor !== 'admin');
      const desde = ts(primerCli ? primerCli.created_at : r.created_at);
      const resp = ms.find(m => m.autor === 'admin' && ts(m.created_at) >= desde);
      return [padCod(r.codigo) || codDeFicha[String(r.cliente_id)] || '', r.nro, String(r.asunto || '').slice(0, 80), r.estado || '',
        ts(r.created_at), resp ? ts(resp.created_at) : null, r.estado === 'resuelto' ? ts(r.updated_at) : null, ms.length];
    }).filter(r => !Z || (r[0] && okCod(r[0])));

    const pl = pla.filter(x => okVend(x.vendedor)).map(x => [String(x.vendedor || ''), x.fecha_rendicion, padCod(x.codigo),
      n2(x.importe), n2(x.efectivo), n2(x.cheques), n2(x.retenciones), n2(x.transferencia), n2(x.tarjeta), n2(x.echeq),
      ts(x.created_at), x.procesado ? 1 : 0, ts(x.procesado_at), x.editado_at ? 1 : 0]);
    const en = env.filter(x => okVend(x.vendedor)).map(x => [String(x.vendedor || ''), x.fecha_rendicion, ts(x.enviada_at), x.filas || 0]);
    const bo = borr.filter(x => okVend(x.vendedor)).map(x => [String(x.vendedor || ''), x.fecha_rendicion, ts(x.borrado_at)]);

    const ncu = nc.map(x => [padCod(x.codigo) || codDeFicha[String(x.cliente_id)] || '', String(x.vendedor || ''), x.estado || '', n2(x.monto), ts(x.created_at), ts(x.aplicado_at)])
      .filter(r => !Z || (r[0] && okCod(r[0])));

    // ── WhatsApp: cada mensaje enviado con su entrega/lectura/falla; los recibidos aparte ──
    const st = {};                                  // message_id → { dl, rd, f }
    const errores = {};
    wa.forEach(e => {
      if (e.tipo !== 'status' || !e.message_id) return;
      const s = st[e.message_id] = st[e.message_id] || {};
      const t = ts(e.created_at);
      if (e.estado === 'delivered' && (!s.dl || t < s.dl)) s.dl = t;
      if (e.estado === 'read' && (!s.rd || t < s.rd)) s.rd = t;
      if (e.estado === 'failed') { s.f = 1; const k = e.error_titulo || 'Sin detalle'; errores[k] = (errores[k] || 0) + 1; }
    });
    const codMsg = e => padCod(e.cod) || codDeTel[tel10(e.telefono || e.wa_id)] || '';
    const waOut = wa.filter(e => e.tipo === 'saliente').map(e => {
      const s = (e.message_id && st[e.message_id]) || {};
      return [codMsg(e), e.estado || '', ts(e.created_at), s.dl || null, s.rd || null, s.f ? 1 : 0];
    }).filter(r => !Z || (r[0] && okCod(r[0])));
    const wi = wa.filter(e => e.tipo === 'message').map(e => [codMsg(e), ts(e.created_at)]).filter(r => !Z || (r[0] && okCod(r[0])));

    const vend = {};
    (vends || []).forEach(v => { if (v && v.codigo) vend[String(v.codigo).trim()] = { n: v.nombre || '', z: v.zona || '' }; });

    return json(200, {
      generado: new Date().toISOString(), zona: zona || null, quien: perfil.nombre || null,
      vend, cu, po, co, ef, re, pl, en, bo, nc: ncu, wa: waOut, wi,
      we: Object.entries(errores).sort((a, b) => b[1] - a[1]).slice(0, 8),
    });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

module.exports.handler = require('./_errores').conErrores('cobranzas-analisis', module.exports.handler);
