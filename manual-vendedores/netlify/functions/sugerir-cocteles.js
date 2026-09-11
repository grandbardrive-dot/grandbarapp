// ============================================================
//  GrandBar · Function · sugerir-cocteles
//   A partir de un producto (botella/destilado) que el bar ya compra,
//   la IA propone HASTA 2 cócteles vendibles para ofrecer en la carta.
//   Cada propuesta: nombre del trago, medida (ml del destilado),
//   diluyente (mixer o null) y precio sugerido de venta.
//   El costeo por medida lo hace el front con el precio de la botella.
//
//   POST { producto, categoria? }  →  { cocteles: [ {nombre, medida_ml, diluyente, precio_sugerido} ] }
//   Env: ANTHROPIC_API_KEY
// ============================================================

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.IA_MODEL_COCTELES || 'claude-haiku-4-5-20251001';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

function parseJSONArray(texto) {
  let t = String(texto || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { const arr = JSON.parse(t); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return json(500, { error: 'Falta ANTHROPIC_API_KEY' });

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    const producto = String(body.producto || '').trim();
    const categoria = String(body.categoria || '').trim();
    if (!producto) return json(400, { error: 'Falta el producto' });

    const prompt = `Sos un asesor de coctelería para bares. El bar ya compra esta botella:
Producto: "${producto}"${categoria ? `\nCategoría: ${categoria}` : ''}

Proponé COMO MÁXIMO 2 cócteles clásicos y vendibles que se preparen con ESE destilado como base, ideales para sumar a la carta del bar. Elegí tragos conocidos y fáciles de vender.

Devolvé ÚNICAMENTE un JSON array (sin texto antes ni después, sin markdown). Cada objeto con EXACTAMENTE estas claves:
- "nombre": string. Nombre del trago (ej: "Gin Tonic", "Negroni").
- "medida_ml": number. Mililitros del destilado principal que lleva UNA unidad del trago (típico 45; usá 30 o 60 según el trago).
- "diluyente": string o null. El mixer/diluyente con el que se sirve (ej: "Agua tónica", "Jugo de pomelo"). null si el trago no lleva diluyente (ej: Negroni, que es solo destilados).
- "precio_sugerido": number. Precio de venta al público sugerido para ese trago en un bar, en PESOS ARGENTINOS, número redondo y razonable.

Máximo 2 objetos. Si solo hay 1 trago claro, devolvé 1.`;

    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return json(502, { error: 'IA no disponible (' + resp.status + ')', detalle: t.slice(0, 300) });
    }
    const data = await resp.json();
    const texto = (data.content && data.content[0] && data.content[0].text) || '';
    let cocteles = parseJSONArray(texto).slice(0, 2).map(c => ({
      nombre: String(c.nombre || '').trim(),
      medida_ml: Number(c.medida_ml) > 0 ? Math.round(Number(c.medida_ml)) : 45,
      diluyente: c.diluyente ? String(c.diluyente).trim() : null,
      precio_sugerido: Number(c.precio_sugerido) > 0 ? Math.round(Number(c.precio_sugerido)) : null,
    })).filter(c => c.nombre);

    return json(200, { cocteles });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
