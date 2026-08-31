-- ============================================================
--  Herramientas del Hub — para poder manejarlas desde el panel
--  Correr en el proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Hasta ahora las tarjetas del Hub vivían en assets/apps.js, un archivo
--  de código: para prender una, cambiarla de área o dársela a otro rol
--  había que tocar el código y publicar. Con esta tabla se maneja desde
--  el panel de Diseño y Desarrollo.
--
--  Si la tabla no existe o queda vacía, el Hub sigue usando apps.js.
--  O sea: correr esto no rompe nada, y borrar la tabla tampoco.
-- ============================================================

create table if not exists public.hub_herramientas (
  id           text primary key,               -- mismo id que traía apps.js
  nombre       text not null,
  descripcion  text,
  icono        text,
  area         text not null default 'ventas',
  roles        text[] not null default '{}',   -- qué roles la ven; {"*"} = todos
  estado       text not null default 'soon',   -- live | soon
  url          text not null default '#',
  url_por_rol  jsonb,                          -- destino distinto según el rol
  orden        int not null default 0,
  actualizado  timestamptz not null default now()
);

insert into public.hub_herramientas
  (id, nombre, descripcion, icono, area, roles, estado, url, url_por_rol, orden)
values
  ('panel-diseno-desarrollo', 'Panel de Diseño y Desarrollo', 'Pedidos de diseño, materiales, usuarios y acceso a todas las pantallas del sistema.', '🎨', 'sistema', '{"admin","diseno","desarrollo","marketing"}', 'live', 'panel-desarrollo.html', '{"diseno":"panel-diseno.html","marketing":"panel-diseno.html","desarrollo":"panel-desarrollo.html"}', 0),
  ('planificador-ia', 'Planificador de Ruta IA', 'La IA arma tu día: menos km, más clientes. Ruta optimizada, mapa y navegación.', '✦', 'copiloto', '{"admin","ventas"}', 'live', 'planificador-ia.html', null, 10),
  ('clientes', 'Mis Clientes', 'Tu cartera de clientes: ficha, dirección, historial y visitas.', '👥', 'ventas', '{"admin","ventas"}', 'live', 'clientes-hub.html', null, 20),
  ('vendedores', 'Manual de Vendedores', 'Manual, herramientas de venta y panel admin. Incluye el recolector de propuestas de proveedores.', '📘', 'ventas', '{"admin","ventas","compras"}', 'live', 'manual-vendedores/admin-comercial.html', '{"ventas":"manual-vendedores/index.html"}', 30),
  ('mercaderia-pendiente', 'Mercadería Pendiente', 'Seguimiento de mercadería pendiente de entrega y recepción.', '⏳', 'ventas', '{"admin","compras"}', 'soon', '#', null, 40),
  ('catalogo', 'Catálogo de Acciones', 'Ver las acciones y promos vigentes por marca.', '📖', 'ventas', '{"admin","ventas","marketing"}', 'live', 'https://catalogosgrandbar.netlify.app', null, 50),
  ('placas-diseno', 'Placas / Diseño a Pedido', 'Pedidos de placas y piezas de diseño al área de Marketing.', '🖼️', 'marketing', '{"admin","marketing","compras"}', 'soon', '#', null, 60),
  ('materiales', 'Materiales (Marketing)', 'Biblioteca de materiales, stock por movimientos y alta con foto.', '🎨', 'marketing', '{"admin","marketing","deposito"}', 'live', '#', null, 70),
  ('comparador-precios', 'Comparador de Precios', 'Precios de la competencia: compará nuestros productos contra los de cada cadena.', '🔍', 'compras', '{"admin","compras"}', 'live', 'manual-vendedores/admin-comparador.html', null, 80),
  ('reco', 'Reco (Recompra)', 'Sugerencias de recompra y reposición. Herramienta de Luciana.', '🛒', 'compras', '{"admin","compras"}', 'soon', '#', null, 90),
  ('rotacion', 'Rotación de Mercadería', 'Análisis de rotación de mercadería por producto y marca.', '🔄', 'compras', '{"admin","compras"}', 'soon', '#', null, 100),
  ('dias-inventario', 'Días de Inventario', 'Días de inventario y cobertura de stock por producto.', '📅', 'compras', '{"admin","compras"}', 'soon', '#', null, 110),
  ('stock', 'Stock e Inventario', 'Control de stock del depósito y de los puntos del Mayorista.', '📦', 'deposito', '{"admin","compras","deposito","mayorista"}', 'live', '#', null, 120),
  ('vencimientos', 'Vencimientos', 'Control de productos próximos a vencer en depósito.', '⏰', 'deposito', '{"admin","deposito","compras"}', 'soon', '#', null, 130),
  ('cashflow', 'Cashflow', 'Flujo de caja proyectado y seguimiento de ingresos/egresos.', '💹', 'administracion', '{"admin","administracion","compras"}', 'soon', '#', null, 140),
  ('portal', 'Portal Cuenta Corriente', 'Saldos, facturas y pagos de clientes (MercadoPago).', '🏦', 'administracion', '{"admin","administracion","cliente"}', 'live', '#', null, 150),
  ('cobranzas-revision', 'Revisión de Cobranzas', 'Comprobantes que cargaron los vendedores: cruzar con el banco y aceptar o rechazar.', '💳', 'administracion', '{"admin","administracion","tesoreria"}', 'live', 'cobranzas-tesoreria.html', null, 160),
  ('cobranzas', 'Cobranzas', 'Reparto automático de pagos parciales, factura más atrasada primero.', '💵', 'administracion', '{"admin","administracion"}', 'live', '#', null, 170),
  ('whatsapp', 'Recordatorios WhatsApp', 'Avisos automáticos de cuenta corriente por WhatsApp oficial.', '💬', 'administracion', '{"admin","administracion"}', 'live', '#', null, 180),
  ('reportes', 'Reportes (Boox)', 'Dashboard de estadísticas para clientes.', '📊', 'reportes', '{"admin","direccion","reportes","cliente"}', 'live', '#', null, 190),
  ('mis-reportes', 'Reportes', 'Presentá reportes a Dirección y seguí el estado y la devolución de Fernando.', '📄', 'reportes', '{"admin","compras","marketing","ventas","deposito","administracion"}', 'live', 'mis-reportes.html', null, 200)
on conflict (id) do nothing;

-- Permisos: cualquiera puede leerlas (el Hub las necesita para dibujar las tarjetas),
-- pero solo alguien con sesión iniciada puede modificarlas.
alter table public.hub_herramientas enable row level security;

drop policy if exists "hub_herramientas_lectura"   on public.hub_herramientas;
drop policy if exists "hub_herramientas_escritura" on public.hub_herramientas;

create policy "hub_herramientas_lectura" on public.hub_herramientas
  for select using (true);

create policy "hub_herramientas_escritura" on public.hub_herramientas
  for all to authenticated using (true) with check (true);

-- Comprobar:
--   select id, nombre, area, estado from public.hub_herramientas order by orden;
