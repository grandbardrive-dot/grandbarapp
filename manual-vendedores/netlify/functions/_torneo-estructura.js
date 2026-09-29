// ============================================================
//  Estructura del Torneo Doña Paula (Mundial Doña Paula - Magnum).
//  Sale de la presentación "Incentivo GB 2026" (diapositiva 3). Es la única
//  lista: la usan la carga de evidencias del vendedor y la revisión de Juan
//  Pablo Sepúlveda. Los puntos no van acá: los carga Administración a mano.
//  (El "_" evita que Netlify lo publique como función.)
// ============================================================
const LINEAS = ['Los Cardos', 'Los Cardos PR', 'Estate', 'SV', 'Altitude/Altaluvia', 'Parcel/SDB'];

// Acciones de las dos ligas y las propias de cada una.
const ACCIONES = {
  ambas: ['Cliente activo con compra', 'Up Selling', 'Cliente nuevo (incorporación)'],
  off:   ['Sampling', 'Puntera'],
  on:    ['Vino por copa', 'Degustación / evento', 'Presencia en carta'],
};

// Qué acciones puede cargar cada vendedor según su canal. Los de los dos canales
// (canal "ambos" o sin canal) ven todas.
function accionesPara(canal) {
  const c = String(canal || '').toLowerCase();
  const grupos = [{ liga: 'ambas', titulo: 'Las dos ligas', acciones: ACCIONES.ambas }];
  if (c !== 'on') grupos.push({ liga: 'off', titulo: 'Liga OFF', acciones: ACCIONES.off });
  if (c !== 'off') grupos.push({ liga: 'on', titulo: 'Liga ON', acciones: ACCIONES.on });
  return grupos;
}

// La liga en la que cuenta una acción: la propia de la acción o, para las de
// las dos ligas, el canal del vendedor.
function ligaDe(accion, canal) {
  if (ACCIONES.off.includes(accion)) return 'OFF';
  if (ACCIONES.on.includes(accion)) return 'ON';
  const c = String(canal || '').toLowerCase();
  return c === 'on' ? 'ON' : c === 'off' ? 'OFF' : 'ON/OFF';
}

module.exports = { LINEAS, ACCIONES, accionesPara, ligaDe };
