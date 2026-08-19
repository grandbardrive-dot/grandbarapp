-- ============================================================
--  GrandBar Hub · Notificaciones (para cualquier usuario)
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null,        -- auth id de quien la recibe
  icono           text,
  titulo          text not null,
  detalle         text,
  link            text,                 -- página a la que lleva
  leida           boolean default false,
  created_at      timestamptz default now()
);
alter table public.notificaciones enable row level security;  -- solo el service role (Functions) accede
create index if not exists notif_dest_idx on public.notificaciones(destinatario_id, created_at desc);
