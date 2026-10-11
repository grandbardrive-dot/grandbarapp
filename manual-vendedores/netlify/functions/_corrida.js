// ============================================================
//  Helper compartido: registra cada corrida de una tarea automática en el Hub
//  (tabla sistema_corridas) para que estado-sistema y n8n sepan si corrió,
//  cuándo y si falló. (El "_" evita que Netlify lo publique como función.)
//
//  Uso, al final de la función:
//    exports.handler = require('./_corrida').conRegistro('sync-clientes', exports.handler);
//
//  Cuenta como FALLA si la función tira un error, si responde 400 o más, o si
//  durante la corrida escribió algún console.error (así se ven también los
//  errores que las funciones de fondo atrapan y solo dejaban en los registros).
//  Si no se puede guardar el registro, la tarea sigue igual: nunca la frena.
// ============================================================
const HUB_URL = 'https://xqhyemccbwmzxqzkrtwa.supabase.co';

const texto = (x) => {
  if (x && x.message) return x.message;
  if (typeof x === 'string') return x;
  try { return JSON.stringify(x); } catch (e) { return String(x); }
};

async function guardar(fila) {
  const k = process.env.HUB_SERVICE_ROLE;
  if (!k) return;
  try {
    await fetch(HUB_URL + '/rest/v1/sistema_corridas', {
      method: 'POST',
      headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(fila),
    });
  } catch (e) {}
}

function conRegistro(tarea, handler, opciones) {
  const siCorre = (opciones && opciones.siCorre) || (() => true);
  return async (event, context) => {
    // Llamadas que la función rechaza (p. ej. sin la clave del disparo) no cuentan como corrida.
    if (!siCorre(event)) return handler(event, context);
    const t0 = Date.now();
    const errores = [];
    const errOrig = console.error;
    console.error = (...a) => {
      try { errores.push(a.map(texto).join(' ').slice(0, 300)); } catch (e) {}
      errOrig.apply(console, a);
    };
    let res, excepcion = null;
    try { res = await handler(event, context); }
    catch (e) { excepcion = e; }
    finally { console.error = errOrig; }
    const st = res && res.statusCode;
    const ok = !excepcion && !(st >= 400) && !errores.length;
    const detalle = excepcion ? texto(excepcion).slice(0, 600)
      : errores.length ? errores.slice(0, 3).join(' | ').slice(0, 900)
      : st >= 400 ? ('respondió ' + st + (res.body ? ': ' + String(res.body).slice(0, 300) : ''))
      : null;
    await guardar({ tarea, inicio: new Date(t0).toISOString(), fin: new Date().toISOString(), ok, detalle, ms: Date.now() - t0 });
    if (excepcion) throw excepcion;
    return res;
  };
}

module.exports = { conRegistro };
