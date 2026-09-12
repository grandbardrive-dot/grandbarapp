-- ============================================================
--  Aperitivos de bienvenida o pre cena
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  Aperitivos que las marcas dan para recibir a la gente antes de la cena, con
--  una condición especial. Los carga Luciana (Campañas → Aperitivos de
--  bienvenida, admin-aperitivos.html) y el vendedor los ve en la sección
--  "Aperitivos de bienvenida o pre cena" del manual (hoy: Discos con previa).
--  rubros: en qué manuales aparece ('disco', 'restaurante', …). Vacío = en todos.
--  Se puede correr más de una vez.
-- ============================================================

create table if not exists public.aperitivos_bienvenida (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  marca       text,
  condicion   text,
  descripcion text,
  imagen_url  text,
  rubros      text[] not null default '{}',
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.aperitivos_bienvenida enable row level security;
do $$ begin
  create policy "anon_all_aperitivos_bienvenida" on public.aperitivos_bienvenida
    for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Comprobar
select count(*) as aperitivos from public.aperitivos_bienvenida;
