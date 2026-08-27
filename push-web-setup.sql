-- ============================================================
--  GrandBar Hub · Notificaciones push (Web Push) para la agenda
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
-- ============================================================

-- Suscripciones push por celular/navegador (un usuario puede tener varias).
create table if not exists push_subscriptions (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz default now()
);
create index if not exists push_subs_usuario_idx on push_subscriptions(usuario_id);
alter table push_subscriptions enable row level security;   -- solo el service role (Functions) accede

-- Marcas para no repetir el aviso de una misma reunión.
alter table public.reuniones add column if not exists aviso_dia_at  timestamptz;
alter table public.reuniones add column if not exists aviso_hora_at timestamptz;
