// ============================================================
//  GrandBar · Function · sugerir-rotacion
//   Un producto que el cliente compró pero dejó de rotar. La IA
//   sugiere una ACCIÓN comercial para reactivarlo (no necesariamente
//   venderle otra caja): sumarlo a un trago, darle visibilidad,
//   una activación, etc.
//
//   POST { producto, dias_sin_comprar?, motivo? }  →  { sugerencia: "..." }
//   Env: ANTHROPIC_API_KEY
// ============================================================

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.IA_MODEL_ROTACION || 'claude-haiku-4-5-20251001';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return json(500, { error: 'Falta ANTHROPIC_API_KEY' });

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    const producto = String(body.producto || '').trim();
    const dias = Number(body.dias_sin_comprar) || null;
    const motivo = String(body.motivo || '').trim();
    if (!producto) return json(400, { error: 'Falta el producto' });

    const prompt = `Sos un asesor comercial de GrandBar (distribuidora de bebidas) que ayuda al vendedor en la visita a un BAR.

El bar compró este producto pero dejó de rotarlo (baja salida):
Producto: "${producto}"${dias ? `\nSin comprar hace: ${dias} días` : ''}${motivo ? `\nMotivo que marcó el vendedor: ${motivo}` : ''}

Dale al vendedor UNA sugerencia de ACCIÓN para REACTIVAR la rotación de ese producto en el bar. La idea NO es venderle otra caja, sino que el producto empiece a salir de nuevo: sumarlo a un trago de la carta, darle visibilidad en la barra, una activación/promo, capacitación al bartender, combos, etc.

Respondé en español rioplatense, en 2 o 3 oraciones cortas, concreto y accionable, sin títulos ni listas ni markdown. Empezá directo con la sugerencia.`;

    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return json(502, { error: 'IA no disponible (' + resp.status + ')', detalle: t.slice(0, 300) });
    }
    const data = await resp.json();
    const sugerencia = ((data.content && data.content[0] && data.content[0].text) || '').trim();
    return json(200, { sugerencia });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
