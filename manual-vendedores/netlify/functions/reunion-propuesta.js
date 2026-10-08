// ============================================================
//  GrandBar · Function · reunion-propuesta
//   En la Reunión por marca (reunion-marca.html): con el diagnóstico de
//   "cómo venimos" (vs año anterior), la acción vigente y los materiales
//   con stock, la IA propone 3 ACCIONES concretas para proponerle al
//   proveedor. Cada una ya viene con los campos del cuestionario
//   (descuento, tope, sin cargo, ejecución en el PDV, materiales, vigencia,
//   a quién apunta y meta), para "Usar esta" y ajustarla en la reunión.
//
//   POST { marca, rubro, proveedor, diagnostico, vigentes, materiales }
//        → { propuestas: [ { titulo, para_que, a_quien, descuento, sin_cargo,
//            mecanica, tope, ejecucion, materiales[], vigencia_dias, meta, por_que } ] }
//   Los números los pone el sistema (diagnostico); la IA no inventa ventas.
//   Env: ANTHROPIC_API_KEY, IA_MODEL_PROPUESTA (default claude-sonnet-5).
// ============================================================
const { rubroIA } = require('./_rubro-ia');

const URL_IA = 'https://api.anthropic.com/v1/messages';
const MODELO = process.env.IA_MODEL_PROPUESTA || 'claude-sonnet-5';
const RAPIDO = 'claude-haiku-4-5-20251001';   // si el principal tarda, la reunión no espera
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });

function parseArray(texto) {
  let t = String(texto || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { const arr = JSON.parse(t); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
}

async function pedir(key, modelo, prompt, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(URL_IA, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: modelo, max_tokens: 1300, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error('IA ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    return (d.content && d.content[0] && d.content[0].text) || '';
  } finally { clearTimeout(t); }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return json(500, { error: 'Falta ANTHROPIC_API_KEY' });
    let b = {};
    try { b = JSON.parse(event.body || '{}'); } catch (e) {}
    const marca = String(b.marca || '').trim();
    if (!marca) return json(400, { error: 'Falta la marca' });
    const rubro = String(b.rubro || '').trim();
    const R = rubro && rubro !== 'todos' ? rubroIA(rubro) : null;
    const d = b.diagnostico || {};
    const vig = (b.vigentes || []).slice(0, 6);
    const mats = (b.materiales || []).slice(0, 15);

    const prompt = `Sos del equipo Comercial / Trade Marketing de GrandBar, distribuidora de bebidas de Mendoza y San Luis (Argentina). Estás en una reunión con el proveedor ${b.proveedor || ''} hablando de ${marca}${R ? ` en ${R.lugar}` : ' en todos los canales'}.

DIAGNÓSTICO (datos reales del sistema, no los cambies):
${JSON.stringify(d)}

ACCIÓN VIGENTE HOY (catálogo / propuestas del proveedor):
${vig.length ? vig.map((a) => '- ' + a).join('\n') : '- ninguna cargada'}

MATERIALES CON STOCK EN NUESTRO DEPÓSITO para esta marca:
${mats.length ? mats.map((m) => `- ${m.name} (${m.stock_actual} en stock)`).join('\n') : '- ninguno cargado'}

${R ? `Cómo funciona ${R.lugar}: para reactivar un producto conviene ${R.rotar}. Activaciones típicas: ${R.activar}.${R.off ? ' Es venta para llevar: nada de tragos, barra ni bartender.' : ''}` : ''}

Tarea: proponé 3 ACCIONES distintas para presentarle al proveedor que ataquen el problema concreto del diagnóstico (la línea que cae, los clientes que dejaron de comprar, el rubro flojo) o que aprovechen lo que crece. Mecánicas habituales de GrandBar: producto sin cargo (5+1, 3+1, 8+1), % adicional sobre lista, combos, incorporación en carta, degustación, exhibición/puntera, torneo de vendedores. Siempre con tope (por PDV o cajas totales). Materiales: usá solo los de la lista; si hace falta otro, escribilo como "pedir al proveedor: …". REGLAS DE NÚMEROS: usá EXACTAMENTE los números del diagnóstico y no inventes otros (ni cantidades de clientes, ni botellas, ni "bares grandes"). "dejaron_de_comprar.cantidad" son clientes que dejaron de comprar la MARCA (cualquier línea), no una línea en particular: no digas que dejaron de comprar una línea específica. Si una línea crece (variacion_pct positiva) no la llames "salvataje" ni "recuperación": es aprovechar el envión. La meta tiene que ser concreta pero razonable respecto del diagnóstico.

Devolvé ÚNICAMENTE un JSON array de 3 objetos, en español rioplatense, cada uno con estas claves:
"titulo" (corto), "para_que" (qué problema ataca, 1 oración con el dato), "a_quien" (qué clientes, con el dato del diagnóstico: ej. "los clientes que dejaron de comprar la marca" o "los clientes nuevos"), "mecanica" (ej. "5+1" o "20% adicional"), "sin_cargo" (true/false), "descuento" (texto o ""), "tope" (texto), "ejecucion" (cómo se ejecuta en el punto de venta y qué evidencia se pide, 1-2 oraciones), "materiales" (array de strings), "vigencia_dias" (número), "meta" (1 oración medible), "por_que" (1 oración: por qué esta y no otra).
Cada valor de texto: máximo 25 palabras. Sin texto antes ni después, sin markdown.`;

    // Los dos a la vez: si el principal termina a tiempo se usa ese; si no, el rápido
    // (que ya está listo). Así la reunión nunca espera más de ~25 s.
    const pPrincipal = pedir(key, MODELO, prompt, 24000);
    const pRapido = pedir(key, RAPIDO, prompt, 24000);
    pRapido.catch(() => {});
    let texto, modelo = MODELO, motivo = null;
    try { texto = await pPrincipal; if (!parseArray(texto).length) throw new Error('respuesta vacía'); }
    catch (e) { motivo = (e && e.message) || String(e); modelo = RAPIDO; texto = await pRapido; }
    const propuestas = parseArray(texto).slice(0, 3).map((p) => ({
      titulo: String(p.titulo || '').trim(), para_que: String(p.para_que || '').trim(), a_quien: String(p.a_quien || '').trim(),
      mecanica: String(p.mecanica || '').trim(), sin_cargo: !!p.sin_cargo, descuento: String(p.descuento || '').trim(), tope: String(p.tope || '').trim(),
      ejecucion: String(p.ejecucion || '').trim(), materiales: Array.isArray(p.materiales) ? p.materiales.map(String) : [],
      vigencia_dias: Number(p.vigencia_dias) || 30, meta: String(p.meta || '').trim(), por_que: String(p.por_que || '').trim(),
    })).filter((p) => p.titulo);
    if (!propuestas.length) return json(502, { error: 'La IA no devolvió propuestas válidas', modelo });
    return json(200, { propuestas, modelo, ...(motivo ? { motivo_respaldo: motivo.slice(0, 200) } : {}) });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
