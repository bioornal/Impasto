# Agente de impresión térmica

## Estado (23/09/2026)

Primera etapa: codificador ESC/POS y envío RAW a Windows implementados.
Las webs todavía no usan este agente. El servidor HTTP y el emparejamiento siguen pendientes.

- Cola exacta: `EPSON TM-T20II Receipt`.
- Controlador: `EPSON TM-T20II Receipt5`, puerto `ESDPRT001`.
- Papel nominal: 80 mm; formato conservador de 42 columnas, 21 en título doble.
- Página de códigos: WPC1252 (`ESC t 16`), bytes Windows-1252.
- Final: cuatro avances de línea contando la última línea de pago y `GS V 0`.
- Ticket ficticio corto enviado el 23/09/2026: trabajo 9, Windows indicó `Complete`.
- Confirmación presencial del dueño: «Salió bien, cortó y sin papel sobrante».
- Largo y ancho útil medidos, comprobación explícita de á/ñ y ticket largo: pendientes.
- 17 pruebas automatizadas aprobadas; no imprimen pedidos reales ni registran datos de clientes.

## Compilar y probar

Desde la raíz de esta rama, con .NET Framework 4.x de Windows (sin instalar paquetes):

```powershell
powershell -NoProfile -File printer-agent/build.ps1 -Test
powershell -NoProfile -File printer-agent/build.ps1
./printer-agent/bin/PrinterAgent.exe --test-raw "EPSON TM-T20II Receipt"
./printer-agent/bin/PrinterAgent.exe --test-raw-long "EPSON TM-T20II Receipt"
```

Los últimos dos comandos consumen papel y generan únicamente comandas ficticias
marcadas `NO PREPARAR`, sin pedidos, cobros ni datos personales.
Una respuesta de éxito significa **enviado a la cola**, no confirmación del papel.
No repetir automáticamente un envío ambiguo: comprobar antes la cola y el papel.

`bin/` y `config.local.json` quedan ignorados por Git.

## Referencias

- [Comandos Epson TM-T20II](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/tmt20ii.html).
- [Corte GS V](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_cv.html).

## Siguiente puerta de avance

Validar HTTP/CORS, secreto y deduplicación, y después HTTPS → loopback desde
`https://www.impastopizzas.com` y `https://carro-fogon.vercel.app` en Edge.
No integrar las webs hasta superar esa prueba.

## Servidor local (implementado; aceptación de navegador pendiente)

`powershell -NoProfile -File printer-agent/start.ps1` valida la cola exacta y
arranca `--serve`. Solo escucha `http://127.0.0.1:8765/`; no abrir firewall ni
usar prefijos `+`/`*` o direcciones LAN. Si el usuario estándar recibe acceso
denegado de HttpListener, revisar una reserva URL para **ese usuario exacto**;
no crear reservas amplias ni ejecutar el agente permanentemente como administrador.

La configuración contiene solo cola, secreto local aleatorio y los dos orígenes
HTTPS exactos. La plantilla tiene token vacío para fallar hasta configurarse.
El secreto ya fue generado en esta PC en `config.local.json`, ignorado por Git;
no copiarlo a documentación, logs, capturas o variables `NEXT_PUBLIC_*`.

- `GET /health`, con Origin permitido: estado del agente, versión, cola y `paired`.
- Si health lleva `X-Printer-Token`, lo verifica; token incorrecto responde 403.
- `POST /print`: Origin exacto y secreto obligatorios, JSON validado de hasta 64 KiB.
- Preflight permite solo Content-Type y X-Printer-Token; soporta solicitud PNA.
- `queued` y `duplicate:true` indican aceptación por Windows, nunca papel confirmado.
- La misma clave con distinto contenido da conflicto (409).
- Ante corte o error ambiguo se conserva `pending`: revisar papel/cola antes de una
  reimpresión explícita con nueva clave. No borrar el registro para reintentar.
- Registro en `%LOCALAPPDATA%/ImpastoPrinter/attempts.json`: hash de la comanda,
  ID de intento, fecha y estado. No guarda el texto del cliente. Reserva durable
  antes del envío, reemplazo atómico, exclusión de procesos y límite de 10.000
  entradas. Las confirmadas expiran a 30 días; las inciertas no se podan solas.
- Si falla el registro, no se imprime. Si falla después del envío, se informa
  resultado incierto, sin afirmar que quedó en cola ni reenviarlo automáticamente.

Prueba de navegador desde la consola de **cada sitio real**, sin imprimir:

```js
fetch('http://127.0.0.1:8765/health', {
  headers: {'X-Printer-Token': 'prueba-conexion'}
}).then(async r => console.log(r.status, await r.text())).catch(console.error)
```

Se espera HTTP 403 y `pairing_required`: el secreto de prueba es incorrecto
intencionalmente. Poder leer esa respuesta prueba el acceso y CORS con preflight.
Después se verificará el secreto local real al emparejar la interfaz.
No desactivar protecciones del navegador si la solicitud queda bloqueada.

Al 23/09: health local de PowerShell respondió 200, `available`, cola correcta;
27 pruebas automáticas aprobadas. La prueba desde Edge está pendiente de respuesta
presencial: Edge no está conectado a la herramienta de navegador de esta sesión,
y el navegador integrado devolvió `ERR_BLOCKED_BY_CLIENT` al abrir Impasto.
