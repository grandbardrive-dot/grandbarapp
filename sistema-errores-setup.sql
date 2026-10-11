-- ============================================================
--  Estado del sistema: errores de funciones y pantallas (11/10/2026)
--  Correr en Supabase → proyecto del HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor.
--
--  Cada función del Portal anota sus errores internos (_errores.js) y las
--  pantallas anotan lo que se rompe en el navegador, por ejemplo si no se pudo
--  guardar una visita (assets/reporte-errores.js → función reportar-error).
--  estado-sistema los cuenta: si una función o pantalla da varios errores en la
--  última hora, n8n avisa por mail con el nombre y el error.
--  Tabla cerrada: RLS prendido y SIN reglas. Se borra lo de más de 30 días.
-- ============================================================

create table if not exists public.sistema_errores (
  id          bigint generated always as identity primary key,
  momento     timestamptz not null default now(),
  origen      text not null,          -- funcion | pantalla
  lugar       text not null,          -- nombre de la función o la pantalla (ruta)
  status      integer,
  detalle     text,
  usuario_id  uuid,                   -- quién lo tuvo (solo pantallas)
  usuario     text
);
create index if not exists sistema_errores_momento_idx on public.sistema_errores (momento desc);

alter table public.sistema_errores enable row level security;
-- Sin políticas a propósito.

-- Control: tiene que dar una fila con rls = true.
select relname, relrowsecurity as rls from pg_class where relname = 'sistema_errores';
