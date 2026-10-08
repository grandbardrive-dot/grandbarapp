-- ============================================================
--  GrandBar Hub · Agente "Cazador de clientes" · setup
--  Corré este SQL en el proyecto del HUB (xqhyemccbwmzxqzkrtwa).
--
--  Crea:
--    · prospectos           → los posibles clientes nuevos (resultado del agente)
--    · prospectos_zonas     → zonas que barre Google Places cada mañana
--    · prospectos_hashtags  → hashtags que barre Instagram (cuando haya token)
--  y siembra zonas/hashtags de arranque para Mendoza y San Luis.
-- ============================================================

create extension if not exists pgcrypto;

-- ── Zonas (Google) ───────────────────────────────────────────
create table if not exists prospectos_zonas (
  id       uuid primary key default gen_random_uuid(),
  nombre   text not null,                       -- etiqueta: "Mendoza Capital"
  lat      double precision not null,
  lng      double precision not null,
  radio    integer not null default 3000,       -- metros (300..20000)
  canal    text not null default 'ambos',       -- on | off | ambos
  activa   boolean not null default true
);

-- ── Hashtags (Instagram) ─────────────────────────────────────
create table if not exists prospectos_hashtags (
  id       uuid primary key default gen_random_uuid(),
  hashtag  text not null,                        -- SIN el '#': "baresmendoza"
  canal    text not null default 'ambos',
  zona     text,                                 -- informativo: "Mendoza"
  activa   boolean not null default true
);

-- ── Prospectos (resultado) ───────────────────────────────────
create table if not exists prospectos (
  id             uuid primary key default gen_random_uuid(),
  fuente         text not null,                  -- google | instagram
  ref_id         text not null,                  -- place_id (Google) o shortcode/permalink (IG) → clave de dedup
  nombre         text not null,
  direccion      text,
  lat            double precision,
  lng            double precision,
  tipo           text,                           -- primaryType de Google o categoria de la IA
  canal          text,                           -- on | off
  zona           text,
  rating         double precision,
  reviews        integer,
  telefono       text,
  website        text,
  maps_url       text,
  instagram      text,                           -- @handle si se conoce
  instagram_url  text,                           -- link directo (perfil, post o búsqueda)
  score          integer,                        -- 0..100 (lo pone la IA)
  score_motivo   text,
  canal_contacto text,                           -- whatsapp | instagram | ninguno
  mensaje_wsp    text,
  mensaje_ig     text,
  estado         text not null default 'nuevo',  -- nuevo | contactado | interesado | visita | descartado | ya_cliente
  supervisor_id  uuid,                            -- quién lo tomó
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (fuente, ref_id)
);
create index if not exists prospectos_orden_idx on prospectos (estado, score desc nulls last, created_at desc);

-- updated_at automático
create or replace function prospectos_touch() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists prospectos_touch_t on prospectos;
create trigger prospectos_touch_t before update on prospectos
  for each row execute function prospectos_touch();

-- ── RLS ──────────────────────────────────────────────────────
-- El agente (cron) escribe con el service_role, que saltea RLS.
-- Los supervisores leen/actualizan desde el panel (usuarios autenticados).
alter table prospectos          enable row level security;
alter table prospectos_zonas    enable row level security;
alter table prospectos_hashtags enable row level security;

drop policy if exists prospectos_sel on prospectos;
create policy prospectos_sel on prospectos for select to authenticated using (true);
drop policy if exists prospectos_upd on prospectos;
create policy prospectos_upd on prospectos for update to authenticated using (true) with check (true);

drop policy if exists zonas_all on prospectos_zonas;
create policy zonas_all on prospectos_zonas for all to authenticated using (true) with check (true);
drop policy if exists hashtags_all on prospectos_hashtags;
create policy hashtags_all on prospectos_hashtags for all to authenticated using (true) with check (true);

-- ── Semilla: zonas de arranque (editá lat/lng/radio a gusto) ──
insert into prospectos_zonas (nombre, lat, lng, radio, canal) values
  ('Mendoza Capital',        -32.8895, -68.8458, 4000, 'ambos'),
  ('Godoy Cruz',             -32.9289, -68.8510, 3500, 'ambos'),
  ('Guaymallén',             -32.8903, -68.7899, 4000, 'ambos'),
  ('Ciudad de San Luis',     -33.2950, -66.3356, 4000, 'ambos')
on conflict do nothing;

-- ── Semilla: hashtags de arranque (se activan al cargar el token de IG) ──
insert into prospectos_hashtags (hashtag, canal, zona) values
  ('baresmendoza',        'on',  'Mendoza'),
  ('gastronomiamendoza',  'on',  'Mendoza'),
  ('restaurantemendoza',  'on',  'Mendoza'),
  ('vinotecamendoza',     'off', 'Mendoza'),
  ('barsanluis',          'on',  'San Luis'),
  ('gastronomiasanluis',  'on',  'San Luis')
on conflict do nothing;
