-- ============================================================
--  11T Peñaflor · almacén del export de ventas (CuboVentas)
--  Correr en el proyecto Manual/Luciana:  fzaxwuuodseyyinveknn
--  (Supabase → SQL Editor → New query → pegar → Run)
--
--  El WebApi del ERP solo ve las facturas impresas (~13% de las ventas),
--  así que el 11T NO se alimenta de la API sino de este export que Luciana
--  sube día a día desde admin-11t.html. Cada carga reemplaza el mes.
-- ============================================================

create table if not exists ventas_penaflor (
  id             bigint generated always as identity primary key,
  mes            text not null,                 -- 'YYYY-MM'
  cliente_codigo text not null,
  cliente_nombre text,
  sku            text,
  articulo       text not null,
  familia2       text,                          -- bodega (Familia 2 del cubo)
  tipo_cliente   text,                          -- Vinoteca / Restaurant / Bar / ...
  vendedor       text,
  cantidad       numeric default 0
);
create index if not exists ventas_penaflor_mes_idx on ventas_penaflor(mes);
create index if not exists ventas_penaflor_cli_idx on ventas_penaflor(mes, cliente_codigo);

-- Metadatos de la última carga por mes (para mostrar "actualizado hace…").
create table if not exists ventas_penaflor_meta (
  mes          text primary key,
  actualizado  timestamptz default now(),
  filas        integer default 0,
  clientes     integer default 0,
  archivo      text
);

-- RLS abierto con la anon key (igual que el resto del proyecto manual).
alter table ventas_penaflor       enable row level security;
alter table ventas_penaflor_meta  enable row level security;
do $$ begin
  begin create policy vp_all  on ventas_penaflor      for all using (true) with check (true); exception when duplicate_object then null; end;
  begin create policy vpm_all on ventas_penaflor_meta for all using (true) with check (true); exception when duplicate_object then null; end;
end $$;
