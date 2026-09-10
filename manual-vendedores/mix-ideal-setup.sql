-- ============================================================
--  MIX IDEAL — GrandBar
--  Combos de productos de distintas categorías (gin, vodka, tequila…)
--  que Luciana arma desde su panel (Campañas → Mix Ideal) para que el
--  vendedor le proponga al BAR en combo.
--  El vendedor los ve en el manual, en SPIRITS → Propuestas Mix Ideal.
--
--  Ejecutar en: Supabase (proyecto del Manual, fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists mixes_ideales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                 -- "Mix Básico de Barra"
  nivel text,                           -- "Básico", "Alta gama", etc. (chip)
  contenido text,                       -- un producto por línea: "1 Gin\n1 Vodka\n1 Tequila"
  descripcion text,                     -- para qué sirve / cuándo ofrecerlo
  precio numeric,                       -- precio del combo (opcional)
  imagen_url text,
  canal text default 'bar',
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz default now()
);

alter table mixes_ideales enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'mixes_ideales' and policyname = 'anon_all_mixes_ideales') then
    create policy "anon_all_mixes_ideales" on mixes_ideales for all using (true) with check (true);
  end if;
end $$;

create index if not exists mixes_ideales_orden on mixes_ideales (activo, orden);

-- ── Mix de ejemplo (para ver cómo se ve en el manual) ──
insert into mixes_ideales (nombre, nivel, contenido, descripcion, precio, orden, activo)
select
  'Mix Básico de Barra', 'Básico',
  E'1 Gin Beefeater\n1 Vodka Absolut\n1 Tequila\n1 Ron Havana',
  'Los cuatro destilados base para arrancar la coctelería del bar. Ideal para clientes que recién ordenan su barra.',
  null, 0, true
where not exists (select 1 from mixes_ideales where nombre = 'Mix Básico de Barra');
