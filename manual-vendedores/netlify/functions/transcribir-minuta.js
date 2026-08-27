// ============================================================
//  GrandBar Hub · Function · transcribir-minuta
//   Recibe la URL de un audio (subido a Storage), lo transcribe con AssemblyAI
//   (async, aguanta reuniones largas) y con Claude lo arma en una minuta:
//   { temas[], pendientes[], notas }.
//   Flujo: accion 'start' → devuelve id ; accion 'estado' → procesando | listo.
//   Env: ASSEMBLYAI_API_KEY, ANTHROPIC_API_KEY (opcional IA_MODEL), HUB auth.
// ============================================================
const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const MODEL = process.env.IA_MODEL || 'claude-haiku-4-5-20251001'; // rápido: entra en el límite de tiempo de la función
const AAI = 'https://api.assemblyai.com/v2/transcript';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

const SYS = `Sos un asistente que arma la minuta de una reunión de trabajo de GrandBar (distribuidora de bebidas) a partir de la transcripción (puede tener errores de dictado). Extraé y ordená lo importante. Respondé ÚNICAMENTE con un JSON válido, sin texto antes ni después:
{
  "temas": ["cada tema o punto hablado, en una frase clara"],
  "pendientes": ["cada tarea o pendiente para la próxima reunión, con responsable si se menciona"],
  "notas": "acuerdos, decisiones u observaciones importantes en un párrafo corto (o vacío)"
}
Sé conciso y fiel a lo que se dijo; no inventes.`;

const SYS_RESUMEN = `Sos un asistente que arma un RESUMEN visual, claro y "copado" de una reunión de trabajo de GrandBar (distribuidora de bebidas), a partir de la transcripción.

Generá un bloque HTML AUTOCONTENIDO (solo estilos inline; NADA de <script>, sin recursos externos, sin <html>/<head>/<body>). Que se lea lindo en el celular. Estructura sugerida (usá solo las secciones que apliquen):
- Un encabezado con el título y una frase de "resumen ejecutivo" (2 a 4 frases).
- "Temas clave": cada uno con una línea de contexto.
- "Decisiones": lo que se resolvió.
- "Acciones / pendientes": una <table> con Tarea · Responsable · Para cuándo (si se mencionan).
- "Próximos pasos".
- Si hay algo cuantificable (metas, %, cantidades, comparaciones), sumá un mini-gráfico simple: barras hechas con <div> de ancho proporcional, o un <svg> chico. Que aporte, no de relleno.

Paleta sobria: azul #1f447f, dorado #c0912f, verde #2f8f6e, gris #6d7d85, fondos suaves. Títulos en negrita, buen espaciado, bordes redondeados. No inventes datos que no estén. Respondé SOLO el HTML, sin explicaciones ni comillas triples.`;

async function claudeMinuta(transcript) {
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return null;
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1600, system: SYS, messages: [{ role: 'user', content: 'Transcripción de la reunión:\n\n' + transcript.slice(0, 40000) }] }),
  });
  const data = await resp.json().catch(() => ({}));
  let txt = (data.content && data.content[0] && data.content[0].text) || '';
  txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(txt); } catch (e) { const m = txt.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e2) {} } }
  return { temas: [], pendientes: [], notas: txt.slice(0, 800) };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
    const AKEY = process.env.ASSEMBLYAI_API_KEY;
    if (!AKEY) return json(503, { error: 'Falta ASSEMBLYAI_API_KEY en Netlify.' });

    // auth: cualquier usuario logueado del Hub
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });

    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}

    if (b.accion === 'start') {
      if (!b.audio_url) return json(400, { error: 'Falta audio_url.' });
      const r = await fetch(AAI, { method: 'POST', headers: { authorization: AKEY, 'content-type': 'application/json' }, body: JSON.stringify({ audio_url: b.audio_url, language_code: 'es' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.id) return json(502, { error: 'No pude iniciar la transcripción: ' + (d.error || r.status) });
      return json(200, { ok: true, id: d.id });
    }

    if (b.accion === 'estado') {
      if (!b.id) return json(400, { error: 'Falta id.' });
      const r = await fetch(AAI + '/' + encodeURIComponent(b.id), { headers: { authorization: AKEY } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json(502, { error: 'No pude consultar el estado.' });
      if (d.status === 'error') return json(200, { ok: false, error: 'La transcripción falló: ' + (d.error || '') });
      if (d.status !== 'completed') return json(200, { ok: true, estado: 'procesando' });
      const transcript = d.text || '';
      if (!transcript.trim()) return json(200, { ok: true, estado: 'listo', minuta: { temas: [], pendientes: [], notas: '' }, transcript: '' });
      const minuta = await claudeMinuta(transcript) || { temas: [], pendientes: [], notas: '' };
      return json(200, { ok: true, estado: 'listo', minuta, transcript });
    }

    if (b.accion === 'resumen') {
      const KEY = process.env.ANTHROPIC_API_KEY;
      if (!KEY) return json(503, { error: 'Falta ANTHROPIC_API_KEY.' });
      const transcript = String(b.transcript || '').trim();
      const temas = Array.isArray(b.temas) ? b.temas : [];
      const pend = Array.isArray(b.pendientes) ? b.pendientes : [];
      if (!transcript && !temas.length) return json(400, { error: 'No hay contenido para resumir.' });
      const userMsg = 'Reunión: ' + (b.titulo || '(sin título)') + '\n\n'
        + (transcript ? 'TRANSCRIPCIÓN:\n' + transcript.slice(0, 40000) : 'PUNTOS:\nTemas: ' + temas.join('; ') + '\nPendientes: ' + pend.join('; '));
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1600, system: SYS_RESUMEN, messages: [{ role: 'user', content: userMsg }] }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return json(502, { error: 'Error de la IA: ' + ((data.error && data.error.message) || resp.status) });
      let html = (data.content && data.content[0] && data.content[0].text) || '';
      html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '').replace(/javascript:/gi, '');
      return json(200, { ok: true, html });
    }

    return json(400, { error: 'Acción inválida' });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
