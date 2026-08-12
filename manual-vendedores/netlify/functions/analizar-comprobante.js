// ============================================================
//  GrandBar Hub · Function · analizar-comprobante
//   Lee un comprobante (imagen o PDF) con Claude (visión) y extrae
//   monto, fecha, banco, titular, N° de operación + señales de edición.
//   Compara el monto detectado contra el declarado y devuelve un veredicto.
//
//   Uso: POST { archivo_url, monto_declarado }
//   Valida la sesión del Hub (rol tesoreria/administracion/admin).
//   Env: ANTHROPIC_API_KEY  (cargar en Netlify, NUNCA en el repo)
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const ROLES_OK = ['tesoreria', 'administracion', 'admin'];
const MODEL    = 'claude-opus-5';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return json(500, { error: 'Falta ANTHROPIC_API_KEY en Netlify.' });

    // --- Auth: token del Hub + rol autorizado ---
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const pRes = await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    const rol = String(((await pRes.json())[0] || {}).rol || '').toLowerCase();
    if (!ROLES_OK.includes(rol)) return json(403, { error: 'No autorizado.' });

    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
    if (!b.archivo_url) return json(400, { error: 'Falta archivo_url' });
    const montoDeclarado = b.monto_declarado != null ? Number(b.monto_declarado) : null;

    // --- Bajar el comprobante y pasarlo a base64 ---
    const fRes = await fetch(b.archivo_url);
    if (!fRes.ok) return json(502, { error: 'No pude descargar el comprobante (' + fRes.status + ')' });
    let mime = (fRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const buf = Buffer.from(await fRes.arrayBuffer());
    const b64 = buf.toString('base64');
    if (!mime || mime === 'application/octet-stream') {
      const u = b.archivo_url.toLowerCase();
      mime = u.endsWith('.pdf') ? 'application/pdf' : u.endsWith('.png') ? 'image/png' : u.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    }
    const esPdf = mime === 'application/pdf';
    const source = esPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };

    const prompt =
      'Sos un asistente de tesorería. Analizá este comprobante de pago/transferencia bancaria (Argentina) y extraé los datos. ' +
      'Respondé ÚNICAMENTE con un JSON válido (sin texto adicional, sin markdown) con estas claves:\n' +
      '{"legible": boolean, "monto": number|null, "moneda": string|null, "fecha": string|null, ' +
      '"banco": string|null, "titular_o_destinatario": string|null, "nro_operacion": string|null, ' +
      '"tipo": string|null, "senales_edicion": string[], "observacion": string|null}\n' +
      '- monto: el importe total transferido, como número sin símbolos ni separadores de miles (ej: 15000.50).\n' +
      '- fecha: en formato YYYY-MM-DD si se puede.\n' +
      '- senales_edicion: lista de indicios de posible manipulación (tipografías inconsistentes, montos superpuestos, bordes recortados, etc.). Vacía si no ves nada raro.\n' +
      '- Si algo no se lee, poné null. No inventes.';

    const body = {
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: [source, { type: 'text', text: prompt }] }],
    };

    const aRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    if (!aRes.ok) return json(502, { error: 'Error de la IA: ' + (await aRes.text()).slice(0, 200) });
    const out = await aRes.json();
    const txt = (out.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();

    let datos = null;
    try { datos = JSON.parse(txt); } catch (e) {
      const m = txt.match(/\{[\s\S]*\}/); if (m) { try { datos = JSON.parse(m[0]); } catch (e2) {} }
    }
    if (!datos) return json(200, { ok: true, datos: null, crudo: txt.slice(0, 500), coincide: null, alertas: ['No pude interpretar el comprobante.'] });

    // --- Comparación de montos ---
    const montoDetectado = datos.monto != null ? Number(datos.monto) : null;
    let coincide = null, diferencia = null;
    if (montoDetectado != null && montoDeclarado != null) {
      diferencia = Math.round((montoDeclarado - montoDetectado) * 100) / 100;
      coincide = Math.abs(diferencia) < 1; // tolerancia de $1 por redondeos
    }
    const alertas = [];
    if (datos.legible === false) alertas.push('El comprobante no se lee bien.');
    if (coincide === false) alertas.push(`El comprobante dice $${Math.round(montoDetectado).toLocaleString('es-AR')} pero el monto declarado es $${Math.round(montoDeclarado).toLocaleString('es-AR')}.`);
    if (Array.isArray(datos.senales_edicion) && datos.senales_edicion.length) alertas.push('Posibles señales de edición: ' + datos.senales_edicion.join('; '));

    return json(200, { ok: true, datos, monto_detectado: montoDetectado, monto_declarado: montoDeclarado, coincide, diferencia, alertas });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
