// ─── Definición de checklists por tipo de cliente ──────────────────────────
// Para agregar un tipo nuevo: agregar una clave en CHECKLISTS con su estructura.
// Tipos sin checklist propio usan 'restaurante' como fallback.

const CHECKLISTS = {

  restaurante: {
    id: 'restaurante',
    label: 'Restaurantes',
    heroSubtitulo: 'Checklist de visita al punto de venta.',
    secciones: [
      {
        id: 's0',
        titulo: 'Introducción & preparación',
        subtitulo: 'Antes de entrar al local',
        icono: '📋',
        iconoBg: '#EAF2FB', iconoColor: '#1A5C9A',
        intro: 'Revisá estos puntos antes de ingresar para llegar preparado y generar confianza desde el primer momento.',
        items: [
          { texto: 'Revisé el historial del cliente antes de la visita',        detalle: 'Pedidos anteriores, categorías activas, última visita, deudas pendientes' },
          { texto: 'Tengo materiales de apoyo y catálogos actualizados',         detalle: 'Carta de vinos vigente, folletería de productos nuevos, materiales POP' },
          { texto: 'Identifiqué oportunidades de mejora para este cliente',      detalle: 'Categorías no activas, productos de la competencia, quiebres anteriores' },
        ]
      },
      {
        id: 's1',
        titulo: 'Acciones de incorporación',
        subtitulo: 'Sumar nuevos productos a la carta',
        icono: '🔄',
        iconoBg: '#EAF4EE', iconoColor: '#2D6A4F',
        intro: 'Detectá qué categorías o productos no están activos y proponé incorporarlos con argumentos de rentabilidad.',
        planes: [
          {
            id: 'p1a',
            pill: '1+1', pillColor: 'green',
            titulo: 'Incorporación general — todos los vinos',
            subtitulo: 'Por cada caja comprada, 1 de regalo',
            desc: 'Todos los vinos del portafolio tienen disponible la condición 1+1 para nuevas incorporaciones en carta de restaurante. Aplica sobre el primer pedido de cada línea no activa previamente.',
            tags: ['Todo el portafolio', 'Primera compra por línea', 'Sin mínimo de cajas']
          },
          {
            id: 'p1b',
            pill: '1+2', pillColor: 'purple',
            titulo: 'Peñaflor — 11 Tintos',
            subtitulo: 'Por cada caja comprada, 2 de regalo',
            desc: 'Condición especial 1+2 para las líneas participantes de Peñaflor. Ideal para activar múltiples etiquetas en un solo pedido y maximizar el beneficio para el cliente.',
            tags: ['Alma Mora', 'Don David', 'Fond de Cave', 'Fond de Cave RVA', 'Cazador', 'Mascota', 'NC Espumantes', 'Trapiche Medalla', 'Trapiche Reserva']
          }
        ],
        items: [
          { texto: 'Relevé categorías faltantes en la carta actual',                        detalle: 'Ej: tiene vinos pero no tiene espumantes ni vinos por copa' },
          { texto: 'Presenté al menos 1 producto nuevo para incorporar',                    detalle: 'Con argumento de margen, tendencia de consumo o diferenciación' },
          { texto: 'Informé la condición de incorporación vigente (1+1 o 1+2 Peñaflor)',   detalle: '' },
          { texto: 'Acordé exhibición / lugar en carta para el nuevo producto',             detalle: 'Posición en menú, precio sugerido de venta' },
        ]
      },
      {
        id: 's_acciones_mensuales',
        titulo: 'Acciones Mensuales',
        subtitulo: 'Promos y condiciones activas del mes',
        icono: '⭐',
        iconoBg: '#FDF5E0', iconoColor: '#8A5E00',
        especial: 'acciones_mensuales',
        intro: 'Acciones vigentes cargadas por administración para este canal.',
        items: [
          { texto: 'Presenté las acciones vigentes del mes al cliente', detalle: '' },
          { texto: 'El cliente se sumó a al menos una acción o promo', detalle: '' },
        ]
      },
      {
        id: 's2',
        titulo: 'Acciones de rotación',
        subtitulo: 'Mejorar la rotación del stock existente',
        icono: '⇄',
        iconoBg: '#FDF5E0', iconoColor: '#8A5E00',
        intro: 'Revisá el stock en bodega, identificá productos de baja rotación y acordá acciones concretas para moverlos.',
        items: [
          { texto: 'Revisé el stock en bodega o detrás del bar',                            detalle: 'Stock físico vs. lo que están vendiendo activamente' },
          { texto: 'Identifiqué productos con baja rotación y acordé acción',               detalle: 'Posición destacada, recomendación del mozo, combo con plato, precio especial' },
          { texto: 'Verifiqué que los productos estrella estén bien surtidos',              detalle: 'Sin quiebre ni riesgo de quiebre antes de la próxima visita' },
        ]
      },
      {
        id: 's3',
        titulo: 'Acciones fechas especiales',
        subtitulo: 'Oportunidades de temporada',
        icono: '📅',
        iconoBg: '#FBEAF0', iconoColor: '#72243E',
        intro: 'Anticipate a las fechas clave para que el cliente tenga stock y propuestas especiales a tiempo.',
        items: [
          { texto: 'Informé la próxima fecha especial relevante (≤30 días)',    detalle: 'Día de la Madre, Navidad, San Valentín, Semana Santa, fiestas locales' },
          { texto: 'Propuse oferta específica para esa fecha',                  detalle: 'Pack de espumantes, maridaje especial, oferta por volumen, copa de brindis' },
          { texto: 'Cerré un pedido anticipado o dejé presupuesto armado',      detalle: '' },
        ]
      },
      {
        id: 's4',
        titulo: 'Acciones de precio',
        subtitulo: 'Precio de venta al consumidor',
        icono: '🏷',
        iconoBg: '#EEEDF8', iconoColor: '#4A3D8F',
        intro: 'Ayudá al cliente a fijar precios competitivos que cuiden su margen y mejoren la rotación.',
        items: [
          { texto: 'Revisé los precios actuales en carta vs. nuestros precios',             detalle: 'Margen bruto aplicado, comparación con precios sugeridos de la zona' },
          { texto: 'Sugerí ajuste de precio en al menos un producto',                       detalle: '' },
          { texto: 'Acordé precio sugerido de venta para nuevas incorporaciones',           detalle: '' },
        ],
        nota: { label: 'Benchmark', texto: 'El margen sugerido para vinos en restaurante es <strong>2,5x a 3x</strong> el precio de costo. Usalo como referencia al proponer precios de carta.' }
      },
      {
        id: 's5',
        titulo: 'Nuevos productos — futuras incorporaciones',
        subtitulo: 'Pipeline de lanzamientos',
        icono: '📦',
        iconoBg: '#E1F5EE', iconoColor: '#085041',
        intro: 'Mantené al cliente informado de lo que viene para que pueda planificar con tiempo.',
        items: [
          { texto: 'Presenté novedades del portafolio próximas a lanzar',   detalle: 'Nuevas etiquetas, cosechas nuevas, líneas de espumantes, vinos orgánicos' },
          { texto: 'Dejé muestra o ficha técnica del producto nuevo',        detalle: '' },
          { texto: 'Acordé fecha de seguimiento para cierre de incorporación', detalle: '' },
        ]
      },
      {
        id: 's6',
        titulo: 'Acciones aperitivos',
        subtitulo: 'Activar la categoría pre-cena',
        icono: '🍷',
        iconoBg: '#FAECE7', iconoColor: '#712B13',
        intro: 'Los aperitivos son una categoría de alto margen y crecimiento. Muchos restaurantes la tienen subdesarrollada.',
        items: [
          { texto: 'Revisé si tienen carta o propuesta de aperitivos activa',              detalle: '' },
          { texto: 'Propuse ampliar o crear sección de aperitivos en carta',               detalle: 'Con al menos 3 opciones en distintos rangos de precio' },
          { texto: 'Presenté argumento de margen y tendencia de la categoría',             detalle: 'Margen promedio 60–70% sobre costo, tendencia ascendente' },
        ]
      },
      {
        id: 's7',
        titulo: 'Vino por copa',
        subtitulo: 'Programa de copa de la casa',
        icono: '🍸',
        iconoBg: '#EEEDF8', iconoColor: '#4A3D8F',
        intro: 'El vino por copa aumenta el ticket promedio y facilita la rotación.',
        planes: [
          {
            id: 'p7a',
            pill: '3 meses', pillColor: 'amber',
            titulo: 'Doña Paula — Plan copa de la casa',
            subtitulo: 'Programa de activación por copa',
            desc: 'Plan de 3 meses de acompañamiento de la bodega Doña Paula para activar el vino por copa en el restaurante. Incluye soporte de comunicación y materiales. Consultá a tu supervisor para condiciones específicas de precio y mínimos.',
            tags: ['Doña Paula', '3 meses de vigencia', 'Copa de la casa']
          }
        ],
        items: [
          { texto: 'Relevé si tienen propuesta de vinos por copa activa',              detalle: 'Mínimo ideal: blanco, rosado y tinto de entrada' },
          { texto: 'Presenté plan Doña Paula 3 meses para copa de la casa',            detalle: '' },
          { texto: 'Presenté propuesta concreta de copa para blancos y tintos',        detalle: 'Con precio sugerido y maridaje recomendado' },
          { texto: 'Acordé al menos 1 producto para activar como copa de la casa',     detalle: '' },
        ]
      },
      {
        id: 's8',
        titulo: 'Café Segafreddo',
        subtitulo: 'Mostrá, relevá y cerrá la categoría café',
        icono: '☕',
        iconoBg: '#FAECE7', iconoColor: '#993C1D',
        especial: 'segafreddo',
        intro: 'El café de calidad es el cierre perfecto de una experiencia gastronómica. Segafreddo eleva la percepción del restaurante.',
        items: [
          // j=0 sí/no — cuenta cuando se responde
          { texto: '¿El cliente ya trabaja café Segafreddo?',              tipo: 'sino' },
          // j=1 multiselect variedades — cuenta cuando SÍ + ≥1 seleccionada, o cuando NO (N/A)
          { texto: 'Variedades que trabaja hoy',                           tipo: 'multiselect_sega_var' },
          // j=2-3 checkboxes estándar
          { texto: 'Mostré el catálogo Segafreddo al encargado',           detalle: '' },
          { texto: 'Presenté la propuesta con diferenciación de marca',    detalle: '' },
          // j=4 multiselect incorporaciones — cuenta cuando ≥1 opción elegida
          { texto: '¿Qué productos incorporó en esta visita?',             tipo: 'multiselect_sega_incorp' },
          // j=5-6 checkboxes estándar
          { texto: 'Dejé muestra / degustación acordada con el encargado', detalle: '' },
          { texto: 'Presenté materiales de comunicación disponibles',      detalle: '' },
        ]
      },
      {
        id: 's9',
        titulo: 'Acciones con materiales',
        subtitulo: 'POP y comunicación en punto de venta',
        icono: '📷',
        iconoBg: '#EAF4EE', iconoColor: '#27500A',
        intro: 'Los materiales bien colocados comunican al consumidor final y aumentan la probabilidad de venta.',
        items: [
          { texto: 'Revisé si los materiales actuales están en buen estado y visibles', detalle: 'Cartas de vino, cenefas, displays, carteles de copa, posavasos' },
          { texto: 'Repuse o actualicé materiales desactualizados o deteriorados',      detalle: '' },
          { texto: 'Coloqué nuevo material POP para producto o acción vigente',         detalle: 'Posición: entrada, mesa, barra o pizarra' },
        ]
      },
      {
        id: 's10',
        titulo: 'Partners con bodegas | Beneficios clientes',
        subtitulo: 'Activaciones co-branded',
        icono: '🏆',
        iconoBg: '#FDF5E0', iconoColor: '#854F0B',
        intro: 'Las bodegas partner ofrecen beneficios exclusivos para restaurantes que activan sus productos.',
        items: [
          { texto: 'Presenté algún programa de beneficios vigente de bodegas partner', detalle: 'Degustaciones, capacitaciones para mozos, materiales co-branded, bonificaciones' },
          { texto: 'Conecté al cliente con un beneficio concreto aplicable hoy',        detalle: '' },
          { texto: 'Documenté el compromiso tomado con el cliente',                     detalle: '' },
        ]
      },
    ]
  }

  ,

  // ─── VINOTECAS ─────────────────────────────────────────────────────────────
  vinoteca: {
    id: 'vinoteca',
    label: 'Vinotecas',
    heroSubtitulo: 'Checklist de visita a vinotecas — recorrido físico del local.',
    secciones: [

      // S1 ── Vidrieras
      {
        id: 'vt_vidrieras',
        titulo: 'Vidrieras',
        subtitulo: 'Acuerdos de exhibición y vidriera',
        icono: '🪟',
        iconoBg: '#EAF2FB', iconoColor: '#1F447F',
        especial: 'vt_vidrieras',
        intro: 'Arrancá por la vidriera: verificá el acuerdo vigente o presentá un plan nuevo.',
        items: [
          { texto: 'Revisé la vidriera', detalle: 'Estado, limpieza, visibilidad de productos e iluminación' },
          { texto: 'Detecté oportunidad', detalle: 'Espacio disponible, productos sin destacar, materiales vencidos' },
          { texto: 'Presenté propuesta comercial', detalle: 'Plan de vidriera o renovación de exhibición' },
        ]
      },

      // S2 ── Góndola de Vinos
      {
        id: 'vt_gondola_vinos',
        titulo: 'Góndola de Vinos',
        subtitulo: 'Acciones vigentes y acuerdos de rotación',
        icono: '🍷',
        iconoBg: '#EEEDF8', iconoColor: '#4A3D8F',
        especial: 'vt_gondola_vinos',
        intro: 'Recorré la góndola de vinos y presentá las promociones vigentes del mes.',
        items: [
          { texto: 'Presenté promociones vigentes', detalle: '1+1, 3+1, 5+1, 6+2, %OFF' },
          { texto: 'Detecté oportunidad de rotación', detalle: 'Baja rotación, reposición, mejor posición en góndola' },
          { texto: 'Registré acuerdo', detalle: '' },
        ]
      },

      // S3 ── Incorporaciones
      {
        id: 'vt_incorporaciones',
        titulo: 'Incorporaciones',
        subtitulo: 'Nuevas etiquetas y condiciones especiales',
        icono: '🔄',
        iconoBg: '#EAF4EE', iconoColor: '#2D6A4F',
        especial: 'vt_incorporaciones',
        intro: 'Presentá las incorporaciones cargadas por administración con sus condiciones.',
        items: [
          { texto: 'Presenté incorporación', detalle: 'Al menos 1 etiqueta nueva' },
          { texto: 'Expliqué beneficios', detalle: 'Margen, condición, diferenciación' },
          { texto: 'Registré respuesta', detalle: '' },
        ]
      },

      // S4 ── Isla / Exhibiciones especiales
      {
        id: 'vt_isla',
        titulo: 'Isla / Exhibiciones especiales',
        subtitulo: 'Acciones de isla y puntas de góndola',
        icono: '🏝️',
        iconoBg: '#FDF5E0', iconoColor: '#8A5E00',
        especial: 'vt_isla',
        intro: 'Revisá los espacios de exhibición especial y proponé acciones de isla.',
        items: [
          { texto: 'Revisé espacio', detalle: 'Isla, punta de góndola, exhibición destacada' },
          { texto: 'Presenté propuesta', detalle: '' },
          { texto: 'Registré acuerdo', detalle: '' },
        ]
      },

      // S5 ── Góndola Spirits
      {
        id: 'vt_gondola_spirits',
        titulo: 'Góndola Spirits',
        subtitulo: 'Promos de spirits y activaciones de canal',
        icono: '🥃',
        iconoBg: '#FAECE7', iconoColor: '#712B13',
        especial: 'vt_gondola_spirits',
        intro: 'Recorré la góndola de spirits y presentá las promociones de marca vigentes.',
        items: [
          { texto: 'Presenté promociones', detalle: 'Chivas, Ballantine’s, Beefeater, Aperol, Campari, Absolut, Skyy, Cynar' },
          { texto: 'Detecté oportunidad', detalle: '' },
          { texto: 'Registré acuerdo', detalle: '' },
        ]
      },

      // S6 ── Productos de Heladera
      {
        id: 'vt_heladera',
        titulo: 'Productos de Heladera',
        subtitulo: 'RTD, cervezas, energizantes y frío',
        icono: '🧊',
        iconoBg: '#EAF2FB', iconoColor: '#0D3B66',
        especial: 'vt_heladera',
        intro: 'Revisá la heladera: stock, espacios libres y propuesta integral de frío.',
        items: [
          { texto: 'Revisé heladera', detalle: 'Aperol Spritz, Campari Spritz, Gin Tonic RTD, Cervezas, Energizantes' },
          { texto: 'Detecté espacios', detalle: 'Quiebres o lugares libres para incorporar' },
          { texto: 'Presenté acciones', detalle: '' },
        ]
      },

      // S7 ── Acciones Mensuales
      {
        id: 'vt_acciones_mensuales',
        titulo: 'Acciones Mensuales',
        subtitulo: 'Promos y condiciones activas del mes',
        icono: '⭐',
        iconoBg: '#FDF5E0', iconoColor: '#8A5E00',
        especial: 'acciones_mensuales',
        intro: 'Acciones vigentes cargadas por administración para este canal.',
        items: [
          { texto: 'Presenté las acciones vigentes del mes al cliente', detalle: '' },
          { texto: 'El cliente se sumó a al menos una acción o promo', detalle: '' },
        ]
      },

      // S8 ── Fechas Especiales (calendario)
      {
        id: 'vt_fechas',
        titulo: 'Fechas Especiales',
        subtitulo: 'Calendario de eventos y temporada',
        icono: '📅',
        iconoBg: '#FBEAF0', iconoColor: '#72243E',
        especial: 'vt_fechas_cal',
        intro: 'Anticipá las fechas clave del mes y programá las acciones con recordatorio.',
        items: [
          { texto: 'Revisé el calendario de fechas especiales con el cliente', detalle: '' },
          { texto: 'Programé al menos 1 acción con fecha', detalle: '' },
        ]
      },

      // S9 ── Nuevos Productos
      {
        id: 'vt_nuevos_productos',
        titulo: 'Nuevos Productos',
        subtitulo: 'Novedades y lanzamientos',
        icono: '📦',
        iconoBg: '#E1F5EE', iconoColor: '#085041',
        especial: 'vt_nuevos_productos',
        intro: 'Mostrá las novedades del portafolio cargadas por administración.',
        items: [
          { texto: 'Presenté novedad', detalle: 'Ficha, imagen y PDF del producto nuevo' },
          { texto: 'Registré interés', detalle: '' },
          { texto: 'Programé seguimiento', detalle: '' },
        ]
      },

      // S10 ── Activaciones con Materiales
      {
        id: 'vt_materiales',
        titulo: 'Activaciones con Materiales',
        subtitulo: 'Catálogo POP y solicitud por WhatsApp',
        icono: '📷',
        iconoBg: '#EAF4EE', iconoColor: '#27500A',
        especial: 'vt_materiales',
        intro: 'Revisá el catálogo de materiales, solicitá lo que necesites e indicá cantidad y fecha.',
        items: [
          { texto: 'Revisé materiales actuales — estado y vigencia', detalle: 'Cenefas, carteles, displays, stoppers' },
          { texto: 'Repuse o retiré materiales desactualizados', detalle: '' },
          { texto: 'Solicité nuevos materiales si corresponde', detalle: '' },
        ]
      },

      // S11 ── Partners con Bodegas
      {
        id: 'vt_partners',
        titulo: 'Partners con Bodegas',
        subtitulo: 'Beneficios co-branded y eventos',
        icono: '🏆',
        iconoBg: '#FDF5E0', iconoColor: '#854F0B',
        especial: 'vt_partners',
        intro: 'Presentá los beneficios de bodegas partner: degustaciones, capacitaciones, visitas y eventos.',
        items: [
          { texto: 'Presenté beneficio', detalle: 'Degustaciones, capacitaciones, visitas a bodegas, eventos' },
          { texto: 'Registré interés', detalle: '' },
          { texto: 'Programé seguimiento', detalle: '' },
        ]
      },

      // S12 ── Cierre de Visita
      {
        id: 'vt_cierre',
        titulo: 'Cierre de Visita',
        subtitulo: 'Resumen, acuerdos y próximo seguimiento',
        icono: '✅',
        iconoBg: '#EAF4EE', iconoColor: '#1B4332',
        especial: 'vt_cierre',
        intro: 'Cerrá la visita: revisá el recorrido, confirmá acuerdos y dejá programado el seguimiento.',
        items: [
          { texto: 'Completé el recorrido', detalle: '' },
          { texto: 'Registré acuerdos', detalle: 'Todos los acuerdos del carrito' },
          { texto: 'Registré observaciones', detalle: '' },
          { texto: 'Programé seguimientos', detalle: '' },
        ]
      },

    ]
  }

  ,

  // ─── AUTOSERVICIOS ──────────────────────────────────────────────────────────
  autoservicio: {
    id: 'autoservicio',
    label: 'Autoservicios',
    heroSubtitulo: 'Checklist de visita a autoservicios.',
    secciones: [

      // (Sección "Programas Satélites" removida del recorrido: quedaba duplicada
      //  con el acordeón 🛰 de la ficha del cliente, donde vive el Torneo Doña Paula.)

      {
        id: 'as1',
        titulo: 'Frente del local',
        subtitulo: 'Vidriera y cartelería',
        icono: '🏪',
        iconoBg: '#EAF2FB', iconoColor: '#1F447F',
        especial: 'as_frente',
        intro: 'Revisá la presencia exterior del local y acordá acciones visibles.',
        items: [
          { texto: 'Revisé si hay cartelería visible desde la calle',   detalle: 'Carteles en vidrio, frente, entrada' },
          { texto: 'Propuse material de cartelería disponible',         detalle: 'Cenefas, stickers de precio, carteles de góndola' },
          { texto: 'Acordé colocación de nuevo material',               detalle: 'Lugar específico + fecha de colocación' },
        ]
      },

      {
        id: 'as2',
        titulo: 'Heladera',
        subtitulo: 'Stock, incorporaciones y propuesta integral',
        icono: '🧊',
        iconoBg: '#EAF2FB', iconoColor: '#0D3B66',
        especial: 'as_heladera',
        intro: 'Revisá el estado de la heladera e identificá incorporaciones posibles.',
        items: [
          { texto: 'Relevé presencia de RTD en heladera',               detalle: 'Cantidad, marcas y facings disponibles' },
          { texto: "Propuse incorporar RTD Gordon's",                   detalle: 'Con condición 1+1 disponible' },
          { texto: 'Relevé presencia de cervezas y gaseosas',           detalle: 'Share de espacio vs. vinos y RTD' },
          { texto: 'Propuse surtido integral de heladera',              detalle: 'Balance entre RTD, cervezas y gaseosas' },
        ]
      },

      {
        id: 'as3',
        titulo: 'Góndola de Vinos',
        subtitulo: 'Surtido por segmento de precio',
        icono: '🍷',
        iconoBg: '#EEEDF8', iconoColor: '#4A3D8F',
        especial: 'as_gondola_vinos',
        intro: 'Mejorá el surtido de marcas en góndola por rango de precio.',
        items: []
      },

      {
        id: 'as4',
        titulo: 'Góndola de Spirits',
        subtitulo: 'Incorporaciones y acciones con valor agregado',
        icono: '🥃',
        iconoBg: '#FAECE7', iconoColor: '#712B13',
        especial: 'as_gondola_spirits',
        intro: 'Mejorar el surtido de spirits en góndola.',
        items: []
      },

      {
        id: 'as5',
        titulo: 'Materiales',
        subtitulo: 'Catálogo, solicitud, mochila y exhibidores',
        icono: '📦',
        iconoBg: '#EAF4EE', iconoColor: '#27500A',
        especial: 'as_materiales',
        intro: 'Gestioná los materiales de comunicación disponibles.',
        items: [
          { texto: 'Relevé si el local tiene exhibidores de GrandBar',  detalle: 'Gondoleros, display de punta, exhibidor de heladera' },
          { texto: 'Propuse exhibidor disponible para góndola',         detalle: 'Disponibles: gondolero 6 botellas, display de punta' },
          { texto: 'Acordé colocación de exhibidor',                    detalle: 'Sección + fecha' },
        ]
      },

      {
        id: 'as6',
        titulo: 'Fechas especiales',
        subtitulo: 'Acciones de temporada y eventos',
        icono: '📅',
        iconoBg: '#FBEAF0', iconoColor: '#72243E',
        especial: 'fechas',
        intro: 'Acciones vigentes cargadas por administración.',
        items: [
          { texto: 'Informé al cliente las acciones de fechas especiales', detalle: '' },
          { texto: 'El cliente se sumó a al menos 1 acción',            detalle: '' },
          { texto: 'Acordé fecha de ejecución de la acción',            detalle: '' },
        ]
      },

      {
        id: 'as_acciones_mensuales',
        titulo: 'Acciones Mensuales',
        subtitulo: 'Promos y condiciones activas del mes',
        icono: '⭐',
        iconoBg: '#FDF5E0', iconoColor: '#8A5E00',
        especial: 'acciones_mensuales',
        intro: 'Acciones vigentes cargadas por administración para este canal.',
        items: [
          { texto: 'Presenté las acciones vigentes del mes al cliente', detalle: '' },
          { texto: 'El cliente se sumó a al menos una acción o promo', detalle: '' },
        ]
      },

    ]
  }

};

// Retorna el checklist hardcodeado (síncrono, fallback)
function getChecklist(tipo) {
  return CHECKLISTS[(tipo || '').toLowerCase()] || CHECKLISTS['restaurante'];
}

// Cache por canal para evitar re-fetch en la misma sesión
const _clCache = {};

// Retorna el checklist desde Supabase si las tablas existen, sino fallback al hardcodeado
// Requiere que `sb` (cliente Supabase) esté disponible globalmente
// Tipo de cliente → manual que le corresponde. Los manuales editables son dos
// (ON TRADE y vinotecas), pero los clientes vienen con muchos tipos: bar, hotel,
// mayorista, "otros"… Sin este mapa, esos clientes caían al checklist viejo escrito
// en el código y NO veían nada de lo que se carga desde el panel (secciones nuevas,
// campañas por sección). Mismo criterio que usa el asistente de campañas.
const MANUAL_POR_TIPO = {
  vinoteca: 'vinoteca',
  autoservicio: 'autoservicio',   // todavía tiene su checklist propio en el código
  kiosco: 'autoservicio',
  hotel: 'hotel',                 // rubros separados: cada uno su propio manual
  bar: 'bar',
  disco: 'disco',
  discoteca: 'disco',
  mayorista: 'mayorista',         // manual propio; adentro lleva EVENTOS
};
// Nombre lindo de cada rubro (para el manual vacío recién creado).
const RUBRO_LABELS = { restaurante: 'Restaurantes', vinoteca: 'Vinotecas', autoservicio: 'Autoservicios', hotel: 'Hoteles', bar: 'Bares', disco: 'Discos', mayorista: 'Mayoristas' };
function manualDe(tipo) {
  const t = String(tipo || '').toLowerCase();
  return MANUAL_POR_TIPO[t] || 'restaurante';   // sin mapeo (mayorista, otros…) → Restaurantes
}

// La zona sale del vendedor logueado (el login guarda su ficha completa). Mendoza es
// el default: si un vendedor no tiene zona cargada, ve el manual de siempre.
function zonaActual() {
  try {
    const v = JSON.parse(sessionStorage.getItem('vendedor') || '{}');
    const z = String(v.zona || '').trim().toLowerCase();
    return z === 'sanluis' ? 'sanluis' : 'mendoza';
  } catch (e) { return 'mendoza'; }
}

async function getChecklistDynamic(tipo, zonaPedida) {
  const canal = manualDe(tipo);
  const zona  = zonaPedida || zonaActual();
  const clave = canal + '|' + zona;

  // Devolver cache si ya se cargó
  if (_clCache[clave]) return _clCache[clave];

  // Trae las secciones de esa zona. San Luis que todavía no tenga nada cargado para
  // ese rubro cae en las de Mendoza, para que el vendedor no se quede sin manual
  // mientras se está armando.
  //
  // Si la columna `zona` todavía no existe (falta correr zona-sanluis-setup.sql),
  // se consulta sin ella: así el manual sigue andando igual que antes en vez de
  // quedar en blanco por un cambio que todavía no se aplicó en la base.
  let _sinColumnaZona = false;
  async function traer(z) {
    if (!_sinColumnaZona) {
      const r = await sb.from('checklist_secciones').select('*')
        .eq('canal', canal).eq('zona', z).eq('activa', true).order('orden');
      if (r.error && /column .*zona.* does not exist/i.test(r.error.message || '')) {
        _sinColumnaZona = true;                       // no reintentar en cada llamada
        console.warn('[checklist] Falta la columna zona: se usa el manual único.');
      } else {
        return (r.error || !r.data?.length) ? null : r.data;
      }
    }
    if (z !== 'mendoza') return null;                 // sin columna, hay un solo manual
    const r2 = await sb.from('checklist_secciones').select('*')
      .eq('canal', canal).eq('activa', true).order('orden');
    return (r2.error || !r2.data?.length) ? null : r2.data;
  }

  try {
    let secciones = await traer(zona);
    if (!secciones && zona !== 'mendoza') secciones = await traer('mendoza');

    // Si falla (tablas no existen) o no hay datos → fallback.
    // Rubros con checklist hardcodeado (restaurante/vinoteca/autoservicio) usan ese;
    // los rubros separados sin secciones cargadas (hotel/bar/disco/mayorista) se muestran
    // VACÍOS — NO caen al manual de Restaurantes.
    if (!secciones) {
      _clCache[clave] = CHECKLISTS[canal] || { id: canal, label: RUBRO_LABELS[canal] || canal, heroSubtitulo: '', secciones: [] };
      return _clCache[clave];
    }

    const secIds = secciones.map(s => s.id);
    const [itemsRes, planesRes] = await Promise.all([
      sb.from('checklist_items').select('*').in('seccion_id', secIds).eq('activo', true).order('orden'),
      // Traemos todos los planes activos: un plan puede aparecer en varias secciones (columna `secciones`).
      sb.from('checklist_planes').select('*').eq('activo', true).order('created_at'),
    ]);

    const itemsPorSec  = {};
    const planesPorSec = {};
    (itemsRes.data  || []).forEach(i => {
      if (!itemsPorSec[i.seccion_id])  itemsPorSec[i.seccion_id]  = [];
      itemsPorSec[i.seccion_id].push(i);
    });
    const secIdSet = new Set(secIds);
    (planesRes.data || []).forEach(p => {
      // Un plan puede tener varias secciones (columna `secciones`); si no, usa seccion_id.
      // Solo lo agrupamos en las secciones que pertenecen a este canal.
      const secs = (Array.isArray(p.secciones) && p.secciones.length) ? p.secciones : (p.seccion_id ? [p.seccion_id] : []);
      secs.forEach(sid => {
        if (!secIdSet.has(sid)) return;
        if (!planesPorSec[sid]) planesPorSec[sid] = [];
        planesPorSec[sid].push(p);
      });
    });

    const base = CHECKLISTS[canal] || CHECKLISTS['restaurante'];

    // Armar nodos planos (uno por sección, madre o hija)
    const nodos = secciones.map(sec => ({
      // Usar codigo (string ID original) para compatibilidad con progreso guardado
      id:         sec.codigo || sec.id,
      _uuid:      sec.id,
      _parentUuid: sec.parent_id || null,
      _orden:     sec.orden ?? 0,
      titulo:     sec.nombre,
      subtitulo:  sec.descripcion || '',
      icono:      sec.icono       || '📋',
      iconoBg:    sec.icono_bg    || '#EAF2FB',
      iconoColor: sec.icono_color || '#1A5C9A',
      especial:   sec.especial    || undefined,
      intro:      sec.intro       || '',
      pdf_url:    sec.pdf_url      || null,   // PDF por sección (ej: propuestas de vidriera)
      items: (itemsPorSec[sec.id] || []).map(i => ({
        texto:   i.texto,
        detalle: i.descripcion || '',
      })),
      planes: (planesPorSec[sec.id] || []).map(p => ({
        id:        p.id,
        pill:      p.condicion || 'Plan',
        pillColor: 'green',
        titulo:    p.nombre,
        subtitulo: p.proveedor || '',
        desc:      p.descripcion || '',
        tags:      p.lineas_participantes || [],
        pdf_url:   p.pdf_url   || null,
      })),
    }));

    // Anidar: las que tienen parent_id van a subsecciones[] de su madre
    const porUuid = {};
    nodos.forEach(n => { porUuid[n._uuid] = n; });
    const topLevel = [];
    nodos.forEach(n => {
      const madre = n._parentUuid ? porUuid[n._parentUuid] : null;
      if (madre) (madre.subsecciones = madre.subsecciones || []).push(n);
      else topLevel.push(n);
    });
    // Ordenar madres por orden y, dentro de cada madre, sus hijas por orden
    topLevel.sort((a, b) => a._orden - b._orden);
    topLevel.forEach(m => { if (m.subsecciones) m.subsecciones.sort((a, b) => a._orden - b._orden); });

    const result = {
      id:            canal,
      label:         base.label         || canal,
      heroSubtitulo: base.heroSubtitulo || '',
      secciones:     topLevel,
    };

    _clCache[clave] = result;
    return result;

  } catch(e) {
    console.warn('[checklist] Fallback a datos hardcodeados:', e.message);
    _clCache[clave] = getChecklist(tipo);
    return _clCache[clave];
  }
}

// Invalidar cache (llamar después de editar en admin). La cache va por canal+zona,
// así que borrar un canal borra sus dos zonas.
function invalidarCacheChecklist(canal) {
  if (canal) Object.keys(_clCache).forEach(k => { if (k === canal || k.startsWith(canal + '|')) delete _clCache[k]; });
  else Object.keys(_clCache).forEach(k => delete _clCache[k]);
}

// Devuelve las secciones HOJA (las que tienen ítems): las madres se reemplazan
// por sus subsecciones. Soporta checklists planos y con subsecciones.
function seccionesHoja(cl) {
  const out = [];
  cl.secciones.forEach(s => {
    // Una madre puede tener ítems PROPIOS además de subsecciones (caso mixto):
    // se cuenta a sí misma si tiene ítems, y siempre a sus hijas con ítems.
    if (s.items && s.items.length) out.push(s);
    if (s.subsecciones && s.subsecciones.length) {
      // También las hijas SIN ítems: una subsección recién creada desde el panel todavía
      // no tiene checklist, pero igual tiene que poder recibir campañas.
      s.subsecciones.forEach(ss => out.push(ss));
    } else if (!(s.items && s.items.length)) {
      out.push(s); // sección sin ítems ni subsecciones (raro): empujar igual por compatibilidad
    }
  });
  return out;
}

// Cuenta el total de ítems de un checklist (solo hojas)
function totalItems(cl) {
  return seccionesHoja(cl).reduce((acc, s) => acc + s.items.length, 0);
}

// Calcula el porcentaje a partir del objeto progreso { sId: { checks: [bool], obs: '' } }
// Cuenta solo las secciones hoja (las madres son solo agregado visual).
function calcPorcentaje(cl, progreso) {
  let total = 0, done = 0;
  seccionesHoja(cl).forEach(s => {
    s.items.forEach((_, i) => {
      total++;
      if (progreso[s.id]?.checks?.[i]) done++;
    });
  });
  return total ? Math.round(done / total * 100) : 0;
}
