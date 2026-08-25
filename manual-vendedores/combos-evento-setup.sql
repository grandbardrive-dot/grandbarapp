-- ============================================================
--  COMBOS DE EVENTOS — GrandBar
--  Los carga Luciana desde su panel (Campañas → Combos de eventos)
--  y los ve el vendedor en el manual, dentro de EVENTOS → Combos.
--
--  Ejecutar en: Supabase (proyecto del Manual) → SQL Editor → New query
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists combos_evento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                 -- "Combo Gin Tonic"
  descripcion text,                     -- para qué sirve / cuándo ofrecerlo
  contenido text,                       -- "1 gin + 6 tónicas + hielo" (una línea por ítem o separado por +)
  rinde_personas integer,               -- para cuántas personas alcanza UN combo (opcional)
  imagen_url text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz default now()
);

alter table combos_evento enable row level security;

-- Mismo criterio que el resto de las tablas del manual: el panel y la app
-- entran con la clave pública.
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'combos_evento' and policyname = 'anon_all_combos_evento') then
    create policy "anon_all_combos_evento" on combos_evento for all using (true) with check (true);
  end if;
end $$;

create index if not exists combos_evento_orden on combos_evento (activo, orden);
