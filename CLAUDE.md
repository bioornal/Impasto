@AGENTS.md

# Impasto · Estado del proyecto

Pizzería de **Puerto Iguazú, Misiones**. Next.js 16 + InsForge (Postgres) + Mercado Pago.
Deploy en Netlify: https://vocal-naiad-861a2c.netlify.app

Última actualización: 20 de agosto de 2026.

## Cómo trabajar en este repo

- **El gestor de paquetes es `pnpm`**, no npm. Instalar con npm rompe la auth del panel:
  el `package-lock.json` fijaba `@insforge/sdk@1.2.5`, que no expone el subpath `/ssr`.
  Ese lockfile ya se eliminó; no volver a crearlo.
- `pnpm build`, `pnpm test` (tests de horarios), `pnpm dev`.
- **Migraciones:** `npx -y @insforge/cli db migrations new <nombre>` + `db migrations up --all`.
  Nunca con `db query`: **descarta el DDL en silencio y reporta éxito igual**.
- **Al editar archivos con scripts**, ojo con los finales de línea CRLF: varios reemplazos
  fallaron por eso y TypeScript no los detecta (una prop sin usar compila). Verificar en el
  navegador, no solo con `tsc`.
- El deploy de Netlify se dispara solo al pushear a `main`. **Cambiar una variable de entorno
  no afecta a los deploys ya publicados**: hay que reconstruir aunque la variable se lea en runtime.
- `app/api/productos/route.ts` no lo consume nadie en el repo. Se conservó por si algún
  cliente externo lo llama. Si se confirma que no, borrarlo es un cambio de un archivo.
- **Al verificar con `grep` que no quedan literales duplicados, incluí `.tsx`.** Un grep con
  solo `--include=*.ts` dio un falso negativo y dejó pasar una cuarta copia de la allowlist
  de categorías en `StoreProvider.tsx`.

## Los tres proyectos que comparten esta base

La base InsForge `3agqcygs.us-east.insforge.app` la usan **tres aplicaciones distintas**, sin
separación por esquema ni columna de pertenencia. Las tres apuntan al mismo backend.

| Proyecto | Qué es | Stack | Producción |
|---|---|---|---|
| **Impasto** (este repo) | E-commerce de la pizzería de Iguazú | Next.js 16 | `vocal-naiad-861a2c.netlify.app` |
| **El Fogón — Dashboard** (`recetario-napolitano`) | Costeo: ingredientes, recetas, costos, márgenes y precios de venta. Más la calculadora de masa napolitana | Astro + Netlify | `recetarionapolitano.netlify.app` |
| **Carro Fogón** (`carroFogon/next-app`) | Punto de venta del carro: toma pedidos, imprime comanda | Next.js 15 + Vercel | `carro-fogon.vercel.app` |

### Quién escribe qué

- `recetas`, `ingredientes`, `receta_ingredientes`, `precios_venta`, `costos_fijos`,
  `costos_variables`, `config_negocio`, `gastos`, `ventas_mes` → **las escribe el recetario**.
  Impasto **solo las lee**: de ahí salieron las descripciones y los tags, y desde el
  21/08/2026 también los precios efectivos. Escribirlas rompe el costeo del recetario.
- `productos`, `pedidos`, `clientes` → **compartidas entre Impasto y Carro Fogón**. Las tres
  las escriben los dos.
- `etiquetas`, `carritos`, `pedido_eventos`, `notificaciones`, `promociones`, `testimonios`,
  `info_empresa_impasto` → hoy las usa solo Impasto, pero **viven en la misma base**, sin
  prefijo ni esquema propio.
- El recetario **lee `pedidos`** en `ganancias.astro` para calcular la ganancia del mes. Los
  pedidos de Impasto y los del carro entran **juntos** en ese cálculo.

### La fuga que hay que conocer

`GET /api/productos` de Carro Fogón hace `.select("*").eq("disponible", true)` **sin filtrar
por categoría**. Al 21/08/2026 su menú lista **65 productos, de los cuales 49 son de Impasto**
(32 pizzas, 9 empanadas, 8 bebidas) y solo 16 son suyos (hamburguesas, lomos, calzones, otros).
**Activar un producto acá lo agrega al menú del carro.** Pasó con las 8 bebidas.

En el sentido inverso Impasto **sí** está protegido: filtra por `CATEGORIAS_IMPASTO`
(`lib/categorias.ts`), y el `POST` de Carro Fogón inserta sin `categoria`, así que sus
productos quedan con categoría nula y no llegan al catálogo de Impasto.

Además Carro Fogón recalcula los precios del pedido cruzando **por `nombre`** contra
`productos` (`app/api/pedidos/route.ts`), no por `id`: dos filas con el mismo nombre se pisan
entre proyectos.

**Nada de esto se arregla desde este repo.** El arreglo natural es el filtro de categoría del
lado del carro, pero es su código y su decisión.

## Lo que está terminado y verificado en producción

- **Auth del panel** — las 10 rutas admin protegidas + rate limiting en el login.
- **Mercado Pago (Checkout API vía Orders)** — formulario propio con Secure Fields (no Brick),
  `POST /v1/orders` con idempotencia, webhook con firma HMAC que falla cerrado, mapeo de estados
  y devoluciones totales y parciales desde el panel.
  **Credenciales de PRODUCCIÓN activas: cobra plata real.**
- **Persistencia del pedido** — todos los campos + historial con timestamps en `pedido_eventos`.
- **Horarios y estado de venta** — configurables desde el panel, con interruptor manual para
  vacaciones. La validación vive en `createPedido`, el punto único por donde pasan todas las
  vías de pago. La hora se calcula en la zona del local, no del servidor (Netlify corre en UTC).
- **Rate limiting** con respaldo en base (las funciones serverless no comparten memoria).
- **Módulo de email** construido y probado, **pero sin proveedor configurado**.

### Distinción que se presta a confusión

`hours` es el horario de trabajo que ve el cliente (**hasta las 00:00**).
`horaCierre` es la hora del **último pedido** (**23:45**). No son lo mismo y se editan por separado.

`categoria` también tiene dos sentidos. En la base es la **línea de producto** (`pizzas`,
`hamburguesas`); en TypeScript, `Pizza.categoria` es el **estilo** (`clasica` | `gourmet`).
El estilo se resuelve por `tags`: etiquetar una pizza como `"gourmet"` la hace aparecer en
esa pestaña y le pone el badge. `Veggie` y `Picantes` funcionan igual — son filtros por
`tags`, no por `categoria`. Los valores exactos que espera el filtro son `gourmet`,
`vegetariana` y `picante`; en empanadas, `picante`, `vegetariana` y `dulce`.

Las pestañas del sitio (`Todas`, `Clásicas`, `Gourmet`, `Veggie`, `Picantes`) están
**hardcodeadas** en `PizzaList.tsx` y filtran por `tags`. Los cartelitos, en cambio, salen
de la tabla `etiquetas` y se administran desde el panel. Son dos cosas distintas: una
etiqueta puede alimentar una pestaña, mostrar un cartelito, las dos o ninguna.

La columna `tipo` no influye en nada de lo que ve el cliente: la clasificación (pizza,
empanada, bebida, y con eso lo que pisa el catálogo del sitio) sale toda de `categoria`.
En el panel, el selector "Tipo" del formulario de productos ahora es quien manda: al
crear o editar un producto, cambiar el Tipo deriva `categoria` automáticamente
(`pizza→pizzas`, `empanada→empanadas`, `bebida→bebidas`), así no puede quedar un producto
con un Tipo que no se corresponda con su `categoria`. Ya no hay un selector de Categoría
aparte en el panel.

## Pendientes, en orden sugerido

### 1. Proveedor de email
El código está listo; falta solo configuración. InsForge está en **plan free**, donde
`emails.send()` no está disponible. Recomendación: **Resend** (100 mails/día gratis), que
necesita verificar el dominio por DNS. Variables a completar en `.env.local` y Netlify:
`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`.
Hoy los avisos se registran en la tabla `notificaciones` con estado `omitido`.

### 2. Catálogo
**Descripciones y tags: hechos el 20/08/2026.** Las 41 pizzas y empanadas tienen
descripción, y los tags están cargados. Falta todavía: **fotos reales** (hoy son
ilustraciones generadas), alérgenos, tamaños y stock.

Ojo con el conteo: la tabla tiene 65 filas, no 41 — 41 de Impasto, 16 del proyecto
paralelo (`hamburguesas`, `lomos`, `calzones` y `otros`, esta última una sola fila:
"Esfiha de Carne"), y 8 bebidas cargadas en borrador.

**Las descripciones no se inventaron: salen de las recetas reales.** Ver "El catálogo
tiene recetas" más abajo — es el hallazgo que más rinde de todo el proyecto.

Efecto secundario que conviene no romper: el buscador filtra por `nombre + desc`
(`PizzaList.tsx:36`), así que **los ingredientes nombrados en la descripción son
buscables**. Buscar "panceta" devuelve cinco pizzas, cuatro de las cuales no la tienen
en el nombre. Si se reescriben las descripciones sacando ingredientes, se pierde eso.

### 3. Bebidas
0 productos con `categoria = 'bebidas'`. La app las soporta y oculta la sección si no hay.

### 4. Promociones
Tabla `promociones` vacía. Falta interfaz, reglas de aplicación, vigencias, límites de uso,
descuentos reales en la cotización y validación server-side.

### 5. Notificaciones que faltan
Aviso al local cuando entra un pedido, seguimiento en tiempo real y actualización automática
del estado. **WhatsApp automático quedó descartado**: la API oficial de Meta exige un número
que no esté en WhatsApp Business App, verificación con CUIT y plantillas aprobadas.
Las librerías no oficiales arriesgan el baneo permanente del número del local.

### 6. Chatbot vendedor
Sin empezar. La base está lista: catálogo en DB, cotización server-side, carrito persistente
y pedidos asociados a sucursal.

### 7. Calidad y operación
Solo hay tests de horarios. Falta: tests de cotización y pedidos, logs estructurados, monitoreo,
limpieza automática de carritos abandonados, consentimiento de privacidad, SEO local y analítica.

## Decisiones tomadas, para no rediscutirlas

- **Sin Brick de Mercado Pago.** El formulario es propio; solo número, vencimiento y CVV son
  iframes de MP (Secure Fields), porque lo contrario exige certificación PCI-DSS.
- **Sin borde relleno.** El local no lo hace; se eliminó de todo el flujo.
- **Sin pedidos anticipados.** Con el local cerrado no se toman pedidos, ni siquiera programados.
  Si se quiere habilitar, aceptarlos siempre que el horario elegido caiga dentro de la atención.
- **Email como canal de avisos**, no WhatsApp.

## El catálogo tiene recetas (hallazgo del 20/08/2026)

La base tiene **los ingredientes reales de cada producto**, y no estaba documentado. Son
tres tablas globales, que **escribe el recetario** (`recetario-napolitano`):

- `recetas` (81 filas) — una por producto, se cruza con `productos` **por `nombre`**.
- `ingredientes` (79) — con `precio_kg`, `tipo` y `multiplo_rendimiento`.
- `receta_ingredientes` (441) — la tabla puente, con `cantidad_kg` y `merma_factor`.

**El cruce cubre las 41 de Impasto sin un solo faltante.** De ahí salieron las
descripciones y los tags de `vegetariana` y `picante`. Antes de inventar cualquier dato
de producto, mirar acá primero.

Solo se leen: escribirlas afectaría el costeo del recetario.

### Errores de carga detectados en esas recetas

No los corregí porque son del sistema de costos del otro proyecto, pero **inflan costos**:

- `Pizza Anchoas` y `Napoletana Marinara`: **8.000 g de anchoas** cada una. Ocho kilos.
- `Empanadas Espinaca y Muzza`: cada ingrediente cargado **dos veces**.
- `Napoletana Margarita Especial`: `Pesto 0g`.
- Varias: `Huevo Duro 2g`, que parece ser "2 unidades" y no 2 gramos.

### Dos nombres que no coinciden con su receta

- `Pizza 5 Quesos` lleva **seis**: muzzarella, cheddar, roquefort, sardo, dambo y parmesano.
- `Pizza Rellena Provolone` **no lleva provolone**, lleva sardo. La que sí lo lleva es
  `Pizzeta Provolone Rellena`.

Las descripciones dicen lo que el producto **realmente** lleva, así que en esos dos casos
la descripción contradice al nombre. Hay que corregir el nombre o la receta.

## Cómo funcionan las etiquetas

Se administran desde la sección **Etiquetas** del panel y viven en la tabla `etiquetas`.

- **`slug` es inmutable** y es lo que se guarda en `productos.tags`. **`label`** es lo que
  ve el cliente y se puede renombrar sin tocar ningún producto. Esa separación es
  deliberada: renombrar el slug huerfanaría las marcas de todos los productos.
- **`orden` define la prioridad.** Cada tarjeta muestra **un solo cartelito**: el de menor
  orden entre los que el producto tenga. Es decisión de diseño, no una limitación técnica.
- **`mostrar_badge`** (`ambos` / `pizzas` / `empanadas` / `ninguno`) decide **dónde se ve**
  el cartelito, no dónde se puede marcar. Por eso `vegetariana` está en `empanadas`: filtra
  15 pizzas en la pestaña Veggie sin ensuciarles la tarjeta.
- **`sistema`** marca las que alimentan pestañas hardcodeadas (`gourmet`, `vegetariana`,
  `picante`). **No impide borrarlas**: el panel avisa qué pestaña queda vacía y cuántos
  productos pierden la marca, y el dueño decide.
- Al borrar una etiqueta, **el slug se quita de los productos** en la misma operación.
  Dejarlo huérfano lo volvería invisible desde el panel.
- La resolución del cartelito vive en `resolverBadge()`, en `lib/catalog-build.ts`, y está
  cubierta por tests. Los componentes reciben el badge ya resuelto.
- La paleta de colores es fija y las variables CSS **tienen que existir en
  `app/impasto.css`**. `--a-sidebar` solo existe en `admin.css`: un badge con ese color se
  vería bien en el panel y roto en el sitio.

## Cosas que hay que recordar hacer

- **`productos` es una tabla global compartida** con **Carro Fogón**, y no tiene ninguna
  columna de pertenencia. El único criterio es `categoria` contra `CATEGORIAS_IMPASTO`
  (`lib/categorias.ts`): `pizzas`, `empanadas` y `bebidas` son de Impasto; `hamburguesas`,
  `lomos`, `calzones` y `otros` son del otro proyecto. **No borrar ni editar esas filas.**
  Es el mismo problema que `info_empresa_impasto`, pero con Mercado Pago en producción del
  otro lado: si el proyecto paralelo carga algo con `categoria = 'pizzas'`, aparece en el
  sitio y es cobrable.
- **Al comprar el dominio:** cambiar la URL del webhook en Mercado Pago (se hace por MCP) y
  actualizar la variable en Netlify. Conviene además separar la URL de sandbox de la de
  producción, hoy apuntan al mismo endpoint.
- **`info_empresa_impasto`** sigue siendo una tabla global con datos de Iguazú. Si otro de los
  dos proyectos la consulta directamente, va a mostrar estos datos.
- Si se rota el secreto del webhook en el panel de MP, actualizar `MERCADOPAGO_WEBHOOK_SECRET`
  **y reconstruir**, o el webhook rechaza todo con 401.
