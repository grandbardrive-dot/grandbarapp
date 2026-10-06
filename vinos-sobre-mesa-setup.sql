-- ============================================================
--  VINOS SOBRE LA MESA — GrandBar (06/10/2026)
--  Acciones de vino sobre la mesa que carga Luciana desde su panel
--  (Herramientas del manual → Vinos sobre la mesa). Cada una elige en qué
--  secciones del manual sale; si no elige ninguna, sale donde está la
--  herramienta (hoy: Restaurantes › "SOBRE LA MESA" › Vinos).
--
--  Ejecutar en: Supabase del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
--
--  Tabla cerrada (no se abre con using(true)):
--    · cualquiera lee SOLO las visibles (las ve el vendedor en el manual);
--    · cargar, editar, ocultar y borrar: solo los roles del panel comercial
--      (compras, desarrollo, diseno, marketing), con su sesión del Portal.
-- ============================================================

create table if not exists public.vinos_sobre_mesa (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,                     -- el vino o la línea
  proveedor   text,                              -- bodega o proveedor
  condicion   text,                              -- la acción: qué da y con qué condición
  descripcion text,                              -- nota para el vendedor (opcional)
  secciones   uuid[] not null default '{}',      -- checklist_secciones.id (base del manual) donde sale
  zonas       text[] not null default '{}',      -- 'mendoza' / 'sanluis'; vacío = las dos
  orden       integer not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.vinos_sobre_mesa enable row level security;

drop policy if exists vsm_leer_visibles on public.vinos_sobre_mesa;
create policy vsm_leer_visibles on public.vinos_sobre_mesa
  for select to anon, authenticated
  using (activo);

drop policy if exists vsm_panel_comercial on public.vinos_sobre_mesa;
create policy vsm_panel_comercial on public.vinos_sobre_mesa
  for all to authenticated
  using      (lower(coalesce(public.mi_rol(), '')) in ('compras', 'desarrollo', 'diseno', 'marketing'))
  with check (lower(coalesce(public.mi_rol(), '')) in ('compras', 'desarrollo', 'diseno', 'marketing'));

revoke all on public.vinos_sobre_mesa from anon;
grant select on public.vinos_sobre_mesa to anon;
grant select, insert, update, delete on public.vinos_sobre_mesa to authenticated;

create index if not exists vinos_sobre_mesa_orden on public.vinos_sobre_mesa (activo, orden);

-- Control: tiene que salir la tabla con 0 filas la primera vez.
select count(*) as vinos_sobre_la_mesa from public.vinos_sobre_mesa;
