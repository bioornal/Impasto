# P0 — Configuración de cuentas y puesta en marcha

Estado: el código está listo; falta la configuración del dueño. Resolver las tres cuentas juntas
(email, Telegram, DeepSeek) y después el dominio.

## Separación de tenants — YA ESTÁ HECHA (24/08/2026)

No hay nada que hacer acá. Queda registrado por si hay que rehacerlo en otro entorno.

1. ~~**Aplicar la migración** `migrations/20260825120000_tenant-proyecto-id.sql`~~ — **aplicada**,
   figura en `npx -y @insforge/cli db migrations up --all` / `db migrations list`.
   Nunca con `db query`: descarta el DDL en silencio y reporta éxito igual.
2. ~~**Deploy del código**~~ — **deployado** en los dos repos (Impasto → `main` en Netlify;
   Carro Fogón → `main` en Vercel). El orden migración → deploy se respetó.
3. **Verificado** contra la base y contra producción: `productos` 49 impasto / 16 carro, sin
   nulos; el sitio sirve la carta completa y `/terminos`, `/privacidad` y `/reembolso` dan 200.

**Lo único pendiente de este documento son las cuentas del dueño (secciones 1 a 4).**

## 1. Email (Resend) — CONFIGURADO (19/09/2026)

- Cuenta creada, dominio `impastopizzas.com` verificado (región São Paulo).
- Netlify: `EMAIL_PROVIDER=resend`, `EMAIL_FROM=Impasto <pedidos@impastopizzas.com>`,
  `RESEND_API_KEY` (secreta, solo envío). Sitio reconstruido.
- Detalle de los registros DNS y de la prueba en `CLAUDE.md`, pendiente 1.
- Las respuestas de los clientes van al Gmail del dueño (`EMAIL_REPLY_TO` en Netlify).
- Prueba recibida en la bandeja de entrada, no en spam.

## 2. Aviso al local (Telegram) — CONFIGURADO (Netlify)

- `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_IDS` cargados en Netlify y `.env.local`.

## 3. Chatbot vendedor (DeepSeek) — CONFIGURADO Y VERIFICADO EN PRODUCCIÓN (06/09/2026)

- Cuenta activa, `DEEPSEEK_API_KEY` sincronizada en Netlify CLI.
- Verificado en producción (`vocal-naiad-861a2c.netlify.app`): responde en streaming en tiempo real vía `/api/chat`.

## 4. Dominio propio + webhook de Mercado Pago — HECHO (19/09/2026)

- Dominio `impastopizzas.com` (Hostinger, DNS en Hostinger). Principal: `www.impastopizzas.com`.
- Netlify: dominio + alias sin `www`, certificado Let's Encrypt activo.
- `NEXT_PUBLIC_SITE_URL=https://www.impastopizzas.com` cargada y sitio reconstruido.
- Webhook de MP en `https://www.impastopizzas.com/api/payments/webhook`, mismo secreto.
- Detalle y orden de los pasos en `CLAUDE.md`, sección "Dominio propio".
- Pendiente menor: separar la URL de sandbox de la de producción.

## Verificación de tenants — resultado (24/08/2026)

- **Productos:** ✅ 49 impasto (32 pizzas + 9 empanadas + 8 bebidas) / 16 carro (8 hamburguesas,
  3 lomos, 4 calzones, 1 otros). Cero nulos. El sitio de Impasto sirve la carta completa.
- Para volver a revisar filas mal clasificadas:
  ```sql
  select nombre, categoria, proyecto_id from productos order by categoria, nombre;
  ```
- **Pedidos:** la tabla estaba **vacía**, así que su backfill
  (`sucursal_id = 'iguazu' or external_reference like 'IM-%'`) no llegó a ejercitarse. Revisar
  el primer pedido real de cada proyecto: los inserts nuevos ya escriben `proyecto_id`.

## Nota legal

Las páginas `/terminos`, `/privacidad` y `/reembolso` ya están creadas y enlazadas en el footer. Si
atendés clientes de Brasil (Iguazú es frontera con Foz do Iguaçu), falta un anexo LGPD en portugués
— pedilo cuando lo necesites.
