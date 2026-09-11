-- ============================================================
--  PRE-ARMADOS DE FRIGOBAR (Hoteles) — GrandBar
--  Packs pre-armados de productos para el frigobar/minibar que
--  Luciana carga desde su panel (Campañas → Frigobar) para que el
--  vendedor se los proponga al hotel. Similar a Mix Ideal.
--  El vendedor los ve en el manual, en FRIGOBAR → Pre-armados.
--
--  Ejecutar en: Supabase (proyecto del Manual, fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists packs_frigobar (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                 -- "Frigobar Clásico"
  nivel text,                           -- "Básico", "Premium", etc. (chip)
  contenido text,                       -- un producto por línea
  descripcion text,                     -- para qué sirve / cuándo ofrecerlo
  precio numeric,                       -- precio del pack (opcional)
  imagen_url text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz default now()
);

alter table packs_frigobar enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'packs_frigobar' and policyname = 'anon_all_packs_frigobar') then
    create policy "anon_all_packs_frigobar" on packs_frigobar for all using (true) with check (true);
  end if;
end $$;

create index if not exists packs_frigobar_orden on packs_frigobar (activo, orden);

-- ── Pack de ejemplo ──
insert into packs_frigobar (nombre, nivel, contenido, descripcion, precio, orden, activo)
select
  'Frigobar Clásico', 'Básico',
  E'2 Aguas sin gas\n2 Gaseosas\n2 Cervezas\n1 Vino individual\n2 Snacks',
  'Ideal para hoteles que recién arman su frigobar. Cubre las bebidas básicas de una habitación.',
  null, 0, true
where not exists (select 1 from packs_frigobar where nombre = 'Frigobar Clásico');
