# Impresión térmica directa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Imprimir comandas de Carro Fogón e Impasto en la Epson TM-T20II conectada por USB a una sola PC, sin diálogo ni cola de papel blanco, sin volver a guardar un pedido cuando falla la impresora.

**Architecture:** Un agente local en C#/.NET Framework escucha en `127.0.0.1:8765`, valida origen y secreto, transforma comandas JSON en ESC/POS y envía bytes RAW a la cola de Windows. Carro Fogón llama al agente después de persistir un pedido y ofrece reimpresión desde Comandas; Impasto lo llama solo desde su botón manual. Los dos proyectos siguen usando sus API y reglas de pago actuales.

**Tech Stack:** Windows 11, Epson TM-T20II USB, .NET Framework 4.x (`csc.exe` ya presente), Winspool P/Invoke, `HttpListener`, TypeScript/React/Next.js, pruebas locales C# y de cada app. No se añaden paquetes ni se altera InsForge.

**Spec:** `docs/superpowers/specs/2026-09-23-impresion-termica-directa-design.md`

## Global Constraints

- Una sola PC Windows con la Epson USB de 80 mm; el agente acepta solo `127.0.0.1` y la cola se elige por nombre exacto.
- Carro Fogón imprime automáticamente **después** de guardar, tanto delivery como retiro; Impasto imprime solo al pulsar el botón.
- El error de impresión jamás se convierte en «Error al guardar el pedido», no crea otro pedido y permite reintento desde el pedido existente.
- El agente no recibe claves de InsForge ni bytes ESC/POS arbitrarios; no registra teléfonos, direcciones o notas; secreto local fuera de Git.
- La respuesta «enviado a la cola» no equivale a «papel impreso». Pago MP no acreditado sigue bloqueando cocina.
- La prueba RAW física y la prueba de HTTPS → loopback son puertas de avance: si fallan, se revisa el diseño antes de integrar las apps.
- Los repos son `C:/Users/spezi/Documents/PROYECTOS/Impasto` y `C:/Users/spezi/Documents/PROYECTOS/carroFogon`; no incluir archivos ajenos que ya estén sin seguimiento en los commits.

## Review Focus

1. `notas` omitida, `null` o vacía: POST de Carro Fogón almacena `''` y no falla (Task 4).
2. Texto con `ESC`, saltos anómalos, tildes y una línea muy larga: el ticket mantiene contenido legible sin ejecutar órdenes inyectadas (Task 1).
3. Misma clave reenviada tras respuesta perdida: un solo trabajo en cola; reimpresión explícita usa clave nueva (Task 2).
4. Agente parado, cola inexistente o impresora apagada: pedido ya guardado permanece y el UI no afirma impresión física (Tasks 2, 4 y 5).
5. Pedido MP pendiente/rechazado o cancelado: no sale una comanda de cocina por el nuevo canal (Tasks 4 y 6).

---

## Mapa de archivos

En Impasto, crear `printer-agent/` con `Program.cs` (composición y CLI), `PrintRequest.cs` (contrato/validación), `ReceiptEncoder.cs` (formato ESC/POS), `RawSpooler.cs` (P/Invoke), `LocalServer.cs` (HTTP/CORS), `AttemptLedger.cs` (deduplicación), `AgentConfig.cs` (configuración), `Tests.cs` (pruebas sin impresora), `build.ps1`, `config.example.json`, `README.md`. Añadir a `.gitignore` el ejecutable y `config.local.json`. Añadir `lib/local-printer.ts` y `tests/local-printer.test.ts`; modificar `app/admin/components/Orders.tsx` y `CLAUDE.md`.

En Carro Fogón, crear `next-app/src/lib/local-printer.ts` y `next-app/tests/local-printer.test.mjs`; modificar `next-app/src/components/FormCliente.tsx`, `next-app/app/api/pedidos/route.ts`, `next-app/app/pedidos/page.tsx`, `next-app/package.json` (incluir test nuevo en script) y `CLAUDE.md`. `next-app/src/lib/print.ts` permanece como alternativa manual temporal.

## Task 1: Prueba RAW de la Epson y codificador del ticket

**Files:** Create `printer-agent/PrintRequest.cs`, `printer-agent/ReceiptEncoder.cs`, `printer-agent/RawSpooler.cs`, `printer-agent/Program.cs`, `printer-agent/Tests.cs`, `printer-agent/build.ps1`; modify `.gitignore` in Impasto.

**Interfaces:** `PrintRequest.Parse(string json): PrintRequest`; `ReceiptEncoder.Encode(PrintRequest request, bool reprint): byte[]`; `RawSpooler.Send(string queueName, byte[] bytes): void`. `Program --test-raw <nombre-cola>` imprime exclusivamente una comanda ficticia, sin datos de cliente.

- [x] **Step 1: Escribir pruebas que fallen para el codificador.** En `Tests.cs`, usar un pequeño runner que salga con código 1 si falla: `Assert(bytes[0] == 0x1B && bytes[1] == 0x40, "ESC @ inicial"); Assert(EndsWith(bytes, new byte[] {0x1D,0x56,0x00}), "corte final"); Assert(!Contains(bytes, new byte[] {0x1B,0x70}), "texto no puede abrir cajón");`. Probar un nombre con `\u001b`, `á/ñ`, una línea de 120 caracteres y `Items` vacío (rechazo explícito).
- [x] **Step 2: Ejecutar el runner antes de la implementación.** `powershell -File printer-agent/build.ps1 -Test`; debe fallar por tipos/métodos aún inexistentes, no por un test omitido.
- [x] **Step 3: Implementar lo mínimo.** `Parse` rechaza cuerpo mayor a 64 KiB, ID vacío, cero ítems y campos demasiado largos; normaliza `delivery`/`retiro`. `Encode` inicia con `ESC @`, selecciona página de códigos compatible tras prueba, usa 42 columnas de texto normal y corta líneas largas, elimina controles C0 del texto salvo saltos previstos, produce encabezado grande, ítems/detalles, destino, total/pago y termina con pocos avances y `GS V 0`. `RawSpooler.Send` usa `OpenPrinter`, `StartDocPrinter` con `pDatatype="RAW"`, `StartPagePrinter`, `WritePrinter`, `EndPagePrinter`, `EndDocPrinter`, `ClosePrinter`, comprobando que los bytes escritos coinciden y liberando handles en `finally`.
- [ ] **Step 4: Verificar runner y prueba física.** `powershell -File printer-agent/build.ps1 -Test` debe salir 0. `printer-agent/bin/PrinterAgent.exe --test-raw "EPSON TM-T20II Receipt"` debe producir un ticket corto legible y cortado, sin ~30 cm de blanco. Medir y anotar ancho, largo y resultado de `á/ñ` en `printer-agent/README.md`. Si RAW no funciona, probar una cola `Generic / Text Only` o ruta Epson compatible; detener la integración hasta obtener el ticket físico correcto.
- [ ] **Step 5: Commit de Task 1.** Preparar solo los archivos de este task; `git diff --cached --check`, `git status --short`, commit `feat: probar impresion ESC POS RAW con Epson`.

## Task 2: Agente HTTP local, emparejamiento y deduplicación

**Files:** Create `printer-agent/AgentConfig.cs`, `printer-agent/LocalServer.cs`, `printer-agent/AttemptLedger.cs`, `printer-agent/config.example.json`; modify `printer-agent/Program.cs`, `printer-agent/Tests.cs`, `printer-agent/README.md`, `.gitignore`.

**Interfaces:** `AgentConfig.Load(path)` carga `queueName`, `token` y dos `allowedOrigins` exactos; `LocalServer.Run(config, Action<string,byte[]> spool, AttemptLedger ledger)` sirve `/health` y `/print`; `AttemptLedger.TryReserve(attemptId, orderId)` y `MarkQueued(attemptId)` persisten aceptación. JSON de `/print`: `{attemptId, source, orderId, reprint, receipt:{kind, date, number, customer, phone, address, notes, items:[{name,quantity,detail,unitPrice}], total, paymentMethod, paymentStatus}}`.

- [x] **Step 1: Pruebas que fallen con servidor en puerto efímero y `spool` falso.** Ejemplos: `POST` desde origen permitido con token válido llama una vez a `spool`; mismo `attemptId` por segunda vez devuelve `duplicate:true` y no llama otra vez; origen distinto, token incorrecto, cuerpo >64 KiB y `Origin` ausente devuelven 403/413 sin llamar a `spool`; cola falsa devuelve error y no marca «queued». Reiniciar `AttemptLedger` sobre el mismo archivo y repetir la clave para verificar persistencia. `GET /health` no devuelve token ni datos personales.
- [x] **Step 2: Ejecutar `powershell -File printer-agent/build.ps1 -Test`.** Debe fallar por el servidor/ledger inexistente.
- [x] **Step 3: Implementar servidor y configuración.** `HttpListener` escucha solo `http://127.0.0.1:8765/`. Para `OPTIONS`, validar `Origin` exacto y responder `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Content-Type, X-Printer-Token` y, si lo pidió, `Access-Control-Allow-Private-Network: true`. `POST /print` exige token comparado en tiempo constante, valida contrato, consulta ledger, envía RAW y responde `{status:"queued",duplicate:false}`; fallos responden error sin datos sensibles. Persistir ledger en `%LOCALAPPDATA%/ImpastoPrinter/attempts.json` con escritura temporal + reemplazo y poda de entradas viejas; si la persistencia falla, no asegurar deduplicación ni imprimir silenciosamente.
- [ ] **Step 4: Ejecutar pruebas y probar navegador real.** Runner 0; iniciar `--serve` en PC, consultar `/health` y ejecutar `fetch` desde las URLs HTTPS reales de ambas apps con token de prueba. Verificar preflight y acceso a red local en Edge. Si el navegador bloquea HTTPS → loopback, detener la integración y revisar arquitectura. Generar token local aleatorio; `config.local.json` y `bin/` quedan ignorados por Git.
- [ ] **Step 5: Commit de Task 2.** `git diff --cached --check`; commit `feat: agente local seguro para comandas` solo con archivos propios.

## Task 3: Cliente web de impresión local reutilizable por contrato

**Files:** Create `lib/local-printer.ts`, `tests/local-printer.test.ts` in Impasto; create `next-app/src/lib/local-printer.ts`, `next-app/tests/local-printer.test.mjs` in Carro Fogón; modify `next-app/package.json`.

**Interfaces:** En ambos proyectos exportar `printLocal(request: PrintJob, fetcher = fetch): Promise<"queued"|"duplicate">`, `printerHealth(fetcher = fetch): Promise<boolean>` y `newAttemptId(): string`. `PrintJob` reproduce el JSON del Task 2. El token se lee de configuración local del navegador por origen (`localStorage`), nunca de variables `NEXT_PUBLIC_*` ni de InsForge; una función `configurePrinter(token)` solo cambia ese valor tras prueba de conexión.

- [ ] **Step 1: Pruebas que fallen en ambos proyectos.** Mockear `fetcher`: verificar URL `http://127.0.0.1:8765/print`, header `X-Printer-Token`, `attemptId` estable para el mismo objeto, `duplicate` aceptado, 403 como error de emparejamiento, `TypeError`/timeout como «agente no disponible», y ausencia de logs con datos personales. `printerHealth` falla cerrado.
- [ ] **Step 2: Correr pruebas focalizadas.** Impasto: `pnpm exec tsx tests/local-printer.test.ts`. Carro: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON next-app/tests/local-printer.test.mjs` desde raíz; deben fallar por módulo aún inexistente.
- [ ] **Step 3: Implementar cliente pequeño en cada repo con el mismo contrato.** Usar `AbortController` con 4 s; `fetch("http://127.0.0.1:8765/print", {method:"POST",headers:{"Content-Type":"application/json","X-Printer-Token":token},body:JSON.stringify(request),signal})`; no repetir automáticamente tras timeout ambiguo. `newAttemptId` usa `crypto.randomUUID()`. La interfaz ofrece emparejar/editar token solo a operadores; el valor no se muestra después de guardarlo.
- [ ] **Step 4: Correr focalizadas + TypeScript.** `pnpm exec tsx tests/local-printer.test.ts` y `pnpm exec tsc --noEmit` en Impasto; `node ... tests/local-printer.test.mjs` y `npx tsc --noEmit` en `carroFogon/next-app`. Todas deben salir 0.
- [ ] **Step 5: Commits separados por repo.** En Impasto `feat: cliente local de impresion`; en Carro Fogón `feat: cliente local de impresion`; solo archivos de Task 3.

## Task 4: Corregir notas vacías y separar guardado de impresión en el POS

**Files:** Modify `next-app/app/api/pedidos/route.ts`, `next-app/src/components/FormCliente.tsx`, `next-app/src/lib/pedido-comanda.ts`; create `next-app/tests/pedido-notas.test.mjs`, `next-app/tests/pos-save-print.test.mjs`; modify `next-app/package.json`.

**Interfaces:** El POST mantiene su respuesta de pedido persistido; `notas` se almacena como `input.notas ?? ""`. La impresión recibe el `id` y el número devueltos por la API, nunca un número supuesto del contador local; solo se llama si `puedeImprimirComanda(creado)`.

- [ ] **Step 1: Pruebas de regresión que fallen.** Con notas omitidas o `null`, verificar que el payload de inserción lleve `notas:""`; con texto, preservarlo. En una función extraída de orquestación, simular guardado exitoso seguido de rechazo de `printLocal`: comprobar exactamente un `api.post('/pedidos')`, resultado `saved:true,printed:false`, aviso «Pedido guardado; comanda no enviada», carrito ya consumido; fallo del POST produce `saved:false` y cero llamadas a imprimir. MP manual pendiente y pedido cancelado nunca llaman al agente; retiro y delivery elegibles sí lo hacen.
- [ ] **Step 2: Correr `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/pedido-notas.test.mjs` y `tests/pos-save-print.test.mjs` desde `next-app`.** Deben fallar antes del cambio.
- [ ] **Step 3: Implementar corrección mínima.** Cambiar la línea del route a `notas: input.notas ?? ""` y el formulario a `notas: detalles.trim()`. Separar `try/catch` de POST del de impresión. Tras POST exitoso, conservar `creado` y limpiar/avanzar UI una vez; crear `PrintJob` desde `toComanda(creado)` y datos autorizados por `puedeImprimirComanda`. Mantener el estado de «guardado pero no impreso» y una acción que reintente la impresión con la misma clave mientras su resultado sea desconocido; si el agente ya respondió `queued`, deshabilitar reenvío automático. No rotular «impreso» si solo se envió a cola.
- [ ] **Step 4: Verificar pruebas, API y flujo real.** `npm test`, `npx tsc --noEmit`, `npm run build` desde `next-app`; probar presencialmente delivery y retiro sin notas. Confirmar en base un pedido por pulsación y `notas=''`; apagar el agente y comprobar que se conserva el pedido sin duplicarlo.
- [ ] **Step 5: Commit Carro Fogón.** `git diff --cached --check`; commit `fix: separar pedido guardado de comanda local`.

## Task 5: Reimpresión deliberada desde Comandas

**Files:** Modify `next-app/app/pedidos/page.tsx`; create/extend `next-app/tests/pos-reprint.test.mjs`; modify `next-app/package.json`.

**Interfaces:** `imprimirPedido(p)` comprueba `puedeImprimirComanda(p)`, construye el mismo `PrintJob` del Task 4 con `reprint:true` y `newAttemptId()`, y llama a `printLocal`. `abrirComanda` queda como opción manual de respaldo claramente etiquetada, no como éxito del agente.

- [ ] **Step 1: Pruebas que fallen.** Pedido elegible crea nueva clave y marca `reprint:true`; MP pendiente, cancelado o productos inválidos hacen cero llamadas; agente caído muestra «No se pudo enviar a la impresora; pedido guardado»; respuesta `queued` muestra «Enviado a la cola», no «Impreso».
- [ ] **Step 2: Correr `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/pos-reprint.test.mjs` en `next-app`; confirmar fallo.**
- [ ] **Step 3: Implementar botón y estados.** Sustituir la llamada directa a `abrirComanda` por `await printLocal(job)`; permitir respaldo manual separado. Deshabilitar el botón durante envío, sin modificar estado del pedido. Mantener marca visible de reimpresión en el ticket.
- [ ] **Step 4: Ejecutar `npm test`, `npx tsc --noEmit` y reimprimir físicamente un retiro existente y un delivery existente.** Verificar que ambos usan el mismo ancho/corte y que la cantidad de filas de `pedidos` no cambia.
- [ ] **Step 5: Commit Carro Fogón.** `git diff --cached --check`; commit `feat: reimpresion local desde comandas`.

## Task 6: Impresión manual del panel Impasto

**Files:** Modify `app/admin/components/Orders.tsx`; create `lib/admin-print-job.ts`, `tests/admin-print-job.test.ts`; update `lib/local-printer.ts` only if el contrato requiere una corrección comprobada.

**Interfaces:** `adminPrintJob(order: AdminOrder, attemptId: string, reprint: boolean): PrintJob` conserva `items[].detail`, `notas`, modalidad y pago; `Orders` llama a `printLocal` solo cuando `esPedidoParaCocina(order)` autoriza.

- [ ] **Step 1: Pruebas que fallen.** Caja de empanadas con sabores mantiene `detail`; mitad y mitad mantiene detalle; delivery muestra dirección y retiro no inventa envío; pago rechazado o pendiente no se representa como cobrado; dos pulsaciones explícitas crean claves distintas; un pedido bloqueado no llama al agente.
- [ ] **Step 2: Correr `pnpm exec tsx tests/admin-print-job.test.ts`; confirmar fallo.**
- [ ] **Step 3: Implementar mapeo y botón.** Sustituir `setTimeout(() => window.print(), 150)` y el `window.print()` del detalle por una acción async que valida `esPedidoParaCocina`, construye el trabajo, llama al agente y muestra «Enviado a la cola» o error con opción de reintentar. Mantener impresión de navegador como respaldo manual etiquetado durante transición. No modificar `estado` ni `pagoEstado` al imprimir.
- [ ] **Step 4: Ejecutar `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` y prueba física desde el panel en Edge.** Un ticket corto no arrastra los 297 mm de la impresión HTML.
- [ ] **Step 5: Commit Impasto.** `git diff --cached --check`; commit `feat: imprimir comandas del panel por agente local`.

## Task 7: Instalación operativa y verificación final

**Files:** Modify `printer-agent/README.md`, `CLAUDE.md` en Impasto y `CLAUDE.md` en Carro Fogón; create `printer-agent/start.ps1` en Impasto.

**Interfaces:** `build.ps1` genera `bin/PrinterAgent.exe` ignorado por Git; `start.ps1` carga `config.local.json`, comprueba la cola exacta y arranca `--serve`. Un acceso directo de Windows inicia `start.ps1` con la sesión del operador.

- [ ] **Step 1: Ensayar instalación en la PC real.** Compilar, crear secreto aleatorio en `config.local.json`, configurar los dos orígenes reales, iniciar agente sin privilegios de administrador. Si `HttpListener` requiere reserva de URL, documentar comando `netsh http add urlacl` para `http://127.0.0.1:8765/` y el usuario exacto; no abrir el puerto en la LAN. Confirmar `/health` y emparejamiento en Edge.
- [ ] **Step 2: Ensayar recuperación y seguridad.** Cerrar/reabrir agente, desenchufar impresora, cambiar nombre de cola, token errado, origen ajeno, dos solicitudes con misma clave y reimpresión voluntaria. Comprobar que no se guardan PII en logs ni en `config.local.json`, y que este archivo y `bin/` no aparecen en `git status`.
- [ ] **Step 3: Ejecutar suites completas y aceptación presencial.** En Impasto `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`; en `carroFogon/next-app`, `npm test`, `npx tsc --noEmit`, `npm run build`. Registrar en `README.md` resultado, largo de ticket corto, corte, tildes, delivery/retiro, MP pendiente y errores de agente. No declarar éxito si alguna prueba física falla.
- [ ] **Step 4: Actualizar operación y reversión en ambos `CLAUDE.md`.** Explicar arranque al iniciar Windows, emparejamiento, diferencia «en cola»/«impreso», cómo reimprimir sin alta nueva y respaldo HTML temporal. Añadir pasos para volver al flujo manual si el agente no arranca, sin alterar pedidos existentes.
- [ ] **Step 5: Commits finales por repo, sin archivos ajenos.** Impasto `docs: operar agente termico local`; Carro Fogón `docs: operar impresion termica desde POS`. Revisar `git status --short` de ambos antes de cualquier push; publicar solo si el usuario lo solicita.

## Orden y puertas de decisión

Tasks 1 y 2 se completan en Impasto antes de editar las aplicaciones. Si falla el papel RAW o el fetch desde las URLs HTTPS, parar, documentar la causa y consultar una alternativa. Después Task 3 establece el contrato común; Tasks 4–5 completan el POS y Task 6 el panel web. Task 7 instala y verifica. Cada task acaba con pruebas y revisión de su propio diff; ningún error de impresión se diagnostica como error de guardado.
