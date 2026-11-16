// ============================================================
//  GrandBar Hub · Function BACKGROUND · comprobantes-wa-background  (16/11/2026)
//  Comprobantes de los VENDEDORES sin grupo de WhatsApp. El vendedor reenvía los
//  comprobantes al WhatsApp de GrandBar (o los sube todos juntos en la planilla) y:
//   1) la IA lee cada uno: importe, fecha, quién pagó (nombre y CUIT), banco, N° de op.
//   2) se engancha solo a la fila de SU planilla: por CUIT o nombre del pagador contra
//      el cliente, por el importe contra lo declarado y por lo que escribió en el epígrafe.
//      Si todavía no cargó ese cobro, queda esperando y se reintenta en cada corrida.
//   3) le contesta por WhatsApp qué hizo con cada uno (solo la primera vez).
//  La cola es la tabla comprobantes_vendedor (base cobranzas), que llena un trigger de
//  wa_eventos con las fotos/PDF que llegan desde los celulares de vendedores_whatsapp.
//
//  Lo dispara comprobantes-wa-cron (cada 2 min en horario de oficina), la planilla del
//  vendedor al subir varios, y el panel de Moni al abrir una planilla.
//  Env: ANTHROPIC_API_KEY, COBRANZAS_SERVICE_ROLE, WA_TOKEN, WA_PHONE_ID.
// ============================================================

const COB_URL = 'https://qpaoyfubyaloyhepatlm.supabase.co';
const MODEL = 'claude-opus-5-5';
const BUDGET_MS = 12 * 60 * 1000;
const MEDIOS = ['transferencia', 'echeq', 'cheques', 'efectivo', 'tarjeta', 'retenciones'];

const cob = (p, o = {}) => {
  const service = process.env.COBRANZAS_SERVICE_ROLE;
  return fetch(COB_URL + '/rest/v1/' + p, { ...o, headers: Object.assign({ apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' }, o.headers || {}) });
};
const leer = async (p) => { const r = await cob(p); const j = await r.json().catch(() => []); return Array.isArray(j) ? j : []; };
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const padCod = v => { const d = String(v == null ? '' : v).replace(/\D/g, ''); return d ? d.padStart(5, '0') : ''; };
const soloDig = v => String(v == null ? '' : v).replace(/\D/g, '');
const pesos = n => '$' + Math.round(num(n)).toLocaleString('es-AR');
const sumaDias = (iso, d) => { const x = new Date(iso.slice(0, 10) + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const diaAR = ts => new Date(new Date(ts).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ddmm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';

// ---------- 1) Leer el comprobante con IA ----------
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['es_comprobante', 'legible', 'monto', 'fecha', 'pagador_nombre', 'pagador_cuit', 'banco', 'nro_operacion', 'destinatario', 'tipo'],
  properties: {
    es_comprobante: { type: 'boolean' },
    legible: { type: 'boolean' },
    monto: { type: ['number', 'null'] },
    fecha: { type: ['string', 'null'] },
    pagador_nombre: { type: ['string', 'null'] },
    pagador_cuit: { type: ['string', 'null'] },
    banco: { type: ['string', 'null'] },
    nro_operacion: { type: ['string', 'null'] },
    destinatario: { type: ['string', 'null'] },
    tipo: { type: ['string', 'null'] },
  },
};
const PROMPT =
  'Es un comprobante de pago que un cliente le hizo a GrandBar (distribuidora de bebidas de Argentina): ' +
  'transferencia, depósito, e-cheq, Mercado Pago, etc. Extraé los datos tal como figuran, sin inventar nada.\n' +
  '- es_comprobante: false si la imagen no es un comprobante de pago (una foto cualquiera, un chat, una factura).\n' +
  '- monto: el importe pagado, como número (ej. 15000.5), sin símbolos ni separadores de miles.\n' +
  '- fecha: de la operación, en formato YYYY-MM-DD.\n' +
  '- pagador_nombre y pagador_cuit: quien ORIGINA el pago (titular de la cuenta de origen / "De"), no el destinatario. CUIT solo con números.\n' +
  '- destinatario: a quién va el pago (debería ser GrandBar o su razón social).\n' +
  '- tipo: transferencia | deposito | echeq | cheque | mercadopago | otro.\n' +
  'Lo que no se lea, null.';

async function leerConIA(url) {
  const fr = await fetch(url);
  if (!fr.ok) throw new Error('No pude bajar el archivo (' + fr.status + ')');
  let mime = (fr.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const b64 = Buffer.from(await fr.arrayBuffer()).toString('base64');
  if (!mime || mime === 'application/octet-stream') mime = /\.pdf$/i.test(url) ? 'application/pdf' : /\.png$/i.test(url) ? 'image/png' : 'image/jpeg';
  const source = mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
      messages: [{ role: 'user', content: [source, { type: 'text', text: PROMPT }] }],
    }),
  });
  if (!r.ok) throw new Error('IA ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const out = await r.json();
  if (out.stop_reason === 'refusal') throw new Error('La IA no quiso leerlo');
  const txt = (out.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  return JSON.parse(txt);
}

// ---------- 2) Engancharlo a la fila de la planilla ----------
const VACIAS = new Set(['srl', 'sas', 'sa', 'sociedad', 'anonima', 'responsabilidad', 'limitada', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'cia', 'hnos', 'hermanos', 'grupo']);
const palabras = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/).filter(w => w.length >= 4 && !VACIAS.has(w));
const comparten = (a, b) => { const sb = new Set(palabras(b)); return palabras(a).some(w => sb.has(w)); };
const redondo = n => Math.abs(n % 1000) < 0.01;

function montosDe(f) {
  const out = [num(f.importe)];
  MEDIOS.forEach(m => out.push(num(f[m])));
  ['transferencia_detalle', 'echeq_detalle', 'cheques_detalle'].forEach(k => (Array.isArray(f[k]) ? f[k] : []).forEach(x => out.push(num(x))));
  return out.filter(x => x > 0);
}

// Devuelve la fila elegida (o null) para un comprobante ya leído.
function elegirFila(c, filas, clientes) {
  if (!filas.length) return null;
  const monto = num(c.monto), cuit = soloDig(c.pagador_cuit), pista = String(c.nombre || '');
  const puntaje = filas.map(f => {
    const cli = clientes[padCod(f.codigo)] || {};
    let p = 0;
    if (cuit && cuit.length >= 10 && soloDig(cli.cuit) === cuit) p += 5;
    if (c.pagador && (comparten(c.pagador, f.razon_social) || comparten(c.pagador, cli.nombre) || comparten(c.pagador, cli.razon_social))) p += 3;
    if (pista && (comparten(pista, f.razon_social) || comparten(pista, cli.nombre) || (padCod(f.codigo) && pista.includes(String(Number(soloDig(f.codigo))))))) p += 3;
    const montos = montosDe(f);
    if (monto && montos.some(x => Math.abs(x - monto) <= 1)) p += 3;
    else if (monto && montos.some(x => Math.abs(x - monto) <= x * 0.01)) p += 1;
    return { f, p };
  }).sort((a, b) => b.p - a.p);
  // Importe exacto, con centavos o no redondo, y que solo lo tiene una fila: también alcanza.
  if (monto && !redondo(monto) && puntaje[0].p === 3) {
    const conEse = filas.filter(f => montosDe(f).some(x => Math.abs(x - monto) <= 1));
    if (conEse.length === 1 && conEse[0] === puntaje[0].f) puntaje[0].p = 5;
  }
  const [a, b] = puntaje;
  if (a.p >= 5 && (!b || b.p < a.p)) return a.f;
  return null;
}

async function adjuntar(c, fila, quien) {
  const actual = (await leer('planilla_cobranzas?select=id,comprobantes&id=eq.' + fila.id))[0];
  if (!actual) return false;
  const lista = Array.isArray(actual.comprobantes) ? actual.comprobantes.slice() : [];
  if (!lista.some(x => x && x.comp_id === c.id)) {
    lista.push({ url: c.url, nombre: (c.origen === 'whatsapp' ? 'WhatsApp' : 'Subido') + (c.monto ? ' · ' + pesos(c.monto) : ''), origen: c.origen, comp_id: c.id, monto_ia: c.monto != null ? num(c.monto) : null, pagador: c.pagador || null });
    const r = await cob('planilla_cobranzas?id=eq.' + fila.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ comprobantes: lista }) });
    if (!r.ok) return false;
  }
  await cob('comprobantes_vendedor?id=eq.' + c.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ estado: 'asignado', fila_id: fila.id, asignado_por: quien, asignado_at: new Date().toISOString() }) });
  return true;
}

// ---------- 3) Contestarle al vendedor ----------
// Una sola respuesta por comprobante aunque corran dos a la vez: se reserva marcando
// respondido=true solo si todavía estaba en false.
async function responder(c, texto) {
  const rr = await cob('comprobantes_vendedor?id=eq.' + c.id + '&respondido=eq.false', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ respondido: true }) });
  c.respondido = true;
  if (!(await rr.json().catch(() => [])).length) return;
  if (!process.env.WA_TOKEN || !process.env.WA_PHONE_ID || !c.telefono || c.origen !== 'whatsapp') return;
  const body = { messaging_product: 'whatsapp', to: soloDig(c.telefono), type: 'text', text: { body: texto } };
  if (c.wa_message_id) body.context = { message_id: c.wa_message_id };
  try {
    const r = await fetch('https://graph.facebook.com/v21.0/' + process.env.WA_PHONE_ID + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.WA_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    const mid = j.messages && j.messages[0] ? j.messages[0].id : null;
    await cob('wa_eventos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tipo: 'saliente', estado: r.ok ? 'texto' : 'error', telefono: soloDig(c.telefono), wa_id: soloDig(c.telefono), message_id: mid, crudo: { text: { body: texto }, por: 'Comprobantes vendedor', error: r.ok ? null : j } }) });
  } catch (_) {}
}

exports.handler = async (event) => {
  const t0 = Date.now(), log = [];
  if (!process.env.COBRANZAS_SERVICE_ROLE) { console.log('comprobantes-wa: falta COBRANZAS_SERVICE_ROLE'); return { statusCode: 500 }; }
  try {
    // 1) Leer los nuevos (de a 4 en paralelo). Se reservan pasándolos a 'leyendo' para que
    //    otra corrida simultánea no los lea dos veces; si una corrida murió a mitad, a los
    //    10 minutos vuelven a 'nuevo'.
    await cob('comprobantes_vendedor?estado=eq.leyendo&leyendo_desde=lt.' + new Date(Date.now() - 10 * 60000).toISOString(), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'nuevo' }) });
    const cola = await leer('comprobantes_vendedor?select=id&estado=eq.nuevo&order=recibido_at.asc&limit=24');
    let nuevos = [];
    if (cola.length) {
      const rr = await cob('comprobantes_vendedor?estado=eq.nuevo&id=in.(' + cola.map(x => x.id).join(',') + ')', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ estado: 'leyendo', leyendo_desde: new Date().toISOString() }) });
      nuevos = await rr.json().catch(() => []);
      if (!Array.isArray(nuevos)) nuevos = [];
    }
    for (let i = 0; i < nuevos.length && Date.now() - t0 < BUDGET_MS; i += 4) {
      await Promise.all(nuevos.slice(i, i + 4).map(async (c) => {
        try {
          if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');
          const d = await leerConIA(c.url);
          const ok = d.es_comprobante !== false && d.legible !== false && d.monto != null;
          const campos = { ia: d, monto: d.monto, pagador: d.pagador_nombre, pagador_cuit: soloDig(d.pagador_cuit) || null, fecha_pago: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : null, banco: d.banco, nro_operacion: d.nro_operacion, estado: ok ? 'leido' : 'error', nota: ok ? null : (d.es_comprobante === false ? 'No parece un comprobante de pago.' : 'No se lee bien.') };
          await cob('comprobantes_vendedor?id=eq.' + c.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos) });
          Object.assign(c, campos);
          if (!ok && !c.respondido) {
            await responder(c, d.es_comprobante === false
              ? '⚠️ Esto no parece un comprobante de pago, no lo cargué. Si lo es, mandalo de nuevo más claro o en PDF.'
              : '⚠️ No pude leer bien este comprobante. ¿Lo mandás de nuevo más claro o en PDF?');
          }
        } catch (e) {
          const intentos = num(c.intentos) + 1;
          await cob('comprobantes_vendedor?id=eq.' + c.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ intentos, estado: intentos >= 3 ? 'error' : 'nuevo', nota: String((e && e.message) || e).slice(0, 300) }) });
          log.push('error leyendo ' + c.id + ': ' + ((e && e.message) || e));
        }
      }));
    }

    // 2) Enganchar los leídos y los que esperaban su fila (últimos 6 días).
    const desde = new Date(Date.now() - 6 * 864e5).toISOString();
    const pend = await leer('comprobantes_vendedor?estado=in.(leido,sin_asignar)&recibido_at=gte.' + desde + '&order=recibido_at.asc&limit=300');
    const porVend = {};
    pend.forEach(c => { (porVend[c.vendedor] = porVend[c.vendedor] || []).push(c); });
    let asignados = 0, esperando = 0;
    for (const [vend, comps] of Object.entries(porVend)) {
      const dias = comps.map(c => diaAR(c.recibido_at)).sort();
      const filas = await leer('planilla_cobranzas?select=id,codigo,razon_social,fecha_rendicion,importe,' + MEDIOS.join(',') + ',transferencia_detalle,echeq_detalle,cheques_detalle,comprobantes'
        + '&vendedor=eq.' + encodeURIComponent(vend) + '&fecha_rendicion=gte.' + sumaDias(dias[0], -3) + '&fecha_rendicion=lte.' + sumaDias(dias[dias.length - 1], 4));
      const cods = [...new Set(filas.map(f => padCod(f.codigo)).filter(Boolean))];
      const clientes = {};
      if (cods.length) (await leer('cuentas_cubo?select=codigo,nombre,razon_social,cuit&codigo=in.(' + cods.map(x => '"' + x + '"').join(',') + ')')).forEach(x => { clientes[x.codigo] = x; });
      for (const c of comps) {
        const dia = diaAR(c.recibido_at);
        const cand = filas.filter(f => f.fecha_rendicion >= sumaDias(dia, -3) && f.fecha_rendicion <= sumaDias(dia, 4));
        const fila = elegirFila(c, cand, clientes);
        if (fila && await adjuntar(c, fila, 'automático')) {
          asignados++;
          if (!c.respondido) await responder(c, '✓ Comprobante de ' + pesos(c.monto) + (c.pagador ? ' (' + c.pagador + ')' : '') + ' → ' + (fila.razon_social || 'cliente ' + fila.codigo) + ', planilla del ' + ddmm(fila.fecha_rendicion) + '.');
          continue;
        }
        esperando++;
        if (c.estado !== 'sin_asignar') await cob('comprobantes_vendedor?id=eq.' + c.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado: 'sin_asignar' }) });
        if (!c.respondido) await responder(c, '📥 Recibí el comprobante de ' + pesos(c.monto) + (c.pagador ? ' de ' + c.pagador : '') + '. Todavía no lo encuentro en tu planilla: cuando cargues ese cobro se engancha solo (o elegís la fila en "Comprobantes sin asignar" de tu planilla).');
      }
    }
    // Los que pasaron 6 días sin fila quedan sin asignar para siempre (los ve Moni a mano).
    log.push('leídos ' + nuevos.length + ' · enganchados ' + asignados + ' · esperando ' + esperando);
  } catch (e) {
    log.push('error: ' + ((e && e.message) || String(e)));
  }
  console.log('comprobantes-wa:', log.join(' · '), '·', Math.round((Date.now() - t0) / 1000) + 's');
  return { statusCode: 200, body: JSON.stringify({ ok: true, log }) };
};

module.exports.handler = require('./_errores').conErrores('comprobantes-wa-background', module.exports.handler);
