// ─────────────────────────────────────────────────────────────────────────────
// Netlify Function: sugerir-accion
// Dado un proveedor y sus materiales POP disponibles, la IA sugiere una idea
// concreta y breve de acción/activación comercial para el punto de venta.
// Usa ANTHROPIC_API_KEY (ya cargada en Netlify). La clave nunca va al frontend.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = 'claude-haiku-4-5-20251001';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: 'Falta ANTHROPIC_API_KEY en Netlify.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido.' }); }

  const proveedor = (body.proveedor || '').toString().slice(0, 80);
  const materiales = Array.isArray(body.materiales) ? body.materiales.slice(0, 20) : [];
  const canal = (body.canal || '').toString().slice(0, 60);
  if (!materiales.length) return json(400, { error: 'Faltan materiales.' });

  // ── On-trade vs Off-trade ────────────────────────────────────────────────
  // La activación NO es la misma según dónde se consume el producto.
  const ON  = ['on','on-trade','ontrade','bar','bares','restaurante','restaurantes','hotel','hoteles','disco','discos','discotecas','boliche','evento','eventos','catering'];
  const OFF = ['off','off-trade','offtrade','vinoteca','vinotecas','autoservicio','autoservicios','kiosco','kioscos','almacen','almacén','mayorista','mayoristas','mayorista_mendoza','mayorista_sanluis','supermercado','super'];
  const norm = s => (s || '').toString().toLowerCase().trim();
  const trade = ['on', 'off'].includes(norm(body.trade))
    ? norm(body.trade)
    : (ON.some(k => norm(canal).includes(k)) ? 'on'
      : OFF.some(k => norm(canal).includes(k)) ? 'off' : '');

  const GUIA = {
    on:
`El local es ON-TRADE (consumo en el lugar: bar, restaurante, hotel, disco, evento). El cliente toma el trago ahí.
Enfocá la idea en: venta por copa/trago, carta o pizarra de cócteles de la marca, exhibición y ambientación en la barra o mesas, capacitación/incentivo al bartender o mozo, cócteles de autor. NO propongas exhibición en góndola ni "llevar botella".`,
    off:
`El local es OFF-TRADE (compra para llevar: vinoteca, autoservicio, mayorista, kiosco). El cliente se lleva la botella para consumir en otro lado.
Enfocá la idea en: exhibición en góndola/vidriera/isla, visibilidad y precio en el lineal, degustación puntual para gatillar la compra, combos y promociones de llevar, material POP en el punto de venta. NO propongas venta por copa ni consumo en el local.`,
  };

  const lista = materiales
    .map(m => (typeof m === 'string' ? m : `${m.nombre || ''}${m.linea ? ' (' + m.linea + ')' : ''}${m.stock != null ? ' — ' + m.stock + ' u.' : ''}`))
    .filter(Boolean).join('; ');

  const prompt =
`Sos experto en trade marketing de bebidas (vinos y spirits) para puntos de venta en Argentina.
Proveedor: ${proveedor || 'varios'}.
${canal ? `Canal / tipo de local: ${canal}.` : ''}
${trade ? GUIA[trade] : 'No se especificó el canal: proponé una idea que funcione y aclarala si aplica a on-trade o off-trade.'}
Materiales POP disponibles en el depósito: ${lista}.

Sugerí UNA idea concreta y accionable de activación comercial, COHERENTE con el tipo de canal indicado arriba, usando esos materiales.
Requisitos: máximo 2 frases, en español rioplatense, directo y práctico, sin introducción ni saludo, sin markdown. Empezá directo con la idea.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 220,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const detail = await safeText(resp);
      return json(502, { error: `IA respondió ${resp.status}`, detail: detail.slice(0, 300) });
    }
    const data = await resp.json();
    const idea = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
    if (!idea) return json(502, { error: 'La IA no devolvió texto.' });
    return json(200, { idea });
  } catch (e) {
    return json(500, { error: 'Error generando la idea', detail: String(e && e.message || e).slice(0, 300) });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
async function safeText(resp) { try { return await resp.text(); } catch { return ''; } }
