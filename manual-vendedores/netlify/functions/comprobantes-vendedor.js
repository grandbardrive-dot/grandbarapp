// ============================================================
//  GrandBar Hub · Function · comprobantes-vendedor
//  Inbox de cobranzas del vendedor:
//   - GET  → comprobantes 'pendiente' de SUS clientes (por su código).
//   - POST {accion:'procesar', id} → marca 'procesado' (ya lo cargó en Conquer).
//  Lee/escribe la base de COBRANZAS con service role; identifica al
//  vendedor por su token del Hub.
//  Env: COBRANZAS_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const q = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta COBRANZAS_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    // Vendedor logueado (Hub)
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=codigo_vendedor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const cod = ((await pRes.json())[0] || {}).codigo_vendedor;
    if (!cod) return json(200, { comprobantes: [] });

    const cob = (path, opts = {}) => fetch(COB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    // Acción: marcar procesado
    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
      if (body.accion === 'procesar' && body.id) {
        const up = await cob('comprobantes?id=eq.' + encodeURIComponent(body.id) + '&estado=eq.pendiente', {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ estado: 'procesado', procesado_por: cod, procesado_at: new Date().toISOString(), vendedor: cod }),
        });
        if (!up.ok) return json(502, { error: 'No pude procesar: ' + (await up.text()).slice(0, 150) });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // Listar: clientes del vendedor → sus comprobantes pendientes
    const cc = await cob('cuentas_cubo?vendedor=eq.' + encodeURIComponent(cod) + '&select=codigo');
    const codigos = ((await cc.json()) || []).map(x => x.codigo).filter(Boolean);
    if (!codigos.length) return json(200, { codigo: cod, comprobantes: [] });

    const cl = await cob('clientes?codigo_cubo=in.(' + q(codigos) + ')&select=id,nombre,comercio,codigo_cubo');
    const clientes = (await cl.json()) || [];
    if (!Array.isArray(clientes) || !clientes.length) return json(200, { codigo: cod, comprobantes: [] });
    const idMap = {}; clientes.forEach(c => { idMap[c.id] = c; });
    const ids = clientes.map(c => c.id);

    const cp = await cob('comprobantes?cliente_id=in.(' + q(ids) + ')&tipo=eq.cliente&select=id,cliente_id,concepto,archivo_url,monto,fecha_pago,estado,procesado_at,created_at&order=created_at.desc&limit=600');
    const comps = (await cp.json()) || [];
    const out = (Array.isArray(comps) ? comps : []).map(c => ({
      id: c.id,
      cliente: (idMap[c.cliente_id] && (idMap[c.cliente_id].comercio || idMap[c.cliente_id].nombre)) || '—',
      concepto: c.concepto, monto: c.monto, fecha_pago: c.fecha_pago,
      estado: c.estado, procesado_at: c.procesado_at,
      comprobante_url: c.archivo_url, subido: c.created_at,
    }));
    return json(200, { codigo: cod, comprobantes: out });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
