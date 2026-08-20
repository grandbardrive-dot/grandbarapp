-- ============================================================
--  GrandBar Hub · Passkeys (ingreso con Face ID / WebAuthn)
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
-- ============================================================
create extension if not exists pgcrypto;

-- Credenciales biométricas registradas por usuario/dispositivo
create table if not exists public.passkeys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  email         text,
  credential_id text unique not null,   -- rawId en base64url
  public_key    text not null,          -- clave pública (SPKI) en base64
  created_at    timestamptz default now(),
  last_used_at  timestamptz
);
alter table public.passkeys enable row level security;   -- solo el service role (Functions)
create index if not exists passkeys_user_idx on public.passkeys(user_id);

-- Retos (challenges) temporales para registro/login
create table if not exists public.webauthn_challenges (
  id         text primary key,          -- id aleatorio que se le da al cliente
  challenge  text not null,             -- challenge en base64url
  purpose    text not null,             -- 'register' | 'login'
  user_id    uuid,
  expires_at timestamptz not null
);
alter table public.webauthn_challenges enable row level security;
