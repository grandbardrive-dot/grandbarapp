-- ============================================================
--  GrandBar Hub · Leads (CRM Zenvia → Portal)
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  nombre        text,
  telefono      text,
  email         text,
  origen        text default 'zenvia',        -- zenvia / manual
  zona          text,
  canal         text,                          -- on / off / ...
  mensaje       text,                          -- consulta / primer mensaje del lead
  estado        text default 'nuevo',          -- nuevo / asignado / contactado / convertido / descartado
  vendedor      text,                          -- codigo_vendedor asignado (null = sin asignar)
  asignado_por  text,
  nota          text,                          -- notas del vendedor / seguimiento
  zenvia_id     text unique,                   -- id externo de Zenvia (para no duplicar)
  raw           jsonb,                          -- payload crudo de Zenvia (debug / campos extra)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.leads enable row level security;   -- solo el service role (Functions)
create index if not exists leads_vend_idx   on public.leads(vendedor, created_at desc);
create index if not exists leads_estado_idx on public.leads(estado, created_at desc);
