// ============================================================
//  Helper compartido: anota los errores internos de una función que usa la gente
//  (cobranzas, evidencias, tareas, asistente…) en la tabla sistema_errores del Hub,
//  para que estado-sistema y n8n avisen cuando una función empieza a fallar.
//  (El "_" evita que Netlify lo publique como función.)
//
//  Uso, al final de la función:
//    module.exports.handler = require('./_errores').conErrores('cobranzas-vendedor', module.exports.handler);
//
//  Cuenta como error: que la función tire una excepción o que responda 500 o más.
//  Los 4xx (sin sesión, datos inválidos, sin permiso) son respuestas normales: no
//  se anotan. Si no se puede guardar el registro, la función responde igual.
//  Las tareas automáticas usan _corrida.js, no esto.
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

function motivo(body) {
  if (!body) return null;
  try { const j = JSON.parse(body); return String(j.error || j.message || body).slice(0, 500); }
  catch (e) { return String(body).slice(0, 500); }
}

async function guardar(fila) {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) return;
  try {
    await fetch(HUB_URL + '/rest/v1/sistema_errores', {
      method: 'POST',
      headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(fila),
    });
  } catch (e) {}
}

function conErrores(nombre, handler) {
  return async (event, context) => {
    let res;
    try { res = await handler(event, context); }
    catch (e) {
      await guardar({ origen: 'funcion', lugar: nombre, status: 500, detalle: ((e && e.message) || String(e)).slice(0, 500) });
      throw e;
    }
    if (res && res.statusCode >= 500) await guardar({ origen: 'funcion', lugar: nombre, status: res.statusCode, detalle: motivo(res.body) });
    return res;
  };
}

module.exports = { conErrores };
