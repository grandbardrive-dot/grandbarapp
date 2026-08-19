-- ============================================================
--  GrandBar Hub · Agenda Eficiente del vendedor
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
-- ============================================================
create extension if not exists pgcrypto;

-- 1) Categorización de clientes por frecuencia de visita (se hace 1 vez)
create table if not exists public.agenda_frecuencia (
  id             uuid primary key default gen_random_uuid(),
  vendedor       text not null,                 -- codigo_vendedor
  cliente_codigo text not null,
  cliente_nombre text,
  frecuencia     text not null default 'mensual', -- semanal / quincenal / mensual
  updated_at     timestamptz default now(),
  unique (vendedor, cliente_codigo)
);
alter table public.agenda_frecuencia enable row level security;
create index if not exists agenda_frec_vend_idx on public.agenda_frecuencia(vendedor);

-- 2) Plan mensual: qué día visita a cada cliente (y seguimiento diario)
create table if not exists public.agenda_plan (
  id             uuid primary key default gen_random_uuid(),
  vendedor       text not null,                 -- codigo_vendedor
  mes            text not null,                 -- 'YYYY-MM'
  fecha          date not null,
  cliente_codigo text not null,
  cliente_nombre text,
  estado         text default 'pendiente',      -- pendiente / visitado
  visitado_at    timestamptz,
  duracion_min   int,
  created_at     timestamptz default now()
);
alter table public.agenda_plan enable row level security;
create index if not exists agenda_plan_vm_idx on public.agenda_plan(vendedor, mes);
create index if not exists agenda_plan_vf_idx on public.agenda_plan(vendedor, fecha);

-- 3) Estado del envío del plan mensual al supervisor
create table if not exists public.agenda_plan_envio (
  id             uuid primary key default gen_random_uuid(),
  vendedor       text not null,
  mes            text not null,                 -- 'YYYY-MM'
  estado         text default 'borrador',        -- borrador / enviada / aprobada / cambios
  nota_supervisor text,
  revisado_por   text,
  updated_at     timestamptz default now(),
  unique (vendedor, mes)
);
alter table public.agenda_plan_envio enable row level security;
