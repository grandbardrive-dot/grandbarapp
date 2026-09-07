-- ============================================================
--  Comprobantes: dejar registro de la revisión de tesorería
--  Correr en el proyecto de COBRANZAS (qpaoyfubyaloyhepatlm) → SQL Editor
--
--  Hasta ahora el circuito guardaba solo dos de los tres pasos:
--    1) el cliente sube el comprobante          → estado 'pendiente'
--    2) el vendedor lo confirma                 → 'procesado' + procesado_por/procesado_at
--    3) tesorería lo cruza con el banco         → 'aceptado' o 'rechazado'  ← sin registro
--
--  Del paso 3 no quedaba quién ni cuándo, así que no se podía medir cuánto tarda
--  tesorería en cerrar un comprobante: solo se veía lo que seguía esperando.
--  Estas dos columnas cierran esa parte.
-- ============================================================

alter table public.comprobantes
  add column if not exists revisado_por text,        -- quién lo aceptó o rechazó
  add column if not exists revisado_at  timestamptz; -- cuándo

comment on column public.comprobantes.revisado_por is
  'Persona de tesorería que aceptó o rechazó el comprobante (nombre del Portal).';
comment on column public.comprobantes.revisado_at is
  'Momento en que tesorería lo aceptó o rechazó. Con created_at y procesado_at se mide cada tramo.';

-- Para que la pantalla de supervisión filtre rápido por período.
create index if not exists comprobantes_revisado_at_idx
  on public.comprobantes (revisado_at desc);

-- Lo que ya está cerrado de antes queda sin datos: no hay de dónde sacarlos.
-- Se cuenta desde acá en adelante.
select count(*) filter (where estado in ('aceptado','rechazado')) as ya_cerrados_sin_registro,
       count(*) filter (where revisado_at is not null)            as con_registro
  from public.comprobantes
 where tipo = 'cliente';
