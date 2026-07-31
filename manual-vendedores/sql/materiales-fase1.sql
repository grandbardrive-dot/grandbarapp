-- ============================================================================
--  GrandBar · Biblioteca e Inventario de Materiales — FASE 1
--  Correr en: Supabase → SQL Editor → New query → pegar todo → Run
--  Seguro de correr varias veces (usa IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

-- ---------- Categorías y subcategorías ----------
create table if not exists material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  orden int default 0,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists material_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references material_categories(id) on delete cascade,
  name text not null,
  orden int default 0,
  activo boolean default true,
  created_at timestamptz default now()
);

-- ---------- Marcas y líneas (dependientes del proveedor) ----------
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references proveedores(id) on delete set null,
  name text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists product_lines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  name text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

-- ---------- Depósitos y ubicaciones ----------
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid references warehouses(id) on delete cascade,
  sector text,
  estante text,
  contenedor text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- ---------- Materiales ----------
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  -- Paso 1: identificación
  name text not null,
  description text,
  internal_code text,
  sku text,
  barcode text,
  category_id uuid references material_categories(id) on delete set null,
  subcategory_id uuid references material_subcategories(id) on delete set null,
  -- Paso 2: marca y proveedor
  supplier_id uuid references proveedores(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  product_line_id uuid references product_lines(id) on delete set null,
  producto_asociado text,
  origin_campaign_id uuid,
  -- Fotos (original + procesada por IA; nunca se pisan)
  original_image_url text,
  processed_image_url text,
  ai_processing_status text default 'none',   -- none|pending|processing|completed|failed
  -- Paso 3: inventario
  unit_type text default 'unidad',            -- unidad|caja|kit|pack|juego|metro|otro
  minimum_stock numeric default 0,
  condition text default 'nuevo',             -- nuevo|excelente|bueno|regular|dañado|en_reparacion|fuera_de_uso
  warehouse_id uuid references warehouses(id) on delete set null,
  location_id uuid references warehouse_locations(id) on delete set null,
  location_detail text,
  is_returnable boolean default false,
  requires_approval boolean default false,
  fecha_ingreso date default current_date,
  fecha_devolucion_estimada date,
  -- Paso 4: uso comercial
  canales text[] default '{}',
  rubros text[] default '{}',
  tipo_accion text,
  fechas_especiales text[] default '{}',
  instrucciones text,
  pdf_url text,
  video_url text,
  observaciones text,
  visible_to_luciana boolean default true,
  visible_to_sellers boolean default false,
  -- meta / baja lógica
  is_active boolean default true,
  created_at timestamptz default now(),
  created_by text,
  updated_at timestamptz default now(),
  updated_by text
);

-- ---------- Movimientos de stock (única fuente de verdad del stock) ----------
create table if not exists material_stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id) on delete cascade,
  movement_type text not null,  -- ingreso|salida|reserva|entrega|devolucion|ajuste_positivo|ajuste_negativo|rotura|perdida|baja|transferencia|conteo
  quantity numeric not null default 0,
  previous_stock numeric,
  resulting_stock numeric,
  seller_id uuid,
  customer_id uuid,
  campaign_id uuid,
  request_id uuid,
  evidence_image_url text,
  condition_after text,
  notes text,
  created_at timestamptz default now(),
  created_by text
);

create index if not exists idx_msm_material on material_stock_movements(material_id);
create index if not exists idx_materials_supplier on materials(supplier_id);
create index if not exists idx_materials_category on materials(category_id);
create index if not exists idx_brands_supplier on brands(supplier_id);
create index if not exists idx_lines_brand on product_lines(brand_id);

-- ---------- Vista: stock actual calculado desde los movimientos ----------
create or replace view materials_with_stock as
select m.*,
  coalesce((
    select sum(case
      when mv.movement_type in ('ingreso','devolucion','ajuste_positivo') then mv.quantity
      when mv.movement_type in ('salida','entrega','rotura','perdida','baja','ajuste_negativo') then -mv.quantity
      else 0 end)   -- reserva / transferencia / conteo son neutrales para el stock actual
    from material_stock_movements mv where mv.material_id = m.id
  ), 0) as stock_actual
from materials m;

-- ---------- Semilla: categorías sugeridas ----------
insert into material_categories (name, orden)
select v.name, v.orden from (values
  ('Exhibidores',1),('Displays',2),('Cenefas',3),('Cartelería',4),
  ('Material para góndola',5),('Material para vidriera',6),('Frío',7),
  ('Cristalería',8),('Indumentaria',9),('Bolsos y mochilas',10),('Barras',11),
  ('Iluminación',12),('Accesorios',13),('Material gastronómico',14),
  ('Material para eventos',15),('Otros',99)
) as v(name,orden)
where not exists (select 1 from material_categories mc where mc.name = v.name);

-- ---------- Semilla: depósito por defecto ----------
insert into warehouses (name)
select 'Depósito Central'
where not exists (select 1 from warehouses w where w.name = 'Depósito Central');

-- ---------- RLS permisiva (MODO B — igual que el resto de la app por ahora) ----------
-- La seguridad por rol real llega con el login (Fase 3). Por ahora anon puede operar.
do $$
declare t text;
begin
  foreach t in array array[
    'material_categories','material_subcategories','brands','product_lines',
    'warehouses','warehouse_locations','materials','material_stock_movements'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon_all_%1$s" on %1$I', t);
    execute format('create policy "anon_all_%1$s" on %1$I for all using (true) with check (true)', t);
    execute format('grant all on table %I to anon, authenticated', t);
  end loop;
end $$;

grant select on materials_with_stock to anon, authenticated;

-- Fin Fase 1.
