-- ============================================================
--  GrandBar · Resultados de acciones · setup
--  Proyecto Supabase del panel de Luciana: fzaxwuuodseyyinveknn
--  Corré TODO esto una vez en el SQL Editor.
-- ============================================================

-- 1) VENTAS por artículo y día (baja desde el ERP Aikon/Sinergis).
--    Neto de ventas: facturas suman, notas de crédito restan.
create table if not exists ventas_articulos (
  sku            text not null,          -- código de artículo del sistema (Articulo, 8 díg)
  fecha          date not null,          -- fecha de emisión (AR)
  descripcion    text,
  marca          text,
  familia        text,
  familia_nombre text,
  codigo_barras  text,
  unidades       numeric default 0,      -- unidades netas (BO)
  importe        numeric default 0,      -- neto facturado (sin IVA), facturas - NC
  importe_iva    numeric default 0,      -- facturado CON IVA
  imp_interno    numeric default 0,      -- impuesto interno (destilados/cervezas; vinos=0)
  costo          numeric default 0,      -- costo neto total de lo vendido
  costo_pleno    numeric default 0,      -- costo neto + IVA + impuesto interno
  comprobantes   int     default 0,      -- cantidad de renglones que aportaron
  actualizado    timestamptz default now(),
  primary key (sku, fecha)
);
-- Si la tabla ya existía sin estas columnas, las agrega:
alter table ventas_articulos add column if not exists importe_iva numeric default 0;
alter table ventas_articulos add column if not exists imp_interno numeric default 0;
alter table ventas_articulos add column if not exists costo_pleno numeric default 0;
create index if not exists va_fecha_idx on ventas_articulos (fecha);
create index if not exists va_sku_idx   on ventas_articulos (sku);

alter table ventas_articulos enable row level security;
drop policy if exists "anon_all_ventas_articulos" on ventas_articulos;
create policy "anon_all_ventas_articulos" on ventas_articulos
  for all using (true) with check (true);

-- 2) Registro de corridas del sync (para saber hasta qué día bajamos).
create table if not exists ventas_sync_log (
  id          bigint generated always as identity primary key,
  desde       date,
  hasta       date,
  comprobantes int,
  renglones    int,
  skus         int,
  ok          boolean,
  detalle     text,
  created_at  timestamptz default now()
);
alter table ventas_sync_log enable row level security;
drop policy if exists "anon_all_ventas_sync_log" on ventas_sync_log;
create policy "anon_all_ventas_sync_log" on ventas_sync_log
  for all using (true) with check (true);

-- 3) Vincular cada acción con su(s) artículo(s) del sistema + objetivo.
--    articulos = lista de SKUs que cubre la acción (para cruzar con ventas).
--    objetivo_unidades = meta opcional para el % de cumplimiento.
alter table acciones_mensuales add column if not exists articulos        text[];
alter table acciones_mensuales add column if not exists objetivo_unidades numeric;

-- ============================================================
-- FIN
-- ============================================================
