# Copia del cliente en la impresora térmica

Fecha: 09/10/2026. Aprobado por el dueño en la misma fecha.

## Problema

Impasto (panel) y Carro Fogón (POS) imprimen por el agente local una sola comanda, pensada para
la cocina: número correlativo, notas internas, "Pago: efectivo / pendiente" y, en el POS, el
encabezado "CARRO FOGÓN". Falta una **copia para pegar en la caja** que recibe el cliente, con
datos útiles para él y presentación profesional.

## Decisiones del dueño

- **Las dos copias salen juntas**, cocina primero y cliente después, **cada una con su corte**
  (dos tickets, nunca uno solo). Además se puede reimprimir cada una por separado.
- **Las dos van a la misma impresora**: la del selector actual de cada web. El selector no cambia.
- **La copia del cliente no lleva el número de pedido**: un correlativo bajo (#4, #10) deja ver
  cuánto se vende. La caja se identifica por el nombre y, en delivery, por la dirección. La
  comanda de cocina conserva su número.
- Contenido aprobado sobre el ejemplo de abajo (sin el número).

## Copia del cliente

42 columnas, WPC1252, mismo papel y corte que la comanda. Ejemplo de delivery:

```
                 IMPASTO
  Pizza a la piedra · técnica napoletana
         Puerto Iguazú, Misiones
------------------------------------------
9/10/2026, 21:15:00               DELIVERY
------------------------------------------
Juan Pérez
Santa María 123 · portón negro
Tel. 3757 123456
------------------------------------------
2 x Muzzarella                     $32.000
1 x Caja x12 empanadas             $27.000
    4 Carne, 4 Pollo, 4 Árabe
1 x Coca-Cola 1.5 L                 $4.500
------------------------------------------
Subtotal                           $63.500
Envío                               Gratis
TOTAL                              $63.500
------------------------------------------
Pago en efectivo · a abonar $63.500
------------------------------------------
      ¡Gracias por elegir Impasto!
    Pedí online: www.impastopizzas.com
WhatsApp (03757) 65-2003 · @impasto.iguazu
```

- **Encabezado:** siempre `IMPASTO` (doble alto y ancho, centrado), el lema y la ciudad, venga de
  Impasto o de Carro Fogón.
- **Fecha y modalidad** en una línea: la fecha que manda la web a la izquierda, `DELIVERY` o
  `RETIRO` a la derecha. **Sin número de pedido.**
- **Cliente:** el nombre si lo hay. En delivery, además, la dirección y `Tel. <teléfono>`; en
  retiro, solo el nombre.
- **Ítems:** `<cantidad> x <nombre>` a la izquierda y el importe de la línea a la derecha. El
  importe es `lineTotal` si viene, o `cantidad × unitPrice`. Si no entra en una línea, el nombre
  se parte con la regla de 42 columnas que ya existe y el importe va alineado a la derecha en la
  última línea. El detalle (sabores, mitades) va debajo, con sangría de 4 espacios.
- **Totales:** `Subtotal`; `Envío` solo en delivery (`Gratis` si es 0); `Descuento -$X` solo si
  `subtotal + envío > total` (descuentos históricos); `TOTAL` en negrita.
- **Pago**, traducido para el cliente:
  - `estado_pago = aprobado` → `Pagado con efectivo` / `Pagado con transferencia` /
    `Pagado con Mercado Pago`.
  - Pendiente en efectivo → `Pago en efectivo · a abonar $X` (X = total).
  - Pendiente por transferencia → `Pago por transferencia · a abonar $X`.
  - Cualquier otro estado con medio conocido → `Forma de pago: efectivo` / `transferencia` /
    `Mercado Pago`, sin estado. No se inventa un cobro.
  - Medio desconocido (por ejemplo `n/d` en pedidos viejos) → no se imprime línea de pago.
- **Fuera de la copia del cliente:** número de pedido, notas, la marca `REIMPRESIÓN` y el
  estado de pago crudo.
- **Pie** centrado: agradecimiento, web, WhatsApp e Instagram. Son textos fijos del agente,
  como hoy lo es `IMPASTO`; cambiarlos exige recompilar el agente.
- **Importes** en pesos con separador de miles y sin decimales cuando son enteros (`$63.500`);
  con centavos, dos decimales. La comanda de cocina sigue con su formato `N2`.

## Agente (versión 3)

- `PrintRequest.copy`: `"cocina"` o `"cliente"`. Ausente, vacío o nulo equivale a `"cocina"`:
  las webs actuales siguen funcionando igual contra el agente nuevo. Otro valor → 400.
- `Receipt` suma `subtotal` y `shipping` (opcionales, `0` a `100000000`); son **obligatorios en la
  copia del cliente** (400 si faltan). `ReceiptItem` suma `lineTotal` opcional, en el mismo rango.
- `ReceiptEncoder.Encode` elige el formato por `copy`. **La comanda de cocina no cambia ni un
  byte.** Los avances extra de la 3nStar antes del corte valen para las dos copias.
- `GET /health` responde `version = "3"`.
- Prueba en papel sin pedido real: `PrinterAgent.exe --test-cliente "<cola>"` imprime una copia
  del cliente ficticia, marcada `NO PREPARAR`, igual que `--test-raw`.
- El registro anti-duplicados no cambia. Cada copia tiene su propio `attemptId`: la del cliente
  usa el de la cocina más el sufijo `:cliente`, así un reintento de una no repite la otra.

## Webs

`local-printer.ts` es idéntico en los dos repositorios y lo sigue siendo:

- `PrintJob` suma `copy?: "cocina" | "cliente"`, `receipt.subtotal?`, `receipt.shipping?` e
  `items[].lineTotal?`.
- `printerVersion()`: lee `/health` con la clave guardada y devuelve el número de versión o
  `null`. La copia del cliente solo se manda si es 3 o más.

### Carro Fogón

- `posPrintJob(order, attemptId, reprint, copy)`: con `copy = "cliente"` agrega `subtotal` y
  `shipping` (de `toComanda`) y `lineTotal = precio × cantidad + extra` por ítem, y usa
  `attemptId + ":cliente"`.
- **Al guardar** (`guardarYEnviarComanda`): después del POST confirmado, cocina y luego cliente.
  Si la cocina falla, no se intenta la del cliente. `FormCliente` guarda la lista de copias
  pendientes; **Reintentar** manda solo las que no salieron, con sus mismas claves.
- **Comandas:** el ícono de la lista sigue reimprimiendo la cocina. En el detalle, dos botones:
  "Comanda cocina" y "Copia cliente", cada uno con confirmación y clave nueva, como la
  reimpresión de hoy.

### Impasto

- `adaptOrder` conserva el `extra` de los ítems del POS para calcular `lineTotal`.
- `adminPrintJob(order, attemptId, reprint, copy)`: igual que en el POS, con `order.subtotal`
  y `order.shipping`.
- **"Enviar a impresora térmica"** manda cocina y luego cliente. Los trabajos fallidos se guardan
  por pedido **y por copia**; "Reintentar envío" manda solo los que faltan.
- **Detalle del pedido:** se suma el botón "Copia cliente". "Enviar a impresora térmica" sigue
  imprimiendo las dos.

### Bloqueos y respaldo

- Las dos copias usan la misma regla que hoy: Mercado Pago pendiente o rechazado y pedidos
  cancelados no imprimen ninguna.
- La impresión por navegador sigue siendo solo para la comanda de cocina.

## Errores y mensajes

- **Falla la cocina:** "No se pudo enviar la comanda; el pedido sigue guardado." Reintentar
  manda las dos.
- **Sale la cocina y falla la del cliente:** "Comanda de cocina enviada; copia del cliente no
  enviada. <motivo>". Reintentar manda solo la del cliente.
- **Agente versión 2:** sale la cocina y el aviso dice "Actualizá el agente de impresión para
  imprimir la copia del cliente". Nunca se imprime la copia del cliente con el formato de cocina.

## Pruebas

- **Agente** (`Tests.cs`, `ServerTests.cs`): la comanda de cocina de la ficha de prueba es
  idéntica a la de antes del cambio; la copia del cliente lleva IMPASTO en las dos fuentes y no
  lleva `#número`, notas ni `REIMPRESIÓN`; teléfono y dirección solo en delivery; ninguna línea
  pasa de 42 columnas; importes a la derecha; subtotal, envío gratis y con costo, descuento;
  los cuatro textos de pago; `copy` inválido y copia del cliente sin `subtotal` responden 400;
  `/health` informa la versión 3.
- **Webs:** armado de cada copia (campos, `lineTotal` con extra, sufijo de la clave), orden
  cocina → cliente, fallo parcial con reintento de solo la que faltó, agente versión 2.
- **En papel:** `--test-cliente` en la Epson antes de publicar las webs.

## Instalación

1. Compilar el agente con sus pruebas (`build.ps1 -Test`, luego `build.ps1`).
2. Con confirmación del dueño: detener el agente, copiar `bin/PrinterAgent.exe` a
   `%LOCALAPPDATA%\ImpastoPrinter\agent\bin\` (conservar `config.local.json`, `attempts.json` y
   `printer-selection.json`), arrancarlo y comprobar `/health` versión 3.
3. Imprimir `--test-cliente` y que el dueño lo vea.
4. Publicar Impasto (Netlify) y Carro Fogón (Vercel). Como las webs consultan la versión, el
   orden entre ellas no importa.

## Fuera de alcance

- Elegir una impresora distinta para cada copia.
- Copia del cliente por impresión del navegador.
- Cambiar el encabezado `CARRO FOGÓN` de la comanda de cocina del POS.
