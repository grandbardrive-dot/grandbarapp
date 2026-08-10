// ============================================================
//  GrandBar Hub · Function · cobranzas-tesoreria  (Mónica / Brenda)
//   GET  → comprobantes en estado 'procesado' + sugerencia de match con el banco.
//   POST {accion:'importar-banco', movimientos:[...]} → carga el extracto.
//   POST {accion:'aceptar', id, banco_mov_id?} → estado 'aceptado' + liga el movimiento.
//   POST {accion:'rechazar', id} → estado 'rechazado'.
//  Verifica el rol del Hub (tesoreria | administracion | admin).
//  Env: COBRANZAS_SERVICE_ROLE
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const ROLES_OK = ['tesoreria', 'administracion', 'admin'];

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }
const qids = arr => arr.map(x => '"' + String(x).replace(/"/g, '') + '"').join(',');

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta COBRANZAS_SERVICE_ROLE' });
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol,nombre', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = (await pRes.json())[0] || {};
    if (!ROLES_OK.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'No autorizado (solo tesorería/administración).' });

    const cob = (path, opts = {}) => fetch(COB_URL + '/rest/v1/' + path, { ...opts, headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}

      if (body.accion === 'importar-banco' && Array.isArray(body.movimientos)) {
        const filas = body.movimientos.filter(m => m && m.hash).map(m => ({
          fecha: m.fecha || null, hora: m.hora || null, concepto: m.concepto || null, detalle: m.detalle || null,
          nombre: m.nombre || null, documento: m.documento || null,
          credito: m.credito != null ? Number(m.credito) : null, debito: m.debito != null ? Number(m.debito) : null,
          hash: String(m.hash),
        }));
        let cargados = 0;
        for (let i = 0; i < filas.length; i += 500) {
          const chunk = filas.slice(i, i + 500);
          const r = await cob('banco_movimientos?on_conflict=hash', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(chunk) });
          if (r.ok) cargados += chunk.length;
        }
        return json(200, { ok: true, recibidos: filas.length });
      }

      if (body.accion === 'aceptar' && body.id) {
        const patch = { estado: 'aceptado' };
        if (body.banco_mov_id) patch.banco_mov_id = body.banco_mov_id;
        const up = await cob('comprobantes?id=eq.' + encodeURIComponent(body.id) + '&estado=eq.procesado', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        if (!up.ok) return json(502, { error: 'No pude aceptar: ' + (await up.text()).slice(0, 150) });
        if (body.banco_mov_id) await cob('banco_movimientos?id=eq.' + encodeURIComponent(body.banco_mov_id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ usado_en: body.id }) });
        return json(200, { ok: true });
      }

      if (body.accion === 'rechazar' && body.id) {
        const up = await cob('comprobantes?id=eq.' + encodeURIComponent(body.id) + '&estado=eq.procesado', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'rechazado' }) });
        if (!up.ok) return json(502, { error: 'No pude rechazar' });
        return json(200, { ok: true });
      }
      return json(400, { error: 'Acción inválida' });
    }

    // GET → por revisar (procesado) + historial (aceptado/rechazado) + recibos
    const cp = await cob('comprobantes?tipo=eq.cliente&estado=in.(procesado,aceptado,rechazado)&select=id,cliente_id,concepto,archivo_url,monto,fecha_pago,estado,procesado_por,procesado_at,created_at&order=created_at.desc&limit=300');
    const comps = (await cp.json()) || [];
    const rc = await cob('comprobantes?tipo=eq.recibo&select=id,cliente_id,factura,archivo_url,fecha_pago,concepto,created_at&order=created_at.desc&limit=150');
    const recs = (await rc.json()) || [];

    const clienteIds = [...new Set([...(Array.isArray(comps) ? comps : []), ...(Array.isArray(recs) ? recs : [])].map(c => c.cliente_id).filter(Boolean))];
    const cl = clienteIds.length ? (await (await cob('clientes?id=in.(' + qids(clienteIds) + ')&select=id,nombre,comercio,codigo_cubo')).json()) : [];
    const cmap = {}; (Array.isArray(cl) ? cl : []).forEach(c => { cmap[c.id] = c; });
    const nombreDe = id => { const c = cmap[id] || {}; return c.comercio || c.nombre || '—'; };

    // Vendedor asignado a cada cliente (de cuentas_cubo, el dato oficial del sistema)
    const codigosCli = [...new Set(Object.values(cmap).map(c => c.codigo_cubo).filter(Boolean))];
    const vc = codigosCli.length ? (await (await cob('cuentas_cubo?codigo=in.(' + qids(codigosCli) + ')&select=codigo,vendedor')).json()) : [];
    const vmap = {}; (Array.isArray(vc) ? vc : []).forEach(x => { vmap[x.codigo] = x.vendedor; });
    const vendedorDe = id => { const c = cmap[id] || {}; return (c.codigo_cubo && vmap[c.codigo_cubo]) || null; };

    // Movimientos del banco sin usar (para los matches de los procesados)
    const bm = await cob('banco_movimientos?usado_en=is.null&select=id,fecha,nombre,documento,credito&order=fecha.desc&limit=2000');
    const movs = (await bm.json()) || [];
    const byMonto = {};
    (Array.isArray(movs) ? movs : []).forEach(m => { const k = Math.round(Number(m.credito) || 0); (byMonto[k] = byMonto[k] || []).push(m); });

    const por_revisar = [], historial = [];
    (Array.isArray(comps) ? comps : []).forEach(c => {
      const base = { id: c.id, cliente: nombreDe(c.cliente_id), vendedor: vendedorDe(c.cliente_id) || c.procesado_por || null, codigo: (cmap[c.cliente_id] || {}).codigo_cubo || null, concepto: c.concepto, monto: c.monto, fecha_pago: c.fecha_pago, estado: c.estado, comprobante_url: c.archivo_url, procesado_por: c.procesado_por, procesado_at: c.procesado_at, subido: c.created_at };
      if (c.estado === 'procesado') {
        const monto = c.monto != null ? Math.round(Number(c.monto)) : null;
        base.matches = (monto != null ? (byMonto[monto] || []) : []).slice(0, 3).map(m => ({ id: m.id, nombre: m.nombre, documento: m.documento, credito: m.credito, fecha: m.fecha }));
        por_revisar.push(base);
      } else { historial.push(base); }
    });
    const recibos = (Array.isArray(recs) ? recs : []).map(r => ({ id: r.id, cliente: nombreDe(r.cliente_id), codigo: (cmap[r.cliente_id] || {}).codigo_cubo || null, factura: r.factura, concepto: r.concepto, fecha: r.fecha_pago || r.created_at, recibo_url: r.archivo_url }));

    return json(200, { rol: perfil.rol, por_revisar, historial, recibos });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
