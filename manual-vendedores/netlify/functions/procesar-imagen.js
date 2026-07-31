// ─────────────────────────────────────────────────────────────────────────────
// Netlify Function: procesar-imagen
// Recibe la URL de la foto ORIGINAL (ya subida a Supabase Storage), la manda a
// Photoroom (fondo blanco tipo estudio + sombra suave, sin alterar el objeto),
// sube la imagen PROCESADA a Supabase Storage y devuelve su URL pública.
//
// La API key de Photoroom vive SOLO acá (variable de entorno en Netlify),
// nunca en el frontend.
//
// Env vars (Netlify → Site settings → Environment variables):
//   PHOTOROOM_API_KEY   (obligatoria)  → tu clave de Photoroom
//   SUPABASE_URL        (opcional)     → default al proyecto de GrandBar
//   SUPABASE_ANON_KEY   (opcional)     → default a la anon key pública
// ─────────────────────────────────────────────────────────────────────────────

// v2 · redeploy para tomar PHOTOROOM_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fzaxwuuodseyyinveknn.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk';
const BUCKET = 'Activaciones';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  const apiKey = process.env.PHOTOROOM_API_KEY;
  if (!apiKey) return json(500, { error: 'Falta configurar PHOTOROOM_API_KEY en Netlify.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido.' }); }
  const imageUrl = body.image_url;
  if (!imageUrl) return json(400, { error: 'Falta image_url.' });

  try {
    // 1) Photoroom v2 edit — foto producto: fondo blanco + sombra suave, centrado.
    const params = new URLSearchParams({
      imageUrl,
      removeBackground: 'true',
      'background.color': 'FFFFFF',
      'shadow.mode': 'ai.soft',
      padding: '0.08',
      outputSize: '1500x1500',
      'export.format': 'png',
    });
    const prResp = await fetch('https://image-api.photoroom.com/v2/edit?' + params.toString(), {
      method: 'GET',
      headers: { 'x-api-key': apiKey, Accept: 'image/png,application/json' },
    });

    if (!prResp.ok) {
      const detail = await safeText(prResp);
      return json(502, { error: `Photoroom respondió ${prResp.status}`, detail: detail.slice(0, 400) });
    }

    const buf = Buffer.from(await prResp.arrayBuffer());
    if (!buf.length) return json(502, { error: 'Photoroom devolvió una imagen vacía.' });

    // 2) Subir la procesada a Supabase Storage.
    const path = `materiales/procesadas/${Date.now()}-${Math.floor(Math.random() * 99999)}.png`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: buf,
    });
    if (!up.ok) {
      const detail = await safeText(up);
      return json(502, { error: `No se pudo guardar la imagen procesada (${up.status})`, detail: detail.slice(0, 400) });
    }

    const processedUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    return json(200, { processed_url: processedUrl, provider: 'photoroom-v2', status: 'completed' });
  } catch (e) {
    return json(500, { error: 'Error procesando la imagen', detail: String(e && e.message || e).slice(0, 400) });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
async function safeText(resp) { try { return await resp.text(); } catch { return ''; } }
