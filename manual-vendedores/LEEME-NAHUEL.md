# 👋 Bienvenido al proyecto — App GrandBar Vendedores

Esta es la app que usan los vendedores de GrandBar en el celular para hacer las visitas.
Este instructivo es para que puedas **seguir editándola desde tu compu**, con tu propio chat de Claude Code.

---

## 1. Qué es esto (en criollo)
- Es una app hecha con archivos `.html` y `.js` (no hay que "compilar" nada).
- La info (clientes, promos, avatares, etc.) se guarda en una base llamada **Supabase**.
- La app publicada (lo que ven los vendedores) vive en internet, en:
  **https://grandbar-vendedores.netlify.app**

---

## 2. Instalá Claude Code
1. Necesitás tu propio acceso a **Claude** (Claude Code).
2. Instalalo en tu compu (versión de escritorio o la extensión de tu editor).
3. Guardá **esta carpeta** en un lugar cómodo, por ejemplo `C:\GrandBar\vendedores-app`.
4. Abrí Claude Code **apuntando a esta carpeta**. Desde ahí Claude puede leer y editar los archivos.

> Claude trabaja sobre los archivos que están en tu disco. No hay que "subir" nada al chat: con abrir la carpeta alcanza.

---

## 3. Cómo ver la app mientras trabajás
- La forma más simple: abrí el archivo `index.html` con doble clic (se abre en el navegador).
- Para probar de verdad (con login de vendedor), conviene levantar un servidor local. Pedile a Claude Code:
  *"levantá el preview de la app"* y te guía (usa la config que está en `.claude/`).

---

## 4. Archivos principales (para orientarte)
- `visita.html` → la pantalla de la visita (checklist, camino, carrito, cierre). **Es el archivo más grande e importante.**
- `admin.html` → el panel de carga (promos, productos, materiales, secciones).
- `clientes.html` / `supervisor.html` → listados y perfiles.
- `_checklist-data.js` → estructura base de las listas de cada rubro.
- `_config.js` → datos de conexión a la base (Supabase) y contraseña del panel admin.
- `_avatar.js` / `_accesorios.js` / `vestidor.html` → muñequitos, trajes y niveles.
- Los archivos `.sql` → son la "receta" de cómo está armada la base (referencia).

---

## 5. Cómo publicar los cambios (¡OJO, coordinar!)
- La app se publica en **Netlify** (sitio `grandbar-vendedores`).
- Para publicar hace falta el login de Netlify. Coordiná con Josefina: **lo ideal es que publique una sola persona** para no pisarse.
- Publicar es fácil desde la web de Netlify: se arrastra la carpeta del proyecto al recuadro *"Drag and drop your project folder here"*.

### ⚠️ Lo más importante: no pisarse
Josefina y vos tienen **copias separadas** del proyecto (una en cada compu). No se sincronizan solas.
- Editá **archivos distintos** a los que toca ella (por ejemplo, vos el `admin.html` y ella otra cosa).
- **Avisensé** antes de publicar. El último que publica **pisa** lo del otro.
- Si los dos editan el mismo archivo, uno va a perder su parte. Coordinen.

---

## 6. Reglas de oro (nos salvaron más de una vez)
- Si un cambio toca la **base de datos** (algo con `.sql`), primero **mirá el SQL y probalo con cuidado**. Guardá una copia de lo que había antes.
- **No aprietes** el botón "Migrar" del panel admin (está desactivado a propósito: rompía las secciones).
- Ante la duda, pedile a Claude Code que te **explique** qué hace algo antes de cambiarlo.

---

## 7. Datos clave
- App online: **grandbar-vendedores.netlify.app**
- Base de datos: **Supabase** (datos de conexión en `_config.js`)
- Panel admin: se entra con contraseña (está en `_config.js`)

¡A darle! Cualquier cosa, Claude Code te va guiando paso a paso.
