-- ============================================================
-- MIGRACIÓN COMPLETA DE CHECKLISTS — GrandBar
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. CREAR TABLAS
-- ============================================================
create table if not exists checklist_secciones (
  id uuid default gen_random_uuid() primary key,
  canal text not null,
  codigo text,
  nombre text not null,
  descripcion text,
  icono text default '📋',
  icono_bg text default '#EAF2FB',
  icono_color text default '#1A5C9A',
  especial text,
  intro text,
  orden integer not null default 0,
  activa boolean default true,
  created_at timestamptz default now()
);

create table if not exists checklist_items (
  id uuid default gen_random_uuid() primary key,
  seccion_id uuid references checklist_secciones(id) on delete cascade,
  texto text not null,
  descripcion text,
  orden integer not null default 0,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists checklist_planes (
  id uuid default gen_random_uuid() primary key,
  seccion_id uuid references checklist_secciones(id) on delete cascade,
  nombre text not null,
  proveedor text,
  condicion text,
  descripcion text,
  lineas_participantes text[],
  fecha_inicio date,
  fecha_fin date,
  activo boolean default true,
  created_at timestamptz default now()
);

-- RLS
alter table checklist_secciones enable row level security;
alter table checklist_items     enable row level security;
alter table checklist_planes    enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='checklist_secciones' and policyname='anon_all_cl_sec') then
    create policy "anon_all_cl_sec"   on checklist_secciones for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='checklist_items'     and policyname='anon_all_cl_items') then
    create policy "anon_all_cl_items" on checklist_items     for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='checklist_planes'    and policyname='anon_all_cl_plan') then
    create policy "anon_all_cl_plan"  on checklist_planes    for all using (true) with check (true); end if;
end $$;

-- Índice único para evitar duplicados en re-ejecución
create unique index if not exists cl_sec_canal_codigo on checklist_secciones(canal, codigo);

-- ============================================================
-- 2. SECCIONES — RESTAURANTE
-- ============================================================
insert into checklist_secciones (canal,codigo,nombre,descripcion,icono,icono_bg,icono_color,especial,intro,orden,activa) values
('restaurante','s0','Introducción & preparación','Antes de entrar al local','📋','#EAF2FB','#1A5C9A',null,'Revisá estos puntos antes de ingresar para llegar preparado y generar confianza desde el primer momento.',0,true),
('restaurante','s1','Acciones de incorporación','Sumar nuevos productos a la carta','🔄','#EAF4EE','#2D6A4F',null,'Detectá qué categorías o productos no están activos y proponé incorporarlos con argumentos de rentabilidad.',1,true),
('restaurante','s_acciones_mensuales','Acciones Mensuales','Promos y condiciones activas del mes','⭐','#FDF5E0','#8A5E00','acciones_mensuales','Acciones vigentes cargadas por administración para este canal.',2,true),
('restaurante','s2','Acciones de rotación','Mejorar la rotación del stock existente','⇄','#FDF5E0','#8A5E00',null,'Revisá el stock en bodega, identificá productos de baja rotación y acordá acciones concretas para moverlos.',3,true),
('restaurante','s3','Acciones fechas especiales','Oportunidades de temporada','📅','#FBEAF0','#72243E',null,'Anticipate a las fechas clave para que el cliente tenga stock y propuestas especiales a tiempo.',4,true),
('restaurante','s4','Acciones de precio','Precio de venta al consumidor','🏷','#EEEDF8','#4A3D8F',null,'Ayudá al cliente a fijar precios competitivos que cuiden su margen y mejoren la rotación.',5,true),
('restaurante','s5','Nuevos productos — futuras incorporaciones','Pipeline de lanzamientos','📦','#E1F5EE','#085041',null,'Mantené al cliente informado de lo que viene para que pueda planificar con tiempo.',6,true),
('restaurante','s6','Acciones aperitivos','Activar la categoría pre-cena','🍷','#FAECE7','#712B13',null,'Los aperitivos son una categoría de alto margen y crecimiento. Muchos restaurantes la tienen subdesarrollada.',7,true),
('restaurante','s7','Vino por copa','Programa de copa de la casa','🍸','#EEEDF8','#4A3D8F',null,'El vino por copa aumenta el ticket promedio y facilita la rotación.',8,true),
('restaurante','s8','Propuestas Café Segafreddo','Activar la categoría café','☕','#FAECE7','#993C1D',null,'El café de calidad es el cierre perfecto de una experiencia gastronómica. Segafreddo eleva la percepción del restaurante.',9,true),
('restaurante','s9','Acciones con materiales','POP y comunicación en punto de venta','📷','#EAF4EE','#27500A',null,'Los materiales bien colocados comunican al consumidor final y aumentan la probabilidad de venta.',10,true),
('restaurante','s10','Partners con bodegas | Beneficios clientes','Activaciones co-branded','🏆','#FDF5E0','#854F0B',null,'Las bodegas partner ofrecen beneficios exclusivos para restaurantes que activan sus productos.',11,true)
on conflict (canal,codigo) do nothing;

-- ============================================================
-- 3. SECCIONES — VINOTECA
-- ============================================================
insert into checklist_secciones (canal,codigo,nombre,descripcion,icono,icono_bg,icono_color,especial,intro,orden,activa) values
('vinoteca','vt1','Vidrieras','Acuerdos de exhibición y vidriera','🪟','#EAF2FB','#1F447F','vidriera','Verificá si el cliente tiene un acuerdo vigente o cerrá uno nuevo.',0,true),
('vinoteca','vt2','Productos de heladera','Stock, quiebres y oportunidades de incorporación','🧊','#EAF2FB','#0D3B66','heladera','Revisá el estado de la heladera e identificá incorporaciones posibles.',1,true),
('vinoteca','vt3','Góndola de vinos','Promos del mes y acuerdos especiales','🍷','#EEEDF8','#4A3D8F','gondola_vinos','Revisá la góndola de vinos y gestioná las promos vigentes.',2,true),
('vinoteca','vt_acciones_mensuales','Acciones Mensuales','Promos y condiciones activas del mes','⭐','#FDF5E0','#8A5E00','acciones_mensuales','Acciones vigentes cargadas por administración para este canal.',3,true),
('vinoteca','vt4','Incorporaciones','Condiciones generales y Peñaflor 11T','🔄','#EAF4EE','#2D6A4F','incorporaciones','Incorporaciones con condiciones especiales vigentes.',4,true),
('vinoteca','vt5','Góndola Spirits','Promos de spirits y activaciones de canal','🥃','#FAECE7','#712B13','gondola_spirits','Revisá la góndola de spirits y cerrá acciones vigentes.',5,true),
('vinoteca','vt6','Activaciones con materiales','Solicitud y colocación de materiales POP','📦','#EAF4EE','#27500A','materiales','Gestioná los materiales de comunicación y solicitá vía WhatsApp.',6,true),
('vinoteca','vt7','Fechas especiales','Acciones de temporada y eventos','📅','#FBEAF0','#72243E','fechas','Acciones vigentes cargadas por administración.',7,true),
('vinoteca','vt8','Partners con Bodegas | Beneficios','Programas co-branded y beneficios exclusivos','🏆','#FDF5E0','#854F0B',null,'Las bodegas partner ofrecen beneficios exclusivos para vinotecas.',8,true)
on conflict (canal,codigo) do nothing;

-- ============================================================
-- 4. ÍTEMS — RESTAURANTE
-- ============================================================

-- s0: Introducción & preparación
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Revisé el historial del cliente antes de la visita','Pedidos anteriores, categorías activas, última visita, deudas pendientes',0,true from checklist_secciones where canal='restaurante' and codigo='s0'
union all
select id,'Tengo materiales de apoyo y catálogos actualizados','Carta de vinos vigente, folletería de productos nuevos, materiales POP',1,true from checklist_secciones where canal='restaurante' and codigo='s0'
union all
select id,'Identifiqué oportunidades de mejora para este cliente','Categorías no activas, productos de la competencia, quiebres anteriores',2,true from checklist_secciones where canal='restaurante' and codigo='s0';

-- s1: Acciones de incorporación
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Relevé categorías faltantes en la carta actual','Ej: tiene vinos pero no tiene espumantes ni vinos por copa',0,true from checklist_secciones where canal='restaurante' and codigo='s1'
union all
select id,'Presenté al menos 1 producto nuevo para incorporar','Con argumento de margen, tendencia de consumo o diferenciación',1,true from checklist_secciones where canal='restaurante' and codigo='s1'
union all
select id,'Informé la condición de incorporación vigente (1+1 o 1+2 Peñaflor)','',2,true from checklist_secciones where canal='restaurante' and codigo='s1'
union all
select id,'Acordé exhibición / lugar en carta para el nuevo producto','Posición en menú, precio sugerido de venta',3,true from checklist_secciones where canal='restaurante' and codigo='s1';

-- s_acciones_mensuales
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Presenté las acciones vigentes del mes al cliente','',0,true from checklist_secciones where canal='restaurante' and codigo='s_acciones_mensuales'
union all
select id,'El cliente se sumó a al menos una acción o promo','',1,true from checklist_secciones where canal='restaurante' and codigo='s_acciones_mensuales';

-- s2: Rotación
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Revisé el stock en bodega o detrás del bar','Stock físico vs. lo que están vendiendo activamente',0,true from checklist_secciones where canal='restaurante' and codigo='s2'
union all
select id,'Identifiqué productos con baja rotación y acordé acción','Posición destacada, recomendación del mozo, combo con plato, precio especial',1,true from checklist_secciones where canal='restaurante' and codigo='s2'
union all
select id,'Verifiqué que los productos estrella estén bien surtidos','Sin quiebre ni riesgo de quiebre antes de la próxima visita',2,true from checklist_secciones where canal='restaurante' and codigo='s2';

-- s3: Fechas especiales
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Informé la próxima fecha especial relevante (≤30 días)','Día de la Madre, Navidad, San Valentín, Semana Santa, fiestas locales',0,true from checklist_secciones where canal='restaurante' and codigo='s3'
union all
select id,'Propuse oferta específica para esa fecha','Pack de espumantes, maridaje especial, oferta por volumen, copa de brindis',1,true from checklist_secciones where canal='restaurante' and codigo='s3'
union all
select id,'Cerré un pedido anticipado o dejé presupuesto armado','',2,true from checklist_secciones where canal='restaurante' and codigo='s3';

-- s4: Precio
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Revisé los precios actuales en carta vs. nuestros precios','Margen bruto aplicado, comparación con precios sugeridos de la zona',0,true from checklist_secciones where canal='restaurante' and codigo='s4'
union all
select id,'Sugerí ajuste de precio en al menos un producto','',1,true from checklist_secciones where canal='restaurante' and codigo='s4'
union all
select id,'Acordé precio sugerido de venta para nuevas incorporaciones','',2,true from checklist_secciones where canal='restaurante' and codigo='s4';

-- s5: Nuevos productos
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Presenté novedades del portafolio próximas a lanzar','Nuevas etiquetas, cosechas nuevas, líneas de espumantes, vinos orgánicos',0,true from checklist_secciones where canal='restaurante' and codigo='s5'
union all
select id,'Dejé muestra o ficha técnica del producto nuevo','',1,true from checklist_secciones where canal='restaurante' and codigo='s5'
union all
select id,'Acordé fecha de seguimiento para cierre de incorporación','',2,true from checklist_secciones where canal='restaurante' and codigo='s5';

-- s6: Aperitivos
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Revisé si tienen carta o propuesta de aperitivos activa','',0,true from checklist_secciones where canal='restaurante' and codigo='s6'
union all
select id,'Propuse ampliar o crear sección de aperitivos en carta','Con al menos 3 opciones en distintos rangos de precio',1,true from checklist_secciones where canal='restaurante' and codigo='s6'
union all
select id,'Presenté argumento de margen y tendencia de la categoría','Margen promedio 60–70% sobre costo, tendencia ascendente',2,true from checklist_secciones where canal='restaurante' and codigo='s6';

-- s7: Vino por copa
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Relevé si tienen propuesta de vinos por copa activa','Mínimo ideal: blanco, rosado y tinto de entrada',0,true from checklist_secciones where canal='restaurante' and codigo='s7'
union all
select id,'Presenté plan Doña Paula 3 meses para copa de la casa','',1,true from checklist_secciones where canal='restaurante' and codigo='s7'
union all
select id,'Presenté propuesta concreta de copa para blancos y tintos','Con precio sugerido y maridaje recomendado',2,true from checklist_secciones where canal='restaurante' and codigo='s7'
union all
select id,'Acordé al menos 1 producto para activar como copa de la casa','',3,true from checklist_secciones where canal='restaurante' and codigo='s7';

-- s8: Café Segafreddo
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Relevé qué café están usando actualmente','Proveedor actual, formato, satisfacción del encargado',0,true from checklist_secciones where canal='restaurante' and codigo='s8'
union all
select id,'Presenté propuesta Segafreddo con diferenciación de marca','',1,true from checklist_secciones where canal='restaurante' and codigo='s8'
union all
select id,'Dejé muestra / degustación acordada con el encargado','',2,true from checklist_secciones where canal='restaurante' and codigo='s8'
union all
select id,'Presenté materiales de comunicación disponibles','',3,true from checklist_secciones where canal='restaurante' and codigo='s8';

-- s9: Materiales
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Revisé si los materiales actuales están en buen estado y visibles','Cartas de vino, cenefas, displays, carteles de copa, posavasos',0,true from checklist_secciones where canal='restaurante' and codigo='s9'
union all
select id,'Repuse o actualicé materiales desactualizados o deteriorados','',1,true from checklist_secciones where canal='restaurante' and codigo='s9'
union all
select id,'Coloqué nuevo material POP para producto o acción vigente','Posición: entrada, mesa, barra o pizarra',2,true from checklist_secciones where canal='restaurante' and codigo='s9';

-- s10: Partners
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Presenté algún programa de beneficios vigente de bodegas partner','Degustaciones, capacitaciones para mozos, materiales co-branded, bonificaciones',0,true from checklist_secciones where canal='restaurante' and codigo='s10'
union all
select id,'Conecté al cliente con un beneficio concreto aplicable hoy','',1,true from checklist_secciones where canal='restaurante' and codigo='s10'
union all
select id,'Documenté el compromiso tomado con el cliente','',2,true from checklist_secciones where canal='restaurante' and codigo='s10';

-- ============================================================
-- 5. ÍTEMS — VINOTECA
-- ============================================================

-- vt1: Vidrieras
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Revisé el estado y limpieza de la vidriera','Visibilidad de productos, iluminación, orden',0,true from checklist_secciones where canal='vinoteca' and codigo='vt1'
union all
select id,'Los productos están correctamente exhibidos y con precio','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt1'
union all
select id,'Actualicé materiales POP en vidriera','Cenefas, carteles, displays actualizados',2,true from checklist_secciones where canal='vinoteca' and codigo='vt1';

-- vt2: Heladera
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Relevé stock actual en heladera','Cantidad y variedad por categoría',0,true from checklist_secciones where canal='vinoteca' and codigo='vt2'
union all
select id,'Identifiqué quiebres o riesgo de quiebre','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt2'
union all
select id,'Propuse reposición o nuevas incorporaciones','',2,true from checklist_secciones where canal='vinoteca' and codigo='vt2';

-- vt3: Góndola vinos
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Relevé planograma actual y orden de la góndola','',0,true from checklist_secciones where canal='vinoteca' and codigo='vt3'
union all
select id,'Identifiqué productos de baja rotación','Acordé acción correctiva (precio, posición, bundle)',1,true from checklist_secciones where canal='vinoteca' and codigo='vt3'
union all
select id,'Informé promos activas del mes al cliente','',2,true from checklist_secciones where canal='vinoteca' and codigo='vt3'
union all
select id,'Cerré al menos 1 acción de incorporación o promo','',3,true from checklist_secciones where canal='vinoteca' and codigo='vt3';

-- vt_acciones_mensuales
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Presenté las acciones vigentes del mes al cliente','',0,true from checklist_secciones where canal='vinoteca' and codigo='vt_acciones_mensuales'
union all
select id,'El cliente se sumó a al menos una acción o promo','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt_acciones_mensuales';

-- vt4: Incorporaciones
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Relevé categorías faltantes en la oferta actual','',0,true from checklist_secciones where canal='vinoteca' and codigo='vt4'
union all
select id,'Presenté al menos 1 producto nuevo con argumento de margen','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt4'
union all
select id,'Informé condición de incorporación (1+1 general o 1+2 Peñaflor)','',2,true from checklist_secciones where canal='vinoteca' and codigo='vt4'
union all
select id,'Acordé incorporación y lugar de exhibición','',3,true from checklist_secciones where canal='vinoteca' and codigo='vt4';

-- vt5: Góndola Spirits
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Relevé stock y variedad de spirits en góndola','Whisky, gin, vodka, aperitivos, rum',0,true from checklist_secciones where canal='vinoteca' and codigo='vt5'
union all
select id,'Identifiqué oportunidades de incorporación','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt5'
union all
select id,'Propuse acción o promo del mes para spirits','',2,true from checklist_secciones where canal='vinoteca' and codigo='vt5'
union all
select id,'Acordé exhibición destacada para al menos 1 spirit','',3,true from checklist_secciones where canal='vinoteca' and codigo='vt5';

-- vt6: Materiales
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Revisé materiales actuales — estado y vigencia','Cenefas, carteles, displays, stoppers',0,true from checklist_secciones where canal='vinoteca' and codigo='vt6'
union all
select id,'Repuse o retiré materiales desactualizados','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt6'
union all
select id,'Solicité nuevos materiales si corresponde','',2,true from checklist_secciones where canal='vinoteca' and codigo='vt6';

-- vt7: Fechas especiales
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Informé al cliente las acciones de fechas especiales','',0,true from checklist_secciones where canal='vinoteca' and codigo='vt7'
union all
select id,'El cliente se sumó a al menos 1 acción','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt7'
union all
select id,'Acordé fecha de ejecución de la acción','',2,true from checklist_secciones where canal='vinoteca' and codigo='vt7';

-- vt8: Partners
insert into checklist_items (seccion_id,texto,descripcion,orden,activo)
select id,'Presenté programa de beneficios vigente de bodegas partner','Degustaciones, capacitaciones, materiales co-branded',0,true from checklist_secciones where canal='vinoteca' and codigo='vt8'
union all
select id,'Conecté al cliente con un beneficio concreto aplicable hoy','',1,true from checklist_secciones where canal='vinoteca' and codigo='vt8'
union all
select id,'Documenté el compromiso tomado con el cliente','',2,true from checklist_secciones where canal='vinoteca' and codigo='vt8';

-- ============================================================
-- 6. PLANES — RESTAURANTE
-- ============================================================

-- s1: Incorporación general + Peñaflor
insert into checklist_planes (seccion_id,nombre,condicion,proveedor,descripcion,lineas_participantes,activo)
select id,
  'Incorporación general — todos los vinos',
  '1+1',
  'Todo el portafolio',
  'Todos los vinos del portafolio tienen disponible la condición 1+1 para nuevas incorporaciones en carta de restaurante. Aplica sobre el primer pedido de cada línea no activa previamente.',
  array['Todo el portafolio','Primera compra por línea','Sin mínimo de cajas'],
  true
from checklist_secciones where canal='restaurante' and codigo='s1';

insert into checklist_planes (seccion_id,nombre,condicion,proveedor,descripcion,lineas_participantes,activo)
select id,
  'Peñaflor — 11 Tintos',
  '1+2',
  'Peñaflor',
  'Condición especial 1+2 para las líneas participantes de Peñaflor. Ideal para activar múltiples etiquetas en un solo pedido y maximizar el beneficio para el cliente.',
  array['Alma Mora','Don David','Fond de Cave','Fond de Cave RVA','Cazador','Mascota','NC Espumantes','Trapiche Medalla','Trapiche Reserva'],
  true
from checklist_secciones where canal='restaurante' and codigo='s1';

-- s7: Doña Paula copa de la casa
insert into checklist_planes (seccion_id,nombre,condicion,proveedor,descripcion,lineas_participantes,activo)
select id,
  'Doña Paula — Plan copa de la casa',
  '3 meses',
  'Doña Paula',
  'Plan de 3 meses de acompañamiento de la bodega Doña Paula para activar el vino por copa en el restaurante. Incluye soporte de comunicación y materiales. Consultá a tu supervisor para condiciones específicas de precio y mínimos.',
  array['Doña Paula','3 meses de vigencia','Copa de la casa'],
  true
from checklist_secciones where canal='restaurante' and codigo='s7';

-- ============================================================
-- 7. VERIFICACIÓN
-- ============================================================
select
  canal,
  count(*) as secciones
from checklist_secciones
group by canal
order by canal;

select
  cs.canal,
  cs.codigo,
  cs.nombre,
  count(ci.id) as items,
  count(cp.id) as planes
from checklist_secciones cs
left join checklist_items ci on ci.seccion_id = cs.id
left join checklist_planes cp on cp.seccion_id = cs.id
group by cs.canal, cs.codigo, cs.nombre, cs.orden
order by cs.canal, cs.orden;
