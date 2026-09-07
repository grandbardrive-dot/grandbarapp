// ============================================================
//  GrandBar Hub · Function · cobranzas-panel
//  Los datos del panel de Cobranzas, para que las pantallas vivan
//  DENTRO del Portal en vez de mandar a otro sistema.
//
//  Por qué una función y no leer la base desde el navegador: las tablas
//  de Cobranzas (cuentas corrientes, comprobantes, reclamos) están
//  cerradas — probadas con la clave pública, devuelven cero. Son datos
//  financieros de clientes. Acá la llave de servicio queda en el
//  servidor y nunca viaja al navegador, y antes de responder se
//  verifica QUIÉN pregunta con su token del Hub.
//
//    GET ?que=resumen   → los números de las 7 tarjetas
//    GET ?que=clientes&q=texto&pagina=0  → cuentas corrientes
//    GET ?que=bloquear  → los que pasaron su tope de deuda vencida
//    GET ?que=efectivo  → cobros en efectivo avisados
//    POST {accion:'bloquear'|'desbloquear', codigo}
//    POST {accion:'cobro-cobrado'|'cobro-cancelado', id}
//
//  Env (ya configurada para las otras funciones de cobranzas):
//    COBRANZAS_SERVICE_ROLE = service_role de qpaoyfubyaloyhepatlm
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const ROLES_OK = ['tesoreria', 'administracion', 'admin', 'desarrollo', 'diseno'];
const POR_PAGINA = 50;

function json(s, b) {
  return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) };
}

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta configurar COBRANZAS_SERVICE_ROLE en Netlify.' });

    // ── Quién pregunta ──
    const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'Sin sesión.' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión vencida. Volvé a entrar al Portal.' });
    const user = await uRes.json();

    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,nombre',
      { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const rol = String(perfil.rol || '').toLowerCase();
    if (!ROLES_OK.includes(rol)) return json(403, { error: 'Esta pantalla es del área de administración y cobranzas.' });

    // ── Acceso a la base de Cobranzas (solo del lado del servidor) ──
    const cob = (path, opts = {}) => fetch(COB_URL + '/rest/v1/' + path, {
      ...opts,
      headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });

    // ══════════ ESCRITURA ══════════
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { accion } = body;

      if (accion === 'bloquear' || accion === 'desbloquear') {
        if (!body.codigo) return json(400, { error: 'Falta el código de cliente.' });
        const estado = accion === 'bloquear' ? 'bloqueado' : 'aprobado';
        const r = await cob('clientes?codigo=eq.' + encodeURIComponent(body.codigo), {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ estado }),
        });
        const filas = await r.json();
        if (!r.ok) return json(400, { error: filas.message || 'No se pudo actualizar.' });
        // Sin filas = ese código no está registrado como cliente con cuenta.
        if (!filas.length) return json(404, { error: 'Ese cliente no tiene cuenta registrada, así que no se puede bloquear.' });
        return json(200, { ok: true, estado, cliente: filas[0] });
      }

      if (accion === 'cobro-cobrado' || accion === 'cobro-cancelado') {
        if (!body.id) return json(400, { error: 'Falta el cobro.' });
        const patch = accion === 'cobro-cobrado'
          ? { estado: 'cobrado', cobrado_at: new Date().toISOString() }
          : { estado: 'cancelado' };
        const r = await cob('cobros_efectivo?id=eq.' + encodeURIComponent(body.id), {
          method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
        });
        const filas = await r.json();
        if (!r.ok) return json(400, { error: filas.message || 'No se pudo actualizar.' });
        if (!filas.length) return json(404, { error: 'Ese cobro ya no existe.' });
        return json(200, { ok: true, cobro: filas[0] });
      }

      return json(400, { error: 'Acción desconocida: ' + accion });
    }

    // ══════════ LECTURA ══════════
    const p = event.queryStringParameters || {};
    const que = p.que || 'resumen';

    const contar = async (tabla, filtro) => {
      const r = await cob(tabla + '?select=id' + (filtro ? '&' + filtro : ''), { headers: { Prefer: 'count=exact', Range: '0-0' } });
      const cr = r.headers.get('content-range') || '*/0';
      return Number(cr.split('/')[1]) || 0;
    };

    if (que === 'resumen') {
      const [cuentas, compPend, reclAbiertos, cobrosPend] = await Promise.all([
        contar('cuentas_cubo', ''),
        contar('comprobantes', 'estado=eq.pendiente'),
        contar('reclamos', 'estado=eq.abierto'),
        contar('cobros_efectivo', 'estado=eq.pendiente'),
      ]);
      // Los que pasaron su tope: se cuenta acá porque depende de comparar dos columnas.
      const rb = await cob('clientes?select=codigo,deuda_vencida,tope_deuda_vencida,estado&deuda_vencida=gt.0&limit=2000');
      const clientes = rb.ok ? await rb.json() : [];
      const aBloquear = clientes.filter(c =>
        Number(c.deuda_vencida || 0) > Number(c.tope_deuda_vencida || 0) && c.estado !== 'bloqueado').length;

      return json(200, { rol, nombre: perfil.nombre, cuentas, compPend, reclAbiertos, cobrosPend, aBloquear });
    }

    if (que === 'clientes') {
      const pagina = Math.max(0, parseInt(p.pagina || '0', 10) || 0);
      const desde = pagina * POR_PAGINA, hasta = desde + POR_PAGINA - 1;
      const q = (p.q || '').trim();
      // Busca por código o por nombre/comercio, como en el panel original.
      const filtro = q
        ? '&or=(codigo.ilike.*' + encodeURIComponent(q) + '*,nombre.ilike.*' + encodeURIComponent(q) + '*,comercio.ilike.*' + encodeURIComponent(q) + '*)'
        : '';
      const r = await cob('cuentas_cubo?select=*' + filtro + '&order=saldo.desc.nullslast',
        { headers: { Prefer: 'count=exact', Range: desde + '-' + hasta } });
      const filas = r.ok ? await r.json() : [];
      const cr = r.headers.get('content-range') || '*/0';
      return json(200, { filas, total: Number(cr.split('/')[1]) || 0, pagina, porPagina: POR_PAGINA });
    }

    if (que === 'bloquear') {
      const r = await cob('clientes?select=*&deuda_vencida=gt.0&order=deuda_vencida.desc&limit=500');
      const todos = r.ok ? await r.json() : [];
      const filas = todos.filter(c =>
        Number(c.deuda_vencida || 0) > Number(c.tope_deuda_vencida || 0) && c.estado !== 'bloqueado');
      const bloqueados = todos.filter(c => c.estado === 'bloqueado');
      return json(200, { filas, bloqueados });
    }

    if (que === 'efectivo') {
      const r = await cob('cobros_efectivo?select=*&order=created_at.desc&limit=300');
      return json(200, { filas: r.ok ? await r.json() : [] });
    }

    return json(400, { error: 'No sé qué es "' + que + '".' });

  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
