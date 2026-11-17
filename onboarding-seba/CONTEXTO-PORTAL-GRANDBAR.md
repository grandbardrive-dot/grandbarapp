# Contexto del Portal GrandBar — para desarrollar con Claude

> **Para quién es esto:** este archivo se lo das a tu Claude (Claude Code) al empezar
> a trabajar. Le explica qué es el portal, cómo está armado, cómo se publica y las
> reglas que **no** se pueden romper. Pegalo como primer mensaje, o guardalo como
> `CLAUDE.md` en la raíz del repo y Claude lo lee solo.

---

## 1. Qué es el Portal GrandBar

GrandBar es una distribuidora de bebidas de Mendoza y San Luis (canales ON / OFF /
mayorista). El **Portal** (grandbar-hub) es la app interna donde viven las
herramientas del equipo: paneles de vendedores, supervisores, dirección, marketing,
cobranzas internas, acciones comerciales, incentivos de proveedores, etc.

- **Producción:** https://portalgrandbar.com (hosteado en Netlify).
- **Stack:** HTML + JavaScript (ES modules, sin framework) + Supabase (base de datos,
  auth y storage) + Netlify Functions (backend serverless en Node).
- No hay build ni bundler. Los `.html` y `.js` se sirven tal cual.

---

## 2. Repositorio y cómo se publica (REGLA DE ORO)

- **Repo:** `github.com/grandbardrive-dot/grandbarapp`
- **Carpeta local:** `grandbar-hub`
- **Rama:** `main`

**El portal se publica SOLO con `git push`.** Netlify tiene auto-deploy conectado a
GitHub: apenas se pushea a `main`, se reconstruye y sale online en ~1 minuto.

```
REGLA: NUNCA publicar con `netlify deploy`, ni arrastrando carpetas, ni por CLI.
Solo git push. Si el push falla, NO busques otra forma de subir: avisá y pará.
```

Por qué: el repo es la fuente de verdad. Si subís por fuera de git, el próximo push
de otra persona reconstruye todo desde GitHub y **borra** lo que subiste por afuera.

**Flujo de trabajo, siempre:**

```bash
git pull          # 1. traer lo último ANTES de tocar nada
# ...editás archivos...
git add -A
git commit -m "qué hiciste"
git push          # 2. publica solo
```

> **Trabajo compartido:** en este repo también trabajan Nahuel (Desarrollo) y Josefina.
> No se pisan porque git junta cambios de archivos distintos — por eso el `git pull`
> antes de empezar es obligatorio. Si tocan el MISMO archivo a la vez, puede haber un
> conflicto de merge: resolvelo con calma, no fuerces (`git push --force` jamás).

---

## 3. Supabase — las 4 bases

El portal usa 4 proyectos Supabase (cada uno con su URL y su `anon key` pública). La
mayoría de las cosas del Hub están en **Portal/Hub**.

| Proyecto | Ref | Para qué |
|---|---|---|
| **Portal / Hub** | `xqhyemccbwmzxqzkrtwa` | Auth + datos principales del portal (usuarios, incentivos, presupuestos, notificaciones, etc.) |
| **Manual (vendedores)** | `fzaxwuuodseyyinveknn` | Admin de Luciana, manual del vendedor, visita, acciones de proveedores, propuestas |
| **Catálogo** | `zlwnoqdxendsgbfvfyue` | Catálogo de productos |
| **Portal Cliente** | `qpaoyfubyaloyhepatlm` | Cuenta corriente / cobranzas del cliente (otra app) |

**Claves anon (públicas, van en el front):**
- Hub: `sb_publishable_OOHT_QlNmec_NabERLw5YQ_DexGMwvc`
- Manual: `sb_publishable_gvclIOm9A3vCXEDT38O0Ng_HuOGH-Rk`

> ⚠️ **Secretos:** la `service_role` de cada proyecto y otras claves sensibles
> (VAPID, tokens) **NO van en el código ni en este documento**. Viven como variables
> de entorno en Netlify (`HUB_SERVICE_ROLE`, etc.) y las usan solo las Functions.
> Si necesitás una, pedila; no la hardcodees ni la pegues en un commit.

### Seguridad por rol (RLS)
Supabase tiene Row Level Security. El rol del usuario se resuelve con la función
`public.mi_rol()`. Roles que existen:
`diseno` (Josefina), `desarrollo` (Nahuel), `torneo` (Sepúlveda), `admin` (Fernando),
`ventas` (vendedores), `compras`, y el flag `es_supervisor`. Cuando crees una tabla
nueva, acordate de definir sus políticas RLS según quién tiene que verla/escribirla.

---

## 4. Netlify Functions (backend)

- Viven en `manual-vendedores/netlify/functions/*.js`.
- Son endpoints serverless Node. Se invocan desde el front como
  `/.netlify/functions/<nombre>`.
- Reciben el token del usuario en el header `Authorization: Bearer ...`, validan la
  sesión contra Supabase auth, y recién ahí usan la `service_role` (env var) para leer
  o escribir saltando RLS cuando hace falta.
- Ejemplo a mirar como patrón: `incentivos.js` (lee planes de proveedores y los
  devuelve ya calculados al dashboard).

---

## 5. Convenciones y gotchas (leelas, ahorran dolores)

1. **Los `.js` son ES modules** (usan `import ... from './supabase.js'`). Para
   verificar sintaxis, `node --check archivo.js` da un **falso OK** y no detecta
   errores reales. Verificá copiándolo a `.mjs`:
   ```bash
   cp js/foo.js "$TEMP/chk.mjs" && node --check "$TEMP/chk.mjs"
   ```
   Un paréntesis faltante que pasó el check dejó una vez todo un panel en blanco.

2. **Dos cuentas de GitHub en esta PC** (`grandbardrive-dot` y `cubicmza-svg`). Si el
   `git push` da **403 "Permission denied"**, es porque quedó activa la otra cuenta.
   Se arregla poniendo el usuario en la URL del remote (ya está hecho en grandbar-hub):
   ```
   git remote set-url origin https://grandbardrive-dot@github.com/grandbardrive-dot/grandbarapp.git
   ```

3. **Cache-busting:** cuando cambiás un `.js` que está cacheado, subí la versión en el
   `<script src="assets/foo.js?v=N">` del HTML que lo usa, si no el navegador sigue
   con la vieja.

4. **Archivos cargados / assets** van a buckets de Supabase Storage (ej. fotos de
   presupuestos van al bucket `Activaciones`, carpeta `presupuestos/` del proyecto Manual).

---

## 6. Estructura del repo (orientación rápida)

- **Raíz:** páginas del Hub (`mi-panel.html`, `supervisor-incentivos.html`,
  paneles de dirección, cobranzas internas, trade-acciones, etc.) + `assets/` (JS/CSS).
- **`manual-vendedores/`:** admin de Luciana (`admin-*.html`), `visita.html`, portal
  de proveedores, y `netlify/functions/` (el backend).
- `netlify.toml` en la raíz: `publish="."`, functions en `manual-vendedores/netlify/functions`.

Para entender una pantalla, abrí su `.html` y seguí los `<script src="...">`.

---

## 7. Tu primera misión: automatizar el incentivo Pernod Ricard Q4

Esto es lo que ya venís haciendo (los reportes de incentivos), ahora conectado al portal.

**Cómo está armado hoy (display, ya funciona):**
- Hay una sección **Incentivos** en el portal (`supervisor-incentivos.html` +
  function `incentivos.js`). Muestra tarjetas por proveedor → planes → detalle.
- Campari "Cobertura" lee la tabla **`cobertura_productos`** (Hub): producto, target,
  avance → % cumplimiento. Hoy el avance se actualiza a mano.
- Pernod Ricard "Q4 2026" lee la tabla **`incentivos_snapshots`** (Hub):
  ```
  incentivos_snapshots (
    incentivo  text  primary key,   -- ej. 'PR_Q4_2026'
    corte      date,                -- fecha del dato
    data       jsonb,               -- { nombre, detalle, objetivos[], vendedores[] }
    updated_at timestamptz
  )
  ```
  El `data` guarda los 6 objetivos (marca×canal con meta/logrado/cerca/con_promo) y el
  avance por vendedor. Hoy está sembrada a mano con los números de control del corte.

**Lo que falta (tu desarrollo):**
- El avance real sale del **ERP Aikon / Córdoba Software (WebAPI IS3, empresa 3333
  CUBOS, solo lectura)**. Eso **no se alcanza desde la nube** — hay que correr un
  **script (Python)** en una PC/servidor de GrandBar.
- El script tiene que: consultar el ERP, calcular el avance según las reglas del
  incentivo, y hacer **upsert** del JSON en `incentivos_snapshots` (reemplazar lo que
  hoy se carga a mano).
- Correrlo **todos los días a las 06:00** (Programador de tareas de Windows / cron).
- Credenciales del ERP: te las pasa **JP Sepúlveda** (van como variables de entorno,
  nunca en el código).
- Está todo documentado (reglas, SKUs, estructura del ERP, un script base y los
  números de control) en el doc de traspaso de JP:
  `Contexto_Incentivo_PR_Q4_GrandBar.html`. **Pedíselo a Josefina/JP.**

Validá el resultado contra los números de control del doc antes de darlo por bueno.

---

## 8. Checklist mental antes de pushear

- [ ] Hice `git pull` antes de empezar.
- [ ] Verifiqué la sintaxis de los `.js` como `.mjs`.
- [ ] Si cambié un `.js`, subí el `?v=` en el HTML que lo usa.
- [ ] No hardcodeé ningún secreto (service_role, tokens, VAPID).
- [ ] Las tablas nuevas tienen su RLS pensada.
- [ ] Probé en el navegador que no quedó nada en blanco (consola sin errores).
- [ ] Recién ahí: `git push`.

---

*Dudas de arquitectura o permisos → Nahuel (Desarrollo) o Josefina. Dudas de datos del
ERP e incentivos → JP Sepúlveda.*
