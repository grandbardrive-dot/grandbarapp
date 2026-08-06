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
  if (!apiKey) return json(500, {
    error: 'Falta ANTHROPIC_API_KEY en Netlify.',
    site: process.env.SITE_NAME || null,
    customKeys: Object.keys(process.env).filter(k => !/^(AWS|LAMBDA|_|PATH|NODE|TZ|LANG|LD_|NETLIFY|SITE_|DEPLOY|URL|COMMIT|BRANCH|HOME|PWD|SHLVL|CONTEXT|BUILD_)/i.test(k)).sort(),
  });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido.' }); }

  const proveedor = (body.proveedor || '').toString().slice(0, 80);
  const materiales = Array.isArray(body.materiales) ? body.materiales.slice(0, 20) : [];
  const canal = (body.canal || '').toString().slice(0, 40);
  if (!materiales.length) return json(400, { error: 'Faltan materiales.' });

  const lista = materiales
    .map(m => (typeof m === 'string' ? m : `${m.nombre || ''}${m.linea ? ' (' + m.linea + ')' : ''}${m.stock != null ? ' — ' + m.stock + ' u.' : ''}`))
    .filter(Boolean).join('; ');

  const prompt =
`Sos experto en trade marketing de bebidas (vinos y spirits) para puntos de venta en Argentina.
Proveedor: ${proveedor || 'varios'}.
${canal ? `Canal / tipo de local: ${canal}.` : ''}
Materiales POP disponibles en el depósito: ${lista}.

Sugerí UNA idea concreta y accionable de activación comercial en el punto de venta usando esos materiales.
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
