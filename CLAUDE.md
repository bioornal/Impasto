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
esa pestaña y le pone el badge. Mientras ninguna esté etiquetada, la pestaña está vacía.
Lo mismo pasa con `Veggie` y `Picantes`: son pestañas de filtro por `tags`, no por `categoria`,
y hoy están igual de vacías. Con las 57 filas sin ningún tag cargado, las tres pestañas
(`Gourmet`, `Veggie`, `Picantes`) muestran 0 productos; solo `Todas` (32) y `Clásicas` (32)
tienen contenido, porque `Clásicas` es el default cuando no hay tags.

## Pendientes, en orden sugerido

### 1. Proveedor de email
El código está listo; falta solo configuración. InsForge está en **plan free**, donde
`emails.send()` no está disponible. Recomendación: **Resend** (100 mails/día gratis), que
necesita verificar el dominio por DNS. Variables a completar en `.env.local` y Netlify:
`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`.
Hoy los avisos se registran en la tabla `notificaciones` con estado `omitido`.

### 2. Catálogo (el punto más flojo)
**41 de 41 pizzas y empanadas no tienen descripción.** Ojo: la tabla tiene 57 filas, no 41
— las otras 16 son `hamburguesas`, `lomos`, `calzones` y `otros` (esta última, una sola
fila: "Esfiha de Carne") del proyecto paralelo, y el código de Impasto las filtra. Tampoco
hay fotos reales (se usan
ilustraciones generadas), ni tags, alérgenos, ingredientes, tamaños ni stock.
Es lo que más impacta en la conversión.

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

## Cosas que hay que recordar hacer

- **`productos` es una tabla global compartida** con el proyecto paralelo, y no tiene ninguna
  columna de pertenencia. El único criterio es `categoria` contra `CATEGORIAS_IMPASTO`
  (`lib/categorias.ts`): `pizzas`, `empanadas` y `bebidas` son de Impasto; `hamburguesas`,
  `lomos`, `calzones` y `otros` son del otro proyecto. **No borrar ni editar esas filas.**
  Es el mismo problema que `info_empresa_impasto`, pero con Mercado Pago en producción del
  otro lado: si el proyecto paralelo carga algo con `categoria = 'pizzas'`, aparece en el
  sitio y es cobrable.
- **Al comprar el dominio:** cambiar la URL del webhook en Mercado Pago (se hace por MCP) y
  actualizar la variable en Netlify. Conviene además separar la URL de sandbox de la de
  producción, hoy apuntan al mismo endpoint.
- **`info_empresa_impasto`** sigue siendo una tabla global con datos de Iguazú. Si el proyecto
  paralelo la consulta directamente, va a mostrar estos datos.
- Si se rota el secreto del webhook en el panel de MP, actualizar `MERCADOPAGO_WEBHOOK_SECRET`
  **y reconstruir**, o el webhook rechaza todo con 401.
