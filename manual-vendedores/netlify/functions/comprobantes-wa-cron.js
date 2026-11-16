// ============================================================
//  GrandBar Hub · Function PROGRAMADA · comprobantes-wa-cron
//  Dispara comprobantes-wa-background: lee con IA los comprobantes que los vendedores
//  mandan al WhatsApp de GrandBar y los engancha a su planilla (ver ese archivo).
//  Solo la dispara si hay algo para hacer, así no corre de gusto cada 2 minutos.
// ============================================================
const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';

exports.handler = async () => {
  const base = process.env.URL || 'https://portalgrandbar.com';
  try {
    const service = process.env.COBRANZAS_SERVICE_ROLE;
    const desde = new Date(Date.now() - 6 * 864e5).toISOString();
    const r = await fetch(COB_URL + '/rest/v1/comprobantes_vendedor?select=id&or=(estado.in.(nuevo,leido),and(estado.eq.sin_asignar,recibido_at.gte.' + desde + '))&limit=1',
      { headers: { apikey: service, Authorization: 'Bearer ' + service } });
    const hay = r.ok ? (await r.json()).length : 1;
    if (!hay) return { statusCode: 200, body: JSON.stringify({ ok: true, nada: true }) };
    const b = await fetch(`${base}/.netlify/functions/comprobantes-wa-background`, { method: 'POST' });
    console.log('comprobantes-wa-cron: disparada →', b.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, background: b.status }) };
  } catch (e) {
    console.log('comprobantes-wa-cron error:', (e && e.message) || e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: (e && e.message) || String(e) }) };
  }
};

module.exports.handler = require('./_errores').conErrores('comprobantes-wa-cron', module.exports.handler);
