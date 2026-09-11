// ============================================================
//  GrandBar · Function · sugerir-activacion
//   Para una FECHA del bar (aniversario, show, happy hour…), la IA
//   sugiere 1 o 2 ideas de activación concretas con los productos que
//   el bar ya trabaja. Corto y accionable, no un listado largo.
//
//   POST { fecha, tipo_fecha, tipo_bar, producto, tipos_accion }
//        → { ideas: ["...", "..."] }
//   Env: ANTHROPIC_API_KEY
// ============================================================

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.IA_MODEL_ACTIVACION || 'claude-haiku-4-5-20251001';

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
    const fecha = String(body.fecha || '').trim();
    const tipoFecha = String(body.tipo_fecha || '').trim();
    const producto = String(body.producto || '').trim();
    const tiposAccion = Array.isArray(body.tipos_accion) ? body.tipos_accion.filter(Boolean) : [];
    if (!fecha && !tipoFecha) return json(400, { error: 'Falta la fecha' });

    const prompt = `Sos del equipo de Trade Marketing de GrandBar (distribuidora de bebidas) ayudando al vendedor en la visita a un BAR.

El bar tiene esta oportunidad:
- Fecha/evento: "${fecha || tipoFecha}"${tipoFecha ? `\n- Tipo de fecha: ${tipoFecha}` : ''}${producto ? `\n- Producto/marca a impulsar: ${producto}` : ''}${tiposAccion.length ? `\n- Tipo(s) de acción que piensa el vendedor: ${tiposAccion.join(', ')}` : ''}

Proponé 1 o 2 ideas de ACTIVACIÓN concretas y realizables para esa fecha, pensadas para que el CONSUMIDOR pida el producto y rote en el bar (trago especial en la carta, happy hour, combo, degustación, presencia de marca, materiales). Nada genérico, nada de listas largas.

Devolvé ÚNICAMENTE un JSON array de 1 o 2 strings (cada string una idea de 1-2 oraciones, español rioplatense, concreta). Sin texto antes ni después, sin markdown.`;

    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return json(502, { error: 'IA no disponible (' + resp.status + ')', detalle: t.slice(0, 300) });
    }
    const data = await resp.json();
    const texto = (data.content && data.content[0] && data.content[0].text) || '';
    const ideas = parseJSONArray(texto).map(x => String(x || '').trim()).filter(Boolean).slice(0, 2);
    return json(200, { ideas });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
