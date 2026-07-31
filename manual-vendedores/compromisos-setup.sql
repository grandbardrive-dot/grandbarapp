-- ============================================================
-- SETUP COMPROMISOS + ACCIONES FECHAS + FCM TOKENS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Compromisos de vendedores
create table if not exists compromisos (
  id                uuid default gen_random_uuid() primary key,
  vendedor_id       uuid references vendedores(id),
  cliente_id        uuid references clientes(id),
  seccion           text not null,
  descripcion       text not null,
  fecha_ejecucion   date not null,
  estado            text not null default 'pendiente', -- pendiente | ejecutado | atrasado
  foto_evidencia_url text,
  created_at        timestamptz default now()
);
alter table compromisos enable row level security;
create policy "anon_all_compromisos" on compromisos for all using (true) with check (true);

create index if not exists comp_vendedor_idx on compromisos(vendedor_id);
create index if not exists comp_estado_idx   on compromisos(estado);
create index if not exists comp_fecha_idx    on compromisos(fecha_ejecucion);

-- Acciones de fechas especiales (cargadas por admin)
create table if not exists acciones_fechas (
  id           uuid default gen_random_uuid() primary key,
  nombre       text not null,
  descripcion  text not null,
  condicion    text,
  canal        text, -- 'vinotecas' | 'restaurantes' | 'todos'
  imagen_url   text,
  fecha_inicio date not null,
  fecha_fin    date not null,
  activa       boolean default true,
  created_at   timestamptz default now()
);
alter table acciones_fechas enable row level security;
create policy "anon_all_acciones" on acciones_fechas for all using (true) with check (true);

-- FCM tokens para push notifications
create table if not exists fcm_tokens (
  id          uuid default gen_random_uuid() primary key,
  vendedor_id uuid references vendedores(id),
  token       text unique not null,
  updated_at  timestamptz default now()
);
alter table fcm_tokens enable row level security;
create policy "anon_all_fcm" on fcm_tokens for all using (true) with check (true);

-- Acuerdos de vidriera activos
create table if not exists acuerdos_vidriera (
  id              uuid default gen_random_uuid() primary key,
  cliente_id      uuid references clientes(id),
  vendedor_id     uuid references vendedores(id),
  bodega          text not null,       -- 'dona_paula' | 'salentein'
  tipo            text not null,       -- 'exclusiva' | 'compartida'
  meses           integer not null,
  cajas_min_mes   integer not null,
  fecha_inicio    date not null,
  fecha_fin       date not null,
  foto_url        text,
  activo          boolean default true,
  created_at      timestamptz default now()
);
alter table acuerdos_vidriera enable row level security;
create policy "anon_all_vidriera" on acuerdos_vidriera for all using (true) with check (true);

-- Marcar compromisos atrasados (ejecutar periódicamente o al cargar)
-- UPDATE compromisos SET estado = 'atrasado'
-- WHERE estado = 'pendiente' AND fecha_ejecucion < CURRENT_DATE;
