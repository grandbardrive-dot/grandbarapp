// ============================================================
// Netlify BACKGROUND Function: analizar-carta-background
// (el sufijo "-background" hace que Netlify la corra en segundo plano,
//  hasta 15 min, sin el límite de 10s de las funciones normales → no más 504)
//
// Flujo: recibe { cliente_id, foto_urls }, responde 202 al instante,
// procesa las fotos con Claude (visión) y escribe el resultado en Supabase
// (cartas_cliente.productos_extraidos + estado_extraccion). El front consulta
// (polling) hasta que estado_extraccion pase a 'procesado' o 'error'.
//
// La API key se lee de process.env.ANTHROPIC_API_KEY (NUNCA en el front).
// Sin dependencias: fetch nativo de Node 18+.
// ============================================================

// ── Modelo de IA con visión (cambialo acá si querés) ─────────────────────────
const MODELO = 'claude-sonnet-4-6';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 8192;

// Supabase — credenciales PÚBLICAS (mismas que _config.js; la anon/publishable
// key ya es pública, no es un secreto). Se usan para escribir el resultado.
const SUPABASE_URL = 'https://fzaxwuuodseyyinveknn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';

const PROMPT = `Sos un asistente que lee la carta/menú de un restaurante a partir de fotos y extrae los productos de bebidas (vinos, espumantes, gin, whisky, cerveza, aperitivos, café y otros).

Devolvé ÚNICAMENTE un JSON válido: un array de objetos, sin ningún texto antes ni después, sin explicaciones, sin markdown.

Cada objeto del array debe tener exactamente estas claves:
- "nombre": string. El nombre del producto tal como lo entendés (ej: "Luigi Bosca Malbec").
- "marca": string o null. La marca/bodega si se distingue; null si no se puede determinar.
- "categoria": string. Uno de: "vino", "espumante", "gin", "whisky", "cerveza", "aperitivo", "café", "otro".
- "origen_texto": string. El texto tal cual aparece en la carta para ese producto.

Reglas importantes:
- NO inventes productos que no estén en la carta. Si una foto está borrosa o no se lee, omití lo que no puedas leer.
- Si hay varias fotos (varias páginas), combiná todo en un solo array.
- Enfocate en bebidas. Si la carta tiene comida, ignorala.
- Si no detectás ningún producto, devolvé un array vacío: [].`;

// Parseo robusto: tolera ```json ... ```, texto alrededor, etc.
function parsearProductos(texto) {
  let t = String(texto || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const ini = t.indexOf('[');
  const fin = t.lastIndexOf(']');
  if (ini !== -1 && fin !== -1 && fin > ini) t = t.slice(ini, fin + 1);
  const parsed = JSON.parse(t);
  if (!Array.isArray(parsed)) throw new Error('La respuesta no es un array');
  return parsed;
}

// Upsert del resultado en analisis_carta (un registro por cliente_id) vía REST
async function actualizarCarta(clienteId, campos) {
  await fetch(`${SUPABASE_URL}/rest/v1/analisis_carta?on_conflict=cliente_id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      // merge-duplicates = si ya existe la fila de ese cliente, la actualiza
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ cliente_id: clienteId, actualizado_en: new Date().toISOString(), ...campos }),
  });
}

exports.handler = async (event) => {
  // Background functions: Netlify ya respondió 202; acá solo hacemos el trabajo.
  let clienteId = null;
  let fotoUrls = [];
  try {
    const body = JSON.parse(event.body || '{}');
    clienteId = body.cliente_id || null;
    fotoUrls = (body.foto_urls || []).filter(u => typeof u === 'string' && u.trim());
  } catch {
    return;
  }
  if (!clienteId || fotoUrls.length === 0) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await actualizarCarta(clienteId, { estado_extraccion: 'error' });
    return;
  }

  try {
    const content = [
      ...fotoUrls.map(url => ({ type: 'image', source: { type: 'url', url } })),
      { type: 'text', text: PROMPT },
    ];

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!res.ok) {
      await actualizarCarta(clienteId, { estado_extraccion: 'error' });
      return;
    }

    const data = await res.json();
    const texto = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const productos = parsearProductos(texto); // lanza si el JSON viene mal

    const limpios = productos
      .filter(p => p && (p.nombre || p.origen_texto))
      .map(p => ({
        nombre: String(p.nombre || p.origen_texto || '').trim(),
        marca: p.marca != null && String(p.marca).trim() ? String(p.marca).trim() : null,
        categoria: String(p.categoria || 'otro').trim().toLowerCase(),
        origen_texto: String(p.origen_texto || p.nombre || '').trim(),
      }))
      .filter(p => p.nombre);

    // 'procesado' = la IA terminó, falta la revisión humana ('listo' lo pone el vendedor al guardar)
    await actualizarCarta(clienteId, {
      productos_extraidos: limpios,
      estado_extraccion: 'procesado',
    });
  } catch (e) {
    await actualizarCarta(clienteId, { estado_extraccion: 'error' });
  }
};
