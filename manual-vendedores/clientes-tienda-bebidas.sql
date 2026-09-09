-- ============================================================
--  Clientes que son TIENDA DE BEBIDAS
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  Salen de la planilla "tienda de bebidas completo.xlsx" (71 clientes, todos
--  activos en CUBO). De esos, 66 existen en la tabla clientes del manual: 33
--  estaban como "otros", 32 como "vinoteca" y 1 como "autoservicio".
--
--  OJO CON EL ORDEN: el rubro decide qué manual ve el vendedor en la visita, y
--  el manual de Tienda de Bebidas todavía no tiene secciones cargadas. Si esto
--  se corre antes de armarlo, los 32 que hoy son vinoteca pasan de tener
--  recorrido a no tener ninguno. Conviene armar primero el manual.
-- ============================================================

-- ── 1) Mirar antes de tocar: qué hay hoy con esos códigos ───
select tipo, count(*) as clientes, count(*) filter (where activo) as activos
  from public.clientes
 where codigo_cliente in (
   '00858',
   '03114',
   '03923',
   '03938',
   '03958',
   '04328',
   '04947',
   '05154',
   '05285',
   '05295',
   '05602',
   '05603',
   '05745',
   '05841',
   '05952',
   '05977',
   '06288',
   '06455',
   '07856',
   '07889',
   '07986',
   '08007',
   '08135',
   '08172',
   '08186',
   '08281',
   '08472',
   '08855',
   '08870',
   '08898',
   '08938',
   '08948',
   '08966',
   '09077',
   '09105',
   '09163',
   '09230',
   '09241',
   '09278',
   '09311',
   '09344',
   '09347',
   '09349',
   '09416',
   '09514',
   '09533',
   '09542',
   '09573',
   '09624',
   '09629',
   '09635',
   '09648',
   '09652',
   '09702',
   '09777',
   '09805',
   '09828',
   '09842',
   '09882',
   '09883',
   '09918',
   '09937',
   '09940',
   '09942',
   '09948',
   '09964',
   '09975',
   '09982',
   '09987',
   '09988',
   '09993'
 )
 group by tipo
 order by clientes desc;


-- ── 2) El cambio ────────────────────────────────────────────
update public.clientes
   set tipo = 'tienda de bebidas'
 where codigo_cliente in (
   '00858',
   '03114',
   '03923',
   '03938',
   '03958',
   '04328',
   '04947',
   '05154',
   '05285',
   '05295',
   '05602',
   '05603',
   '05745',
   '05841',
   '05952',
   '05977',
   '06288',
   '06455',
   '07856',
   '07889',
   '07986',
   '08007',
   '08135',
   '08172',
   '08186',
   '08281',
   '08472',
   '08855',
   '08870',
   '08898',
   '08938',
   '08948',
   '08966',
   '09077',
   '09105',
   '09163',
   '09230',
   '09241',
   '09278',
   '09311',
   '09344',
   '09347',
   '09349',
   '09416',
   '09514',
   '09533',
   '09542',
   '09573',
   '09624',
   '09629',
   '09635',
   '09648',
   '09652',
   '09702',
   '09777',
   '09805',
   '09828',
   '09842',
   '09882',
   '09883',
   '09918',
   '09937',
   '09940',
   '09942',
   '09948',
   '09964',
   '09975',
   '09982',
   '09987',
   '09988',
   '09993'
 );


-- ── 3) Comprobar cómo quedó ─────────────────────────────────
select tipo, count(*) as clientes, count(*) filter (where activo) as activos
  from public.clientes
 where tipo = 'tienda de bebidas'
 group by tipo;
