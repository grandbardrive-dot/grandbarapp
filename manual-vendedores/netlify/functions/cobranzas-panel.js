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
//                      | comprobantes | reclamos | estadisticas
//    POST {accion:'bloquear'|'desbloquear', id}
//         {accion:'cobro-cobrado'|'cobro-cancelado', id}
//         {accion:'comprobante-revisado', id}
//         {accion:'reclamo-estado', id, estado}
//
//  Env: COBRANZAS_SERVICE_ROLE (ya usada por cuentas-vendedor y cobranzas-tesoreria)
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const ROLES_OK = ['tesoreria', 'administracion', 'admin', 'desarrollo', 'diseno'];
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

    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,nombre',
      { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    if (!ROLES_OK.includes(rol)) return json(403, { error: 'Esta sección es del área de administración y cobranzas.' });

    const cob = (path, opts = {}) => fetch(COB_URL + '/rest/v1/' + path, {
      ...opts,
      headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const leer = async (path) => { const r = await cob(path); return r.ok ? await r.json() : []; };
    const contar = async (tabla, filtro) => {
      const r = await cob(tabla + '?select=id' + (filtro ? '&' + filtro : ''), { headers: { Prefer: 'count=exact', Range: '0-0' } });
      return Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
    };

    // ══════════ ESCRITURA ══════════
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const patch = async (tabla, filtro, campos, queEs) => {
        const r = await cob(tabla + '?' + filtro, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(campos) });
        const filas = await r.json();
        if (!r.ok) return json(400, { error: filas.message || 'No se pudo guardar.' });
        if (!filas.length) return json(404, { error: queEs + ' ya no existe.' });
        return json(200, { ok: true, fila: filas[0] });
      };

      if (b.accion === 'bloquear' || b.accion === 'desbloquear') {
        if (!b.id) return json(400, { error: 'Falta el cliente.' });
        return patch('clientes', 'id=eq.' + encodeURIComponent(b.id),
          { estado: b.accion === 'bloquear' ? 'bloqueado' : 'aprobado' }, 'Ese cliente');
      }
      if (b.accion === 'cobro-cobrado' || b.accion === 'cobro-cancelado') {
        if (!b.id) return json(400, { error: 'Falta el cobro.' });
        return patch('cobros_efectivo', 'id=eq.' + encodeURIComponent(b.id),
          b.accion === 'cobro-cobrado' ? { estado: 'cobrado', cobrado_at: new Date().toISOString() } : { estado: 'cancelado' },
          'Ese cobro');
      }
      if (b.accion === 'comprobante-revisado') {
        if (!b.id) return json(400, { error: 'Falta el comprobante.' });
        return patch('comprobantes', 'id=eq.' + encodeURIComponent(b.id), { estado: 'revisado' }, 'Ese comprobante');
      }
      if (b.accion === 'reclamo-estado') {
        if (!b.id || !b.estado) return json(400, { error: 'Falta el reclamo o el estado.' });
        return patch('reclamos', 'id=eq.' + encodeURIComponent(b.id),
          { estado: b.estado, updated_at: new Date().toISOString() }, 'Ese reclamo');
      }
      return json(400, { error: 'Acción desconocida: ' + b.accion });
    }

    // ══════════ LECTURA ══════════
    const p = event.queryStringParameters || {};
    const que = p.que || 'resumen';

    if (que === 'resumen') {
      const [cuentas, compPend, reclAbiertos, cobrosPend, clientes] = await Promise.all([
        contar('cuentas_cubo', ''),
        contar('comprobantes', 'estado=eq.pendiente'),
        contar('reclamos', 'estado=eq.abierto'),
        contar('cobros_efectivo', 'estado=eq.pendiente'),
        leer('clientes?select=estado,deuda_vencida,tope_deuda_vencida&deuda_vencida=gt.0&limit=2000'),
      ]);
      // Pasados de tope: hay que comparar dos columnas entre sí, así que se cuenta acá.
      const aBloquear = clientes.filter(c =>
        Number(c.deuda_vencida || 0) > Number(c.tope_deuda_vencida || 0) && c.estado !== 'bloqueado').length;
      return json(200, { rol, nombre: perfil.nombre, cuentas, compPend, reclAbiertos, cobrosPend, aBloquear });
    }

    if (que === 'clientes') {
      const pagina = Math.max(0, parseInt(p.pagina || '0', 10) || 0);
      const desde = pagina * POR_PAGINA;
      const q = (p.q || '').trim();
      const filtro = q ? '&or=(codigo.ilike.*' + encodeURIComponent(q) + '*,nombre.ilike.*' + encodeURIComponent(q) + '*)' : '';
      const soloDeuda = p.deuda === '1' ? '&vencida=gt.0' : '';
      const r = await cob('cuentas_cubo?select=*' + filtro + soloDeuda + '&order=vencida.desc.nullslast,saldo.desc.nullslast',
        { headers: { Prefer: 'count=exact', Range: desde + '-' + (desde + POR_PAGINA - 1) } });
      const filas = r.ok ? await r.json() : [];
      const total = Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
      return json(200, { filas, total, pagina, porPagina: POR_PAGINA });
    }

    // Ficha de un cliente: su cuenta + las facturas con saldo pendiente.
    if (que === 'cliente') {
      if (!p.codigo) return json(400, { error: 'Falta el código.' });
      const cod = encodeURIComponent(p.codigo);
      const [cuenta, facturas, ficha] = await Promise.all([
        leer('cuentas_cubo?select=*&codigo=eq.' + cod),
        leer('facturas?select=*&codigo=eq.' + cod + '&order=vencimiento.asc&limit=300'),
        leer('clientes?select=*&codigo_cubo=eq.' + cod).catch(() => []),
      ]);
      return json(200, { cuenta: cuenta[0] || null, facturas, ficha: (ficha && ficha[0]) || null });
    }

    if (que === 'bloquear') {
      const todos = await leer('clientes?select=*&deuda_vencida=gt.0&order=deuda_vencida.desc&limit=500');
      return json(200, {
        filas: todos.filter(c => Number(c.deuda_vencida || 0) > Number(c.tope_deuda_vencida || 0) && c.estado !== 'bloqueado'),
        bloqueados: todos.filter(c => c.estado === 'bloqueado'),
      });
    }

    if (que === 'efectivo') {
      return json(200, { filas: await leer('cobros_efectivo?select=*&order=created_at.desc&limit=300') });
    }

    if (que === 'comprobantes') {
      return json(200, { filas: await leer('comprobantes?select=*,cliente:clientes(comercio,nombre,whatsapp)&order=created_at.desc&limit=300') });
    }

    if (que === 'reclamos') {
      if (p.id) {
        const [rec, mensajes] = await Promise.all([
          leer('reclamos?select=*,cliente:clientes(comercio,nombre,whatsapp)&id=eq.' + encodeURIComponent(p.id)),
          leer('reclamos_mensajes?select=*&reclamo_id=eq.' + encodeURIComponent(p.id) + '&order=created_at.asc'),
        ]);
        return json(200, { reclamo: rec[0] || null, mensajes });
      }
      return json(200, { filas: await leer('reclamos?select=*,cliente:clientes(comercio,nombre,whatsapp)&order=updated_at.desc&limit=200') });
    }

    // Supervisión del sector: cómo viene la revisión de comprobantes, sin los botones
    // de aceptar o rechazar (eso lo opera tesorería). Interesa el volumen, cuánto se
    // tarda y qué quedó trabado.
    if (que === 'supervision') {
      const desdeDias = Math.max(1, parseInt(p.dias || '30', 10) || 30);
      const desde = new Date(Date.now() - desdeDias * 86400000).toISOString();
      const comps = await leer('comprobantes?select=id,cliente_id,estado,monto,fecha_pago,procesado_por,procesado_at,created_at,tipo'
        + '&tipo=eq.cliente&created_at=gte.' + desde + '&order=created_at.desc&limit=2000');

      const num = v => Number(v || 0);
      const porEstado = {};
      comps.forEach(c => {
        const e = c.estado || 'pendiente';
        porEstado[e] = porEstado[e] || { estado: e, cantidad: 0, monto: 0 };
        porEstado[e].cantidad++; porEstado[e].monto += num(c.monto);
      });

      // Cuánto tarda en resolverse: de que el cliente lo sube a que tesorería lo cierra.
      const cerrados = comps.filter(c => c.procesado_at && c.created_at);
      const horas = cerrados.map(c => (new Date(c.procesado_at) - new Date(c.created_at)) / 3600000).filter(h => h >= 0);
      const promedio = horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null;

      // Lo que sigue esperando, y hace cuánto: es lo que un supervisor mira primero.
      const abiertos = comps.filter(c => ['pendiente', 'procesado'].includes(c.estado || 'pendiente'));
      const ahora = Date.now();
      const demorados = abiertos
        .map(c => ({ ...c, dias: Math.floor((ahora - new Date(c.created_at)) / 86400000) }))
        .sort((a, b) => b.dias - a.dias).slice(0, 15);

      // De quién es cada uno: un supervisor mira el nombre, no el id.
      const ids = [...new Set(demorados.map(c => c.cliente_id).filter(Boolean))];
      if (ids.length) {
        const cl = await leer('clientes?select=id,nombre,comercio&id=in.(' + ids.join(',') + ')');
        const porId = {};
        cl.forEach(c => { porId[c.id] = c.comercio || c.nombre; });
        demorados.forEach(c => { c.cliente = porId[c.cliente_id] || null; });
      }

      const porPersona = {};
      cerrados.forEach(c => {
        const k = c.procesado_por || 'Sin registrar';
        porPersona[k] = porPersona[k] || { quien: k, cantidad: 0, monto: 0 };
        porPersona[k].cantidad++; porPersona[k].monto += num(c.monto);
      });

      return json(200, {
        dias: desdeDias,
        total: comps.length,
        porEstado: Object.values(porEstado).sort((a, b) => b.cantidad - a.cantidad),
        promedioHoras: promedio,
        abiertos: abiertos.length,
        demorados,
        porPersona: Object.values(porPersona).sort((a, b) => b.cantidad - a.cantidad),
      });
    }

    if (que === 'estadisticas') {
      // Se recorre la cartera para sacar los totales: la función stats_cuentas_cubo
      // del otro sistema exige ser admin DE ESE sistema, y acá entramos con la llave
      // de servicio, así que se calcula del lado nuestro.
      const cuentas = await leer('cuentas_cubo?select=saldo,vencida,equipo,vendedor&limit=10000');
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
      const porVendedor = {};
      cuentas.forEach(c => {
        const k = c.vendedor || 'Sin asignar';
        porVendedor[k] = porVendedor[k] || { vendedor: k, cuentas: 0, cartera: 0, vencida: 0 };
        porVendedor[k].cuentas++; porVendedor[k].cartera += num(c.saldo); porVendedor[k].vencida += num(c.vencida);
      });
      return json(200, {
        total: cuentas.length, cartera, vencida, conVencida,
        equipos: Object.values(porEquipo).sort((a, b) => b.vencida - a.vencida),
        vendedores: Object.values(porVendedor).sort((a, b) => b.vencida - a.vencida).slice(0, 20),
      });
    }

    return json(400, { error: 'No sé qué es "' + que + '".' });

  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
