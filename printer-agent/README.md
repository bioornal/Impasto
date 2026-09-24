# Agente de impresión térmica

Estado al 24/09/2026: código local en `feat/impresion-termica`. Las webs con esta integración todavía no se publicaron. `queued` significa **enviado a la cola de Windows**, no papel impreso.

## Equipo y pruebas realizadas

- Epson TM-T20II USB, cola exacta `EPSON TM-T20II Receipt`, papel de 80 mm, ESC/POS RAW, 42 columnas, WPC1252 (`ESC t 16`) y corte `GS V 0`.
- Ticket ficticio corto: legible, cortó, sin papel sobrante (confirmación del dueño).
- Ticket ficticio largo: completo, cortó y acentos correctos (confirmación del dueño). No se midió su largo exacto.
- Desde Edge, `https://www.impastopizzas.com` y `https://carro-fogon.vercel.app` alcanzaron el agente por HTTP loopback: `403 pairing_required` con token de prueba incorrecto.
- 27 pruebas C# aprobadas. Ninguna prueba guardó ni imprimió un pedido real.
- `GET /health` con el origen Impasto respondió `available`, cola correcta y `paired:false` sin token, tras reactivar el agente el 24/09.

## Instalación en la PC de la impresora

Desde la raíz del proyecto:

```powershell
powershell -NoProfile -File printer-agent/build.ps1 -Test
powershell -NoProfile -File printer-agent/build.ps1
Copy-Item printer-agent/config.example.json printer-agent/config.local.json
```

Editar **solo** `printer-agent/config.local.json`: mantener el nombre exacto de la cola y los dos orígenes HTTPS; completar `token` con una cadena aleatoria de al menos 32 caracteres. En esta PC el archivo local ya existe: no sobrescribirlo con la plantilla. `config.local.json` y `bin/` están ignorados por Git. No poner el secreto en código, logs, capturas, variables `NEXT_PUBLIC_*` ni InsForge.

```powershell
powershell -NoProfile -File printer-agent/start.ps1
```

`start.ps1` verifica la cola y arranca el servidor solo en `127.0.0.1:8765`. Se creó `Impasto Printer Agent.lnk` en el Inicio de Windows del operador, apuntando a este script en el worktree actual. Si se mueve o elimina el worktree, actualizar el acceso directo a la nueva ubicación. No abrir el puerto en la LAN ni agregar reglas de firewall.

Para verificar sin imprimir:

```powershell
Invoke-WebRequest http://127.0.0.1:8765/health -Headers @{Origin='https://www.impastopizzas.com'} -UseBasicParsing
```

Debe responder `available`. Sin `Origin`, el agente responde `origin_forbidden` por diseño. En Edge, cada operador pulsa **Emparejar impresora** en Impasto o Carro Fogón y pega el secreto local una vez por navegador y origen. Si Edge pide acceso a servicios del dispositivo, concederlo para esas webs. Un token incorrecto responde `pairing_required`.

Si `HttpListener` informa acceso denegado, reservar la URL solo para el usuario Windows de esta PC (sustituir `EQUIPO\usuario` por su identidad exacta):

```powershell
netsh http add urlacl url=http://127.0.0.1:8765/ user=EQUIPO\usuario
```

Ese comando requiere consola elevada **solo para crear la reserva**. No ejecutar el agente habitualmente como administrador.

## Uso y recuperación

- Carro Fogón guarda una vez y luego intenta enviar la comanda. Si falla el agente, el pedido queda guardado: usar **Reintentar comanda** con el mismo intento o abrir **Comandas** y elegir una reimpresión deliberada.
- Impasto envía manualmente desde el ícono de impresora o **Enviar a impresora térmica**. **Reintentar envío** reutiliza la clave fallida. **Imprimir con navegador** sigue como respaldo.
- `duplicate:true` significa que esa clave ya quedó en cola. Revisar papel y cola antes de una nueva impresión. La reimpresión deliberada usa otra clave y muestra `REIMPRESIÓN` en el ticket.
- Si el agente cae, ejecutar `start.ps1` y comprobar `/health`. Si falta la cola, revisar nombre, USB y servicio de impresión de Windows. No borrar `%LOCALAPPDATA%/ImpastoPrinter/attempts.json` para forzar reintentos.
- Si la impresora está apagada o sin papel, Windows puede aceptar el trabajo de todos modos. Revisar físicamente antes de reimprimir.
- Para volver al flujo manual, usar **Imprimir con navegador** en Impasto y **Impresión navegador (respaldo)** en Carro Fogón. No volver a pulsar Guardar en el POS solo por un fallo de impresora.

El agente acepta solo dos orígenes exactos, token local y JSON validado de hasta 64 KiB. El registro durable guarda ID, hash, fecha y estado del intento, sin teléfonos, direcciones, notas ni texto de la comanda. Un fallo de registro impide imprimir y un resultado ambiguo no se reenvía automáticamente.

## Pruebas ficticias opcionales

```powershell
./printer-agent/bin/PrinterAgent.exe --test-raw "EPSON TM-T20II Receipt"
./printer-agent/bin/PrinterAgent.exe --test-raw-long "EPSON TM-T20II Receipt"
```

Consumen papel y llevan `NO PREPARAR`; no usan datos reales. La aceptación física desde las interfaces publicadas (delivery, retiro, MP pendiente, agente caído) queda pendiente de despliegue.

## Verificación de código (24/09/2026)

- Agente: 27/27 pruebas C#.
- Impasto: `pnpm test`, `pnpm lint` (0 errores, 11 advertencias previas), `pnpm exec tsc --noEmit` y `pnpm build` aprobados.
- Carro Fogón: `npm test`, `npm exec -- tsc --noEmit` y `npm run build` aprobados; el build conserva advertencias anteriores de imagen y hooks.
- Las pruebas comprueban mapeo de delivery/retiro, detalle de sabores y mitades, bloqueo de Mercado Pago pendiente/rechazado, reintento con la misma clave, deduplicación y error de envío sin volver a guardar. La aceptación con pedidos reales sigue pendiente.
