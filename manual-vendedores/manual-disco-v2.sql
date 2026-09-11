-- ============================================================
--  Manual de DISCOS v2 — la estructura que salió de la reunión de discos
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  Hasta ahora Discos era una copia de Bares. La minuta pide otra cosa:
--    introducción → carta (solo con previa) → acuerdos → eventos y
--    activaciones → materiales → seguimiento → cierre.
--
--  · El manual anterior NO se borra: se apaga. Luciana puede volver a prender
--    cualquier sección desde Secciones → Discos.
--  · Las herramientas nuevas (formato con/sin previa, acuerdos por marca,
--    sunset, activaciones, materiales restringidos, eventos del cliente) se
--    enganchan por el CÓDIGO dc_* de cada sección (manual-vendedores/_disco-tools.js).
--    Los nombres se pueden cambiar; los códigos no.
--  · Los eventos prearmados del mes se cargan como PLANES en la sección
--    "Eventos del mes", con la pantalla de planes de siempre.
--  · Solo zona Mendoza: San Luis, mientras no tenga manual propio, ve este.
--
--  Se puede correr más de una vez: no duplica ni pisa lo que Luciana edite.
-- ============================================================

-- 0) Ficha del cliente: rasgos que se definen una vez y quedan para las
--    próximas visitas (formato del boliche, si hace sunset). La sincronización
--    con CUBO no toca esta columna.
alter table public.clientes add column if not exists perfil jsonb not null default '{}'::jsonb;

-- 1) Apagar el manual anterior (la copia de Bares)
update public.checklist_secciones
   set activa = false
 where canal = 'disco' and codigo not like 'dc\_%';

-- 2) Secciones madre
with m (codigo, nombre, descripcion, icono, especial, intro, orden) as (values
  ('dc_intro',       'INTRODUCCIÓN & PREPARACIÓN', 'Formato del boliche y preparación de la visita',        '🎧', null,             null, 0),
  ('dc_carta',       'CARTA',                      'Solo boliches con previa: cena desde las 21 h',         '🍽️', null,             'Aparece solo si el boliche tiene previa (cena + boliche).', 1),
  ('dc_acuerdos',    'ACUERDOS',                   'Relevamiento: volumen, marcas, fee y plata solicitada', '🤝', null,             null, 2),
  ('dc_eventos',     'EVENTOS & ACTIVACIONES',     'Eventos prearmados del mes y activaciones en el boliche','🎉', null,             null, 3),
  ('dc_materiales',  'MATERIALES',                 'Disponibles y restringidos',                            '📦', null,             null, 4),
  ('dc_seguimiento', 'SEGUIMIENTO',                'Fechas especiales y eventos del cliente',               '📅', null,             null, 5),
  ('dc_cierre',      'CIERRE DE VISITA',           'Resumen, próxima acción y envío al cliente',            '✅', 'cierre_resumen', null, 6)
)
insert into public.checklist_secciones (canal, zona, codigo, nombre, descripcion, icono, especial, intro, orden, activa, parent_id)
select 'disco', 'mendoza', codigo, nombre, descripcion, icono, especial, intro, orden, true, null
  from m
on conflict (canal, zona, codigo) do nothing;

-- 3) Subsecciones (apuntando a su madre por código)
with h (madre, codigo, nombre, descripcion, icono, especial, intro, orden) as (values
  ('dc_carta',       'dc_carta_vinos',      'Acciones de Rotación de Vinos', 'Ofertas del catálogo ON para la cena',            '🍷', null,                null, 0),
  ('dc_carta',       'dc_vino_copa',        'Vino por Copa',                 'Vinos por copa y costo por copa',                 '🥂', null,                null, 1),
  ('dc_carta',       'dc_mix_ideal',        'Propuestas "Mix Ideal"',        'Combos de productos para la carta',               '🍹', null,                null, 2),
  ('dc_carta',       'dc_cocteleria',       'Desarrollo de Coctelería',      'Cócteles sugeridos con costeo por medida',        '🍸', null,                null, 3),
  ('dc_acuerdos',    'dc_acuerdos_marca',   'Acuerdos por marca',            'Volumen, marcas preferidas, fee y plata solicitada', '📝', null,             'Es un relevamiento, no un acuerdo cerrado: Comercial lo define después con esta información.', 0),
  ('dc_acuerdos',    'dc_spirits_rotacion', 'Acciones de Rotación de Spirits', 'Ofertas del catálogo ON',                       '🥃', null,                null, 1),
  ('dc_acuerdos',    'dc_sunset',           'Sunset',                        'Si el boliche hace sunset',                       '🌅', null,                null, 2),
  ('dc_eventos',     'dc_eventos_mes',      'Eventos del mes',               'Eventos prearmados con marcas',                   '🗓️', null,                'Eventos prearmados con condiciones de compra, materiales y beneficios. Los carga Luciana como planes.', 0),
  ('dc_eventos',     'dc_activaciones',     'Activaciones en el PDV',        'Bartenders, shots, tragos regalados, merchandise','🎊', null,                null, 1),
  ('dc_materiales',  'dc_mat_disponibles',  'Materiales disponibles',        'Se piden sin restricción',                        '🧰', 'vt_materiales',     null, 0),
  ('dc_materiales',  'dc_mat_restringidos', 'Materiales restringidos',       'Necesitan aprobación: se piden con el motivo',    '🔒', null,                null, 1),
  ('dc_seguimiento', 'dc_fechas',           'Fechas especiales',             'Calendario de fechas del rubro',                  '📆', 'calendario_fechas', null, 0),
  ('dc_seguimiento', 'dc_eventos_cliente',  'Eventos del cliente',           'Aniversarios y fechas fuertes del boliche',       '🎈', null,                null, 1)
)
insert into public.checklist_secciones (canal, zona, codigo, nombre, descripcion, icono, especial, intro, orden, activa, parent_id)
select 'disco', 'mendoza', h.codigo, h.nombre, h.descripcion, h.icono, h.especial, h.intro, h.orden, true,
       (select n.id from public.checklist_secciones n
         where n.canal = 'disco' and n.zona = 'mendoza' and n.codigo = h.madre)
  from h
on conflict (canal, zona, codigo) do nothing;

-- 4) Tareas para tildar
with i (codigo, texto, orden) as (values
  ('dc_intro',        'Revisé el historial del cliente antes de la visita',                            0),
  ('dc_intro',        'Llevo el catálogo de materiales y los eventos del mes',                         1),
  ('dc_intro',        'Identifiqué oportunidades de mejora para este cliente',                         2),
  ('dc_eventos_mes',  'Presenté los eventos prearmados del mes',                                       0),
  ('dc_eventos_mes',  'El cliente eligió un evento o quedó para confirmar',                            1),
  ('dc_activaciones', 'Acordé que el cliente publique la acción en sus redes (foto como evidencia)',   0)
)
insert into public.checklist_items (seccion_id, texto, orden, activo)
select s.id, i.texto, i.orden, true
  from i
  join public.checklist_secciones s on s.canal = 'disco' and s.zona = 'mendoza' and s.codigo = i.codigo
 where not exists (select 1 from public.checklist_items x where x.seccion_id = s.id and x.texto = i.texto);

-- 5) Comprobar: tiene que listar 7 madres y 13 subsecciones activas, y 6 tareas
select coalesce(m.nombre || '  ›  ', '') || s.nombre as seccion, s.codigo, s.especial,
       (select count(*) from public.checklist_items i where i.seccion_id = s.id) as tareas
  from public.checklist_secciones s
  left join public.checklist_secciones m on m.id = s.parent_id
 where s.canal = 'disco' and s.activa
 order by coalesce(m.orden, s.orden), s.parent_id nulls first, s.orden;
