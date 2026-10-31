# Masas de la noche por tipo (napoletana y al molde)

Fecha: 31/10/2026. Pedido del dueño: el contador de masas es uno solo y no discrimina; cada noche tiene que poder cargar cuántas tiene de cada masa, y la página no puede vender más de las que hay de cada una. Aprobado por el dueño el 31/10/2026.

## Reglas

1. **Una masa por pizza**, entera o mitad y mitad, descontada de la masa que eligió el cliente. Lo que no diga `molde` es napoletana (igual que `normalizarMasa`).
2. **El número manda sobre el interruptor.** Con algún número cargado esa noche, el número decide qué masa se vende (mayor a 0 = se vende). Sin números, mandan los interruptores de siempre.
3. **Si se carga una sola masa, la otra vale 0** y no se vende. Los dos "sin cargar" significan que no hay límite, como hoy.
4. **Las dos en 0 cortan las pizzas**; empanadas y bebidas siguen.
5. Cancelar, eliminar o un pago rechazado devuelven la masa a su contador; reactivar la vuelve a descontar.

## Base (migración nueva, compartida por web y POS)

- `masas_noche` pasa a una fila por masa: columna `masa` (`napoletana` | `molde`), clave `(proyecto_id, noche, masa)`. Las filas viejas quedan como `napoletana` y no se usan más.
- `pedidos.masas_molde integer`: cuántas de `masas_consumo` (que sigue siendo el total) son al molde. Sin valor = 0. Así los pedidos viejos se devuelven a la fila napoletana de su noche.
- `masas_molde(productos)`: cuenta las pizzas al molde, con el mismo criterio de web y POS que `masas_consumo`.
- `masas_mover(proyecto, noche, masas, molde, signo)`: mueve las dos filas. Los triggers de cupos pasan a usarla.
- `fijar_masas_restantes(proyecto, masa, quedan)`: cupo = vendidas + quedan en un paso, para esa masa. `quedan` ya no admite NULL.
- `quitar_limite_masas(proyecto)`: deja las dos sin cargar.
- `crear_pedido_costeado`: crea las dos filas de la noche, las bloquea siempre en el mismo orden y controla cada masa. Si no alcanza: `MASAS_AGOTADAS|<quedan>|<masa>`. El número sigue primero: el regex de la versión publicada lo entiende durante el pase.

## Web

- `lib/masas-noche.ts`: `quedanMasas(filas)` devuelve `{ napoletana, molde }` (la masa sin cargar vale 0) o `null` sin límite. Validaciones, avisos y carrito por masa.
- `getBusinessConfig` lee los números y aplica la regla 2 sobre `masaNapoletanaActiva` / `masaMoldeActiva`. Es el único punto: web, cotización, pedidos y asistente toman de ahí qué masas hay. También expone `masasNoche`, que usa `/api/store-status`. Si la lectura falla, sin límite y mandan los interruptores: la base igual controla al guardar.
- Sin molde, la opción desaparece. Sin napoletana, todas salen al molde con el aviso que ya existe.
- **Carrito:** el tope es por masa, en sumar, en el + y al cambiar de masa. Si la masa que corresponde está llena y la otra tiene lugar, la pizza entra en la otra y se avisa. Si las masas bajaron mientras armaba el pedido, se avisa cuántas sacar y no deja seguir.
- **Aviso sobre las pizzas:** con 3 o menos de una masa disponible, por masa. Las dos en 0: "Por esta noche se terminaron las pizzas."

## Panel

- "Masas de la noche" tiene un contador por masa con vendidas y "Me quedan" (mismos guardados que hoy). Estados por masa: sin cargar, pocas (3 o menos), agotada. "Quitar límite" limpia las dos.
- `GET /api/admin/masas` devuelve las filas; `PUT { masa, quedan }` fija una; `PUT { quedan: null }` quita el límite.
- Un `MasasNocheProvider` comparte los números con el Arranque y la barra superior y los refresca cada 30 s.
- Con números cargados, los interruptores de masa se ven deshabilitados con "Manda el número", y la píldora de arriba muestra lo que queda ("Napoletana 8 · Molde 3"). Sin números, igual que hoy.

## POS (Carro Fogón)

- `GET /api/productos` lee las dos filas y manda `X-Masas-Quedan` con los números. Las dos en 0 sacan las pizzas de la carta.
- El selector del carrito marca "agotada" la masa en 0 y una pizza nueva entra en la que queda. La carta puede atrasarse hasta 5 minutos: lo que manda es la base al guardar.
- `mensajeDeMasas` dice de qué masa no hay y cuántas quedan.

## Pase a producción

Se publica de día, sin servicio: migración primero, después web y POS. Mientras dura el pase, el panel publicado no puede guardar masas y, si alguien cargara números, la web y el POS viejos leerían una fila sola; por eso no se hace con el local abierto. El `POST` de pedidos no se rompe en ningún momento.

## Fuera de alcance

- Los interruptores de masa se mantienen: siguen mandando las noches sin números.
- El POS sigue sin leer los interruptores; solo lo frenan los números.
- Con las dos masas en 0, el bloque de masas del home sigue visible. Las pizzas salen agotadas igual.

## Pruebas

- Tests de `lib/masas-noche.ts`, `lib/masa.ts` y `tests/cupos.test.ts` del POS.
- La migración completa y sus casos corren en la base real dentro de un solo bloque que siempre revierte: conteo web y POS, cargar con ventas previas, regla 3, rechazo por masa, cancelar, reactivar, pago rechazado, eliminar y quitar límite.
- En el navegador, con la API simulada: panel en compu y a 375 px, carrito con cada tope.
- `pnpm test`, `tsc`, eslint de lo tocado y `pnpm build`; en el POS, `npm test` y `npm run build`.
