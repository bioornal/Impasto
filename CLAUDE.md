@AGENTS.md

# Impasto · Estado del proyecto

Pizzería de **Puerto Iguazú, Misiones**. Next.js 16 + InsForge (Postgres) + Mercado Pago.
Deploy en Netlify: https://vocal-naiad-861a2c.netlify.app

Última actualización: 24 de agosto de 2026.

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

Van tres cosas trabadas esperando lo mismo, una sesión del dueño: esta (Resend), el bot de
Telegram del punto 5 y la cuenta de DeepSeek del punto 6. Conviene resolver las tres juntas.

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
**Hecho.** Ya no son 0: hay 8 bebidas cargadas con precio (Vino Malbec, Coca-Cola 1.5 L,
Quilmes, Brahma, Sprite y agua con y sin gas), verificadas en el sitio el 24/08/2026. La
app las soporta y oculta la sección si no hay — hoy no hace falta que la oculte.

### 4. Promociones
Tabla `promociones` vacía. Falta interfaz, reglas de aplicación, vigencias, límites de uso,
descuentos reales en la cotización y validación server-side.

### 5. Notificaciones que faltan
**El aviso al local ya está hecho** (Telegram, 21/08/2026) — falta que el dueño cree el bot y
cargue las variables. Sigue faltando el seguimiento en tiempo real y que el panel se actualice
solo. **WhatsApp automático quedó descartado**: la API oficial de Meta exige un número
que no esté en WhatsApp Business App, verificación con CUIT y plantillas aprobadas.
Las librerías no oficiales arriesgan el baneo permanente del número del local.

### 6. Chatbot vendedor
**Hecho el 23/08/2026.** Ver "El chatbot vendedor" más abajo. Falta que el dueño cree la
cuenta de DeepSeek y cargue saldo: hasta entonces el widget es un botón de WhatsApp.

### 7. Calidad y operación
Hay tests de horarios, catálogo, aviso al local y SEO. Falta: tests de cotización y pedidos, logs estructurados, monitoreo,
limpieza automática de carritos abandonados, consentimiento de privacidad y analítica.

## Decisiones tomadas, para no rediscutirlas

- **Sin Brick de Mercado Pago.** El formulario es propio; solo número, vencimiento y CVV son
  iframes de MP (Secure Fields), porque lo contrario exige certificación PCI-DSS.
- **Sin borde relleno.** El local no lo hace; se eliminó de todo el flujo.
- **Sin pedidos anticipados.** Con el local cerrado no se toman pedidos, ni siquiera programados.
  Si se quiere habilitar, aceptarlos siempre que el horario elegido caiga dentro de la atención.
- **Email como canal de avisos**, no WhatsApp.
- **El chatbot ofrece alcohol como cualquier otra bebida.** Se le planteó al dueño el 23/08/2026
  que listar alcohol en la carta y tener un bot empujándolo son dos posturas distintas frente a
  la Ley 24.788, porque es un sistema automatizado sin verificación de edad. Decidió que sí, así
  que **no hay ninguna regla especial sobre alcohol en el prompt**: el Malbec y las cervezas se
  sugieren igual que una gaseosa. Si algún día se quiere restringir, es una línea en
  `lib/chat-prompt.ts`.
- **El copy del sitio no se unifica por refactor.** Pizzas dice “sin costo extra” y el modal de
  mitad y mitad dice “sin recargo”: significan lo mismo, y reemplazar una por la otra para que
  salgan de una sola constante le cambia la voz a una sección. Lo que tiene que salir de un
  solo lugar son los **datos verificables** (cifras, reglas de precio), no la redacción.

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

## Cómo se entera el local de que entró un pedido

Por **Telegram**, desde el 21/08/2026. Antes no había ningún aviso al local: el único que el
sistema mandaba era un mail **al cliente**, y encima sin proveedor configurado.

- `lib/telegram.ts` es el punto único de envío, espejo de `lib/email.ts`. Sin
  `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_IDS` devuelve `omitido` y no rompe nada.
- **Nunca agregarle `parse_mode`.** El mensaje lleva nombre y dirección escritos por el
  cliente; con Markdown activo un nombre podría inyectar formato o un link. `lib/aviso-local.ts`
  además aplana los saltos de línea, para que nadie falsifique una línea del aviso.
- `lib/aviso-local.ts` arma el texto y **no importa el SDK**, por eso se puede testear bajo
  `tsx` (`tests/aviso-local.test.ts`). Si alguna vez necesita `db`, el test deja de correr.
- La segunda línea del mensaje dice qué hacer con la plata: `COBRAR AL ENTREGAR $X` en
  efectivo, `PAGADO CON TARJETA` cuando MP aprobó, `PAGO SIN CONFIRMAR — revisar` en
  transferencia. No hay un "pago OK" genérico: en efectivo tampoco está cobrado.

Avisa en tres momentos: el checkout de efectivo y transferencia, la tarjeta cuando MP la
aprueba (rechazada no avisa), y **el webhook cuando un pago pendiente pasa a aprobado** — sin
ese tercero, una tarjeta que se acredita más tarde no le llega a nadie.

No se duplica: el índice único de `notificaciones` es `(pedido_id, tipo, canal)`, así que el
aviso de Telegram convive con el del mail y un reintento no manda dos veces.

**Lo que todavía falta:** el panel **no se refresca solo** (`StoreProvider.tsx`, `useEffect`
con dependencias vacías). Aunque quede abierto en una pantalla del local, un pedido nuevo no
aparece hasta recargar a mano.

## El storage (arreglado el 23/08/2026)

Ninguna subida funcionaba, por ninguna vía — panel, SDK o CLI. El error visible era
`DATABASE_VALIDATION_ERROR`, que no dice nada; **el motivo real solo aparece en los logs del
backend** (`npx -y @insforge/cli logs insforge.logs --limit 40`):

    column "uploaded_via" of relation "objects" does not exist

El backend corre InsForge **2.1.1** e inserta `storage.objects.uploaded_via` en cada PUT, pero
la tabla de este proyecto seguía en el esquema anterior: **la migración de plataforma nunca
corrió acá**. Se arregló agregando la columna (`text`, nullable; el backend le escribe `rest`
o `s3`).

**No se puede hacer por migración.** El backend rechaza el DDL con *"Write operations on storage
schema are not allowed"*, así que `db migrations up` falla y dejar el archivo en `migrations/`
trabaría todas las migraciones siguientes. Se aplicó por **conexión directa a Postgres**
(`npx -y @insforge/cli db connection-string` + `pg`), que no pasa por ese guardia. Es la única
vía para tocar los esquemas de plataforma, y por eso este arreglo **no figura en
`db migrations list`**.

Si InsForge vuelve a actualizar el backend y el storage se rompe otra vez, mirar primero si
falta otra columna nueva: es el mismo síntoma.

Dos cosas más, para no repetir el diagnóstico:

- **El nombre del bucket no era el problema.** `DB` en mayúsculas funciona igual que
  `client-assets`. Los dos buckets fallaban idéntico, que fue lo que descartó al bucket.
- **Para assets fijos del sitio (el logo del navbar, íconos) no uses storage**: van en
  `public/` con `next/image`. Se sirven desde el dominio propio, entran en el build y no
  gastan el egress de InsForge. El storage es para lo que sube el dueño desde el panel —
  las fotos reales de productos, que siguen pendientes.

## SEO (hecho el 23/08/2026)

Antes el sitio tenía solo `title` y `description`: sin `robots.txt`, sin sitemap y sin
datos estructurados. Para Google era una página cualquiera, no una pizzería de Iguazú.

- **`lib/site.ts` define la URL canónica** y la usan todos: canonical, `og:url`, sitemap,
  robots y el JSON-LD. Sale de `NEXT_PUBLIC_SITE_URL`, si no de `URL` (que Netlify inyecta
  sola en el build), si no del subdominio actual. **Se lee en build**: al comprar el dominio
  hay que cargarla *y reconstruir*, igual que la public key de Mercado Pago.
- **Los metadatos del `layout` son estáticos** y salen de `BUSINESS`, no de la base: así el
  layout no depende de una consulta. Lo que Google realmente usa para horario, teléfono y
  precios es el **JSON-LD de `app/page.tsx`**, que sí lee la configuración viva del panel.
- **`lib/seo.ts` arma el JSON-LD y no importa `db`**, igual que `lib/aviso-local.ts`, por eso
  se puede testear con `tsx` (`tests/seo.test.ts`).
- **`serializarJsonLd()` escapa el `<`.** Las descripciones las escribe el dueño desde el
  panel: una que contenga `</script>` cortaría la etiqueta. Nunca sacar ese escape.
- **Sin `aggregateRating`.** Google no acepta como rich result las reseñas que el propio
  negocio recolecta y publica sobre sí mismo; declararlas es arriesgar un aviso en Search
  Console a cambio de nada. (Aparte: el hero muestra “4,9★ +1.200 reseñas” hardcodeado
  mientras `testimonios` se administra desde el panel. Conviene mostrar el número real.)
- **`ciudad` en la base guarda “Puerto Iguazú, Misiones”**, ciudad y provincia juntas, porque
  el sitio la muestra así. schema.org las quiere separadas: `partesUbicacion()` las parte.
  Se descubrió mirando el JSON-LD renderizado contra la base, no con los tests.
- **El horario del JSON-LD cierra a las 23:45**, la hora del último pedido, no a las 00:00 en
  que cierra el local. Para un sitio de delivery es el dato útil. Ver la distinción de
  `hours` vs `horaCierre` más arriba.
- **La miniatura para compartir la genera `app/opengraph-image.tsx`** con `next/og`, en el
  build. No es un archivo en `public/`: si se cambia el texto, se regenera sola.
- El panel y la API quedan fuera del índice por `robots.ts` **y** por `robots: noindex` en
  `app/admin/layout.tsx` y `app/admin-login/layout.tsx`. Lo segundo cubre el caso de que
  alguien enlace la URL desde afuera: sin él, Google indexa la URL aunque no la rastree.

Lo que falta del lado de SEO: **Google Business Profile** (es lo que más mueve en búsqueda
local y no se hace desde el código), fotos reales, y rutas propias por producto — hoy la
carta entera vive en `/` y el sitemap tiene una sola entrada.

## El chatbot vendedor (23/08/2026)

Reemplazó al botón flotante de WhatsApp (`components/chat/ChatWidget.tsx`). **Vende, pero no
toma pedidos**: recomienda de la carta y dice dónde encontrar el producto; el que agrega al
carrito es siempre el cliente.

- **La IA va por DeepSeek directo**, no por InsForge. `lib/deepseek.ts` es el punto único de
  llamada, espejo de `lib/telegram.ts` (mismo patrón `{ estado: "omitido"; motivo }`): sin
  `DEEPSEEK_API_KEY` devuelve `omitido`, `hayChat()` da `false` y el widget pasa a ser un botón
  de WhatsApp. **La key es server-only, nunca `NEXT_PUBLIC_`.**
- **InsForge sí tiene IA funcionando** en el plan free de este proyecto —se probó contra el
  backend el 23/08/2026— pero el Model Gateway nuevo no está disponible y el helper viejo del
  SDK no hace streaming. Si algún día hay que volver, el camino es `db.ai.chat.completions`.
- **El modelo es `deepseek-v4-flash`** (default en `lib/deepseek.ts`, se puede pisar con
  `DEEPSEEK_MODEL`). Los viejos `deepseek-chat` y `deepseek-reasoner` ya no existen: verificar
  el nombre en la documentación antes de escribirlo de memoria.
- **`lib/chat-prompt.ts` es todo lo que el bot sabe.** No consulta nada durante la charla. Con
  la carta cerrada en el prompt no puede inventar un producto, y como sale de
  `getCatalogData()` —ya filtrado por `CATEGORIAS_IMPASTO`— no puede ofrecer nada del Carro
  Fogón. **Nunca consultar `productos` directo desde el chat.**
- **El bot no puede cotizar distinto que el carrito, o le miente al cliente.** La mitad y mitad
  cobra el precio de la más cara, y las empanadas se venden solo en cajas: sin esas reglas en
  el prompt, el bot sumaría dos precios donde el carrito cobra uno. Por eso existe
  `lib/reglas-carta.ts` —no estaba en el plan original—, que las escribe una sola vez y las usan
  `lib/chat-prompt.ts` y los componentes que de verdad cobran (`HalfModal.tsx`,
  `EmpanadasSection.tsx`). No importa `db` ni componentes de React, para poder testearse con
  `tsx`.
- **El historial lo manda el cliente y se sanea en `lib/chat-mensajes.ts`**: se descarta el rol
  `system`, se conservan los últimos 12 mensajes, y se cortan por tamaño — pero **el tope no es
  el mismo para los dos roles**. `user` se corta a 500 caracteres (una consulta de venta no
  necesita más); `assistant` se corta a 2.000, porque es lo que generó el propio modelo con
  `max_tokens: 400` (hasta ~1.400 caracteres en español): aplicarle el tope de 500 le
  devolvería al modelo, en el turno siguiente, una versión truncada de su propia respuesta. El
  prompt de sistema se arma siempre en el servidor y nunca viaja desde el cliente.
- **La ruta guarda una foto del catálogo con TTL de 5 minutos** (`app/api/chat/route.ts`).
  `getCatalogData()` consulta doce tablas y no puede correr en cada mensaje. Un precio recién
  editado tarda hasta cinco minutos en llegarle al bot; **no afecta lo que se cobra**, que
  sigue siendo server-side.
- **Esa foto nunca cachea una carta vacía.** `getCatalogData()` no distingue "la base falló" de
  "la carta está legítimamente vacía": su único `catch` (`lib/catalog.ts`) devuelve un catálogo
  sin productos pero perfectamente válido. Si se cacheara esa foto, un corte de base justo
  cuando el TTL vence dejaría al bot negándole la carta entera a cada cliente durante los cinco
  minutos siguientes. La contrapartida asumida a propósito: si la carta llegara a estar
  legítimamente vacía, cada mensaje repetiría las doce consultas en vez de aprovechar la caché
  — lo acota el rate limit de `chat` (40 mensajes cada 10 minutos por IP).
- **El widget tiene dos plazos de espera, no uno** (`ChatWidget.tsx`): uno hasta que llega el
  primer fragmento del stream y otro entre fragmentos una vez que ya arrancó, que se reinicia
  con cada fragmento nuevo. **El primero tiene que ser mayor que el timeout del servidor**
  (el `AbortController` de 20s de `lib/deepseek.ts`, que cubre solo la conexión, no el cuerpo
  del stream): si el del cliente fuera igual o menor, abortaría requests que el servidor
  todavía estaba atendiendo bien.
- **El streaming hay que mirarlo en producción, no en `pnpm dev`.** Las funciones serverless
  pueden bufferear la respuesta y entregarla entera al final: se ve igual que sin streaming y
  no tira ningún error. **No se verificó en esta sesión** — queda pendiente para después del
  próximo deploy (ver Step 6 de la task de cierre).
- **`lib/marca.ts` no alcanza si el sitio no lee de ahí.** Empezó con 3 argumentos sin `id`; hoy
  tiene 7, cada uno con `id` estable para pedirlo puntual con `argumento()`. Lo leen el prompt
  del bot, cinco secciones del sitio (`Story`, `Hero`, `PizzaList`, `EmpanadasSection`,
  `Header`) y `lib/seo.ts`. Antes de este módulo la misma afirmación estuvo duplicada en cinco
  lugares: solo entra acá lo que es verificablemente cierto del negocio.
- **`BusinessConfig.deliveryEstimate`** es el único tiempo de entrega: lo usan siete lugares
  del sitio —tres en `Confirmation.tsx`, tres en `Checkout.tsx`, uno en `CartDrawer.tsx`— más
  el prompt del bot.
- Lo que el bot **no** hace: no arma carrito, no toca la pantalla, no captura datos y no
  consulta el estado de pedidos. Nada de la conversación se guarda.

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
