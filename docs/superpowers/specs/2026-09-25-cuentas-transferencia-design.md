# Varias cuentas para transferencias, una activa

Fecha: 25/09/2026. Aprobado por el dueño en la misma fecha.

## Problema

Hoy hay una sola cuenta para transferencias (cuatro columnas en `sucursales`). El dueño quiere
guardar varias (hoy AstroPay y ARQ) y elegir desde el panel cuál ven los clientes, para cambiar
rápido si una se traba o llega a un límite.

## Decisiones del dueño

- El cliente ve **una sola cuenta: la que el dueño marca como activa**.
- **Cada pedido guarda la cuenta que se le mostró**; confirmación, seguimiento, panel y aviso de
  Telegram usan ese dato aunque después cambie la activa.
- ARQ (titular Speziali Christian Andrés) queda **activa**; AstroPay queda guardada.

## Datos

Migración:

- `sucursales.cuentas_transferencia jsonb not null default '[]'`: lista de
  `{ id, nombre, alias, cbu, banco, titular, activa }`.
- La cuenta actual se copia de las columnas viejas **dentro del SQL** (sin literales: el repo es
  público) como primera cuenta, activa, con `nombre = banco`.
- `pedidos.cuenta_transferencia jsonb` nullable: la foto `{ nombre, alias, cbu, banco, titular }`
  de la cuenta mostrada. Solo la escribe la web en pedidos por transferencia; el POS no la usa.
- Las columnas `cbu`, `alias_cbu`, `banco`, `titular_cuenta` de `sucursales` dejan de leerse y
  escribirse; no se borran todavía (vuelta atrás posible).

ARQ se agrega con un `update` directo en la base (tampoco va al repo), y pasa a ser la activa.

## Lógica pura: `lib/cuentas-transferencia.ts` (testeable con `tsx`)

- `CuentaTransferencia` y `DatosTransferencia` (sin `id` ni `activa`).
- `leerCuentas(raw)`: lista guardada → cuentas bien formadas; descarta lo demás, nunca inventa.
- `cuentaActiva(cuentas)`: los datos de la activa **solo si hay exactamente una**; si no, `null`.
- `validarCuentas(input, nuevoId?)`: para el PUT del panel. Máximo 10 cuentas; `nombre`
  obligatorio (≤ 40); alias opcional con formato `^[A-Za-z0-9.-]{6,20}$`; CBU/CVU opcional, se
  le sacan espacios y guiones y debe tener 22 dígitos; cada cuenta necesita alias o CBU; banco y
  titular ≤ 80; ids únicos (si falta, se genera); con al menos una cuenta, **exactamente una
  activa**. Devuelve `{ ok: true, cuentas }` o `{ ok: false, error }` con mensaje mostrable.
- `datosDesdePedido(raw)`: la foto guardada en el pedido → `DatosTransferencia | null`.

Principio heredado: si algo está mal formado, el cliente no ve datos bancarios y se le ofrece
"Pedir los datos por WhatsApp". Nunca un valor de ejemplo.

## Servidor

- `BusinessConfig`: se quitan `cbu`, `aliasCbu`, `banco`, `titularCuenta`; se agrega
  `cuentaTransferencia: DatosTransferencia | null` (la activa). `BUSINESS` la deja en `null`.
- `createPedido`: si `metodoPago === "transferencia"`, guarda `cuenta_transferencia` con la
  activa y la devuelve en `CreatedOrder.cuentaTransferencia`.
- `POST /api/orders`: devuelve `cuentaTransferencia` y pasa `cuentaTransferencia: nombre` al aviso.
- `GET /api/orders/[ref]`: `bancoInfo` sale de la foto del pedido; si no la tiene (pedidos
  anteriores), de la activa. La forma de la respuesta no cambia.
- `PUT /api/admin/sucursal`: acepta `cuentas_transferencia` validado con `validarCuentas`;
  deja de aceptar los cuatro campos viejos.

## Cliente

- `Confirmation` usa `order.cuentaTransferencia` (lo devolvió el POST), no `business`.
- `/pedido/[ref]` no cambia: consume `bancoInfo` como hoy.
- Panel → Configuración → **Cuentas para transferencias**: una tarjeta por cuenta (Nombre corto,
  Alias, CBU/CVU, Banco/Billetera, Titular), botón "Usar esta" / etiqueta "Activa", "Quitar" y
  "+ Agregar cuenta". Se guarda con "Guardar cambios".
- Panel → detalle del pedido: "Pago: transferencia · ARQ".
- Telegram: `PAGO SIN CONFIRMAR — revisar en ARQ`.

## Fuera de alcance

Carro Fogón (no lee datos bancarios), mail al cliente (no los incluye), mostrar varias cuentas
a la vez, borrar las columnas viejas.

## Pruebas

- `tests/cuentas-transferencia.test.ts` (nuevo, en `pnpm test`): lectura, activa única, lista
  dañada, dos activas → `null`, validación (CBU corto, alias inválido, sin alias ni CBU, dos
  activas, ninguna activa, genera id, normaliza CBU), foto del pedido.
- `tests/aviso-local.test.ts`: la transferencia nombra la cuenta.
- `tests/adapt-order.test.ts`: el panel lee el nombre de la cuenta del pedido.
- Navegador (Chrome headless, `/api/orders` y `/api/store-status` interceptados; no se crean
  pedidos reales): confirmación con ARQ. `GET /api/orders/[ref]` real sobre un pedido por
  transferencia viejo: devuelve la activa. Panel: lo prueba el dueño con su sesión.
