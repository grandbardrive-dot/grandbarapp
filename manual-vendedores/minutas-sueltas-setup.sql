-- ============================================================
--  Minutas sueltas (botón flotante "Minuta IA" en todos los paneles)
--  Cualquier usuario del Hub puede grabar/subir el audio de una
--  reunión, la IA arma la minuta y se guarda acá a su nombre.
--  Correr en: Supabase proyecto Manual (fzaxwuuo) → SQL Editor.
-- ============================================================

create table if not exists minutas_sueltas (
  id uuid primary key default gen_random_uuid(),
  usuario_id text not null,             -- id de auth del Hub (o 'admin')
  usuario_nombre text,
  titulo text,
  fecha date not null default (now() at time zone 'America/Argentina/Mendoza'),
  temas jsonb default '[]'::jsonb,
  pendientes jsonb default '[]'::jsonb,
  notas text,
  transcript text,
  created_at timestamptz not null default now()
);

alter table minutas_sueltas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='minutas_sueltas' and policyname='minutas_sueltas_anon_all') then
    create policy minutas_sueltas_anon_all on minutas_sueltas for all using (true) with check (true);
  end if;
end $$;
create index if not exists minutas_sueltas_user on minutas_sueltas (usuario_id, created_at desc);
