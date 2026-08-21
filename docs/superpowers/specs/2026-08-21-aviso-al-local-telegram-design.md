# Aviso al local por Telegram · Diseño

**Fecha:** 21 de agosto de 2026
**Pedido del dueño:** enterarse al instante de que entró un pedido por la web, para poder
producir.

## El problema

Hoy el dueño **no se entera de ninguna manera**. Son tres huecos distintos:

1. **No existe ningún aviso dirigido al local.** El único que el sistema sabe mandar va al
   cliente: `notificarPedido` (`lib/notifications.ts:87`) arranca con
   `if (!aviso.email) return` y envía a `aviso.email`, el correo del comprador.
2. **Ese email tampoco sale.** Sin `EMAIL_PROVIDER`, `lib/email.ts:24` devuelve
   `{ estado: "omitido" }` y solo se registra la fila en `notificaciones`.
3. **El panel no se refresca solo.** `StoreProvider.tsx:203` es
   `useEffect(() => { load(); }, [])`: carga una vez al abrir. Un pedido nuevo no aparece
   hasta recargar a mano.

Además, el webhook de Mercado Pago (`app/api/payments/webhook/route.ts`) **no avisa a
nadie**: si un pago queda pendiente y se aprueba después, ni el cliente ni el local se
enteran.

## Por qué Telegram

- **Contra el email:** no suena, puede demorar y cae en spam. Resend además exige verificar
  un dominio por DNS, y el sitio todavía vive en `netlify.app`.
- **Contra WhatsApp:** ya descartado en el proyecto. La API oficial pide CUIT, un número que
  no esté en WhatsApp Business App y plantillas aprobadas; las librerías no oficiales
  arriesgan el baneo del número del local.
- **Contra las notificaciones del navegador:** dependen de una pestaña abierta y permisos
  otorgados.

Telegram es gratis, instantáneo, suena con la pantalla apagada y admite varios destinatarios.
**Carro Fogón ya lo tiene resuelto** en `app/api/telegram/route.ts`; sus variables están
vacías, así que tampoco está avisando, pero el patrón —incluida la decisión de no usar
`parse_mode`— se hereda de ahí.

## Arquitectura

### `lib/telegram.ts` (nuevo)

Espejo de `lib/email.ts`, misma forma de resultado:

```ts
export type TelegramResult =
  | { estado: "enviado"; ids: string[] }
  | { estado: "omitido"; motivo: string }
  | { estado: "fallido"; motivo: string };

export async function sendTelegram(text: string): Promise<TelegramResult>
```

Lee `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_IDS` (separados por coma, para sumar al pizzero o
al cadete). Sin configurar devuelve `omitido` y no rompe nada.

**Sin `parse_mode`.** El mensaje incluye nombre y dirección escritos por el cliente; con
Markdown activo, un nombre podría inyectar formato o un link. Es la misma decisión que tomó
Carro Fogón y por el mismo motivo.

Envía a todos los chats con `Promise.allSettled`: que un chat falle no debe cancelar los
demás. Devuelve `enviado` si al menos uno entró, `fallido` si ninguno.

### `lib/notifications.ts` (modificar)

Se separa en dos responsabilidades, con `notificarPedido` como fachada para que las rutas no
cambien:

- `plantillaLocal(aviso, tipo): string` — **función pura**, sin dependencias de base.
  Es lo único que se testea.
- `avisarAlLocal(aviso, tipo)` — reserva la fila en `notificaciones` con `canal: "telegram"`,
  envía y actualiza el estado.
- `notificarCliente(aviso, tipo)` — lo que hoy es `notificarPedido`, sin cambios de conducta.
- `notificarPedido(aviso, tipo)` — llama a las dos.

**El `if (!aviso.email) return` se mueve dentro de `notificarCliente`.** Donde está hoy
cortaría también el aviso al local, que no depende del email del comprador.

La idempotencia ya está resuelta: el índice único es
`notificaciones (pedido_id, tipo, canal)` (`migrations/20260818152105_email-cliente.sql:19`),
así que la fila de Telegram convive con la de email y un reintento no manda dos veces.

### El mensaje

Texto plano, pensado para producir y entregar:

```
PEDIDO NUEVO — IM-0007
COBRAR AL ENTREGAR $24.259

Delivery — Av. Victoria Aguirre 123
Juan Pérez — 3757-123456

2x Muzzarella
1x Napolitana (sin aceitunas)
6x Empanadas de Carne

Total $24.259
```

La segunda línea dice qué hacer con la plata y cambia según el caso:

| Situación | Segunda línea |
|---|---|
| `metodoPago = efectivo` | `COBRAR AL ENTREGAR $X` |
| `metodoPago = mercadopago` y tipo `pago_aprobado` | `PAGADO CON TARJETA` |
| `metodoPago = transferencia` | `PAGO SIN CONFIRMAR — revisar` |

Se eligió esto en lugar de un `PAGO OK` genérico porque en efectivo tampoco está cobrado, y
quien entrega necesita saber si tiene que pedir plata.

Cuando la modalidad es `takeaway`, la línea de dirección dice `Retira en el local` y no se
imprime domicilio.

## Los tres disparadores

| Dónde | Cuándo | Tipo |
|---|---|---|
| `app/api/orders/route.ts` | Efectivo y transferencia, al crear el pedido | `pedido_recibido` |
| `app/api/payments/card/route.ts` | Solo si Mercado Pago **aprobó**. Rechazada no suena | `pago_aprobado` |
| `app/api/payments/webhook/route.ts` | Cuando un pago pasa a `aprobado` | `pago_aprobado` |

El tercero es un agregado sobre lo que existe. Es necesario: una tarjeta que queda pendiente
y se aprueba después nunca generó aviso, y ese pedido hay que producirlo igual.

El webhook hoy hace `.select("id,estado_pago")`. Necesita traer también `numero_pedido`,
`nombre_cliente`, `telefono_cliente`, `direccion`, `modalidad`, `productos`, `subtotal`,
`envio`, `total`, `metodo_pago` y `external_reference` para poder armar el aviso. Una función
`avisoDesdePedido(fila)` traduce la fila de `pedidos` al `AvisoPedido` que ya usan las
plantillas.

La idempotencia del webhook está cubierta por partida doble: sale temprano si el estado no
cambió, y el índice único de `notificaciones` frena el aviso repetido.

## Errores

**Un fallo de aviso nunca voltea una venta.** Cada llamada va en `try/catch`, igual que el
email hoy, y el resultado queda como fila `fallido` en `notificaciones` con el motivo.

Sin `TELEGRAM_BOT_TOKEN` el sistema sigue funcionando exactamente como hoy: la fila se
registra como `omitido` y nadie se entera de nada, que es el estado actual.

## Testing

`plantillaLocal` es pura, así que entra en el esquema del repo (`tsx`, sin framework, sin
base). Casos: delivery contra retiro, los tres métodos de pago, ítems con aclaración
(`detail`), y que el texto no rompa si falta la dirección.

`sendTelegram` y `avisarAlLocal` tocan red y base: no se testean, se verifican a mano.

## Configuración, que la hace el dueño

1. Crear el bot con `@BotFather` y guardar el token.
2. Mandarle un mensaje al bot y obtener el `chat_id`.
3. Cargar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_IDS` en `.env.local` **y** en Netlify.
4. **Reconstruir en Netlify.** Cambiar una variable no afecta a los deploys ya publicados,
   aunque se lea en runtime.

El token no pasa por el chat con el agente: lo carga el dueño en el archivo.

## Qué queda fuera

- **Que el panel se actualice solo.** Es la otra mitad del problema y va en su propia tanda.
- **Avisos de cambio de estado al cliente** ("salió el pedido", "está listo").
- **Responder desde Telegram** para cambiar el estado del pedido.
