-- ============================================================
--  Manual de Vendedores · Clientes Activo/Inactivo
--  Agrega el estado activo a cada cliente. Los inactivos se
--  ocultan de la lista principal y van a la pestaña "Ocultos".
--  Correr en el proyecto Manual/Luciana (fzaxwuuo).
-- ============================================================

alter table clientes add column if not exists activo boolean not null default true;

-- Permitir que el vendedor (anon) cambie el estado activo desde el portal.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clientes' and policyname = 'clientes_update_activo_anon'
  ) then
    create policy clientes_update_activo_anon on clientes
      for update using (true) with check (true);
  end if;
end $$;
