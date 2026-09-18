-- ============================================================
--  Sellout mensual por proveedor (para el panel del proveedor)
--  Guarda el reporte de sellout que hoy arma Seba en Excel, ya
--  agregado por mes. Una fila por (proveedor, periodo):
--    periodo = 'YYYY-MM'  → datos del mes (totales + por canal,
--                            familia, artículo, vendedor, clientes…)
--    periodo = 'stock'    → foto de stock actual del proveedor
--  data (jsonb) trae todo lo que muestra el dashboard.
--
--  Correr en: Supabase proyecto Manual (fzaxwuuo) → SQL Editor.
-- ============================================================

create table if not exists sellout_reportes (
  proveedor  text not null,           -- debe coincidir con usuarios.empresa del proveedor (ej. 'Chandon')
  periodo    text not null,           -- 'YYYY-MM' | 'stock'
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (proveedor, periodo)
);

alter table sellout_reportes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='sellout_reportes' and policyname='sellout_anon_all') then
    create policy sellout_anon_all on sellout_reportes for all using (true) with check (true);
  end if;
end $$;
