// ============================================================
//  GrandBar · helper de las funciones de IA de la visita
//   Las sugerencias (rotación, activaciones, cócteles) estaban escritas
//   pensando en un BAR: en una vinoteca o un autoservicio proponían
//   barra, bartender y tragos de carta. Acá está cómo es cada tipo de
//   cliente para que el prompt hable del negocio correcto.
//   El front manda `rubro` = checklist.id (restaurante, bar, disco,
//   hotel, evento, vinoteca, tienda_bebidas, autoservicio, mayorista).
// ============================================================

const RUBROS = {
  bar: {
    lugar: 'un BAR', off: false,
    rotar: 'sumarlo a un trago de la carta, darle visibilidad en la barra, una activación o promo, capacitar al bartender, armar un combo',
    activar: 'trago especial en la carta, happy hour, combo, degustación, presencia de marca, materiales',
  },
  disco: {
    lugar: 'un BOLICHE (discoteca)', off: false,
    rotar: 'shots o tragos de barra con ese producto, botellas para VIP/mesas, promo por horario, presencia de marca en la pista o la barra',
    activar: 'shots o trago de la noche, botellas VIP con bengala, promo por horario, presencia de marca, materiales para la barra',
  },
  restaurante: {
    lugar: 'un RESTAURANTE', off: false,
    rotar: 'sugerirlo en la carta de vinos o tragos, maridaje con platos, vino por copa, que los mozos lo recomienden, aperitivo de bienvenida',
    activar: 'menú o maridaje especial, vino por copa, aperitivo de bienvenida, degustación, presencia de marca en mesas, materiales',
  },
  hotel: {
    lugar: 'un HOTEL', off: false,
    rotar: 'incluirlo en el frigobar, el bar del lobby o el room service, copa o cóctel de bienvenida, sugerirlo en eventos del hotel',
    activar: 'copa o cóctel de bienvenida, degustación en el lobby, packs de frigobar, presencia de marca en eventos del hotel',
  },
  evento: {
    lugar: 'un espacio de EVENTOS (salón, finca o catering)', off: false,
    rotar: 'incluirlo en los paquetes de bebidas de los eventos, combos por cantidad de invitados, barra temática, brindis',
    activar: 'barra temática, brindis con espumante, combos por invitados, degustación para los organizadores, presencia de marca',
  },
  vinoteca: {
    lugar: 'una VINOTECA (el cliente final compra para llevar)', off: true,
    rotar: 'mejor ubicación en góndola o puntera, degustación en el local, que el vendedor del local lo recomiende, pack o combo, precio promocional, cartelería',
    activar: 'degustación en el local, pack o combo de regalo, precio promocional, exhibición en vidriera o puntera, cartelería, materiales',
  },
  tienda_bebidas: {
    lugar: 'una TIENDA DE BEBIDAS (el cliente final compra para llevar, mucha compra para la previa)', off: true,
    rotar: 'ubicación en góndola o heladera, combo para la previa con mixer o hielo, precio promocional, exhibidor, cartelería',
    activar: 'combo previa, precio promocional, exhibidor o puntera, producto frío en heladera, degustación, cartelería',
  },
  autoservicio: {
    lugar: 'un AUTOSERVICIO o supermercado (compra en góndola)', off: true,
    rotar: 'ubicación en góndola a la altura de los ojos, puntera o exhibidor, precio promocional, pack, cartelería de precio',
    activar: 'puntera o exhibidor, precio promocional, pack o combo, cartelería de precio, degustación en el local',
  },
  mayorista: {
    lugar: 'un MAYORISTA (le revende a otros comercios)', off: true,
    rotar: 'promo por volumen, combos para que les ofrezca a sus clientes, material para los comercios que le compran, precio escalonado',
    activar: 'promo por volumen, combos para sus clientes, material para sus comercios, lanzamiento en el salón de ventas',
  },
};
const ALIAS = { discoteca: 'disco', 'tienda de bebidas': 'tienda_bebidas', tienda: 'tienda_bebidas', kiosco: 'autoservicio', eventos: 'evento' };

// Devuelve el contexto del rubro. Sin rubro reconocido: un comercio genérico.
function rubroIA(r) {
  const k = String(r || '').trim().toLowerCase();
  return RUBROS[ALIAS[k] || k] || {
    lugar: 'un comercio', off: false,
    rotar: 'darle visibilidad, una activación o promo, un combo, que lo recomienden en el local',
    activar: 'promo, combo, degustación, presencia de marca, materiales',
  };
}

module.exports = { rubroIA };
