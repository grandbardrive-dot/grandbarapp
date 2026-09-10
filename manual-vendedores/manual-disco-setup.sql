-- ============================================================
--  Manual de DISCOS = copia del manual de BARES
--  Correr en el proyecto del MANUAL (fzaxwuuodseyyinveknn) → SQL Editor
--
--  El rubro ya existe: está la pestaña "🕺 Discos" en Secciones del manual y el
--  código ya manda ahí a los clientes de tipo disco. Faltaba el contenido.
--
--  Copia las 29 secciones de Bares (9 madre + 20 subsecciones, respetando cuál
--  está desactivada) y sus ítems. Las ofertas del catálogo aparecen solas en
--  "Acciones Mensuales" de VINOS, SPIRITS y FRÍO, porque el widget se ubica
--  por el nombre de la sección. Disco usa el canal ON del catálogo, igual que bar.
--
--  Es un punto de partida: Luciana después edita desde Secciones → Discos.
--  Se puede correr más de una vez sin duplicar nada.
-- ============================================================

-- 1) Secciones madre
insert into public.checklist_secciones
  (canal, zona, codigo, nombre, descripcion, icono, icono_bg, icono_color,
   especial, intro, orden, activa, pdf_url, parent_id)
select 'disco', s.zona, s.codigo, s.nombre, s.descripcion, s.icono, s.icono_bg, s.icono_color,
       s.especial, s.intro, s.orden, s.activa, s.pdf_url, null
  from public.checklist_secciones s
 where s.canal = 'bar' and s.parent_id is null
on conflict (canal, zona, codigo) do nothing;

-- 2) Subsecciones, apuntando a la madre NUEVA (se la encuentra por código)
insert into public.checklist_secciones
  (canal, zona, codigo, nombre, descripcion, icono, icono_bg, icono_color,
   especial, intro, orden, activa, pdf_url, parent_id)
select 'disco', h.zona, h.codigo, h.nombre, h.descripcion, h.icono, h.icono_bg, h.icono_color,
       h.especial, h.intro, h.orden, h.activa, h.pdf_url,
       (select n.id from public.checklist_secciones n
         where n.canal = 'disco' and n.zona = h.zona and n.codigo = m.codigo)
  from public.checklist_secciones h
  join public.checklist_secciones m on m.id = h.parent_id
 where h.canal = 'bar' and h.parent_id is not null
on conflict (canal, zona, codigo) do nothing;

-- 3) Ítems del checklist
insert into public.checklist_items (seccion_id, texto, descripcion, orden, activo)
select n.id, i.texto, i.descripcion, i.orden, i.activo
  from public.checklist_items i
  join public.checklist_secciones b on b.id = i.seccion_id
  join public.checklist_secciones n
    on n.canal = 'disco' and n.zona = b.zona and n.codigo = b.codigo
 where b.canal = 'bar'
   and not exists (select 1 from public.checklist_items x where x.seccion_id = n.id);

-- 4) Comprobar: tiene que dar igual en las dos columnas
select canal,
       count(*) filter (where parent_id is null)     as madres,
       count(*) filter (where parent_id is not null) as subsecciones,
       (select count(*) from public.checklist_items i
          join public.checklist_secciones x on x.id = i.seccion_id
         where x.canal = s.canal)                     as items
  from public.checklist_secciones s
 where canal in ('bar', 'disco')
 group by canal;
