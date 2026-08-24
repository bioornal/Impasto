# P0 — Configuración de cuentas y puesta en marcha

Estado: el código está listo; falta la configuración del dueño. Resolver las tres cuentas juntas
(email, Telegram, DeepSeek) y después el dominio.

## Orden de trabajo (importante)

1. **Aplicar la migración** `migrations/20260825120000_tenant-proyecto-id.sql`:
   ```sh
   npx -y @insforge/cli db migrations up --all
   ```
   Nunca con `db query`: descarta el DDL en silencio y reporta éxito igual.
2. **Deploy del código** (Impasto → push a `main` en Netlify; Carro Fogón → push a su `main` en
   Vercel). El orden migración → deploy evita que los reads nuevos (`proyecto_id`) fallen.
3. **Verificar** (ver sección "Verificación" al final).

## 1. Email (Resend)

- Crear cuenta en https://resend.com (100 mails/día gratis).
- Verificar el dominio por DNS (Resend pide un registro TXT/DKIM).
- En `.env.local` y en el panel de Netlify:
  - `EMAIL_PROVIDER=resend`
  - `RESEND_API_KEY=<tu key>`
  - `EMAIL_FROM=Impasto <pedidos@impastoiguazu.com.ar>`
- Reconstruir en Netlify (las env se leen según el caso en build o runtime).

## 2. Aviso al local (Telegram)

- Crear el bot con `@BotFather` → devuelve un token.
- Mandarle un mensaje al bot y obtener el `chat_id` (ej. con `@userinfobot`).
- En `.env.local` y Netlify:
  - `TELEGRAM_BOT_TOKEN=<token>`
  - `TELEGRAM_CHAT_IDS=<chat_id>` (varios separados por coma)

## 3. Chatbot vendedor (DeepSeek)

- Crear cuenta en https://platform.deepseek.com y cargar saldo.
- En `.env.local` y Netlify:
  - `DEEPSEEK_API_KEY=<key>` (server-only, NUNCA `NEXT_PUBLIC_`)
  - Opcional: `DEEPSEEK_MODEL=deepseek-v4-flash` (es el default)
- Sin la key, el widget queda como botón de WhatsApp (no se rompe nada).
- **Verificar el streaming en PRODUCCIÓN**, no en `pnpm dev`: las funciones serverless pueden
  bufferear la respuesta.

## 4. Dominio propio + webhook de Mercado Pago

- Comprar el dominio (ej. `impastoiguazu.com.ar`).
- En Netlify: asignarlo como dominio principal del sitio.
- Cargar `NEXT_PUBLIC_SITE_URL=https://impastoiguazu.com.ar` y **reconstruir** (se lee en build).
- En Mercado Pago: cambiar la URL del webhook a `https://impastoiguazu.com.ar/api/payments/webhook`
  y conservar el secreto. Conviene separar la URL de sandbox de la de producción.

## Verificación (después del deploy)

- **Productos:** el menú de Impasto sigue mostrando pizzas/empanadas/bebidas; el del carro muestra
  hamburguesas/lomos/calzones (y ya no las de Impasto).
- Revisar filas mal clasificadas por el backfill (productos del carro que hubieran quedado con
  `categoria = 'pizzas'` por el bug del POST viejo):
  ```sql
  select nombre, categoria, proyecto_id from productos order by categoria, nombre;
  ```
- **Pedidos:** el panel de Impasto no ve pedidos del carro y viceversa.
- Sin filas con `proyecto_id` nulo en `pedidos` (los inserts nuevos ya lo escriben).

## Nota legal

Las páginas `/terminos`, `/privacidad` y `/reembolso` ya están creadas y enlazadas en el footer. Si
atendés clientes de Brasil (Iguazú es frontera con Foz do Iguaçu), falta un anexo LGPD en portugués
— pedilo cuando lo necesites.
