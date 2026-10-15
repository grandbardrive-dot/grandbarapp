// ============================================================
//  GrandBar Hub · Function · planilla-cobranzas
//  Planilla de cobranzas del vendedor LOGUEADO: lo que cobró a cada cliente.
//  Se identifica por SU token del Hub → usuarios.codigo_vendedor; todas las filas
//  se filtran por ese código. La base es la de Cobranzas (service_role bypassa RLS).
//
//  GET  ?fecha=YYYY-MM-DD            → { fecha, filas, total }  (default: hoy AR)
//  POST { accion:'agregar', codigo, cliente_nombre, monto, medio, fecha, nota }
//  POST { accion:'borrar', id }      → borra una fila propia
//
//  Env: COBRANZAS_SERVICE_ROLE = service_role de qpaoyfubyaloyhepatlm
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
const hoyAR = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value;
  return g('year') + '-' + g('month') + '-' + g('day');
};
const okFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta la variable COBRANZAS_SERVICE_ROLE en Netlify.' });

    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión iniciada.' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida o vencida.' });
    const user = await uRes.json();

    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=codigo_vendedor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const codigo = perfil.codigo_vendedor;
    if (!codigo) return json(200, { fecha: hoyAR(), filas: [], total: 0, sinCodigo: true });

    const cob = (p, o = {}) => fetch(COB_URL + '/rest/v1/' + p, { ...o, headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' }, o.headers || {}) });

    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) {}

      if (b.accion === 'borrar') {
        if (!b.id) return json(400, { error: 'Falta la fila.' });
        // Solo puede borrar filas de SU vendedor.
        const r = await cob('planilla_cobranzas?id=eq.' + encodeURIComponent(b.id) + '&vendedor=eq.' + encodeURIComponent(codigo), { method: 'DELETE', headers: { Prefer: 'return=representation' } });
        const filas = await r.json();
        if (!r.ok) return json(400, { error: (filas && filas.message) || 'No se pudo borrar.' });
        if (!filas.length) return json(404, { error: 'Esa fila ya no existe.' });
        return json(200, { ok: true });
      }

      // agregar (default)
      const monto = Number(b.monto);
      if (!isFinite(monto) || monto <= 0) return json(400, { error: 'Poné un monto válido.' });
      const fecha = okFecha(b.fecha) ? b.fecha : hoyAR();
      const medios = ['efectivo', 'transferencia', 'cheque', 'otro'];
      const medio = medios.includes(String(b.medio || '').toLowerCase()) ? String(b.medio).toLowerCase() : 'efectivo';
      const fila = {
        vendedor: codigo,
        codigo: b.codigo ? String(b.codigo) : null,
        cliente_nombre: b.cliente_nombre ? String(b.cliente_nombre).slice(0, 160) : null,
        monto, medio, fecha,
        nota: b.nota ? String(b.nota).slice(0, 300) : null,
        creado_por: user.id,
      };
      const r = await cob('planilla_cobranzas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
      const ins = await r.json();
      if (!r.ok) return json(400, { error: (ins && ins.message) || 'No se pudo guardar.' });
      return json(200, { ok: true, fila: ins[0] || null });
    }

    // GET: filas del día pedido (o de hoy).
    const q = event.queryStringParameters || {};
    const fecha = okFecha(q.fecha) ? q.fecha : hoyAR();
    const r = await cob('planilla_cobranzas?select=id,codigo,cliente_nombre,monto,medio,fecha,nota,created_at&vendedor=eq.' + encodeURIComponent(codigo) + '&fecha=eq.' + fecha + '&order=created_at.desc');
    const filas = r.ok ? await r.json() : [];
    const total = (Array.isArray(filas) ? filas : []).reduce((a, c) => a + (Number(c.monto) || 0), 0);
    return json(200, { fecha, filas: Array.isArray(filas) ? filas : [], total });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
