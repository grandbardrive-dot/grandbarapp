-- ============================================================
--  Manual de DISCOS v3 — el recorrido que definió el usuario (12/09/2026)
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--  Va DESPUÉS de manual-disco-v2.sql. Se puede correr más de una vez.
--
--  Recorrido:
--   1. Introducción (la misma de todos los manuales)
--   2. Vinos: Acciones de Incorporación · Acciones Mensuales · Vinos por Copa
--   3. Spirits: Acciones Mensuales · Acciones de Incorporación ·
--      Aperitivos de bienvenida o pre cena · Cervezas y RTD
--   4. Activaciones & Fechas Especiales (igual que bares)
--   5. Materiales & Visibilidad (igual que bares)
--   6. Eventos pre armados (los carga Luciana como planes; el vendedor los cierra)
--   7. Acuerdos con partners (pedido a la marca; lo valida el supervisor)
--   8. Cierre de visita
--
--  Las secciones "igual que bares" son las de la copia de bares que ya estaba en
--  Discos (v2 la apagó): se vuelven a prender con los MISMOS códigos que en
--  bares, así funcionan igual (visibilidad, materiales, calendario).
--  Nada se borra: lo que no va se apaga.
--  Solo con previa: Vinos por Copa y Aperitivos de bienvenida o pre cena.
-- ============================================================

-- A) Pedidos a las marcas partner. Los carga el vendedor en la visita y quedan
--    'pendiente' hasta que el supervisor los aprueba o rechaza
--    (Hub → supervisor-pedidos.html). Después solo quedan registrados.
create table if not exists public.partner_pedidos (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid,
  cliente_nombre  text,
  vendedor_id     uuid,
  vendedor_codigo text,
  vendedor_nombre text,
  marca           text not null,
  necesita        text,
  volumen         text,
  preferidas      text,
  fee             numeric,
  plata           numeric,
  notas           text,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'aprobado', 'rechazado')),
  nota_supervisor text,
  revisado_por    text,
  revisado_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists partner_pedidos_vendedor_idx on public.partner_pedidos (vendedor_id, estado);
create index if not exists partner_pedidos_cliente_idx  on public.partner_pedidos (cliente_id);
alter table public.partner_pedidos enable row level security;
do $$ begin
  create policy "anon_all_partner_pedidos" on public.partner_pedidos for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- B) Eventos pre armados vendidos. Un evento se le puede vender a todos los
--    boliches; "vendido" es por cliente (uno por evento y cliente).
create table if not exists public.evento_ventas (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null,          -- el evento (checklist_planes)
  cliente_id      uuid not null,
  vendedor_id     uuid,
  vendedor_nombre text,
  created_at      timestamptz not null default now(),
  unique (plan_id, cliente_id)
);
create index if not exists evento_ventas_cliente_idx on public.evento_ventas (cliente_id);
alter table public.evento_ventas enable row level security;
do $$ begin
  create policy "anon_all_evento_ventas" on public.evento_ventas for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- C) Prender lo que va (las secciones de la copia de bares), con el nombre y
--    el orden del recorrido. null = deja el nombre que tiene.
update public.checklist_secciones s
   set activa = true,
       orden = v.orden,
       nombre = coalesce(v.nombre, s.nombre),
       descripcion = coalesce(v.descripcion, s.descripcion)
  from (values
    ('preparacion_de_la_visita',   0, null,                         null),
    ('vinos',                      1, 'VINOS & ESPUMANTES',         null),
    ('incorporaciones_2',          0, 'Acciones de Incorporación',  null),
    ('acciones_mensuales_2',       1, 'Acciones Mensuales',         null),
    ('vino_por_copa',              2, 'Vinos por Copa',             'Espumantes y demás vinos por copa'),
    ('barra_cocteleria',           2, 'SPIRITS',                    'Spirits, aperitivos, cervezas y RTD'),
    ('acciones_mensuales',         0, 'Acciones Mensuales',         null),
    ('incorporaciones',            1, 'Acciones de Incorporación',  null),
    ('activaciones_fechas_especi', 3, null,                         null),
    ('proximas_fechas',            0, null,                         null),
    ('proponer_activacion',        1, null,                         null),
    ('seguimiento',                2, null,                         null),
    ('materiales_visibilidad',     4, null,                         null),
    ('materiales_disponibles',     0, null,                         null),
    ('oportunidades_de_visibilid', 1, null,                         null),
    ('materiales_entregados_evid', 2, null,                         null)
  ) as v (codigo, orden, nombre, descripcion)
 where s.canal = 'disco' and s.zona = 'mendoza' and s.codigo = v.codigo;

-- D) Nuevas dentro de SPIRITS: aperitivos (solo con previa) y cervezas / RTD
insert into public.checklist_secciones
  (canal, zona, codigo, nombre, descripcion, icono, intro, orden, activa, parent_id, solo_formato)
select 'disco', 'mendoza', v.codigo, v.nombre, v.descripcion, v.icono, null, v.orden, true,
       (select id from public.checklist_secciones
         where canal = 'disco' and zona = 'mendoza' and codigo = 'barra_cocteleria'),
       v.solo
  from (values
    ('dc_aperitivos',   'Aperitivos de bienvenida o pre cena', 'Para recibir a la gente antes de la cena', '🍹', 2, 'con_previa'),
    ('dc_cervezas_rtd', 'Cervezas y RTD',                      'Ofertas de cervezas y listos para tomar',  '🍺', 3, null)
  ) as v (codigo, nombre, descripcion, icono, orden, solo)
on conflict (canal, zona, codigo) do nothing;

-- E) Eventos pre armados, acuerdos con partners y cierre (secciones de v2)
update public.checklist_secciones s
   set activa = true, orden = v.orden, nombre = v.nombre, descripcion = v.descripcion, intro = v.intro
  from (values
    ('dc_eventos',        5, 'EVENTOS PRE ARMADOS',   'Eventos con marcas para ofrecerle al boliche',   null),
    ('dc_eventos_mes',    0, 'Eventos para ofrecer',  'Condiciones de compra, materiales y beneficios', 'Los carga Luciana. Cuando el cliente toma uno, tocá "Cerrar evento" y queda como vendido.'),
    ('dc_acuerdos',       6, 'ACUERDOS CON PARTNERS', 'Pedidos de acción a las marcas de spirits',      null),
    ('dc_acuerdos_marca', 0, 'Pedido de acción',      'Lo que el cliente necesita de la marca',         'El pedido de acción queda pendiente hasta que lo valida el supervisor.'),
    ('dc_cierre',         7, 'CIERRE DE VISITA',      'Resumen, próxima acción y envío al cliente',     null)
  ) as v (codigo, orden, nombre, descripcion, intro)
 where s.canal = 'disco' and s.zona = 'mendoza' and s.codigo = v.codigo;

-- F) Apagar lo que no va en este recorrido (no se borra)
update public.checklist_secciones
   set activa = false
 where canal = 'disco' and zona = 'mendoza' and codigo in (
   -- de v2
   'dc_intro', 'dc_carta', 'dc_carta_vinos', 'dc_vino_copa', 'dc_mix_ideal', 'dc_cocteleria',
   'dc_spirits_rotacion', 'dc_sunset', 'dc_activaciones',
   'dc_materiales', 'dc_mat_disponibles', 'dc_mat_restringidos',
   'dc_seguimiento', 'dc_fechas', 'dc_eventos_cliente',
   -- de la copia de bares
   'espumantes_aperol', 'oportunidades_en_carta', 'desarrollo_de_cocteleria',
   'frio_consumo_inmediato', 'heladera_disponibilidad', 'incorporaciones_3', 'acciones_mensuales_3',
   'stock_rotacion', 'reposicion_quiebres', 'baja_rotacion',
   'partners_con_bodegas_benef', 'capacitaciones', 'cierre_de_visita'
 );

-- G) Solo con previa: Vinos por Copa (Aperitivos ya entra marcada en D)
update public.checklist_secciones
   set solo_formato = 'con_previa'
 where canal = 'disco' and zona = 'mendoza' and codigo = 'vino_por_copa' and solo_formato is null;

-- H) Tareas para tildar
with i (codigo, texto, orden) as (values
  ('proponer_activacion', 'Acordé que el cliente publique la acción en sus redes (foto como evidencia)', 0),
  ('dc_aperitivos',       'Propuse un aperitivo de bienvenida para antes de la cena',                    0)
)
insert into public.checklist_items (seccion_id, texto, orden, activo)
select s.id, i.texto, i.orden, true
  from i
  join public.checklist_secciones s on s.canal = 'disco' and s.zona = 'mendoza' and s.codigo = i.codigo
 where not exists (select 1 from public.checklist_items x where x.seccion_id = s.id and x.texto = i.texto);

-- I) Comprobar: 8 secciones y 15 subsecciones activas.
--    Vinos por Copa y Aperitivos tienen que decir con_previa.
select coalesce(m.nombre || '  ›  ', '') || s.nombre as seccion, s.codigo, s.especial, s.solo_formato,
       (select count(*) from public.checklist_items i where i.seccion_id = s.id and i.activo) as tareas
  from public.checklist_secciones s
  left join public.checklist_secciones m on m.id = s.parent_id
 where s.canal = 'disco' and s.zona = 'mendoza' and s.activa
 order by coalesce(m.orden, s.orden), s.parent_id nulls first, s.orden;
