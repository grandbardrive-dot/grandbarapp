// ============================================================
//  GrandBar Hub · Function · cobranzas-panel
//  Los datos de la sección Cobranzas del Portal.
//
//  Las tablas viven en el proyecto de Cobranzas (qpaoyfubyaloyhepatlm) y están
//  protegidas con una regla es_admin() de ESE sistema: desde el navegador no se
//  leen. Acá se leen del lado del servidor con la llave de servicio, y antes de
//  responder se verifica quién pregunta con su token del Portal y su rol.
//
//  Los nombres de las columnas salen de los esquemas reales
//  (APP COBRANZAS/app/db/*.sql), no de suponer:
//    cuentas_cubo    codigo, nombre, saldo, vencida, vendedor, equipo, actualizado
//    clientes        id, nombre, comercio, cuit, whatsapp, estado, limite_credito,
//                    saldo_cc, deuda_vencida, tope_deuda_vencida, created_at
//    facturas        codigo, numero, tipo, fecha, vencimiento, importe, saldo
//    cobros_efectivo id, codigo, cliente_nombre, monto, facturas, vendedor,
//                    telefono, estado, nota, created_at, cobrado_at
//    comprobantes    id, cliente_id, concepto, archivo_url, estado, created_at
//    reclamos        id, asunto, factura, estado, updated_at, cliente_id
//
//    GET  ?que=resumen | clientes | cliente&codigo= | bloquear | efectivo
//                      | supervision | reclamos | whatsapp | estadisticas
//    POST {accion:'bloquear'|'desbloquear', id}
//         {accion:'cobro-cobrado'|'cobro-cancelado', id}
//         {accion:'reclamo-estado', id, estado}
//  Sobre comprobantes no hay ninguna accion: aceptarlos o rechazarlos lo opera
//  tesoreria desde cobranzas-tesoreria. Aca la revision solo se supervisa.
//
//  Env: COBRANZAS_SERVICE_ROLE (ya usada por cuentas-vendedor y cobranzas-tesoreria)
//
//  Zona (19/10/2026): un usuario con región en su perfil ve solo esa zona
//  (Romina, administración de San Luis = tesorería + región san_luis). Sin
//  región se ve todo, como siempre. Ver _zona-cobranzas.js.
// ============================================================

const { zonaDe, armarZona } = require('./_zona-cobranzas');

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
// El manual: de acá salen los NOMBRES de los vendedores (comprobantes guarda el código).
const MAN_URL  = 'https://fzaxwuuodseyyinveknn.supabase.co';
const MAN_ANON = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const ROLES_OK = ['tesoreria', 'administracion', 'admin', 'desarrollo', 'diseno', 'direccion'];
// Dirección (Fernando, rol admin) mira y no toca: ni reclamos, ni bloqueos, ni planillas (23/10/2026).
const SOLO_MIRA = ['admin', 'direccion', 'duenio'];
const POR_PAGINA = 50;

const json = (s, b) => ({
  statusCode: s,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(b),
});

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta configurar COBRANZAS_SERVICE_ROLE en Netlify.' });

    // ── Quién pregunta (no se confía en nada que mande el navegador) ──
    const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'Sin sesión.' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Se venció la sesión. Volvé a entrar al Portal.' });
    const user = await uRes.json();

    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,nombre,region',
      { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    if (!ROLES_OK.includes(rol)) return json(403, { error: 'Esta sección es del área de administración y cobranzas.' });

    const cob = (path, opts = {}) => fetch(COB_URL + '/rest/v1/' + path, {
      ...opts,
      headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const leer = async (path) => { const r = await cob(path); return r.ok ? await r.json() : []; };

    // La base corta en 1000 filas por consulta y NO avisa: contesta 200 con las
    // primeras 1000. Un "limit=2000" no sirve de nada. Para lo que se suma entero
    // —la cartera, la deuda vencida— hay que pedirlo por páginas, o los totales
    // salen cortados sin que nada falle.
    const leerTodo = async (path, tope = 20000) => {
      const filas = [], tam = 1000;
      for (let desde = 0; desde < tope; desde += tam) {
        const r = await cob(path, { headers: { 'Range-Unit': 'items', Range: desde + '-' + (desde + tam - 1) } });
        if (!r.ok) break;
        const lote = await r.json();
        if (!Array.isArray(lote) || !lote.length) break;
        filas.push(...lote);
        if (lote.length < tam) break;
      }
      return filas;
    };
    // Ojo: cada tabla tiene su propia clave. cuentas_cubo no tiene columna 'id'
    // (su clave es el codigo), asi que pedir 'select=id' devolvia un error y el
    // contador quedaba en cero sin que se notara.
    const contar = async (tabla, filtro, clave) => {
      const r = await cob(tabla + '?select=' + (clave || 'id') + (filtro ? '&' + filtro : ''), { headers: { Prefer: 'count=exact', Range: '0-0' } });
      return Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
    };

    // Zona del usuario: null = ve todo. Con zona, cada lectura se recorta y cada
    // escritura se controla (no se puede tocar un cliente de la otra zona).
    const Z = await armarZona(zonaDe(perfil), leerTodo);
    const fuera = () => json(403, { error: 'Eso no es de ' + Z.nombre + '.' });
    // Planillas de rendición (26/10/2026): las de los vendedores de San Luis las procesa solo
    // Romina. Tesorería sin región (Mónica) ve las de Mendoza; Brenda, Dirección y Desarrollo,
    // todas. Se arma solo cuando se piden planillas (leer la cartera entera tarda).
    let _zp;
    const zonaPlanillas = async () => (_zp !== undefined ? _zp : (_zp = Z || (rol === 'tesoreria' ? await armarZona('mendoza', leerTodo) : null)));

    // ══════════ ESCRITURA ══════════
    if (event.httpMethod === 'POST') {
      if (SOLO_MIRA.includes(rol)) return json(403, { error: 'Desde el panel de Dirección se mira, no se modifica.' });
      const b = JSON.parse(event.body || '{}');
      const patch = async (tabla, filtro, campos, queEs) => {
        const r = await cob(tabla + '?' + filtro, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(campos) });
        const filas = await r.json();
        if (!r.ok) return json(400, { error: filas.message || 'No se pudo guardar.' });
        if (!filas.length) return json(404, { error: queEs + ' ya no existe.' });
        return json(200, { ok: true, fila: filas[0] });
      };

      // Con zona: la fila tiene que ser de esa zona (se mira en la base, no lo que manda el navegador).
      const deLaZona = async (tabla, id) => {
        if (!Z) return true;
        if (tabla === 'clientes') return Z.cliOk(id);
        const f0 = (await leer(tabla + '?select=codigo,cliente_id&id=eq.' + encodeURIComponent(id)))[0];
        return !f0 || Z.filaOk(f0);
      };

      if (b.accion === 'bloquear' || b.accion === 'desbloquear') {
        if (!b.id) return json(400, { error: 'Falta el cliente.' });
        if (!(await deLaZona('clientes', b.id))) return fuera();
        return patch('clientes', 'id=eq.' + encodeURIComponent(b.id),
          { estado: b.accion === 'bloquear' ? 'bloqueado' : 'aprobado' }, 'Ese cliente');
      }
      if (b.accion === 'cobro-cobrado' || b.accion === 'cobro-cancelado') {
        if (!b.id) return json(400, { error: 'Falta el cobro.' });
        if (!(await deLaZona('cobros_efectivo', b.id))) return fuera();
        return patch('cobros_efectivo', 'id=eq.' + encodeURIComponent(b.id),
          b.accion === 'cobro-cobrado' ? { estado: 'cobrado', cobrado_at: new Date().toISOString() } : { estado: 'cancelado' },
          'Ese cobro');
      }
      if (b.accion === 'reclamo-estado') {
        if (!b.id || !b.estado) return json(400, { error: 'Falta el reclamo o el estado.' });
        if (!(await deLaZona('reclamos', b.id))) return fuera();
        return patch('reclamos', 'id=eq.' + encodeURIComponent(b.id),
          { estado: b.estado, updated_at: new Date().toISOString() }, 'Ese reclamo');
      }
      // Responderle al cliente en su reclamo: se guarda como mensaje nuestro
      // (autor='admin') y el cliente lo ve en su portal, en el mismo chat.
      if (b.accion === 'reclamo-responder') {
        const texto = String(b.texto || '').trim();
        if (!b.id) return json(400, { error: 'Falta el reclamo.' });
        if (!(await deLaZona('reclamos', b.id))) return fuera();
        if (!texto && !b.archivo_base64) return json(400, { error: 'Escribí un mensaje o adjuntá un archivo.' });
        // Adjunto opcional: lo subimos al bucket público con la llave del servidor.
        let archivo_url = null;
        if (b.archivo_base64) {
          let bytes; try { bytes = Buffer.from(String(b.archivo_base64).replace(/^data:[^,]*,/, ''), 'base64'); } catch (_) { bytes = null; }
          if (!bytes || !bytes.length) return json(400, { error: 'El archivo adjunto es inválido.' });
          if (bytes.length > 5 * 1024 * 1024) return json(413, { error: 'El adjunto es muy grande (máx 5 MB).' });
          const mime = String(b.archivo_mime || 'application/octet-stream').split(';')[0];
          const m = String(b.archivo_nombre || '').match(/\.([a-z0-9]{1,5})$/i);
          const ext = m ? m[1].toLowerCase() : ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[mime] || 'bin');
          const path = 'reclamos/' + encodeURIComponent(b.id) + '/' + Date.now() + '.' + ext;
          const up = await fetch(COB_URL + '/storage/v1/object/comprobantes/' + path, {
            method: 'POST', headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': mime, 'x-upsert': 'true' }, body: bytes });
          if (!up.ok) return json(502, { error: 'No se pudo subir el adjunto: ' + (await up.text()).slice(0, 150) });
          archivo_url = COB_URL + '/storage/v1/object/public/comprobantes/' + path;
        }
        const ins = await cob('reclamos_mensajes', { method: 'POST', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ reclamo_id: b.id, autor: 'admin', texto: texto || null, archivo_url }) });
        const filas = await ins.json();
        if (!ins.ok) return json(400, { error: (filas && filas.message) || 'No se pudo enviar la respuesta.' });
        // Bump de updated_at (para que suba en la lista) y, si estaba 'abierto', pasa a 'en_curso'.
        await cob('reclamos?id=eq.' + encodeURIComponent(b.id), { method: 'PATCH', body: JSON.stringify({ updated_at: new Date().toISOString() }) });
        await cob('reclamos?id=eq.' + encodeURIComponent(b.id) + '&estado=eq.abierto', { method: 'PATCH', body: JSON.stringify({ estado: 'en_curso' }) });
        return json(200, { ok: true, mensaje: filas[0] || null });
      }
      // Moni marca una fila de la planilla de rendición como procesada y/o deja observaciones.
      if (b.accion === 'planilla-marcar') {
        if (!b.id) return json(400, { error: 'Falta la fila.' });
        // Con zona, la fila tiene que ser de una planilla de un vendedor de esa zona.
        const ZP = await zonaPlanillas();
        if (ZP) {
          const fila = (await leer('planilla_cobranzas?select=vendedor&id=eq.' + encodeURIComponent(b.id)))[0];
          if (fila && !ZP.vendOk(fila.vendedor)) return json(403, { error: 'Esa planilla es de ' + (ZP.zona === 'mendoza' ? 'San Luis: la procesa Romina.' : 'Mendoza.') });
        }
        const campos = {};
        if ('procesado' in b) {
          campos.procesado = !!b.procesado;
          campos.procesado_at = b.procesado ? new Date().toISOString() : null;
          campos.procesado_por = b.procesado ? (perfil.nombre || null) : null;
        }
        if ('observaciones' in b) campos.observaciones = b.observaciones ? String(b.observaciones).slice(0, 500) : null;
        if (!Object.keys(campos).length) return json(400, { error: 'Nada para guardar.' });
        return patch('planilla_cobranzas', 'id=eq.' + encodeURIComponent(b.id), campos, 'Esa fila');
      }
      // Moni/administración CORRIGE los montos de una fila (cuando el vendedor se confundió
      // y el arqueo no da). Mismos permisos y zona que marcar. Queda registrado quién editó.
      if (b.accion === 'planilla-editar') {
        if (!b.id) return json(400, { error: 'Falta la fila.' });
        const ZP = await zonaPlanillas();
        const fila0 = (await leer('planilla_cobranzas?select=vendedor&id=eq.' + encodeURIComponent(b.id)))[0];
        if (!fila0) return json(404, { error: 'Esa fila ya no existe.' });
        if (ZP && !ZP.vendOk(fila0.vendedor)) return json(403, { error: 'Esa planilla es de ' + (ZP.zona === 'mendoza' ? 'San Luis: la procesa Romina.' : 'Mendoza.') });
        const c = b.campos || {};
        const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };
        const MONEY = ['importe', 'efectivo', 'cheques', 'retenciones', 'transferencia', 'tarjeta', 'echeq'];
        const DET = { transferencia: 'transferencia_detalle', cheques: 'cheques_detalle', echeq: 'echeq_detalle' };
        const campos = {};
        // Al corregir el total de un medio con desglose, se borra el desglose (queda el total corregido).
        MONEY.forEach(k => { if (k in c) { campos[k] = n(c[k]); if (DET[k]) campos[DET[k]] = null; } });
        ['factura', 'razon_social', 'codigo'].forEach(k => { if (k in c) campos[k] = c[k] ? String(c[k]).slice(0, 200) : null; });
        if ('fecha_pago' in c) campos.fecha_pago = /^\d{4}-\d{2}-\d{2}$/.test(c.fecha_pago) ? c.fecha_pago : null;
        if ('fecha_cheque' in c) campos.fecha_cheque = /^\d{4}-\d{2}-\d{2}$/.test(c.fecha_cheque) ? c.fecha_cheque : null;
        if (!Object.keys(campos).length) return json(400, { error: 'Nada para editar.' });
        campos.editado_por = perfil.nombre || null;
        campos.editado_at = new Date().toISOString();
        campos.updated_at = new Date().toISOString();
        return patch('planilla_cobranzas', 'id=eq.' + encodeURIComponent(b.id), campos, 'Esa fila');
      }
      return json(400, { error: 'Acción desconocida: ' + b.accion });
    }

    // ══════════ LECTURA ══════════
    const p = event.queryStringParameters || {};
    const que = p.que || 'resumen';

    // Deuda de cada cliente del portal para decidir bloqueos. Sale de cuentas_cubo,
    // que la sincronización actualiza cada hora con la misma regla que ve el cliente
    // (el saldo a favor se descuenta primero de lo vencido). Antes se usaban
    // clientes.deuda_vencida/saldo_cc, que se calculaban con otra regla (sin restar el
    // saldo a favor) y por eso no coincidían con lo que ve el cliente ni con Clientes.
    const clientesConDeuda = async (campos) => {
      const [fichas, cuentas] = await Promise.all([
        leerTodo('clientes?select=' + campos + '&codigo_cubo=not.is.null&order=id'),
        leerTodo('cuentas_cubo?select=codigo,saldo,vencida&or=(vencida.gt.0,saldo.gt.0)&order=codigo'),
      ]);
      const porCodigo = {};
      cuentas.forEach(c => { porCodigo[c.codigo] = c; });
      return fichas.map(f => {
        const cc = porCodigo[f.codigo_cubo] || {};
        return { ...f, deuda_vencida: Math.max(0, Number(cc.vencida || 0)), saldo_cc: Math.max(0, Number(cc.saldo || 0)) };
      });
    };
    const pasadoDeTope = c => Number(c.deuda_vencida || 0) > Number(c.tope_deuda_vencida || 0);

    if (que === 'resumen' && Z) {
      // Con zona no alcanza con contar en la base: hay que ver de quién es cada fila.
      const [cuentas, comps, recl, cobros, clientes] = await Promise.all([
        contar('cuentas_cubo', Z.filtroEquipo, 'codigo'),
        leerTodo('comprobantes?select=cliente_id&estado=eq.pendiente&tipo=eq.cliente&order=id'),
        leerTodo('reclamos?select=codigo,cliente_id&estado=eq.abierto&order=id'),
        leerTodo('cobros_efectivo?select=codigo,cliente_id&estado=eq.pendiente&order=id'),
        clientesConDeuda('id,estado,tope_deuda_vencida,codigo_cubo'),
      ]);
      return json(200, {
        rol, nombre: perfil.nombre, zona: Z.nombre, cuentas,
        compPend: comps.filter(c => Z.cliOk(c.cliente_id)).length,
        reclAbiertos: recl.filter(Z.filaOk).length,
        cobrosPend: cobros.filter(Z.filaOk).length,
        aBloquear: clientes.filter(c => Z.codOk(c.codigo_cubo) && pasadoDeTope(c) && c.estado !== 'bloqueado').length,
      });
    }

    if (que === 'resumen') {
      const [cuentas, compPend, reclAbiertos, cobrosPend, clientes] = await Promise.all([
        contar('cuentas_cubo', '', 'codigo'),
        contar('comprobantes', 'estado=eq.pendiente&tipo=eq.cliente'),
        contar('reclamos', 'estado=eq.abierto'),
        contar('cobros_efectivo', 'estado=eq.pendiente'),
        clientesConDeuda('id,estado,tope_deuda_vencida,codigo_cubo'),
      ]);
      // Pasados de tope: hay que comparar dos columnas entre sí, así que se cuenta acá.
      const aBloquear = clientes.filter(c => pasadoDeTope(c) && c.estado !== 'bloqueado').length;
      return json(200, { rol, nombre: perfil.nombre, cuentas, compPend, reclAbiertos, cobrosPend, aBloquear });
    }

    if (que === 'clientes') {
      const pagina = Math.max(0, parseInt(p.pagina || '0', 10) || 0);
      const desde = pagina * POR_PAGINA;
      const q = (p.q || '').trim();
      // Entre comillas: un nombre con coma o paréntesis rompía la consulta y salía
      // "Ningún cliente coincide" (19/10/2026).
      const lk = encodeURIComponent('"*' + q.replace(/[\\"]/g, '\\$&') + '*"');
      const filtro = q ? '&or=(codigo.ilike.' + lk + ',nombre.ilike.' + lk + ')' : '';
      const soloDeuda = p.deuda === '1' ? '&vencida=gt.0' : '';
      const deZona = Z ? '&' + Z.filtroEquipo : '';
      const r = await cob('cuentas_cubo?select=*' + filtro + soloDeuda + deZona + '&order=vencida.desc.nullslast,saldo.desc.nullslast',
        { headers: { Prefer: 'count=exact', Range: desde + '-' + (desde + POR_PAGINA - 1) } });
      const filas = r.ok ? await r.json() : [];
      const total = Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
      return json(200, { filas, total, pagina, porPagina: POR_PAGINA });
    }

    // Ficha de un cliente: su cuenta + las facturas con saldo pendiente.
    if (que === 'cliente') {
      if (!p.codigo) return json(400, { error: 'Falta el código.' });
      if (Z && !Z.codOk(p.codigo)) return fuera();
      const cod = encodeURIComponent(p.codigo);
      const [cuenta, facturas, ficha, cobros] = await Promise.all([
        leer('cuentas_cubo?select=*&codigo=eq.' + cod),
        leer('facturas?select=*&codigo=eq.' + cod + '&order=vencimiento.asc&limit=300'),
        leer('clientes?select=*&codigo_cubo=eq.' + cod).catch(() => []),
        leer('cobros_efectivo?select=*&codigo=eq.' + cod + '&order=created_at.desc&limit=20').catch(() => []),
      ]);
      const cli = (ficha && ficha[0]) || null;

      // Lo que subió y lo que reclamó este cliente cuelga de su ficha del portal,
      // no del código del cubo: sin ficha no hay nada que traer.
      let comprobantes = [], reclamos = [];
      if (cli && cli.id) {
        const id = encodeURIComponent(cli.id);
        [comprobantes, reclamos] = await Promise.all([
          leer('comprobantes?select=id,concepto,archivo_url,monto,fecha_pago,estado,tipo,factura,created_at,procesado_por,revisado_por'
             + '&cliente_id=eq.' + id + '&order=created_at.desc&limit=20'),
          leer('reclamos?select=id,asunto,factura,estado,updated_at&cliente_id=eq.' + id + '&order=updated_at.desc&limit=20'),
        ]);
      }
      return json(200, { cuenta: cuenta[0] || null, facturas, ficha: cli, comprobantes, reclamos, cobros });
    }

    if (que === 'bloquear') {
      const todos = (await clientesConDeuda('id,estado,tope_deuda_vencida,codigo_cubo,comercio,nombre,cuit'))
        .filter(c => !Z || Z.codOk(c.codigo_cubo))
        .sort((a, b) => b.deuda_vencida - a.deuda_vencida);
      return json(200, {
        filas: todos.filter(c => pasadoDeTope(c) && c.estado !== 'bloqueado'),
        bloqueados: todos.filter(c => c.estado === 'bloqueado'),
      });
    }

    if (que === 'efectivo') {
      const filas = await leer('cobros_efectivo?select=*&order=created_at.desc&limit=' + (Z ? 1000 : 300));
      return json(200, { filas: Z ? filas.filter(Z.filaOk).slice(0, 300) : filas });
    }

    // Planillas de rendición que envían los vendedores (lista de envíos).
    if (que === 'planillas') {
      const ZP = await zonaPlanillas();
      let filas = await leer('planilla_envios?select=*&order=enviada_at.desc&limit=' + (ZP ? 1000 : 400));
      if (ZP) filas = filas.filter(x => ZP.vendOk(x.vendedor)).slice(0, 400);
      // Filas actuales de cada planilla: cuántas marcó Moni como procesadas (para el verde/rojo)
      // y cuánto suman por medio de pago. El total del día suma SOLO lo que Moni aprobó
      // (procesado); lo demás va aparte como "falta aprobar" (22/10/2026).
      const MEDIOS = ['efectivo', 'cheques', 'retenciones', 'transferencia', 'tarjeta', 'echeq'];
      const desde = filas.reduce((m, e) => (!m || e.fecha_rendicion < m) ? e.fecha_rendicion : m, null);
      const det = desde ? await leerTodo('planilla_cobranzas?select=id,vendedor,fecha_rendicion,procesado,' + MEDIOS.join(',') + '&fecha_rendicion=gte.' + desde + '&order=id', 50000) : [];
      const pc = {};
      (Array.isArray(det) ? det : []).forEach(r => {
        const k = r.vendedor + '|' + r.fecha_rendicion;
        const a = pc[k] || (pc[k] = { procesadas: 0, sinAprobar: 0, aprobado: {}, pendiente: 0 });
        if (r.procesado) { a.procesadas++; MEDIOS.forEach(m => { a.aprobado[m] = (a.aprobado[m] || 0) + (Number(r[m]) || 0); }); }
        else { a.sinAprobar++; a.pendiente += MEDIOS.reduce((s, m) => s + (Number(r[m]) || 0), 0); }
      });
      filas = filas.map(e => { const a = pc[e.vendedor + '|' + e.fecha_rendicion] || {}; return { ...e, procesadas: a.procesadas || 0, aprobado: a.aprobado || {}, sinAprobar: a.sinAprobar || 0, pendiente: a.pendiente || 0 }; });
      return json(200, { filas });
    }
    // Detalle de una planilla (filas + envío) de un vendedor y día.
    if (que === 'planilla-det') {
      const vend = p.vendedor, fecha = p.fecha;
      if (!vend || !fecha) return json(400, { error: 'Falta el vendedor o la fecha.' });
      const ZP = await zonaPlanillas();
      if (ZP && !ZP.vendOk(vend)) return json(403, { error: 'Esa planilla es de ' + (ZP.zona === 'mendoza' ? 'San Luis: la procesa Romina.' : 'Mendoza.') });
      const [filas, env] = await Promise.all([
        leer('planilla_cobranzas?select=*&vendedor=eq.' + encodeURIComponent(vend) + '&fecha_rendicion=eq.' + encodeURIComponent(fecha) + '&order=created_at.asc'),
        leer('planilla_envios?select=*&vendedor=eq.' + encodeURIComponent(vend) + '&fecha_rendicion=eq.' + encodeURIComponent(fecha)),
      ]);
      return json(200, { filas, envio: (env || [])[0] || null });
    }

    if (que === 'reclamos') {
      if (p.id) {
        const [rec, mensajes] = await Promise.all([
          leer('reclamos?select=*,cliente:clientes(comercio,nombre,whatsapp)&id=eq.' + encodeURIComponent(p.id)),
          leer('reclamos_mensajes?select=*&reclamo_id=eq.' + encodeURIComponent(p.id) + '&order=created_at.asc'),
        ]);
        if (Z && rec[0] && !Z.filaOk(rec[0])) return fuera();
        return json(200, { reclamo: rec[0] || null, mensajes });
      }
      const filas = await leer('reclamos?select=*,cliente:clientes(comercio,nombre,whatsapp)&order=updated_at.desc&limit=' + (Z ? 1000 : 200));
      return json(200, { filas: Z ? filas.filter(Z.filaOk).slice(0, 200) : filas });
    }

    // ── Cómo viene la revisión de comprobantes ──────────────
    // El circuito real, según lo que escribe cada pantalla:
    //   1) el cliente sube el comprobante   → estado 'pendiente'
    //   2) el vendedor lo confirma          → 'procesado'  + procesado_por (su código) / procesado_at
    //   3) tesorería lo cruza con el banco  → 'aceptado' o 'rechazado' + revisado_por / revisado_at
    // Con eso se puede medir cada tramo por separado: lo que tarda el vendedor en
    // confirmar y lo que tarda tesorería en cerrar.
    if (que === 'supervision') {
      const desdeDias = Math.max(1, parseInt(p.dias || '30', 10) || 30);
      const desde = new Date(Date.now() - desdeDias * 86400000).toISOString();
      const comps = (await leerTodo('comprobantes?select=id,cliente_id,estado,monto,fecha_pago,procesado_por,procesado_at,revisado_por,revisado_at,created_at,tipo'
        + '&tipo=eq.cliente&created_at=gte.' + desde + '&order=created_at.desc'))
        .filter(c => !Z || Z.cliOk(c.cliente_id));

      const num  = v => Number(v || 0);
      const prom = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
      const hrs  = (a, b) => (new Date(b) - new Date(a)) / 3600000;
      const ahora = Date.now();

      const porEstado = {};
      comps.forEach(c => {
        const e = c.estado || 'pendiente';
        porEstado[e] = porEstado[e] || { estado: e, cantidad: 0, monto: 0 };
        porEstado[e].cantidad++; porEstado[e].monto += num(c.monto);
      });

      // Dónde está parado cada uno: esperando al vendedor o esperando a tesorería.
      const conVendedor  = comps.filter(c => (c.estado || 'pendiente') === 'pendiente');
      const conTesoreria = comps.filter(c => c.estado === 'procesado');

      // Tramo 1: lo que tarda el vendedor en confirmar.
      const pasados = comps.filter(c => c.procesado_at && c.created_at);
      const horasVend = pasados.map(c => hrs(c.created_at, c.procesado_at)).filter(h => h >= 0);

      // Tramo 2: lo que tarda tesorería en cerrar, desde que el vendedor lo pasó.
      // Solo cuentan los que se cerraron con las columnas nuevas; lo anterior no
      // tiene registro y se informa aparte para no falsear el promedio.
      const cerrados    = comps.filter(c => ['aceptado', 'rechazado'].includes(c.estado));
      const conRegistro = cerrados.filter(c => c.revisado_at);
      const horasTeso   = conRegistro
        .map(c => hrs(c.procesado_at || c.created_at, c.revisado_at)).filter(h => h >= 0);

      // Los que siguen frenados, con hace cuánto esperan a quien los tiene.
      const trabados = [...conVendedor, ...conTesoreria].map(c => {
        const espera = c.estado === 'procesado' ? (c.procesado_at || c.created_at) : c.created_at;
        return {
          id: c.id, cliente_id: c.cliente_id, estado: c.estado || 'pendiente', monto: c.monto,
          created_at: c.created_at, procesado_por: c.procesado_por,
          esperaA: c.estado === 'procesado' ? 'tesoreria' : 'vendedor',
          dias: Math.floor((ahora - new Date(espera)) / 86400000),
        };
      }).sort((a, b) => b.dias - a.dias).slice(0, 20);

      // De quién es cada uno: un supervisor mira el nombre, no el id.
      const ids = [...new Set(trabados.map(c => c.cliente_id).filter(Boolean))];
      if (ids.length) {
        const cl = await leer('clientes?select=id,nombre,comercio&id=in.(' + ids.join(',') + ')');
        const porId = {};
        cl.forEach(c => { porId[c.id] = c.comercio || c.nombre; });
        trabados.forEach(c => { c.cliente = porId[c.cliente_id] || null; });
      }

      // procesado_por guarda el CÓDIGO del vendedor. Los nombres están en el
      // proyecto del manual, que sí se lee con la clave pública.
      const porVendedor = {};
      pasados.forEach(c => {
        const k = c.procesado_por || 'sin-codigo';
        porVendedor[k] = porVendedor[k] || { codigo: k, nombre: null, cantidad: 0, monto: 0, _h: [] };
        porVendedor[k].cantidad++; porVendedor[k].monto += num(c.monto);
        const h = hrs(c.created_at, c.procesado_at);
        if (h >= 0) porVendedor[k]._h.push(h);
      });
      const codigos = Object.keys(porVendedor).filter(k => k !== 'sin-codigo');
      if (codigos.length) {
        try {
          const r = await fetch(MAN_URL + '/rest/v1/vendedores?select=codigo,nombre&codigo=in.('
            + codigos.map(encodeURIComponent).join(',') + ')',
            { headers: { apikey: MAN_ANON, Authorization: 'Bearer ' + MAN_ANON } });
          if (r.ok) (await r.json()).forEach(v => {
            if (porVendedor[v.codigo]) porVendedor[v.codigo].nombre = v.nombre;
          });
        } catch (e) { /* si no se puede, queda el código solo */ }
      }
      const vendedores = Object.values(porVendedor).map(v => ({
        codigo: v.codigo === 'sin-codigo' ? null : v.codigo,
        nombre: v.nombre, cantidad: v.cantidad, monto: v.monto, horas: prom(v._h),
      })).sort((a, b) => b.cantidad - a.cantidad);

      // revisado_por ya guarda el nombre de la persona del Portal.
      const porRevisor = {};
      conRegistro.forEach(c => {
        const k = c.revisado_por || 'Sin identificar';
        porRevisor[k] = porRevisor[k] || { quien: k, cantidad: 0, monto: 0, aceptados: 0, rechazados: 0, _h: [] };
        const v = porRevisor[k];
        v.cantidad++; v.monto += num(c.monto);
        if (c.estado === 'aceptado') v.aceptados++; else v.rechazados++;
        const h = hrs(c.procesado_at || c.created_at, c.revisado_at);
        if (h >= 0) v._h.push(h);
      });
      const revisores = Object.values(porRevisor).map(v => ({
        quien: v.quien, cantidad: v.cantidad, monto: v.monto,
        aceptados: v.aceptados, rechazados: v.rechazados, horas: prom(v._h),
      })).sort((a, b) => b.cantidad - a.cantidad);

      return json(200, {
        dias: desdeDias,
        total: comps.length,
        porEstado: Object.values(porEstado).sort((a, b) => b.cantidad - a.cantidad),
        esperandoVendedor: conVendedor.length,
        esperandoTesoreria: conTesoreria.length,
        horasVendedor: prom(horasVend),
        horasTesoreria: prom(horasTeso),
        cerrados: cerrados.length,
        cerradosSinRegistro: cerrados.length - conRegistro.length,
        trabados,
        vendedores,
        revisores,
      });
    }

    if (que === 'estadisticas') {
      // Se recorre la cartera para sacar los totales: la función stats_cuentas_cubo
      // del otro sistema exige ser admin DE ESE sistema, y acá entramos con la llave
      // de servicio, así que se calcula del lado nuestro.
      const cuentas = (await leerTodo('cuentas_cubo?select=codigo,saldo,vencida,equipo,vendedor&order=codigo'))
        .filter(c => !Z || Z.codOk(c.codigo));
      const num = v => Number(v || 0);
      const cartera = cuentas.reduce((a, c) => a + num(c.saldo), 0);
      const vencida = cuentas.reduce((a, c) => a + num(c.vencida), 0);
      const conVencida = cuentas.filter(c => num(c.vencida) > 0).length;
      const porEquipo = {};
      cuentas.forEach(c => {
        const k = (c.equipo || 'Sin equipo').toUpperCase();
        porEquipo[k] = porEquipo[k] || { equipo: k, cuentas: 0, cartera: 0, vencida: 0 };
        porEquipo[k].cuentas++; porEquipo[k].cartera += num(c.saldo); porEquipo[k].vencida += num(c.vencida);
      });

      // "Sin equipo" no es un equipo: son las cuentas que vienen con esa celda
      // vacía en el Excel de CUBO. Para poder arreglarlo hay que saber de quién
      // son: si tienen vendedor, el equipo se completa mirando qué equipo tiene
      // ese mismo vendedor en sus otras cuentas.
      const equipoDe = {};                       // vendedor -> equipo, sacado de las cuentas que sí lo traen
      cuentas.forEach(c => {
        const e = (c.equipo || '').trim(), v = (c.vendedor || '').trim();
        if (e && v && !equipoDe[v]) equipoDe[v] = e.toUpperCase();
      });
      const huerfanas = cuentas.filter(c => !(c.equipo || '').trim());
      const porArreglar = {};
      let seDeduce = 0, sinVendedor = 0;
      huerfanas.forEach(c => {
        const v = (c.vendedor || '').trim();
        if (!v) { sinVendedor++; return; }
        const k = v + (equipoDe[v] ? ' → ' + equipoDe[v] : '');
        porArreglar[k] = porArreglar[k] || { vendedor: v, equipo: equipoDe[v] || null, cuentas: 0, cartera: 0, vencida: 0 };
        porArreglar[k].cuentas++; porArreglar[k].cartera += num(c.saldo); porArreglar[k].vencida += num(c.vencida);
        if (equipoDe[v]) seDeduce++;
      });
      const sinEquipo = {
        total: huerfanas.length,
        cartera: huerfanas.reduce((a, c) => a + num(c.saldo), 0),
        vencida: huerfanas.reduce((a, c) => a + num(c.vencida), 0),
        sinVendedor, seDeduce,
        // Separar las que tienen plata de las que no: una cuenta vieja en cero no es
        // el mismo problema que una cuenta con deuda real sin clasificar.
        conSaldo:  huerfanas.filter(c => num(c.saldo) !== 0).length,
        enCero:    huerfanas.filter(c => num(c.saldo) === 0).length,
        vendedores: Object.values(porArreglar).sort((a, b) => b.cuentas - a.cuentas).slice(0, 25),
      };
      const porVendedor = {};
      cuentas.forEach(c => {
        const k = c.vendedor || 'Sin asignar';
        porVendedor[k] = porVendedor[k] || { vendedor: k, cuentas: 0, cartera: 0, vencida: 0 };
        porVendedor[k].cuentas++; porVendedor[k].cartera += num(c.saldo); porVendedor[k].vencida += num(c.vencida);
      });
      return json(200, {
        total: cuentas.length, cartera, vencida, conVencida, sinEquipo,
        equipos: Object.values(porEquipo).sort((a, b) => b.vencida - a.vencida),
        vendedores: Object.values(porVendedor).sort((a, b) => b.vencida - a.vencida).slice(0, 20),
      });
    }

    // ── Bandeja de WhatsApp: respuestas de clientes + estado de envíos ──
    // Los mensajes los guarda el webhook (wa-webhook) en wa_eventos, en el mismo
    // proyecto de cobranzas. Acá se agrupan por teléfono y se matchea el cliente.
    if (que === 'whatsapp') {
      const soloDig = v => String(v == null ? '' : v).replace(/\D/g, '');
      const last10 = v => { const d = soloDig(v); return d.length > 10 ? d.slice(-10) : d; };
      const textoDe = c => {
        if (!c || typeof c !== 'object') return '';
        if (c.text && c.text.body) return c.text.body;
        if (c.button && c.button.text) return c.button.text;
        if (c.interactive) { const i = c.interactive; return (i.button_reply && i.button_reply.title) || (i.list_reply && i.list_reply.title) || '[respuesta]'; }
        if (c.reaction) return c.reaction.emoji ? ('Reaccionó con ' + c.reaction.emoji) : 'Quitó su reacción';
        if (c.image) return '📷 Imagen'; if (c.document) return '📎 ' + ((c.document && c.document.filename) || 'Documento'); if (c.audio) return '🎤 Audio'; if (c.video) return '🎬 Video';
        if (Array.isArray(c.contacts) && c.contacts.length) return '👤 Contacto: ' + c.contacts.map(k => (k.name && k.name.formatted_name) || ((k.phones && k.phones[0] && k.phones[0].phone) || 'sin nombre')).join(', ');
        if (c.location) return '📍 Ubicación' + (c.location.name ? ': ' + c.location.name : '');
        if (c.sticker) return 'Sticker';
        return '[' + (c.type || 'mensaje') + ']';
      };
      // Contacto que compartió el cliente (21/10/2026): nombre, teléfonos y vCard, para
      // poder escribirle, guardarlo o abrir la ficha si el número ya es de un cliente.
      const contactosDe = c => {
        if (!c || !Array.isArray(c.contacts) || !c.contacts.length) return null;
        return c.contacts.map(k => ({
          nombre: (k.name && k.name.formatted_name) || null,
          empresa: (k.org && k.org.company) || null,
          telefonos: (k.phones || []).map(p => {
            const info = dir[last10(p.wa_id || p.phone)] || null;
            const cliente = info && info.codigo && (!Z || Z.codOk(info.codigo)) ? { nombre: info.nombre, codigo: info.codigo } : null;
            return { numero: p.phone || p.wa_id || null, wa: p.wa_id ? soloDig(p.wa_id) : null, tipo: p.type || null, cliente };
          }),
          emails: (k.emails || []).map(m => m && m.email).filter(Boolean),
          vcard: typeof k.vcard === 'string' ? k.vcard.slice(0, 4000) : null,
        }));
      };
      const ubicacionDe = c => {
        const l = c && c.location; if (!l || l.latitude == null || l.longitude == null) return null;
        return { lat: Number(l.latitude), lng: Number(l.longitude), nombre: l.name || null, direccion: l.address || null };
      };
      // Archivo (imagen/documento) que mandó el cliente. Si el webhook ya lo guardó
      // en el bucket (_media_url), se linkea directo; si no, se baja con wa-media por id.
      const mediaDe = c => {
        if (!c || typeof c !== 'object') return null;
        const o = c.image ? { tipo: 'image', d: c.image } : c.document ? { tipo: 'document', d: c.document } : c.audio ? { tipo: 'audio', d: c.audio } : c.video ? { tipo: 'video', d: c.video } : c.sticker ? { tipo: 'image', d: c.sticker } : null;
        if (!o) return null;
        return { id: (o.d && o.d.id) || null, tipo: o.tipo, mime: (o.d && o.d.mime_type) || null, filename: (o.d && o.d.filename) || 'comprobante', url: c._media_url || null };
      };
      const tsDe = (c, f) => { const t = c && c.timestamp ? Number(c.timestamp) * 1000 : null; return t && !isNaN(t) ? new Date(t).toISOString() : f; };

      const eventos = await leerTodo('wa_eventos?select=tipo,estado,telefono,message_id,error_titulo,error_detalle,crudo,created_at&order=created_at.desc', 5000);
      const dir = {};
      for (const c of await leerTodo('cuentas_cubo?select=codigo,nombre,telefono&telefono=not.is.null&order=codigo')) { const k = last10(c.telefono); if (k && !dir[k]) dir[k] = { nombre: c.nombre, codigo: c.codigo }; }
      for (const c of await leerTodo('clientes?select=comercio,nombre,whatsapp,codigo_cubo&whatsapp=not.is.null&order=id')) { const k = last10(c.whatsapp); if (k && !dir[k]) dir[k] = { nombre: c.comercio || c.nombre, codigo: c.codigo_cubo }; }

      const conv = new Map();
      for (const e of (Array.isArray(eventos) ? eventos : [])) {
        const k = last10(e.telefono); if (!k) continue;
        if (!conv.has(k)) conv.set(k, { telefono: e.telefono, key: k, mensajes: [], entrantes: 0, ultimoEstado: null, error: null, ultimaFecha: null, ultimoTexto: null });
        const c = conv.get(k);
        if (e.tipo === 'message') {
          const fecha = tsDe(e.crudo, e.created_at);
          c.mensajes.push({ dir: 'in', texto: textoDe(e.crudo), fecha, media: mediaDe(e.crudo), contactos: contactosDe(e.crudo), ubicacion: ubicacionDe(e.crudo) });
          c.entrantes++;
          if (!c.ultimaFecha || fecha > c.ultimaFecha) { c.ultimaFecha = fecha; c.ultimoTexto = textoDe(e.crudo); }
        } else if (e.tipo === 'saliente') {
          // Respuesta que mandamos nosotros desde la bandeja (o plantilla registrada).
          const fecha = e.created_at;
          // Si fue una foto/archivo que mandamos, lo guardamos con _media_url para mostrarlo.
          const cr = e.crudo || {};
          const mediaOut = cr._media_url ? { url: cr._media_url, tipo: cr._media_tipo || 'document', mime: cr._media_mime || null, filename: cr._media_filename || 'archivo', id: null } : null;
          c.mensajes.push({ dir: 'out', texto: textoDe(e.crudo), fecha, media: mediaOut });
          if (!c.ultimaFecha || fecha > c.ultimaFecha) { c.ultimaFecha = fecha; }
          // Nombre/código de respaldo: si el teléfono no está vinculado en la base,
          // usamos el que guardó el envío de la plantilla.
          if (e.crudo && e.crudo.nombre && !c.nombreFallback) c.nombreFallback = e.crudo.nombre;
          if (e.crudo && e.crudo.codigo && !c.codigoFallback) c.codigoFallback = e.crudo.codigo;
        } else if (e.tipo === 'status') {
          if (!c.ultimoEstado) c.ultimoEstado = e.estado;
          if (e.estado === 'failed' && !c.error) c.error = e.error_titulo || e.error_detalle || 'Falló el envío';
          if (!c.ultimaFecha) c.ultimaFecha = e.created_at;
        }
      }
      const conversaciones = [...conv.values()].map(c => {
        const info = dir[c.key] || {};
        c.mensajes.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
        return { telefono: c.telefono, cliente: info.nombre || c.nombreFallback || null, codigo: info.codigo || c.codigoFallback || null, entrantes: c.entrantes, ultimoTexto: c.ultimoTexto, ultimaFecha: c.ultimaFecha, ultimoEstado: c.ultimoEstado, error: c.error, mensajes: c.mensajes };
      }).sort((a, b) => String(b.ultimaFecha || '').localeCompare(String(a.ultimaFecha || '')))
        .filter(c => !Z || (c.codigo ? Z.codOk(c.codigo) : Z.zona !== 'san_luis'));
      return json(200, { conversaciones });
    }

    return json(400, { error: 'No sé qué es "' + que + '".' });

  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

// Estado del sistema (11/10/2026): los errores internos quedan en sistema_errores (ver _errores.js).
module.exports.handler = require('./_errores').conErrores('cobranzas-panel', module.exports.handler);
