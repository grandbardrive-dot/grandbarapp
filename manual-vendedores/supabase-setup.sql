-- ============================================================
-- SETUP INICIAL — App Vendedores de Bebidas
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensión UUID (ya viene activa en Supabase, pero por las dudas)
create extension if not exists "uuid-ossp";


-- ────────────────────────────────────────────────────────────
-- TABLA: vendedores
-- ────────────────────────────────────────────────────────────
create table if not exists vendedores (
  id         uuid default gen_random_uuid() primary key,
  nombre     text not null,
  codigo     text unique not null,   -- ej: "VEN001" — lo que ingresa el vendedor
  zona       text,                   -- ej: "Zona Norte", "Capital"
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────
-- TABLA: clientes
-- ────────────────────────────────────────────────────────────
create table if not exists clientes (
  id              uuid default gen_random_uuid() primary key,
  codigo_cliente  text unique not null,   -- ej: "REST0042"
  nombre          text not null,
  direccion       text,
  tipo            text not null default 'restaurante',
                  -- valores: restaurante | vinoteca | hotel | bar | evento | (otros)
  vendedor_id     uuid references vendedores(id) on delete set null,
  created_at      timestamptz default now()
);

create index if not exists clientes_vendedor_idx on clientes(vendedor_id);
create index if not exists clientes_tipo_idx     on clientes(tipo);


-- ────────────────────────────────────────────────────────────
-- TABLA: visitas
-- ────────────────────────────────────────────────────────────
create table if not exists visitas (
  id               uuid default gen_random_uuid() primary key,
  vendedor_id      uuid references vendedores(id) on delete set null,
  cliente_id       uuid references clientes(id)   on delete cascade,
  fecha            timestamptz not null default now(),
  progreso         jsonb not null default '{}',
  -- estructura del JSON:
  -- { "s0": { "checks": [true, false, true], "obs": "texto libre" }, "s1": { ... }, ... }
  observaciones    text,           -- notas generales de la visita
  porcentaje_total integer not null default 0 check (porcentaje_total between 0 and 100),
  created_at       timestamptz default now()
);

create index if not exists visitas_vendedor_idx  on visitas(vendedor_id);
create index if not exists visitas_cliente_idx   on visitas(cliente_id);
create index if not exists visitas_fecha_idx     on visitas(fecha desc);


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- La app usa la anon key — esta política permite todo con esa key.
-- Para mayor seguridad en producción, reemplazar por políticas más
-- restrictivas o usar service_role key solo en el backend.
-- ────────────────────────────────────────────────────────────
alter table vendedores enable row level security;
alter table clientes   enable row level security;
alter table visitas    enable row level security;

-- Políticas permisivas para uso con anon key (herramienta interna)
create policy "anon_all_vendedores" on vendedores for all using (true) with check (true);
create policy "anon_all_clientes"   on clientes   for all using (true) with check (true);
create policy "anon_all_visitas"    on visitas     for all using (true) with check (true);


-- ────────────────────────────────────────────────────────────
-- DATOS DE EJEMPLO (opcional — borrar si no se necesitan)
-- ────────────────────────────────────────────────────────────

-- Vendedores de prueba
insert into vendedores (nombre, codigo, zona) values
  ('Martín García',    'VEN001', 'Zona Norte'),
  ('Laura Rodríguez',  'VEN002', 'Zona Sur'),
  ('Diego Fernández',  'VEN003', 'Capital')
on conflict (codigo) do nothing;

-- Clientes de prueba (referenciando los vendedores por código)
insert into clientes (codigo_cliente, nombre, direccion, tipo, vendedor_id)
select 'REST001', 'La Parrilla del Centro', 'Av. Corrientes 1234', 'restaurante', id from vendedores where codigo = 'VEN001'
on conflict (codigo_cliente) do nothing;

insert into clientes (codigo_cliente, nombre, direccion, tipo, vendedor_id)
select 'REST002', 'Bodegón El Ombú', 'San Martín 567', 'restaurante', id from vendedores where codigo = 'VEN001'
on conflict (codigo_cliente) do nothing;

insert into clientes (codigo_cliente, nombre, direccion, tipo, vendedor_id)
select 'VINO001', 'Vinoteca Malbec', 'Palermo, Gurruchaga 890', 'vinoteca', id from vendedores where codigo = 'VEN002'
on conflict (codigo_cliente) do nothing;

insert into clientes (codigo_cliente, nombre, direccion, tipo, vendedor_id)
select 'BAR001', 'Bar Atlántico', 'Recoleta, Posadas 123', 'bar', id from vendedores where codigo = 'VEN003'
on conflict (codigo_cliente) do nothing;


-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN (ejecutar aparte para confirmar)
-- ────────────────────────────────────────────────────────────
-- select * from vendedores;
-- select c.*, v.nombre as vendedor_nombre from clientes c join vendedores v on v.id = c.vendedor_id;
-- select count(*) from visitas;
