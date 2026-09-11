// ============================================================
//  GrandBar Hub · Function PROGRAMADA · sync-clientes-cron
//  Corre sola cada hora (ver netlify.toml) y deja la lista de clientes del
//  manual igual que CUBO: crea los nuevos y corrige nombre, rubro y vendedor.
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

const { sincronizar } = require('./sync-clientes-cubo');

exports.handler = async () => {
  const t0 = Date.now();
  try {
    const inf = await sincronizar('aplicar', t0);
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
