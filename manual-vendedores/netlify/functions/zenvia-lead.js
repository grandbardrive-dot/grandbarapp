// ============================================================
//  GrandBar Hub · Function · zenvia-lead  (WEBHOOK público de Zenvia)
//   Zenvia Sales/Conversion hace POST acá cuando entra un lead nuevo.
//   URL a cargar en Zenvia:  https://portalgrandbar.com/.netlify/functions/zenvia-lead?key=SECRETO
//   Env: HUB_SERVICE_ROLE, ZENVIA_WEBHOOK_SECRET
// ============================================================

const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }; }
// Busca el primer valor no vacío probando varias claves (case-insensitive, anidado 1 nivel).
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  const flat = {};
  for (const k in obj) { flat[k.toLowerCase()] = obj[k]; if (obj[k] && typeof obj[k] === 'object') for (const j in obj[k]) flat[(k + '.' + j).toLowerCase()] = obj[k][j]; }
  for (const key of keys) { const v = flat[key.toLowerCase()]; if (v != null && String(v).trim() !== '') return v; }
  return null;
}

exports.handler = async (event) => {
  try {
    const srole = process.env.HUB_SERVICE_ROLE;
    if (!srole) return json(500, { error: 'config' });
    const secret = process.env.ZENVIA_WEBHOOK_SECRET;
    const qp = event.queryStringParameters || {};
    // Validación por secreto (query ?key= o header x-webhook-secret)
    if (secret) {
      const provisto = qp.key || event.headers['x-webhook-secret'] || event.headers['X-Webhook-Secret'];
      if (provisto !== secret) return json(401, { error: 'unauthorized' });
    }
    if (event.httpMethod !== 'POST') return json(200, { ok: true, ping: true });

    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    // Zenvia puede envolver el lead en distintos niveles
    const lead = body.lead || body.prospect || body.contact || body.data || body;

    const nombre = pick(lead, ['name', 'nombre', 'nome', 'fullname', 'full_name', 'contact.name']);
    const telefono = pick(lead, ['phone', 'telefono', 'telefone', 'celular', 'mobile', 'whatsapp', 'contact.phone']);
    const email = pick(lead, ['email', 'correo', 'e-mail', 'contact.email']);
    const origen = pick(lead, ['origin', 'origen', 'source', 'fonte', 'utm_source']) || 'zenvia';
    const zona = pick(lead, ['zona', 'zone', 'region', 'ciudad', 'city', 'provincia']);
    const canal = pick(lead, ['canal', 'channel', 'tipo', 'segment']);
    const mensaje = pick(lead, ['message', 'mensaje', 'mensagem', 'comment', 'comentario', 'observacion', 'observaciones', 'nota']);
    const zenviaId = pick(lead, ['id', 'lead_id', 'leadid', 'prospect_id', 'external_id']);

    if (!nombre && !telefono && !email) return json(200, { ok: true, ignored: 'sin datos de contacto' });

    const fila = {
      nombre: nombre ? String(nombre) : null, telefono: telefono ? String(telefono) : null, email: email ? String(email) : null,
      origen: String(origen), zona: zona ? String(zona) : null, canal: canal ? String(canal) : null,
      mensaje: mensaje ? String(mensaje) : null, estado: 'nuevo', zenvia_id: zenviaId ? String(zenviaId) : null, raw: body,
    };

    const path = fila.zenvia_id ? 'leads?on_conflict=zenvia_id' : 'leads';
    const prefer = fila.zenvia_id ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal';
    const r = await fetch(HUB_URL + '/rest/v1/' + path, {
      method: 'POST', headers: { apikey: srole, Authorization: 'Bearer ' + srole, 'Content-Type': 'application/json', Prefer: prefer },
      body: JSON.stringify(fila),
    });
    if (!r.ok) return json(502, { error: 'no guardado', detalle: (await r.text()).slice(0, 200) });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
