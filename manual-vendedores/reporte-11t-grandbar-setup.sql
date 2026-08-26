-- ============================================================
--  11T Peñaflor · almacén del reporte GRAND BAR (ya calculado)
--  Correr en el proyecto Manual/Luciana:  fzaxwuuodseyyinveknn
--
--  El tablero 11T ya NO recalcula ventas: lee el Excel "GRAND BAR" que
--  el sistema genera (CCC por canal + detalle por línea, Real y Objetivo).
--  Luciana lo sube en admin-11t.html; se guarda un reporte por mes (jsonb).
-- ============================================================

create table if not exists penaflor_11t_reporte (
  mes          text primary key,          -- 'YYYY-MM'
  data         jsonb not null,            -- { ccc:{canal:{real,objetivo}}, lineas:[{canal,linea,tipo,real,objetivo}] }
  filas        integer default 0,
  actualizado  timestamptz default now(),
  archivo      text
);

alter table penaflor_11t_reporte enable row level security;
do $$ begin
  begin create policy p11t_all on penaflor_11t_reporte for all using (true) with check (true); exception when duplicate_object then null; end;
end $$;
