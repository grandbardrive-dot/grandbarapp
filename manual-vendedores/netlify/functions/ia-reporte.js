// ============================================================
//  GrandBar Hub · Function · ia-reporte
//  Fernando (Dirección) revisa un reporte y pide a la IA estrategias
//  concretas para llegar al objetivo. Toma el contenido del reporte,
//  se lo pasa a Claude con la mecánica del plan 11T de Peñaflor cargada,
//  y devuelve diagnóstico + plan de acción priorizado.
//  Solo Dirección. Env: HUB_SERVICE_ROLE, ANTHROPIC_API_KEY (opcional IA_MODEL).
// ============================================================

const HUB_URL  = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';
const HUB_ANON = 'sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc';
const DIR_ROLES = ['direccion', 'admin', 'duenio'];
const MODEL = process.env.IA_MODEL || 'claude-sonnet-5';

function json(s, b) { return { statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) }; }

const SYS = `Sos un asesor comercial senior de GrandBar Distribuciones (distribuidora de bebidas: vinos, espumantes, destilados y cervezas). Fernando, de Dirección, está revisando un reporte y necesita estrategias CONCRETAS, realistas y accionables para llegar al objetivo en lo que queda del período.

Si el reporte es del Plan 11T de Peñaflor, tené en cuenta su mecánica:
- Es un plan de incorporación/rotación de líneas de Peñaflor en los puntos de venta.
- "Real" = clientes DISTINTOS que compraron al menos un producto de esa línea en el mes. "Objetivo" = cantidad de clientes con compra a alcanzar (meta de EQUIPO). "Faltan" = objetivo - real.
- Canales: OFF = Vinotecas y Tienda de Bebidas (incentivo 1+1); ON = On Premise (Restaurantes/Hoteles) y On Premise Noche (Bares/Discos) (incentivo 1+2). La rotación del mes fue 5+1.
- Condición del beneficio: el punto de venta NO debe haber comprado esa línea en los últimos 6 meses (es una incorporación, no una recompra).
- El objetivo se mide por canal y por línea comercial.

Analizá los números del reporte y armá un plan priorizado: identificá dónde está el mayor gap (canal/línea con más "faltan"), qué atacar primero, cómo mover a los vendedores rezagados apoyándose en los que van mejor, y acciones comerciales concretas (foco en PDV que todavía no tienen la línea, combos por varietal, argumentario, capacitación exprés, seguimiento diario). Sé específico y usá los números del reporte. No inventes datos que no estén.

Respondé ÚNICAMENTE con un JSON válido (sin texto antes ni después, sin bloques de código), con esta forma exacta:
{
  "diagnostico": "2 a 3 frases sobre la situación y el principal problema",
  "acciones": [
    {"titulo": "acción concreta y corta", "detalle": "cómo ejecutarla, con números del reporte", "area": "canal o vendedor al que aplica", "prioridad": "alta|media|baja"}
  ],
  "foco": "la acción #1 de esta semana, en una sola frase"
}
Devolvé entre 4 y 6 acciones, ordenadas de mayor a menor prioridad.`;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
    const KEY = process.env.ANTHROPIC_API_KEY;
    if (!KEY) return json(503, { error: 'Falta cargar ANTHROPIC_API_KEY en Netlify (Site settings → Environment variables).' });

    // ---- Auth: solo Dirección ----
    const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'Sin sesión' });
    const uRes = await fetch(HUB_URL + '/auth/v1/user', { headers: { apikey: HUB_ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return json(401, { error: 'Sesión inválida' });
    const user = await uRes.json();
    const srole = process.env.HUB_SERVICE_ROLE;
    if (srole) {
      const perfil = (await (await fetch(HUB_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id) + '&select=rol', { headers: { apikey: srole, Authorization: 'Bearer ' + srole } })).json())[0] || {};
      if (!DIR_ROLES.includes(String(perfil.rol || '').toLowerCase())) return json(403, { error: 'Solo Dirección puede pedir sugerencias.' });
    }

    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
    const contenido = String(b.contenido || '').trim();
    if (!contenido) return json(400, { error: 'El reporte no tiene texto para analizar.' });

    const userMsg = `REPORTE A ANALIZAR
Título: ${b.titulo || '(sin título)'}
Área: ${b.area || '—'} · Tipo: ${b.tipo || '—'} · Período: ${b.periodo || '—'}

--- Contenido ---
${contenido.slice(0, 6000)}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1800, system: SYS, messages: [{ role: 'user', content: userMsg }] }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return json(502, { error: 'Error de la IA: ' + ((data.error && data.error.message) || resp.status) });

    let txt = (data.content && data.content[0] && data.content[0].text) || '';
    txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    let ia;
    try { ia = JSON.parse(txt); }
    catch (e) {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { ia = JSON.parse(m[0]); } catch (e2) {} }
    }
    if (!ia || !Array.isArray(ia.acciones)) return json(200, { ok: true, ia: { diagnostico: txt.slice(0, 800), acciones: [], foco: '' }, crudo: true });

    return json(200, { ok: true, ia, modelo: MODEL });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};
