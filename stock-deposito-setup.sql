-- ============================================================
--  Stock del depósito dentro del Portal (26/10/2026)
--  Antes era una app aparte (grandbar-stock, base Supabase propia "Stock Grandbar").
--  Ahora vive en el Portal: deposito.html (Lucas Porro y Lucas Buenanueva, rol
--  deposito) y deposito-admin.html (Laura, Brenda, Diseño y Desarrollo).
--  Todo pasa por la función stock (clave de servicio): las tablas no tienen
--  políticas, desde el navegador no se leen ni se escriben.
-- ============================================================

-- Stock del sistema (Córdoba), lo trae stock-sync-background cada hora de 8 a 20 hs.
create table if not exists public.stock_sistema (
  sku            text primary key,
  stock          integer not null default 0,
  articulo       text,
  sector         text,                       -- vinos | spirits (por el prefijo del SKU)
  actualizado_en timestamptz not null default now()
);

-- Agenda de los lunes: qué proveedor se cuenta qué día (lo asigna Laura) y cuáles ya
-- se hicieron (lo marcan los chicos). Un proveedor está una sola vez por sector.
create table if not exists public.stock_agenda (
  id         bigserial primary key,
  fecha      date not null,
  sector     text not null check (sector in ('vinos','spirits')),
  proveedor  text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sector, proveedor)
);

-- Proveedores que no se cuentan (no salen en la agenda ni en el conteo).
create table if not exists public.stock_proveedores_excluidos (
  sector     text not null check (sector in ('vinos','spirits')),
  proveedor  text not null,
  created_at timestamptz not null default now(),
  primary key (sector, proveedor)
);

-- Cada conteo enviado (antes quedaba solo en el celular). items = las filas del Excel.
create table if not exists public.stock_conteos (
  id             bigserial primary key,
  sector         text not null check (sector in ('vinos','spirits')),
  usuario_id     uuid,
  usuario_nombre text,
  fecha          date not null,
  proveedores    text[],
  lineas         text[],
  productos      integer,
  contados       integer,
  unidades       integer,
  items          jsonb not null default '[]'::jsonb,
  prov_obs       jsonb not null default '{}'::jsonb,
  mail_ok        boolean,
  mail_error     text,
  created_at     timestamptz not null default now()
);
create index if not exists stock_conteos_fecha on public.stock_conteos (created_at desc);

alter table public.stock_sistema               enable row level security;
alter table public.stock_agenda                enable row level security;
alter table public.stock_proveedores_excluidos enable row level security;
alter table public.stock_conteos               enable row level security;

-- "Reiniciar el ciclo" de la agenda: desde esta fecha se vuelve a contar quién falta.
-- El historial de la agenda no se borra (Laura lo ve en el calendario).
create table if not exists public.stock_ciclos (
  sector     text primary key check (sector in ('vinos','spirits')),
  desde      date not null,
  por        text,
  updated_at timestamptz not null default now()
);
alter table public.stock_ciclos enable row level security;
