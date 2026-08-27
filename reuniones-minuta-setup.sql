-- ============================================================
--  GrandBar Hub · Minuta de reuniones
--  Correr en el proyecto HUB (xqhyemccbwmzxqzkrtwa) → SQL Editor
--
--  Guarda la minuta dentro de la propia reunión (1 reunión = 1 minuta):
--    minuta = { temas:[...], pendientes:[...], notas:"...", autor:"..." }
--  Al guardar la minuta, la reunión pasa a estado 'realizada'.
-- ============================================================

alter table public.reuniones add column if not exists minuta    jsonb;
alter table public.reuniones add column if not exists minuta_at  timestamptz;

create index if not exists reuniones_minuta_idx on public.reuniones(usuario_id) where minuta is not null;
