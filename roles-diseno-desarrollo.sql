-- ============================================================
--  Roles de Diseño y Desarrollo (Josefina y Nahuel)
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  nvalenzuela@grandbar.com.ar → rol 'desarrollo' → panel-desarrollo.html
--  jlemos@grandbar.com.ar      → rol 'diseno'     → panel-diseno.html
--
--  Qué habilita cada rol en el Hub:
--    desarrollo → ve TODAS las herramientas (igual que admin) + su panel
--    diseno     → ve las que veía Marketing + su panel
--  (eso ya está en el código: hub.html y assets/apps.js)
-- ============================================================

-- ── PASO 1 · Ver si ya tienen ficha ─────────────────────────
--  Si esta consulta devuelve 2 filas, seguí al paso 2.
--  Si devuelve menos, primero hay que crear la cuenta que falte:
--    Supabase → Authentication → Users → Add user → Create new user
--    (email + contraseña; marcá "Auto Confirm User")
--  Al crearla, el disparador del hub-setup le arma sola la ficha en
--  public.usuarios con rol 'ventas', y ahí sí corrés el paso 2.
select id, nombre, email, rol, activo
  from public.usuarios
 where email in ('nvalenzuela@grandbar.com.ar', 'jlemos@grandbar.com.ar');


-- ── PASO 2 · Asignar el rol ─────────────────────────────────
update public.usuarios
   set rol = 'desarrollo', activo = true
 where email = 'nvalenzuela@grandbar.com.ar';

update public.usuarios
   set rol = 'diseno', activo = true
 where email = 'jlemos@grandbar.com.ar';


-- ── PASO 3 · Confirmar que quedó bien ───────────────────────
--  Tienen que aparecer las dos filas con el rol nuevo.
select nombre, email, rol, activo
  from public.usuarios
 where email in ('nvalenzuela@grandbar.com.ar', 'jlemos@grandbar.com.ar');


-- ── OPCIONAL · Completar el nombre ──────────────────────────
--  El nombre es lo que muestra el Hub arriba a la izquierda ("Hola, …")
--  y lo que firma los reportes. Si en el paso 1 salió vacío o mal escrito,
--  descomentá y poné el nombre completo como quieren que se lea:
--
-- update public.usuarios set nombre = 'Nahuel Valenzuela' where email = 'nvalenzuela@grandbar.com.ar';
-- update public.usuarios set nombre = 'Josefina Lemos'    where email = 'jlemos@grandbar.com.ar';
