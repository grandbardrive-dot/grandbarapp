/* ===========================================================
   GrandBar Hub — catálogo de módulos (single source of truth)
   -----------------------------------------------------------
   Para sumar/mover una app: agregá o editá un objeto acá.
   - url:   a dónde lleva la tarjeta (dejá "#" si todavía no hay)
   - area:  clave de AREAS (agrupa y filtra)
   - roles: qué roles la ven. ["*"] = todos.
   - status:"live" (funcionando/existe) | "soon" (a desarrollar)

   ROLES disponibles (alineados al organigrama / 9 Reinas):
     admin          → Desarrollo / superadmin (ve todo)
     direccion      → Fernando (reportes)
     ventas         → equipo comercial
     administracion → admin y finanzas
     compras        → Luciana (Compras + Mayorista)
     mayorista      → puntos de venta al público
     deposito       → depósito (stock, vencimientos, materiales)
     marketing      → Marketing + Desarrollo
     reportes       → acceso a dashboards
     cliente        → clientes externos
   =========================================================== */
const AREAS = {
  ventas:         "Ventas",
  marketing:      "Marketing",
  compras:        "Compras",
  deposito:       "Depósito",
  administracion: "Administración y Finanzas",
  reportes:       "Reportes",
};

const APPS = [
  // =================== VENTAS ===================
  {
    id: "vendedores",
    name: "Manual de Vendedores",
    desc: "Manual, herramientas de venta y panel de administración.",
    icon: "📘",
    area: "ventas",
    roles: ["admin", "ventas", "compras"],
    status: "live",
    url: "#",
  },
  {
    id: "mercaderia-pendiente",
    name: "Mercadería Pendiente",
    desc: "Seguimiento de mercadería pendiente de entrega y recepción.",
    icon: "⏳",
    area: "ventas",
    roles: ["admin", "ventas", "compras"],
    status: "soon",
    url: "#",
  },

  // =================== MARKETING ===================
  {
    id: "placas-diseno",
    name: "Placas / Diseño a Pedido",
    desc: "Pedidos de placas y piezas de diseño al área de Marketing.",
    icon: "🖼️",
    area: "marketing",
    roles: ["admin", "marketing", "compras"],
    status: "soon",
    url: "#",
  },
  {
    id: "catalogo",
    name: "Catálogo de Acciones",
    desc: "Ver las acciones y promos vigentes por marca.",
    icon: "📖",
    area: "marketing",
    roles: ["admin", "ventas", "marketing"],
    status: "live",
    url: "https://catalogosgrandbar.netlify.app",
  },
  {
    id: "catalogo-admin",
    name: "Cargar al Catálogo",
    desc: "Panel admin para subir y editar acciones de los catálogos.",
    icon: "⬆️",
    area: "marketing",
    roles: ["admin", "marketing", "compras"],
    status: "live",
    url: "https://catalogosgrandbar.netlify.app/admin.html",
  },
  {
    id: "materiales",
    name: "Materiales (Marketing)",
    desc: "Biblioteca de materiales, stock por movimientos y alta con foto.",
    icon: "🎨",
    area: "marketing",
    roles: ["admin", "marketing", "deposito"],
    status: "live",
    url: "#",
  },

  // =================== COMPRAS ===================
  {
    id: "propuestas",
    name: "Recolector de Propuestas",
    desc: "Buzón para juntar propuestas de acciones de proveedores.",
    icon: "📥",
    area: "compras",
    roles: ["admin", "ventas", "marketing", "compras"],
    status: "live",
    url: "#",
  },
  {
    id: "reco",
    name: "Reco (Recompra)",
    desc: "Sugerencias de recompra y reposición. Herramienta de Luciana.",
    icon: "🛒",
    area: "compras",
    roles: ["admin", "compras"],
    status: "soon",
    url: "#",
  },
  {
    id: "rotacion",
    name: "Rotación de Mercadería",
    desc: "Análisis de rotación de mercadería por producto y marca.",
    icon: "🔄",
    area: "compras",
    roles: ["admin", "compras"],
    status: "soon",
    url: "#",
  },
  {
    id: "dias-inventario",
    name: "Días de Inventario",
    desc: "Días de inventario y cobertura de stock por producto.",
    icon: "📅",
    area: "compras",
    roles: ["admin", "compras"],
    status: "soon",
    url: "#",
  },

  // =================== DEPÓSITO ===================
  {
    id: "stock",
    name: "Stock e Inventario",
    desc: "Control de stock del depósito y de los puntos del Mayorista.",
    icon: "📦",
    area: "deposito",
    roles: ["admin", "compras", "deposito", "mayorista"],
    status: "live",
    url: "#",
  },
  {
    id: "vencimientos",
    name: "Vencimientos",
    desc: "Control de productos próximos a vencer en depósito.",
    icon: "⏰",
    area: "deposito",
    roles: ["admin", "deposito", "compras"],
    status: "soon",
    url: "#",
  },

  // =================== ADMINISTRACIÓN Y FINANZAS ===================
  {
    id: "cashflow",
    name: "Cashflow",
    desc: "Flujo de caja proyectado y seguimiento de ingresos/egresos.",
    icon: "💹",
    area: "administracion",
    roles: ["admin", "administracion", "compras"],
    status: "soon",
    url: "#",
  },
  {
    id: "portal",
    name: "Portal Cuenta Corriente",
    desc: "Saldos, facturas y pagos de clientes (MercadoPago).",
    icon: "🏦",
    area: "administracion",
    roles: ["admin", "administracion", "cliente"],
    status: "live",
    url: "#",
  },
  {
    id: "cobranzas",
    name: "Cobranzas",
    desc: "Reparto automático de pagos parciales, factura más atrasada primero.",
    icon: "💵",
    area: "administracion",
    roles: ["admin", "administracion"],
    status: "live",
    url: "#",
  },
  {
    id: "whatsapp",
    name: "Recordatorios WhatsApp",
    desc: "Avisos automáticos de cuenta corriente por WhatsApp oficial.",
    icon: "💬",
    area: "administracion",
    roles: ["admin", "administracion"],
    status: "live",
    url: "#",
  },

  // =================== REPORTES ===================
  {
    id: "reportes",
    name: "Reportes (Boox)",
    desc: "Dashboard de estadísticas por área.",
    icon: "📊",
    area: "reportes",
    roles: ["admin", "direccion", "reportes", "compras", "cliente"],
    status: "live",
    url: "#",
  },
];
