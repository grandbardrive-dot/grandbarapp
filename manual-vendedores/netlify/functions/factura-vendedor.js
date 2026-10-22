// ============================================================
//  GrandBar Hub · Function · factura-vendedor
//  Descarga de la FACTURA de un cliente para el VENDEDOR (misma función que el
//  portal del cliente, pero autenticada por el vendedor del Hub).
//  Flujo:
//   1) valida al vendedor (token del Hub → usuarios.codigo_vendedor)
//   2) verifica que el cliente (codigo) sea de SU cartera (cuentas_cubo.vendedor)
//      y que la factura (numero) sea de ese cliente (tabla facturas)
//   3) proxea a factura-pdf del portal de clientes usando la clave del servidor
//      (la clave NUNCA llega al navegador)
//  GET ?tipo=FAC&numero=0005-00036374/A&codigo=07267  (&modo=pago opcional)
//  Env: COBRANZAS_SERVICE_ROLE, FACTURA_MAIL_SECRET
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const COB_URL  = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const ECOM     = 'https://grandbar-gestioncuenta.netlify.app';

const html = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: b });
const padCod = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.padStart(5, '0') : ''; };

exports.handler = async (event) => {
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE, secret = process.env.FACTURA_MAIL_SECRET;
    if (!service || !secret) return html(500, '<h3>Falta configuración (COBRANZAS_SERVICE_ROLE / FACTURA_MAIL_SECRET).</h3>');

    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return html(401, '<h3>Iniciá sesión para descargar la factura.</h3>');
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return html(401, '<h3>Tu sesión venció. Volvé a entrar.</h3>');
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=codigo_vendedor', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const codVend = (((await pRes.json()) || [])[0] || {}).codigo_vendedor;
    if (!codVend) return html(403, '<h3>Tu usuario no tiene código de vendedor.</h3>');

    const q = event.queryStringParameters || {};
    const tipo = q.tipo || 'FAC';
    const numero = String(q.numero || '').trim();
    const cod = padCod(q.codigo);
    if (!numero || !cod) return html(400, '<h3>Faltan datos de la factura.</h3>');

    const cob = p => fetch(COB_URL + '/rest/v1/' + p, { headers: { apikey: service, Authorization: 'Bearer ' + service } });
    // ¿El cliente es de la cartera del vendedor?
    const cc = (((await (await cob('cuentas_cubo?codigo=eq.' + encodeURIComponent(cod) + '&select=vendedor&limit=1')).json())) || [])[0];
    if (!cc || String(cc.vendedor || '') !== String(codVend)) return html(403, '<h3>Ese cliente no es de tu cartera.</h3>');
    // ¿La factura es de ese cliente?
    const fac = (((await (await cob('facturas?codigo=eq.' + encodeURIComponent(cod) + '&numero=eq.' + encodeURIComponent(numero) + '&select=numero&limit=1')).json())) || [])[0];
    if (!fac) return html(404, '<h3>No encontré esa factura en la cuenta del cliente.</h3>');

    // Proxy a factura-pdf (clave sólo del lado del servidor).
    const url = ECOM + '/.netlify/functions/factura-pdf?key=' + encodeURIComponent(secret) + '&tipo=' + encodeURIComponent(tipo) + '&numero=' + encodeURIComponent(numero) + (q.modo ? '&modo=' + encodeURIComponent(q.modo) : '');
    const pr = await fetch(url);
    const body = await pr.text();
    return html(pr.ok ? 200 : pr.status, body);
  } catch (e) {
    return html(500, '<h3>Error generando la factura.</h3><pre>' + String((e && e.message) || e).slice(0, 200) + '</pre>');
  }
};
