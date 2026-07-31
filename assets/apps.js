/* ===========================================================
   GrandBar Hub — catálogo de módulos (single source of truth)
   -----------------------------------------------------------
   Para sumar/mover una app: agregá o editá un objeto acá.
   - url:   a dónde lleva la tarjeta (dejá "#" si todavía no hay)
   - area:  clave de AREAS (agrupa y filtra)
   - roles: qué roles la ven. ["*"] = todos.
   - status:"live" (funcionando) | "soon" (en construcción)

   ROLES disponibles (alineados al organigrama):
     admin          → Desarrollo / superadmin (ve todo)
     direccion      → Fernando (reportes)
     ventas         → equipo comercial
     administracion → admin y finanzas
     compras        → Luciana (Compras + Mayorista)
     mayorista      → puntos de venta al público
     deposito       → depósito (stock, rutas, materiales)
     marketing      → Marketing + Desarrollo
     reportes       → acceso a dashboards
     cliente        → clientes externos
   =========================================================== */
const AREAS = {
  ventas:      "Ventas",
  catalogos:   "Catálogos y Acciones",
  operaciones: "Stock y Operaciones",
  marketing:   "Marketing",
  admin:       "Administración y Finanzas",
  reportes:    "Reportes",
  clientes:    "Clientes",
};

const APPS = [
  // ---------- Ventas ----------
  {
    id: "vendedores",
    name: "App Vendedores",
    desc: "Rutas, clientes, checklists y pedidos en la calle.",
    icon: "🧭",
    area: "ventas",
    roles: ["admin", "ventas"],
    status: "live",
    url: "#",
  },
  {
    id: "vendedores-admin",
    name: "Admin Manual Vendedores",
    desc: "Panel de administración del manual y herramientas de venta.",
    icon: "🛠️",
    area: "ventas",
    roles: ["admin", "ventas", "compras"],
    status: "live",
    url: "#",
  },

  // ---------- Catálogos y Acciones ----------
  {
    id: "catalogo",
    name: "Catálogo de Acciones",
    desc: "Ver las acciones y promos vigentes por marca.",
    icon: "📖",
    area: "catalogos",
    roles: ["admin", "ventas", "marketing"],
    status: "live",
    url: "https://catalogosgrandbar.netlify.app",
  },
  {
    id: "catalogo-admin",
    name: "Cargar al Catálogo",
    desc: "Panel admin para subir y editar acciones de los catálogos.",
    icon: "⬆️",
    area: "catalogos",
    roles: ["admin", "marketing", "compras"],
    status: "live",
    url: "https://catalogosgrandbar.netlify.app/admin.html",
  },
  {
    id: "propuestas",
    name: "Recolector de Propuestas",
    desc: "Buzón para juntar propuestas de acciones de proveedores.",
    icon: "📥",
    area: "catalogos",
    roles: ["admin", "ventas", "marketing", "compras"],
    status: "live",
    url: "#",
  },

  // ---------- Stock y Operaciones ----------
  {
    id: "stock",
    name: "Stock e Inventario",
    desc: "Control de stock del depósito y de los puntos del Mayorista.",
    icon: "📦",
    area: "operaciones",
    roles: ["admin", "compras", "deposito", "mayorista"],
    status: "live",
    url: "#",
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

  // ---------- Administración y Finanzas ----------
  {
    id: "portal",
    name: "Portal Cuenta Corriente",
    desc: "Saldos, facturas y pagos de clientes (MercadoPago).",
    icon: "🏦",
    area: "admin",
    roles: ["admin", "administracion", "cliente"],
    status: "live",
    url: "#",
  },
  {
    id: "cobranzas",
    name: "Cobranzas",
    desc: "Reparto automático de pagos parciales, factura más atrasada primero.",
    icon: "💵",
    area: "admin",
    roles: ["admin", "administracion"],
    status: "live",
    url: "#",
  },
  {
    id: "whatsapp",
    name: "Recordatorios WhatsApp",
    desc: "Avisos automáticos de cuenta corriente por WhatsApp oficial.",
    icon: "💬",
    area: "admin",
    roles: ["admin", "administracion"],
    status: "live",
    url: "#",
  },

  // ---------- Reportes ----------
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

  // ---------- En construcción ----------
  {
    id: "phone-shop",
    name: "Phone Shop",
    desc: "Catálogo de iPhones con stock parseado desde WhatsApp.",
    icon: "📱",
    area: "ventas",
    roles: ["admin", "ventas"],
    status: "soon",
    url: "#",
  },
];
