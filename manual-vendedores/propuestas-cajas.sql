-- ============================================================
--  Cajas disponibles en las propuestas de los proveedores (06/10/2026)
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  Cuando un proveedor propone una acción tiene que decir cuántas cajas del
--  producto tiene para ofrecer. Hasta que se corra esto, el dato se guarda
--  igual dentro de "payload" (campo cajas); después queda en su columna.
-- ============================================================
alter table public.propuestas_acciones
  add column if not exists cajas_disponibles integer check (cajas_disponibles is null or cajas_disponibles > 0);

-- Las propuestas que ya se cargaron con el dato en payload pasan a la columna.
update public.propuestas_acciones
   set cajas_disponibles = (payload->>'cajas')::int
 where cajas_disponibles is null and (payload->>'cajas') ~ '^[0-9]+$' and (payload->>'cajas')::int > 0;

-- Control
select titulo, autor_empresa, cajas_disponibles, estado
from public.propuestas_acciones order by created_at desc limit 10;
