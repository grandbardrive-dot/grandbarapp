// ============================================================
//  GrandBar Hub · Function · planilla-cobranzas
//  Planilla de RENDICIÓN DE COBRANZAS del vendedor logueado (réplica de la de papel):
//  recibo, razón social, factura, importe y el detalle por medio (efectivo, cheques,
//  retenciones, transferencia/MercPago, e-cheq), fecha, + dos archivos por fila
//  (comprobante de WhatsApp y recepción). Se completa por día y se ENVÍA a Moni.
//
//  Se identifica por SU token del Hub → usuarios.codigo_vendedor. Todo filtra por él.
//
//  GET  ?fecha=YYYY-MM-DD    → { fecha, filas, totales, envio, nombre }
//  POST { accion:'agregar', ...campos }
//  POST { accion:'editar', id, campos }
//  POST { accion:'borrar', id }
//  POST { accion:'subir', id, tipo:'comprobante'|'recepcion', file_base64, mime, filename }
//  POST { accion:'enviar', fecha }         → la manda al panel de Moni
//
//  Env: COBRANZAS_SERVICE_ROLE = service_role de qpaoyfubyaloyhepatlm
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const BUCKET   = 'comprobantes';
const MAX_BYTES = 5 * 1024 * 1024;
const MONEY = ['importe', 'efectivo', 'cheques', 'retenciones', 'transferencia', 'echeq'];

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
const hoyAR = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value;
  return g('year') + '-' + g('month') + '-' + g('day');
};
const okFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));
const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
const extDe = (mime, filename) => { const m = String(filename || '').match(/\.([a-z0-9]{1,5})$/i); if (m) return m[1].toLowerCase(); return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[String(mime || '').split(';')[0]]) || 'bin'; };

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    if (!service) return json(500, { error: 'Falta la variable COBRANZAS_SERVICE_ROLE en Netlify.' });

    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión iniciada.' });

    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida o vencida.' });
    const user = await uRes.json();

    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=codigo_vendedor,nombre', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const perfil = ((await pRes.json()) || [])[0] || {};
    const codigo = perfil.codigo_vendedor;
    if (!codigo) return json(200, { fecha: hoyAR(), filas: [], totales: {}, sinCodigo: true });

    const cob = (p, o = {}) => fetch(COB_URL + '/rest/v1/' + p, { ...o, headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' }, o.headers || {}) });

    const sumTotales = (filas) => {
      const t = {}; MONEY.forEach(k => t[k] = 0);
      (filas || []).forEach(f => MONEY.forEach(k => t[k] += Number(f[k]) || 0));
      return t;
    };
    const dueño = async (id) => {
      const r = await cob('planilla_cobranzas?id=eq.' + encodeURIComponent(id) + '&vendedor=eq.' + encodeURIComponent(codigo) + '&select=id,fecha_rendicion');
      const a = r.ok ? await r.json() : []; return a[0] || null;
    };

    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) {}

      if (b.accion === 'borrar') {
        if (!b.id) return json(400, { error: 'Falta la fila.' });
        const r = await cob('planilla_cobranzas?id=eq.' + encodeURIComponent(b.id) + '&vendedor=eq.' + encodeURIComponent(codigo), { method: 'DELETE', headers: { Prefer: 'return=representation' } });
        const filas = await r.json();
        if (!r.ok) return json(400, { error: (filas && filas.message) || 'No se pudo borrar.' });
        if (!filas.length) return json(404, { error: 'Esa fila ya no existe.' });
        return json(200, { ok: true });
      }

      if (b.accion === 'editar') {
        if (!b.id) return json(400, { error: 'Falta la fila.' });
        if (!await dueño(b.id)) return json(404, { error: 'Esa fila no es tuya o no existe.' });
        const c = b.campos || {};
        const patch = { updated_at: new Date().toISOString() };
        ['recibo', 'razon_social', 'codigo', 'factura', 'nota'].forEach(k => { if (k in c) patch[k] = c[k] ? String(c[k]).slice(0, 200) : null; });
        MONEY.forEach(k => { if (k in c) patch[k] = num(c[k]); });
        if ('fecha_pago' in c) patch.fecha_pago = okFecha(c.fecha_pago) ? c.fecha_pago : null;
        const r = await cob('planilla_cobranzas?id=eq.' + encodeURIComponent(b.id) + '&vendedor=eq.' + encodeURIComponent(codigo), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
        const filas = await r.json();
        if (!r.ok) return json(400, { error: (filas && filas.message) || 'No se pudo guardar.' });
        return json(200, { ok: true, fila: filas[0] || null });
      }

      if (b.accion === 'subir') {
        if (!b.id || !b.file_base64) return json(400, { error: 'Falta la fila o el archivo.' });
        const fila = await dueño(b.id);
        if (!fila) return json(404, { error: 'Esa fila no es tuya o no existe.' });
        const campo = b.tipo === 'recepcion' ? 'recepcion_url' : 'comprobante_url';
        let bytes; try { bytes = Buffer.from(String(b.file_base64).replace(/^data:[^,]*,/, ''), 'base64'); } catch (_) { bytes = null; }
        if (!bytes || !bytes.length) return json(400, { error: 'Archivo inválido.' });
        if (bytes.length > MAX_BYTES) return json(413, { error: 'El archivo es muy grande (máx 5 MB).' });
        const mime = String(b.mime || 'application/octet-stream').split(';')[0];
        const path = 'planilla/' + encodeURIComponent(codigo) + '/' + fila.fecha_rendicion + '/' + b.id + '-' + (b.tipo === 'recepcion' ? 'rec' : 'comp') + '-' + Date.now() + '.' + extDe(mime, b.filename);
        const up = await fetch(COB_URL + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'POST', headers: { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': mime, 'x-upsert': 'true' }, body: bytes });
        if (!up.ok) return json(502, { error: 'No se pudo subir: ' + (await up.text()).slice(0, 150) });
        const url = COB_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
        const r = await cob('planilla_cobranzas?id=eq.' + encodeURIComponent(b.id) + '&vendedor=eq.' + encodeURIComponent(codigo), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ [campo]: url, updated_at: new Date().toISOString() }) });
        if (!r.ok) return json(400, { error: 'Se subió pero no se pudo guardar el enlace.' });
        return json(200, { ok: true, url, campo });
      }

      if (b.accion === 'enviar') {
        const fecha = okFecha(b.fecha) ? b.fecha : hoyAR();
        const r = await cob('planilla_cobranzas?select=' + MONEY.join(',') + '&vendedor=eq.' + encodeURIComponent(codigo) + '&fecha_rendicion=eq.' + fecha);
        const filas = r.ok ? await r.json() : [];
        if (!filas.length) return json(400, { error: 'No hay filas cargadas en esta planilla.' });
        const totales = sumTotales(filas);
        const env = { vendedor: codigo, vendedor_nombre: perfil.nombre || null, fecha_rendicion: fecha, enviada_at: new Date().toISOString(), filas: filas.length, totales };
        const er = await cob('planilla_envios?on_conflict=vendedor,fecha_rendicion', { method: 'POST', headers: { Prefer: 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(env) });
        const out = await er.json();
        if (!er.ok) return json(400, { error: (out && out.message) || 'No se pudo enviar.' });
        return json(200, { ok: true, envio: out[0] || env });
      }

      // agregar (default)
      const fecha = okFecha(b.fecha_rendicion) ? b.fecha_rendicion : hoyAR();
      const fila = {
        vendedor: codigo, fecha_rendicion: fecha,
        recibo: b.recibo ? String(b.recibo).slice(0, 60) : null,
        razon_social: b.razon_social ? String(b.razon_social).slice(0, 160) : null,
        codigo: b.codigo ? String(b.codigo).slice(0, 30) : null,
        factura: b.factura ? String(b.factura).slice(0, 60) : null,
        importe: num(b.importe), efectivo: num(b.efectivo), cheques: num(b.cheques),
        retenciones: num(b.retenciones), transferencia: num(b.transferencia), echeq: num(b.echeq),
        fecha_pago: okFecha(b.fecha_pago) ? b.fecha_pago : null,
        nota: b.nota ? String(b.nota).slice(0, 300) : null,
        creado_por: user.id,
      };
      if (!fila.razon_social && !fila.recibo && !fila.factura) return json(400, { error: 'Cargá al menos el recibo, la razón social o la factura.' });
      const r = await cob('planilla_cobranzas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fila) });
      const ins = await r.json();
      if (!r.ok) return json(400, { error: (ins && ins.message) || 'No se pudo guardar.' });
      return json(200, { ok: true, fila: ins[0] || null });
    }

    // GET: filas del día pedido + totales + si ya fue enviada.
    const q = event.queryStringParameters || {};
    const fecha = okFecha(q.fecha) ? q.fecha : hoyAR();
    const [fr, er] = await Promise.all([
      cob('planilla_cobranzas?select=*&vendedor=eq.' + encodeURIComponent(codigo) + '&fecha_rendicion=eq.' + fecha + '&order=created_at.asc'),
      cob('planilla_envios?select=enviada_at,filas&vendedor=eq.' + encodeURIComponent(codigo) + '&fecha_rendicion=eq.' + fecha),
    ]);
    const filas = fr.ok ? await fr.json() : [];
    const envArr = er.ok ? await er.json() : [];
    return json(200, { fecha, nombre: perfil.nombre || null, filas: Array.isArray(filas) ? filas : [], totales: sumTotales(filas), envio: envArr[0] || null });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
