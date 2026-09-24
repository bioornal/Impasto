# Agente de impresión térmica

Estado al 24/09/2026: código publicado en `main` de Impasto y Carro Fogón. `queued` significa **enviado a la cola de Windows**, no papel impreso.

## Equipo y pruebas realizadas

- Epson TM-T20II USB, cola exacta `EPSON TM-T20II Receipt`, papel de 80 mm, ESC/POS RAW, 42 columnas, WPC1252 (`ESC t 16`) y corte `GS V 0`.
- 3nStar RPT006B: Windows la detectó por USB como `Printer POS-80`; cola `3nStar RPT006B` en `USB002` con el controlador firmado de Windows `Generic / Text Only`, usando trabajos ESC/POS RAW. El instalador oficial de 3nStar se ejecutó correctamente, pero su INF `POS-80` sin firma fue rechazado por Windows; no se desactivó la comprobación de firmas. La prueba ficticia corta salió legible, con acentos y corte. En la primera prueba larga, el cortador atravesó la línea final de pago; se añadieron tres avances solo al perfil 3nStar y la aceptación física de esa corrección está pendiente.
- Ticket ficticio corto: legible, cortó, sin papel sobrante (confirmación del dueño).
- Ticket ficticio largo: completo, cortó y acentos correctos (confirmación del dueño). No se midió su largo exacto.
- Desde Edge, `https://www.impastopizzas.com` y `https://carro-fogon.vercel.app` alcanzaron el agente por HTTP loopback: `403 pairing_required` con token de prueba incorrecto.
- 30 pruebas C# aprobadas. Ninguna prueba guardó ni imprimió un pedido real.
- `GET /health` con el origen Impasto respondió `available`, cola correcta y `paired:false` sin token, tras reactivar el agente el 24/09.

## Instalación en la PC de la impresora

Desde la raíz del proyecto:

```powershell
powershell -NoProfile -File printer-agent/build.ps1 -Test
powershell -NoProfile -File printer-agent/build.ps1
Copy-Item printer-agent/config.example.json printer-agent/config.local.json
```

En una PC nueva, editar `printer-agent/config.local.json`: mantener el nombre exacto de la cola Epson en `queueName`, configurar el nombre exacto de la cola 3nStar en `secondaryQueueName` y conservar los dos orígenes HTTPS; completar `token` con una cadena aleatoria de al menos 32 caracteres. El [controlador RPT oficial de 3nStar](https://3nstar.com/printers-download/) incluye Windows 7/10/11. Su paquete exige ejecutar `Setup.exe` (el MSI directo falla); en esta instalación Windows rechazó el INF `POS-80` sin firma y se creó la cola con `Generic / Text Only` para RAW. En esta PC ya existe una copia estable en `%LOCALAPPDATA%\ImpastoPrinter\config.local.json`: **no sobrescribirla**. La cola 3nStar está configurada allí y el agente informa ambas colas disponibles, con Epson seleccionada por defecto en ambas webs. Falta la confirmación física de la segunda prueba larga después de aumentar el margen de corte. La clave sigue siendo la misma hasta que se rote deliberadamente. Cada navegador recuerda la clave por separado para Impasto y Carro Fogón. `config.local.json` y `bin/` están ignorados por Git. No poner el secreto en código, logs, capturas, variables `NEXT_PUBLIC_*` ni InsForge.

```powershell
powershell -NoProfile -File "$env:LOCALAPPDATA\ImpastoPrinter\agent\start.ps1" -ConfigPath "$env:LOCALAPPDATA\ImpastoPrinter\config.local.json"
```

`start.ps1` verifica la cola y arranca el servidor solo en `127.0.0.1:8765`. En esta PC se copiaron el ejecutable y el script a `%LOCALAPPDATA%\ImpastoPrinter\agent\`; el acceso directo `Impasto Printer Agent.lnk` en Inicio de Windows apunta allí. El acceso directo del escritorio **Clave impresora Impasto y Carro Fogón** abre la configuración en Notepad para copiar `token` cuando haga falta. Si se actualiza el agente, recompilar y copiar de nuevo `bin/PrinterAgent.exe` y `start.ps1` a esa carpeta estable, con el agente detenido; conservar `config.local.json` y `attempts.json`. No abrir el puerto en la LAN ni agregar reglas de firewall.

En **Pedidos** de Impasto y **Comandas** de Carro Fogón, cada web muestra su selector de impresora después de emparejar. Epson es la elección inicial en ambas. Cambiar el selector guarda en esta PC una elección independiente por aplicación en `%LOCALAPPDATA%\ImpastoPrinter\printer-selection.json`, sin cambiar el secreto ni preguntar en cada comanda. Una cola no instalada aparece deshabilitada y el agente rechaza elegirla. El selector indica colas instaladas; una impresora desconectada o sin papel todavía puede aceptar trabajos en la cola de Windows. No borrar `printer-selection.json` salvo para restaurar Epson en ambas webs. `GET /printers` consulta la selección y `POST /printers` acepta solo `epson` o `3nstar` desde los dos orígenes permitidos y con el token local.

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
- Si el agente cae, ejecutar el `start.ps1` de la carpeta estable y comprobar `/health`. Si falta la cola, revisar nombre, USB y servicio de impresión de Windows. No borrar `%LOCALAPPDATA%/ImpastoPrinter/attempts.json` para forzar reintentos.
- Si la impresora está apagada o sin papel, Windows puede aceptar el trabajo de todos modos. Revisar físicamente antes de reimprimir.
- Para volver al flujo manual, usar **Imprimir con navegador** en Impasto y **Impresión navegador (respaldo)** en Carro Fogón. No volver a pulsar Guardar en el POS solo por un fallo de impresora.

El agente acepta solo dos orígenes exactos, token local y JSON validado de hasta 64 KiB. El registro durable guarda ID, hash, fecha y estado del intento, sin teléfonos, direcciones, notas ni texto de la comanda. Un fallo de registro impide imprimir y un resultado ambiguo no se reenvía automáticamente.

## Pruebas ficticias opcionales

```powershell
./printer-agent/bin/PrinterAgent.exe --test-raw "EPSON TM-T20II Receipt"
./printer-agent/bin/PrinterAgent.exe --test-raw-long "EPSON TM-T20II Receipt"
```

Consumen papel y llevan `NO PREPARAR`; no usan datos reales. El dueño confirmó impresión desde Carro Fogón (tras emparejar y reintentar el pedido guardado) y desde Impasto web el 24/09. La matriz completa delivery/retiro, bloqueo MP y agente caído en producción no se ensayó todavía.

## Verificación de código (24/09/2026)

- Agente: 27/27 pruebas C#.
- Impasto: `pnpm test`, `pnpm lint` (0 errores, 11 advertencias previas), `pnpm exec tsc --noEmit` y `pnpm build` aprobados.
- Carro Fogón: `npm test`, `npm exec -- tsc --noEmit` y `npm run build` aprobados; el build conserva advertencias anteriores de imagen y hooks.
- Las pruebas comprueban mapeo de delivery/retiro, detalle de sabores y mitades, bloqueo de Mercado Pago pendiente/rechazado, reintento con la misma clave, deduplicación y error de envío sin volver a guardar. La aceptación con pedidos reales sigue pendiente.
