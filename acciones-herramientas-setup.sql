-- ============================================================
--  PUNTERAS · ACCIONES DE VOLUMEN · DEGUSTACIONES — GrandBar (06/10/2026)
--  Acciones que carga Luciana desde su panel (Herramientas del manual) y ve el
--  vendedor en la sección del manual que ella elija. Si no elige ninguna, salen
--  donde está la herramienta:
--    · puntera     → "Plan de Punteras" (Autoservicios)
--    · volumen     → "Acciones de Volumen y Exhibidores" (Autoservicios, Vinotecas, Tiendas de bebidas)
--    · degustacion → "Plan de Degustaciones" (Autoservicios, Vinotecas, Tiendas de bebidas)
--  Juan Pablo (Trade Marketing) las ve y se las devuelve con observaciones.
--
--  Ejecutar en: Supabase del PORTAL (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
--
--  Tabla cerrada (igual que vinos_sobre_mesa, no se abre con using(true)):
--    · cualquiera lee SOLO las visibles (las ve el vendedor en el manual);
--    · cargar, editar, ocultar y borrar: solo los roles del panel comercial.
-- ============================================================

create table if not exists public.acciones_herramientas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('puntera', 'volumen', 'degustacion')),
  nombre      text not null,                     -- producto, marca o línea
  proveedor   text,                              -- bodega o proveedor
  condicion   text,                              -- la acción: qué da y con qué condición
  descripcion text,                              -- nota para el vendedor (opcional)
  fecha_desde date,                              -- vigencia (opcional)
  fecha_hasta date,
  secciones   uuid[] not null default '{}',      -- checklist_secciones.id (base del manual) donde sale
  zonas       text[] not null default '{}',      -- 'mendoza' / 'sanluis'; vacío = las dos
  orden       integer not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.acciones_herramientas enable row level security;

drop policy if exists ah_leer_visibles on public.acciones_herramientas;
create policy ah_leer_visibles on public.acciones_herramientas
  for select to anon, authenticated
  using (activo);

drop policy if exists ah_panel_comercial on public.acciones_herramientas;
create policy ah_panel_comercial on public.acciones_herramientas
  for all to authenticated
  using      (lower(coalesce(public.mi_rol(), '')) in ('compras', 'desarrollo', 'diseno', 'marketing'))
  with check (lower(coalesce(public.mi_rol(), '')) in ('compras', 'desarrollo', 'diseno', 'marketing'));

revoke all on public.acciones_herramientas from anon;
grant select on public.acciones_herramientas to anon;
grant select, insert, update, delete on public.acciones_herramientas to authenticated;

create index if not exists acciones_herramientas_tipo on public.acciones_herramientas (tipo, activo, orden);

-- Devoluciones de Trade Marketing: que Juan Pablo también pueda devolver estas.
alter table public.acciones_devoluciones drop constraint if exists acciones_devoluciones_origen_check;
alter table public.acciones_devoluciones add constraint acciones_devoluciones_origen_check
  check (origen in ('campania', 'plan', 'fecha', 'catalogo', 'vino_mesa', 'puntera', 'volumen', 'degustacion'));

-- Control: tiene que salir 0 la primera vez.
select count(*) as acciones_herramientas from public.acciones_herramientas;
