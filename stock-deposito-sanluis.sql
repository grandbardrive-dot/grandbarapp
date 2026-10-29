-- ============================================================
--  Stock del depósito: Mendoza y San Luis  (29/10/2026)
--  Cristian (encargado del depósito de San Luis) cuenta igual que Lucas Porro y
--  Lucas Buenanueva en Mendoza, y sus conteos le llegan a Romina (administración de
--  San Luis), como los de Mendoza le llegan a Laura.
--  Cada tabla del stock pasa a tener su depósito. Todo lo que había queda en Mendoza.
--  El stock de San Luis sale de Córdoba: DtTabla STOCK, depósito 02 (ver _stock-sync.js).
-- ============================================================

-- Stock del sistema: un número por depósito y artículo.
alter table public.stock_sistema add column if not exists deposito text not null default 'mendoza';
alter table public.stock_sistema drop constraint if exists stock_sistema_pkey;
alter table public.stock_sistema add constraint stock_sistema_pkey primary key (deposito, sku);
alter table public.stock_sistema add constraint stock_sistema_deposito_check check (deposito in ('mendoza','san_luis'));

-- Agenda de los lunes: un proveedor está una sola vez por depósito y sector.
alter table public.stock_agenda add column if not exists deposito text not null default 'mendoza';
alter table public.stock_agenda drop constraint if exists stock_agenda_sector_proveedor_key;
alter table public.stock_agenda add constraint stock_agenda_dep_sector_proveedor_key unique (deposito, sector, proveedor);
alter table public.stock_agenda add constraint stock_agenda_deposito_check check (deposito in ('mendoza','san_luis'));

-- Proveedores excluidos, por depósito.
alter table public.stock_proveedores_excluidos add column if not exists deposito text not null default 'mendoza';
alter table public.stock_proveedores_excluidos drop constraint if exists stock_proveedores_excluidos_pkey;
alter table public.stock_proveedores_excluidos add constraint stock_proveedores_excluidos_pkey primary key (deposito, sector, proveedor);
alter table public.stock_proveedores_excluidos add constraint stock_proveedores_excluidos_deposito_check check (deposito in ('mendoza','san_luis'));

-- Reinicio del ciclo, por depósito.
alter table public.stock_ciclos add column if not exists deposito text not null default 'mendoza';
alter table public.stock_ciclos drop constraint if exists stock_ciclos_pkey;
alter table public.stock_ciclos add constraint stock_ciclos_pkey primary key (deposito, sector);
alter table public.stock_ciclos add constraint stock_ciclos_deposito_check check (deposito in ('mendoza','san_luis'));

-- Conteos: de qué depósito es cada uno.
alter table public.stock_conteos add column if not exists deposito text not null default 'mendoza';
alter table public.stock_conteos add constraint stock_conteos_deposito_check check (deposito in ('mendoza','san_luis'));
create index if not exists stock_conteos_dep_fecha on public.stock_conteos (deposito, created_at desc);
