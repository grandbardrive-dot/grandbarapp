-- ============================================================
--  Panel de supervisor: sacar las contraseñas a la vista (22/09/2026)
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  La tabla supervisores guardaba las contraseñas sin cifrar y se podían
--  leer desde el navegador con la clave pública de la app. Desde hoy el
--  panel de supervisor se abre SOLO con el usuario del Portal, así que esas
--  contraseñas ya no se usan: se borran y la tabla deja de poder leerse
--  entera desde afuera (solo nombre, código y liga, que el panel necesita).
-- ============================================================

-- 1) Borrar las contraseñas viejas (ya estuvieron expuestas; no se usan más)
alter table public.supervisores alter column password drop not null;
update public.supervisores set password = null;

-- 2) Desde el navegador: solo leer id, nombre, código y liga. Nada de escribir.
revoke select, insert, update, delete on public.supervisores from anon, authenticated;
grant select (id, nombre, codigo, liga, created_at) on public.supervisores to anon, authenticated;

-- Control: tiene que decir sin_clave = true en todas las filas.
select nombre, codigo, liga, password is null as sin_clave from public.supervisores order by codigo;
