# Numeración del POS separada de la web — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el POS de Carro Fogón numere sus pedidos 1, 2, 3… sin que los números de seis cifras de la web lo hagan saltar, y que la comanda impresa muestre exactamente el número que quedó guardado en la base.

**Architecture:** Dos secuencias independientes sobre la misma tabla `pedidos`. El POS filtra sus propios pedidos por `external_reference = ''` (la web siempre escribe `IM-XXXXXX-XXXX`, el POS deja el default vacío) tanto al calcular el `MAX+1` como al mostrar el contador en pantalla. El número que se imprime pasa a venir del `.select()` del insert en vez del contador local del navegador. Impasto no se modifica.

**Tech Stack:** Next.js 15 (App Router) + `@insforge/sdk` 1.5.2 + Zod, en `carroFogon/next-app`.

## Global Constraints

- **El gestor de paquetes de Carro Fogón es `npm`** (tiene `package-lock.json`), no pnpm. Los comandos son `npm run lint` y `npm run build`. Impasto sí usa pnpm — no confundirlos.
- **Impasto no se toca en ninguna tarea.** `esReferenciaValida()` exige `IM-\d{6}-XXXX` (`lib/referencia.ts:46`): cambiar el número de la web rompería el seguimiento público de todos los pedidos.
- **Sin migraciones.** Los índices `pedidos_numero_uidx` y `pedidos_external_reference_uidx` ya están aplicados y se quedan como están.
- **No hay runner de tests en Carro Fogón.** `package.json` trae solo `dev`, `build`, `start`, `lint`. No inventar un harness: cada tarea verifica contra la base y el POS reales, que es lo que en este proyecto viene encontrando los bugs que los tests dan por buenos. El "test que falla primero" de cada tarea es una observación reproducible del sistema real.
- **`PROYECTO_ID` es `'impasto'`** en las dos apps (default del código, sin variable en `.env.local`). No es un error: es la unificación operativa de septiembre. No "arreglarlo" a `'carro'`.
- **Toda interpolación en la comanda pasa por `escapeHtml`** (`src/lib/print.ts`): la ventana es same-origin y un dato de cliente podría ejecutar JS. Números y el literal `"—"` son seguros, pero no bajar esa guardia para los campos de texto.
- **Commits locales, sin push.** Pushear en Carro Fogón despliega a Vercel y en Impasto a Netlify. El push lo decide el usuario al final.

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `carroFogon/next-app/app/api/pedidos/route.ts` | Asigna el número server-side al guardar y devuelve la fila creada | 1 y 2 |
| `carroFogon/next-app/app/api/pedidos/contador/route.ts` | El número que el POS muestra en pantalla antes de guardar | 1 |
| `carroFogon/next-app/src/lib/print.ts` | Render de la comanda de 80 mm; tiene que poder no mostrar número | 2 |
| `carroFogon/next-app/src/components/FormCliente.tsx` | Usa el número que devolvió el servidor y avisa si no vino | 2 |
| `carroFogon/CLAUDE.md` | Deja asentado que hay dos secuencias y por qué | 3 |

---

### Task 1: El contador del POS cuenta solo pedidos del POS

**Files:**
- Modify: `carroFogon/next-app/app/api/pedidos/route.ts:101-111`
- Modify: `carroFogon/next-app/app/api/pedidos/contador/route.ts:15-19`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `POST /api/pedidos` sigue devolviendo `201` con el body del insert; `GET /api/pedidos/contador` sigue devolviendo `{ contador: number }`. Ninguna firma cambia — cambia solo el valor.

- [ ] **Step 1: Reproducir el defecto contra la base real**

Desde `C:\Users\spezi\Documents\PROYECTOS\Impasto`, mirar qué números tiene hoy la tabla:

```bash
npx -y @insforge/cli db query "select numero_pedido, external_reference, fecha from pedidos where proyecto_id = 'impasto' order by fecha desc, numero_pedido desc limit 10"
```

Esperado: filas de la web con `numero_pedido` de seis cifras (entre 286113 y 700275 al escribir este plan) y `external_reference` con forma `IM-XXXXXX-XXXX`. Ese es el número que hoy contamina el `MAX+1` del POS.

Después, confirmar que el filtro nuevo aísla al POS:

```bash
npx -y @insforge/cli db query "select count(*) as del_pos from pedidos where proyecto_id = 'impasto' and external_reference = ''"
```

Esperado: `0` si todavía no hubo pedidos de POS. Ese `0` es justamente lo que hace que el POS arranque en 1 en vez de en 700276.

- [ ] **Step 2: Agregar el filtro y la cota del hint en el POST**

En `carroFogon/next-app/app/api/pedidos/route.ts`, agregar la constante junto a `PROYECTO_ID` (línea 8):

```ts
const PROYECTO_ID = (process.env.PROYECTO_ID || "impasto");

/**
 * Piso del número de pedido de la web (Impasto lo calcula como
 * `Date.now() % 900000 + 100000`). Un número de POS legítimo nunca llega a seis
 * cifras, así que sirve para descartar un hint contaminado.
 */
const PISO_NUMERO_WEB = 100000;
```

Reemplazar el bloque de las líneas 98-111 —desde el comentario `// Número de pedido asignado server-side:` hasta la línea del `Math.max`— por:

```ts
  // El POS numera 1, 2, 3… contando SOLO sus propios pedidos. La web comparte
  // esta tabla y el mismo `proyecto_id`, pero numera con el reloj: sin este
  // filtro el máximo salía de un pedido web de seis cifras y la comanda del
  // operario saltaba a #700276 para no volver nunca. El discriminador es
  // `external_reference`: la web siempre escribe `IM-XXXXXX-XXXX` y el POS la
  // deja en el default ''. El mismo filtro va en `contador/route.ts`.
  const hoy = businessDate();
  const { data: pedidosHoy } = await client.database
    .from("pedidos")
    .select("numero_pedido")
    .eq("fecha", hoy)
    .eq("proyecto_id", PROYECTO_ID)
    .eq("external_reference", "");
  const maxHoy = (pedidosHoy ?? []).reduce(
    (m: number, p: { numero_pedido?: number }) => Math.max(m, p.numero_pedido || 0),
    0
  );

  // El hint del navegador habilita el salto manual del numerador, pero se
  // persiste en localStorage: un valor guardado de cuando el contador tomaba
  // números de la web volvería a inflar la numeración. Se descarta en silencio
  // y no se rechaza el pedido — no es culpa del operario y no puede costarle
  // la venta.
  const hint = input.numero_pedido < PISO_NUMERO_WEB ? input.numero_pedido : 0;
  const numeroPedido = Math.max(hint, maxHoy + 1);
```

No tocar `crearPedidoSchema` en `src/lib/validation.ts`: tiene que seguir aceptando `max(999999)` para que un hint contaminado se acote acá y no dispare un 400.

- [ ] **Step 3: Agregar el mismo filtro en el contador de pantalla**

En `carroFogon/next-app/app/api/pedidos/contador/route.ts`, reemplazar el bloque de las líneas 15-19 por:

```ts
  // Mismo filtro que el POST de `/api/pedidos`: el contador que ve el operario
  // tiene que contar los mismos pedidos que el servidor va a numerar. Si solo
  // se arregla uno de los dos, la pantalla y el ticket dejan de coincidir.
  const { data, error } = await client.database
    .from("pedidos")
    .select("numero_pedido")
    .eq("fecha", hoy)
    .eq("proyecto_id", proyectoId)
    .eq("external_reference", "");
```

- [ ] **Step 4: Verificar que compila y no hay regresiones de lint**

```bash
cd /c/Users/spezi/Documents/PROYECTOS/carroFogon/next-app && npm run lint
```

Esperado: 0 errores. Quedan warnings preexistentes de `<img>` y un `exhaustive-deps` — no son de este cambio y no se tocan.

```bash
cd /c/Users/spezi/Documents/PROYECTOS/carroFogon/next-app && npm run build
```

Esperado: build exitoso.

- [ ] **Step 5: Verificar el contador contra el sistema real**

Levantar el POS y entrar con la cuenta del dueño:

```bash
cd /c/Users/spezi/Documents/PROYECTOS/carroFogon/next-app && npm run dev
```

En el navegador, ir a la pantalla de toma de pedidos y mirar el número que muestra `Total.tsx` (`Pedido #N`). Si el localStorage tenía un valor contaminado, recargar una vez para que `syncOrderCounter()` lo reemplace.

Esperado: un número chico (1 si no hubo pedidos de POS hoy), **no** siete cifras. Antes del cambio, con un pedido web cargado hoy, ese lugar mostraba `#700276`.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/spezi/Documents/PROYECTOS/carroFogon
git add next-app/app/api/pedidos/route.ts next-app/app/api/pedidos/contador/route.ts
git commit -m "fix(pos): numerar los pedidos del POS sin contar los de la web

El POS calculaba MAX(numero_pedido)+1 sobre todos los pedidos del dia con
proyecto_id='impasto', incluidos los de la web, que numera con el reloj
(Date.now() % 900000 + 100000). Con un solo pedido web en el dia la comanda
del operario saltaba a siete cifras y no volvia.

Las dos consultas -la del POST y la del contador de pantalla- filtran ahora
por external_reference = '', que es lo que distingue un pedido de POS de uno
de la web. El hint que manda el navegador se acota por debajo de 100000 para
que un valor contaminado en localStorage no vuelva a inflar la numeracion.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: La comanda imprime el número que quedó en la base

**Files:**
- Modify: `carroFogon/next-app/app/api/pedidos/route.ts:133-135`
- Modify: `carroFogon/next-app/src/lib/print.ts:17` y `:60`
- Modify: `carroFogon/next-app/src/components/FormCliente.tsx:94-95`, `:102`, `:106`, `:119-126`

**Interfaces:**
- Consumes: de la tarea 1, que `numeroPedido` ya es el número corto correcto.
- Produces: `POST /api/pedidos` devuelve un array cuyo primer elemento trae `numero_pedido`. `DatosComanda.numero` pasa a ser `number | null`; `abrirComanda(d: DatosComanda): boolean` mantiene su firma. El otro consumidor, `app/pedidos/page.tsx:15`, pasa un `number` y sigue compilando sin cambios.

- [ ] **Step 1: Reproducir el defecto**

Con el POS levantado (`npm run dev`), abrir las herramientas de desarrollo en la pestaña Network, cargar un pedido y apretar el botón de imprimir. Mirar la respuesta de `POST /api/pedidos`.

Esperado hoy: la respuesta **no contiene `numero_pedido`**, porque el insert va sin `.select()`. Por eso `FormCliente.tsx:95` cae a `creado?.numero_pedido ?? orderCounter` y la comanda se imprime con el contador local, que puede no ser el número guardado. Confirmar el número real en la base:

```bash
cd /c/Users/spezi/Documents/PROYECTOS/Impasto && npx -y @insforge/cli db query "select numero_pedido, external_reference from pedidos where external_reference = '' order by created_at desc limit 3"
```

Anotar ese número: es el que la comanda tiene que decir al final de esta tarea.

- [ ] **Step 2: Pedirle el número al servidor en el insert**

En `carroFogon/next-app/app/api/pedidos/route.ts`, reemplazar las líneas 133-135:

```ts
  const { data, error } = await client.database
    .from("pedidos")
    .insert([pedido]);
```

por:

```ts
  // `.select()` para que la respuesta traiga el número que realmente se guardó:
  // la comanda lo imprime y no puede inventarlo desde el contador local. Es el
  // mismo patrón que usa `createPedido()` de Impasto para leer el `id`.
  const { data, error } = await client.database
    .from("pedidos")
    .insert([pedido])
    .select("numero_pedido");
```

- [ ] **Step 3: Permitir que la comanda no tenga número**

En `carroFogon/next-app/src/lib/print.ts`, cambiar la línea 17 dentro de `DatosComanda`:

```ts
  numero: number;
```

por:

```ts
  /** `null` cuando el servidor guardó el pedido pero no devolvió el número. */
  numero: number | null;
```

Y reemplazar la línea 60:

```ts
  const numero = Number(d.numero) || 0;
```

por:

```ts
  // "—" y no 0: un `#0` parece un número válido y el operario lo cantaría.
  const numero = d.numero == null ? "—" : String(d.numero);
```

Las dos interpolaciones existentes —el `<title>` de la línea 68 y la fila del ticket de la línea 78— no se tocan: ya usan `${numero}` y ahora reciben `"—"`.

- [ ] **Step 4: Usar el número del servidor en el formulario**

En `carroFogon/next-app/src/components/FormCliente.tsx`, reemplazar las líneas 94-95:

```ts
      const creado = Array.isArray(res.data) ? res.data[0] : res.data;
      const numPedido: number = creado?.numero_pedido ?? orderCounter;
```

por:

```ts
      const creado = Array.isArray(res.data) ? res.data[0] : res.data;
      // Sin fallback al contador local: si el servidor no devolvió el número,
      // la comanda sale sin número antes que con uno que no está en la base.
      const crudo = Number(creado?.numero_pedido);
      const numPedido: number | null = Number.isFinite(crudo) && crudo > 0 ? crudo : null;
```

En la línea 102, cambiar el encabezado del mensaje de Telegram:

```ts
      const msgTel = `🍕 Pedido Impasto #${numPedido}\n📅 ${new Date().toLocaleDateString("es-AR")}\n🛵 ${envioTexto}\n👤 ${nombre || "—"} | 📞 ${telefono || "—"}\n📍 ${dirFinal}\n\n${lineas}\n\n💰 Total: $${totalFinal.toLocaleString("es-AR")}${conDescuento ? " ✅ Efectivo con desc." : ""}`;
```

por:

```ts
      const msgTel = `🍕 Pedido Impasto #${numPedido ?? "—"}\n📅 ${new Date().toLocaleDateString("es-AR")}\n🛵 ${envioTexto}\n👤 ${nombre || "—"} | 📞 ${telefono || "—"}\n📍 ${dirFinal}\n\n${lineas}\n\n💰 Total: $${totalFinal.toLocaleString("es-AR")}${conDescuento ? " ✅ Efectivo con desc." : ""}`;
```

La línea 106 (`numero: numPedido`) no cambia de texto: ahora pasa un `number | null`, que es exactamente lo que `DatosComanda` acepta desde el paso 3.

Reemplazar las líneas 119-126:

```ts
      setOrderCounter(numPedido + 1);
      clearCart();
      setTelefono(""); setDireccion(""); setNombre(""); setDetalles(""); setConDescuento(false);
      if (impreso) {
        showToast(`✓ Pedido #${numPedido} guardado e impreso`);
      } else {
        showToast(`✓ Pedido #${numPedido} guardado — impresión bloqueada, reimprimilo desde Comandas`, true, 5000);
      }
```

por:

```ts
      // Si no vino el número, el contador se queda como está: `syncOrderCounter()`
      // lo corrige en el próximo montaje contra la base.
      if (numPedido != null) setOrderCounter(numPedido + 1);
      clearCart();
      setTelefono(""); setDireccion(""); setNombre(""); setDetalles(""); setConDescuento(false);
      if (numPedido == null) {
        showToast(
          impreso
            ? "✓ Pedido guardado e impreso sin número — buscalo en Comandas antes de cantarlo"
            : "✓ Pedido guardado sin número — impresión bloqueada, reimprimilo desde Comandas",
          true,
          6000,
        );
      } else if (impreso) {
        showToast(`✓ Pedido #${numPedido} guardado e impreso`);
      } else {
        showToast(`✓ Pedido #${numPedido} guardado — impresión bloqueada, reimprimilo desde Comandas`, true, 5000);
      }
```

`orderCounter` sigue usándose en la línea 81 como hint, así que la variable de la línea 23 no queda sin uso — no la borres.

- [ ] **Step 5: Verificar que compila**

```bash
cd /c/Users/spezi/Documents/PROYECTOS/carroFogon/next-app && npm run lint && npm run build
```

Esperado: 0 errores de lint (siguen los warnings preexistentes) y build exitoso. Si TypeScript se queja en `app/pedidos/page.tsx`, es que `DatosComanda.numero` quedó mal tipado: tiene que ser `number | null`, que acepta el `number` que ese archivo pasa.

- [ ] **Step 6: Verificar contra el sistema real que el ticket dice el número de la base**

Con `npm run dev`, cargar un pedido y apretar imprimir. En la ventana de la comanda, anotar el número. Después:

```bash
cd /c/Users/spezi/Documents/PROYECTOS/Impasto && npx -y @insforge/cli db query "select numero_pedido, total, created_at from pedidos where external_reference = '' order by created_at desc limit 1"
```

Esperado: el `numero_pedido` de la base es **idéntico** al del ticket impreso, y es un número corto de la secuencia del POS.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/spezi/Documents/PROYECTOS/carroFogon
git add next-app/app/api/pedidos/route.ts next-app/src/lib/print.ts next-app/src/components/FormCliente.tsx
git commit -m "fix(pos): imprimir en la comanda el numero que devolvio la base

El insert iba sin .select(), asi que la respuesta no traia numero_pedido y
FormCliente caia al contador local: el ticket podia decir un numero que no
era el guardado.

El insert pide ahora .select('numero_pedido') y el formulario usa ese valor
sin fallback. Si igual no viene, la comanda sale con guion y el operario ve
un aviso de que el pedido se guardo pero el numero hay que buscarlo en
Comandas; antes ese caso habria impreso #0.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Verificar las dos secuencias juntas y documentarlo

**Files:**
- Modify: `carroFogon/CLAUDE.md:89`

**Interfaces:**
- Consumes: las tareas 1 y 2 completas.
- Produces: nada de código.

- [ ] **Step 1: Verificar que los dos canales conviven**

Con el POS levantado, cargar un pedido de POS y anotar su número (debería ser el siguiente de la secuencia corta).

Después generar un pedido por la web. Si no se quiere cobrar de verdad, alcanza con insertar una fila que imite a la web —seis cifras y referencia— para probar el aislamiento.

**Antes de insertarla, avisarle al usuario:** esta fila entra en la tabla de producción y la va a contar el recetario en la ganancia del mes hasta que se borre en el paso 3. Es un pedido de $0, así que no mueve la plata, pero sí el conteo de pedidos.

```bash
cd /c/Users/spezi/Documents/PROYECTOS/Impasto && npx -y @insforge/cli db query "insert into pedidos (numero_pedido, proyecto_id, sucursal_id, fecha, external_reference, metodo_pago, estado_pago, direccion, productos, subtotal, envio, total, modalidad, status, cuando) values (654321, 'impasto', 'iguazu', current_date, 'IM-654321-TEST', 'mercadopago', 'aprobado', 'Prueba', '[]'::jsonb, 0, 0, 0, 'delivery', 'normal', 'asap')"
```

Confirmar que la fila realmente entró, porque `db query` viene reportando éxito sobre sentencias que descarta:

```bash
cd /c/Users/spezi/Documents/PROYECTOS/Impasto && npx -y @insforge/cli db query "select numero_pedido, external_reference from pedidos where external_reference = 'IM-654321-TEST'"
```

Esperado: una fila. Si vuelve vacío, la prueba no sirve — generar un pedido real desde la web en vez de insertarlo a mano.

Volver al POS, recargar para que `syncOrderCounter()` consulte de nuevo, y cargar otro pedido.

Esperado: el número del POS **sigue la secuencia corta** (el siguiente al del primer pedido de POS), sin saltar a 654322. Antes del cambio habría saltado.

- [ ] **Step 2: Confirmar que no se rompió la coordinación con los otros dos proyectos**

```bash
cd /c/Users/spezi/Documents/PROYECTOS/Impasto && npx -y @insforge/cli db query "select numero_pedido, external_reference, metodo_pago, estado_pago from pedidos where fecha = current_date order by created_at desc limit 5"
```

Esperado: los pedidos de POS tienen `metodo_pago = 'efectivo'` y `estado_pago = 'pendiente'` (el default), que es lo que hace que `esPedidoParaCocina()` de Impasto los deje entrar a cocina. Si alguno quedó con otro `metodo_pago`, el pedido no aparecería en el panel de cocina y hay que revisar el insert.

Abrir `/admin` de Impasto en producción y confirmar que el pedido de POS aparece en la lista de comandas.

Y confirmar que el recetario sigue clasificando bien los dos canales: abrir `https://recetarionapolitano.netlify.app/ganancias` e iniciar sesión. El pedido de POS tiene que aparecer con la etiqueta `📲 carroFogon` y el de la web con `🍕 Impasto Web`. La clasificación se hace por heurística sobre `external_reference`, el email y el proveedor de pago (`ganancias.astro:361-371`), no por `proyecto_id`, así que no la afecta este cambio — pero conviene verlo con los dos pedidos del día a la vista antes de dar la tarea por cerrada.

- [ ] **Step 3: Borrar la fila de prueba**

Solo si se insertó la fila del paso 1 y **después de confirmar con el usuario** que se puede borrar:

```bash
cd /c/Users/spezi/Documents/PROYECTOS/Impasto && npx -y @insforge/cli db query "delete from pedidos where external_reference = 'IM-654321-TEST'"
```

Los pedidos de POS creados durante la prueba son datos reales del día: **no borrarlos sin preguntar**, porque impactan en el recetario.

- [ ] **Step 4: Documentar las dos secuencias**

En `carroFogon/CLAUDE.md`, reemplazar la línea 89:

```markdown
- **Base (migraciones de Impasto, compartidas):** `pedidos_numero_uidx` unique `(fecha, proyecto_id, numero_pedido)` y `pedidos_external_reference_uidx` unique **parcial** (`external_reference <> ''`). `clientes.telefono` ya era unique. En una colisión de número la segunda escritura **falla** en vez de duplicar: falta el contador atómico (RPC).
```

por:

```markdown
- **Base (migraciones de Impasto, compartidas):** `pedidos_numero_uidx` unique `(fecha, proyecto_id, numero_pedido)` y `pedidos_external_reference_uidx` unique **parcial** (`external_reference <> ''`). `clientes.telefono` ya era unique. En una colisión de número la segunda escritura **falla** en vez de duplicar: falta el contador atómico (RPC).
- **Hay dos secuencias de `numero_pedido`, no una.** El POS numera 1, 2, 3… y la web de Impasto numera con el reloj (`Date.now() % 900000 + 100000`, siempre seis cifras), las dos sobre la misma tabla y el mismo `proyecto_id = 'impasto'`. Por eso el POS **cuenta solo sus propios pedidos**, filtrando por `external_reference = ''`: la web siempre escribe `IM-XXXXXX-XXXX` y el POS deja el default vacío. El filtro va en `POST /api/pedidos` **y** en `GET /api/pedidos/contador`; si falta en uno, la pantalla y el ticket dejan de coincidir. **No es un olvido, no lo saques:** sin él, un solo pedido web del día hacía saltar la comanda del operario a `#700276` para no volver. El número de la web no se puede acortar porque `esReferenciaValida()` de Impasto exige `IM-\d{6}-XXXX`.
- **El número de la comanda sale del `.select()` del insert**, no del contador local. El hint que manda el navegador (`orderCounter`, persistido en localStorage) se acota por debajo de 100000 en el servidor para que un valor contaminado no vuelva a inflar la numeración; se descarta en silencio en vez de rechazar el pedido.
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/spezi/Documents/PROYECTOS/carroFogon
git add CLAUDE.md
git commit -m "docs: asentar las dos secuencias de numero_pedido y su discriminador

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Reportar al usuario y NO pushear**

Resumir qué se verificó contra la base y el POS, y preguntar si se pushea. Pushear Carro Fogón despliega a Vercel: es una decisión del usuario, sobre todo estando cerca de la apertura.

---

## Lo que este plan deliberadamente no hace

- **No agrega un contador atómico.** Sigue siendo read-then-insert, así que dos terminales de POS simultáneas pueden calcular el mismo número y la segunda escritura falla por el índice único. Es un pendiente ya documentado que necesita una RPC y tocar los tres proyectos; con un solo mostrador no se ejerce.
- **No unifica las dos secuencias.** Decisión tomada en el spec: obligaría a Impasto a leer-y-después-insertar y a sumarle reintento.
- **No toca las 60 filas de `productos` con `proyecto_id = 'carro'`** que quedaron invisibles para las dos apps, ni el falso positivo de `ventas_mes` en el recetario. Son hallazgos separados de la misma revisión.
