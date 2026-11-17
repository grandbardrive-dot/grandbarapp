// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sync-clientes-cron
//  Corre sola cada hora (ver netlify.toml) y deja la lista de clientes del
//  manual igual que CUBO: crea los nuevos y corrige nombre, rubro y vendedor.
//  Además (14/10/2026), los clientes ocultos que volvieron a comprar vuelven a verse.
//
//  CUBO no avisa cuando algo cambia, así que la única forma de "estar al día"
//  es preguntarle seguido. Cada hora es suficiente para que un cliente nuevo o un
//  traspaso aparezca en el manual el mismo día, sin cargarle consultas de más.
//
//  Toda la lógica vive en sync-clientes-cubo.js (la misma que usa la pantalla
//  sync-clientes.html). Acá solo se la dispara en modo "aplicar": las funciones
//  programadas no reciben sesión, por eso no pasan por el control de rol.
//  Qué hizo cada corrida queda en los registros de la función en Netlify.
// ============================================================

const { sincronizar, reactivarCompradores } = require('./sync-clientes-cubo');

exports.handler = async () => {
  const t0 = Date.now();
  // Los clientes ocultos que volvieron a comprar vuelven a verse (14/10/2026). Va primero
  // y aparte: si CUBO no contesta, esto igual corre (las ventas ya están en la base).
  try {
    const re = await reactivarCompradores();
    console.log('sync-clientes-cron reactivados', JSON.stringify({
      reactivados: re.reactivados,
      clientes: (re.clientes || []).slice(0, 30).map(c => c.codigo + ' ' + c.nombre + ' (' + c.vendedor + ')'),
    }));
  } catch (e) {
    console.error('sync-clientes-cron reactivar ERROR', (e && e.message) || String(e));
  }
  try {
    const inf = await sincronizar('aplicar', t0);
    // Resumen de la tabla CLIENTES de CUBO (17/11/2026): queda en sistema_corridas como
    // tarea 'cubo-clientes-resumen' para poder leerlo desde la base (sin datos de clientes).
    try {
      const k = process.env.HUB_SERVICE_ROLE;
      if (k && inf.cubo && inf.cubo.resumen) {
        const ahora = new Date().toISOString();
        await fetch('https://xqhyemccbwmzxqzkrtwa.supabase.co/rest/v1/sistema_corridas', {
          method: 'POST',
          headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ tarea: 'cubo-clientes-resumen', inicio: ahora, fin: ahora, ok: true, ms: 0,
            detalle: JSON.stringify(inf.cubo.resumen).slice(0, 60000) }),
        });
      }
    } catch (e) { console.log('sync-clientes-cron resumen no se guardó', (e && e.message) || String(e)); }
    console.log('sync-clientes-cron OK', JSON.stringify({
      en_cubo: inf.cubo && inf.cubo.clientes,
      nuevos: inf.nuevos,
      corregidos: inf.a_actualizar,
      escrito: inf.escrito,
      ms: inf.ms,
    }));
    return { statusCode: 200 };
  } catch (e) {
    console.error('sync-clientes-cron ERROR', (e && e.message) || String(e));
    return { statusCode: 500 };
  }
};

// Estado del sistema (10/10/2026): cada corrida queda en sistema_corridas (ver _corrida.js).
exports.handler = require('./_corrida').conRegistro('sync-clientes', exports.handler);
