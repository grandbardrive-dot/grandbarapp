-- ============================================================
--  Proveedores como usuarios del Hub (rol 'proveedor')
--  Ahora los proveedores entran por el MISMO login (portalgrandbar.com)
--  que el resto. Son usuarios de la tabla `usuarios` con rol='proveedor'
--  y una columna `empresa` (bodega/marca) para saber de quién son las
--  propuestas.
--
--  CORRER EN: Supabase proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor.
-- ============================================================

-- 1) Columna empresa (solo la usan los proveedores).
alter table usuarios add column if not exists empresa text;

-- 2) Ejemplo: convertir el usuario campari@grandbar.com.ar en proveedor.
--    (Ya existía como vendedor; esto lo pasa a proveedor y le pone la empresa.)
update usuarios
   set rol = 'proveedor', empresa = 'Campari Group'
 where id = (select id from auth.users where email = 'campari@grandbar.com.ar');

-- 3) Para dar de alta un proveedor NUEVO:
--    a) Authentication → Add user (email + password) en el dashboard.
--    b) Después:
--       update usuarios set rol='proveedor', empresa='<Nombre de la marca>'
--        where id = (select id from auth.users where email='<su-email>');
--    La `empresa` debe coincidir con el nombre que se usa en las propuestas
--    (autor_empresa), ej. 'Grupo Peñaflor', 'Salentein', 'Chandon'.
