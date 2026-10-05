-- ============================================================
--  Unificar los dos "Pernod Ricard" de la tabla proveedores (05/10/2026)
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor.
--
--  b30c7b02… (28/07 11:55): lo usan los 30 materiales y las 9 marcas → QUEDA
--  80882e5d… (28/07 12:09): lo usan los 10 productos del catálogo → se pasa al otro y se borra
-- ============================================================
begin;

update public.productos set proveedor_id = 'b30c7b02-8607-4471-bf87-2e83cbc6fa2b'
 where proveedor_id = '80882e5d-1a50-46fe-9031-4e266209ff3e';
update public.materials set supplier_id = 'b30c7b02-8607-4471-bf87-2e83cbc6fa2b'
 where supplier_id = '80882e5d-1a50-46fe-9031-4e266209ff3e';
update public.brands set supplier_id = 'b30c7b02-8607-4471-bf87-2e83cbc6fa2b'
 where supplier_id = '80882e5d-1a50-46fe-9031-4e266209ff3e';

delete from public.proveedores where id = '80882e5d-1a50-46fe-9031-4e266209ff3e';

commit;

-- Control: tiene que quedar UNA fila, con 10 productos, 30 materiales y 9 marcas.
select p.id, p.nombre,
  (select count(*) from public.productos x where x.proveedor_id = p.id) as productos,
  (select count(*) from public.materials x where x.supplier_id = p.id)  as materiales,
  (select count(*) from public.brands x    where x.supplier_id = p.id)  as marcas
from public.proveedores p where p.nombre ilike '%pernod%';
