-- ============================================================
--  Estado Activo/Inactivo de clientes (por CÓDIGO de cliente)
--  Antes el activo/inactivo vivía en la tabla `clientes` del Manual,
--  pero el supervisor ve clientes de Cobranzas que no están en el
--  Manual y no había dónde guardarlos. Esta tabla guarda el estado
--  por código de cliente (normalizado, sin ceros a la izquierda), así
--  funciona para CUALQUIER cliente y lo ven vendedor y supervisor.
--
--  Correr en el proyecto Manual/Luciana (fzaxwuuo) → SQL Editor.
--  Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists clientes_estado (
  codigo text primary key,                 -- código de cliente SIN ceros a la izquierda
  activo boolean not null default true,
  updated_at timestamptz default now()
);

alter table clientes_estado enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clientes_estado' and policyname = 'clientes_estado_anon_all'
  ) then
    create policy clientes_estado_anon_all on clientes_estado
      for all using (true) with check (true);
  end if;
end $$;
