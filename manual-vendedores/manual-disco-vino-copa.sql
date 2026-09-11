-- ============================================================
--  Discos · "Vino por Copa" igual que en restaurantes
--  Proyecto del MANUAL (fzaxwuuodseyyinveknn). Ya aplicado el 12/09/2026
--  (se hizo por la API, con el mismo permiso que usa Secciones del manual);
--  queda acá para poder repetirlo, por ejemplo cuando San Luis tenga su
--  propio manual de discos (cambiar 'mendoza' por 'sanluis').
--
--  El pedido del usuario: "vinos por copa tenés que dejarlo igual que
--  restaurantes". En restaurantes la sección tiene el código s7, y visita.html
--  dibuja la calculadora de precio por copa solo para s7. Con el mismo código,
--  el mismo nombre ("Vino por Copa", que además engancha la herramienta de
--  vinos por copa de Luciana) y las mismas tareas, discos muestra lo mismo.
--  Sigue siendo solo para boliches con previa (solo_formato = 'con_previa').
--  Se puede correr más de una vez.
-- ============================================================

-- 1) La sección de discos toma el código, nombre, descripción e ícono de restaurantes
update public.checklist_secciones d
   set codigo      = 's7',
       nombre      = r.nombre,
       descripcion = r.descripcion,
       icono       = r.icono,
       icono_bg    = r.icono_bg,
       icono_color = r.icono_color,
       intro       = r.intro
  from public.checklist_secciones r
 where d.canal = 'disco'       and d.zona = 'mendoza' and d.codigo in ('vino_por_copa', 's7')
   and r.canal = 'restaurante' and r.zona = 'mendoza' and r.codigo = 's7';

-- 2) Las tareas, copiadas de restaurantes (las apagadas quedan apagadas)
insert into public.checklist_items (seccion_id, texto, descripcion, orden, activo)
select d.id, i.texto, i.descripcion, i.orden, i.activo
  from public.checklist_items i
  join public.checklist_secciones r on r.id = i.seccion_id
                                   and r.canal = 'restaurante' and r.zona = 'mendoza' and r.codigo = 's7'
  join public.checklist_secciones d on d.canal = 'disco' and d.zona = 'mendoza' and d.codigo = 's7'
 where not exists (select 1 from public.checklist_items x where x.seccion_id = d.id and x.texto = i.texto);

-- 3) Comprobar: tiene que decir s7 · Vino por Copa · con_previa · 3 tareas activas
select s.codigo, s.nombre, s.descripcion, s.solo_formato,
       (select count(*) from public.checklist_items i where i.seccion_id = s.id and i.activo) as tareas
  from public.checklist_secciones s
 where s.canal = 'disco' and s.zona = 'mendoza' and s.codigo = 's7';
