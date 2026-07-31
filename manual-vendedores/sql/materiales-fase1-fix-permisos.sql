-- ============================================================================
--  FIX permisos Fase 1 — otorga lectura/escritura (anon) a las tablas nuevas.
--  El bloque do$$ del script anterior cortó por error; esto lo resuelve.
--  Correr en Supabase → SQL Editor → Run. Seguro de correr varias veces.
-- ============================================================================

-- material_categories
alter table material_categories enable row level security;
drop policy if exists p_all_material_categories on material_categories;
create policy p_all_material_categories on material_categories for all to anon, authenticated using (true) with check (true);
grant all on table material_categories to anon, authenticated;

-- material_subcategories
alter table material_subcategories enable row level security;
drop policy if exists p_all_material_subcategories on material_subcategories;
create policy p_all_material_subcategories on material_subcategories for all to anon, authenticated using (true) with check (true);
grant all on table material_subcategories to anon, authenticated;

-- brands
alter table brands enable row level security;
drop policy if exists p_all_brands on brands;
create policy p_all_brands on brands for all to anon, authenticated using (true) with check (true);
grant all on table brands to anon, authenticated;

-- product_lines
alter table product_lines enable row level security;
drop policy if exists p_all_product_lines on product_lines;
create policy p_all_product_lines on product_lines for all to anon, authenticated using (true) with check (true);
grant all on table product_lines to anon, authenticated;

-- warehouses
alter table warehouses enable row level security;
drop policy if exists p_all_warehouses on warehouses;
create policy p_all_warehouses on warehouses for all to anon, authenticated using (true) with check (true);
grant all on table warehouses to anon, authenticated;

-- warehouse_locations
alter table warehouse_locations enable row level security;
drop policy if exists p_all_warehouse_locations on warehouse_locations;
create policy p_all_warehouse_locations on warehouse_locations for all to anon, authenticated using (true) with check (true);
grant all on table warehouse_locations to anon, authenticated;

-- materials
alter table materials enable row level security;
drop policy if exists p_all_materials on materials;
create policy p_all_materials on materials for all to anon, authenticated using (true) with check (true);
grant all on table materials to anon, authenticated;

-- material_stock_movements
alter table material_stock_movements enable row level security;
drop policy if exists p_all_material_stock_movements on material_stock_movements;
create policy p_all_material_stock_movements on material_stock_movements for all to anon, authenticated using (true) with check (true);
grant all on table material_stock_movements to anon, authenticated;

-- vista de stock
grant select on materials_with_stock to anon, authenticated;

-- Refrescar el cache de la API
notify pgrst, 'reload schema';
