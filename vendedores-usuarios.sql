-- ============================================================
--  Vincular las cuentas de los vendedores con su código
--  Correr en el proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
--  DESPUÉS de crear las cuentas en Authentication → Users.
--
--  Por qué hace falta: al crear la cuenta, el disparador arma la ficha en
--  public.usuarios con rol 'ventas', pero SIN el código de vendedor. Sin ese
--  código el Hub no sabe a qué vendedor corresponde y le muestra el cartel de
--  "tu código no figura en la planilla".
--
--  Este script no crea cuentas: solo completa las que ya existen. A las que
--  todavía no estén creadas, simplemente no las toca (0 filas).
-- ============================================================

-- ── PASO 1 · Ver cuáles ya tienen cuenta ────────────────────
--  Las que aparezcan acá son las que el paso 2 va a completar.
select u.email, u.nombre, u.rol, u.codigo_vendedor
  from public.usuarios u
 where u.email like '%@grandbar.com.ar'
 order by u.email;


-- ── PASO 2 · Poner el código y el rol a cada uno ────────────
--  Se identifica por mail. El que no exista todavía, no se toca.
update public.usuarios as u
   set codigo_vendedor = v.codigo,
       nombre = coalesce(nullif(u.nombre, u.email), v.nombre),
       rol = 'ventas',
       activo = true
  from (values
    ('gmartinez@grandbar.com.ar',      '001', 'Gustavo Martinez'),
    -- 002 Fernando Malanca y 020 Franco Malanca NO llevan cuenta (decidido).
    ('ccarrada@grandbar.com.ar',       '003', 'Carolina Carrada'),
    ('jmollar@grandbar.com.ar',        '005', 'Juan Pablo Mollar'),
    ('dperez@grandbar.com.ar',         '006', 'Daniel Perez'),
    ('alaurito@grandbar.com.ar',       '007', 'Ángeles Laurito'),
    ('mjuarez@grandbar.com.ar',        '010', 'Martin Juarez'),
    ('dsebastianelli@grandbar.com.ar', '011', 'Diego Sebastianelli'),
    ('fojer@grandbar.com.ar',          '015', 'Facundo Ojer'),
    ('ljuarez@grandbar.com.ar',        '017', 'Lucas Juarez'),
    ('lbuenanueva@grandbar.com.ar',    '018', 'Luciana Buenanueva'),
    ('aroldan@grandbar.com.ar',        '019', 'Analía Roldan'),
    ('jfranso@grandbar.com.ar',        '024', 'Juan Pablo Franso'),
    ('pcofano@grandbar.com.ar',        '025', 'Pablo Cofano'),
    ('egimenez@grandbar.com.ar',       '027', 'Exequiel Gimenez'),
    ('ngarcia@grandbar.com.ar',        '029', 'Nicolas Garcia'),
    ('ggrosso@grandbar.com.ar',        '035', 'Georgina Grosso'),
    ('cheluani@grandbar.com.ar',       '039', 'Carolina Heluani'),
    ('lpuga@grandbar.com.ar',          '040', 'Laura Puga'),
    ('ffernandez@grandbar.com.ar',     '041', 'Franco Fernandez'),
    ('lgonzalez@grandbar.com.ar',      '042', 'Luisina Brenda Gonzalez'),
    ('jguigue@grandbar.com.ar',        '043', 'Jonathan Guigue')
  ) as v(email, codigo, nombre)
 where lower(u.email) = v.email;

--  OJO con Luciana (018): en el Hub su rol es 'compras', no 'ventas'.
--  El paso 2 se lo pisaría, así que se lo devolvemos:
update public.usuarios set rol = 'compras'
 where lower(email) = 'lbuenanueva@grandbar.com.ar';


-- ── PASO 3 · Ver cómo quedó y qué falta ─────────────────────
select nombre, email, rol, codigo_vendedor, activo
  from public.usuarios
 order by codigo_vendedor nulls last, nombre;
