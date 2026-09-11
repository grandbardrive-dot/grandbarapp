-- ============================================================
--  VINO POR COPA — GrandBar
--  Vinos que los proveedores dan para vender por copa con una
--  condición especial. Los carga Luciana desde su panel
--  (Campañas → Vino por Copa) y los ve el vendedor en el manual,
--  en VINOS & ESPUMANTES → Vino por Copa (junto a la calculadora).
--
--  Ejecutar en: Supabase (proyecto del Manual, fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists vinos_por_copa (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                 -- "Alma Mora Malbec"
  proveedor text,                       -- "Peñaflor"
  condicion text,                       -- "1+1 en la primera compra para copa de la casa"
  precio_botella numeric,               -- precio de la botella (para la calculadora), opcional
  descripcion text,                     -- nota para el vendedor, opcional
  imagen_url text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz default now()
);

alter table vinos_por_copa enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'vinos_por_copa' and policyname = 'anon_all_vinos_por_copa') then
    create policy "anon_all_vinos_por_copa" on vinos_por_copa for all using (true) with check (true);
  end if;
end $$;

create index if not exists vinos_por_copa_orden on vinos_por_copa (activo, orden);

-- ── Vino de ejemplo (para ver cómo se ve en el manual) ──
insert into vinos_por_copa (nombre, proveedor, condicion, precio_botella, descripcion, orden, activo)
select
  'Alma Mora Malbec', 'Peñaflor',
  '1+1 en la primera compra para arrancar la copa de la casa',
  8000,
  'Ideal para bares que quieren sumar una copa de tinto accesible y de buena rotación.',
  0, true
where not exists (select 1 from vinos_por_copa where nombre = 'Alma Mora Malbec');
