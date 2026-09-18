# Numeración del POS separada de la web

**Fecha:** 17 de septiembre de 2026
**Repos que se tocan:** `carroFogon/next-app` (Impasto no cambia)

## El problema

Desde la unificación operativa de septiembre, Carro Fogón escribe `proyecto_id = 'impasto'`,
igual que la web. Las dos aplicaciones comparten la tabla `pedidos`, pero numeran distinto:

- **La web** usa `(Date.now() % 900000) + 100000` (`lib/orders.ts:114`). Siempre seis dígitos.
  El número va también dentro de la referencia `IM-XXXXXX-XXXX`.
- **El POS** usa `MAX(numero_pedido del día) + 1` (`app/api/pedidos/route.ts:111`), y ese máximo
  lo calcula sobre **todos** los pedidos del día con `proyecto_id = 'impasto'` — o sea, incluidos
  los de la web.

Verificado contra la base: las cuatro filas de `pedidos` tienen números entre **286113 y 700275**.
En cuanto entra un pedido web, la comanda del operario salta de `#3` a `#700276` y no vuelve.
No se pierde nada y el índice único no se viola, pero el número deja de servir para cantar
pedidos en cocina, que es lo único para lo que existe.

Arrastra un segundo defecto. El POS inserta sin `.select()`, así que
`FormCliente.tsx:95` cae a `creado?.numero_pedido ?? orderCounter`: cuando la respuesta no trae
la fila, **el ticket impreso dice un número que no es el de la base**. Con el salto de arriba, la
diferencia es de cinco cifras.

## Decisiones

**Dos secuencias separadas, no una compartida.** El POS numera 1, 2, 3… y la web sigue con sus
seis dígitos. La cocina distingue el canal por la forma del número. Se descartó la secuencia
única compartida: obligaría a Impasto a leer-y-después-insertar, y el índice único
`(fecha, proyecto_id, numero_pedido)` haría **fallar** la segunda escritura cuando entran dos
pedidos juntos — habría que sumarle un reintento y tocar los tres proyectos para ganar prolijidad.

**El discriminador es `external_reference = ''`.** La web siempre escribe una referencia real y
`createPedido()` es su único camino; el POS nunca la escribe y la columna es `NOT NULL DEFAULT ''`.
Se descartó una columna `canal` nueva: es más explícita, pero pide migración sobre la tabla
compartida, backfill y deploys coordinados, para distinguir algo que ya se distingue.

**Impasto no se toca.** `esReferenciaValida()` exige `IM-\d{6}-XXXX` (`lib/referencia.ts:46`):
bajarle los dígitos al número de la web rompería el seguimiento público `/pedido/[ref]` de todos
los pedidos. El índice único se queda como red de seguridad.

## Los tres cambios

### 1. El contador del POS cuenta solo pedidos del POS

Suman `.eq("external_reference", "")` las dos consultas que hoy barren el día entero:

- `app/api/pedidos/route.ts:102` — el `MAX+1` con que se guarda el pedido.
- `app/api/pedidos/contador/route.ts:15` — lo que el operario ve en pantalla.

Las dos tienen que llevar el mismo filtro. Si solo se arregla una, lo que se imprime y lo que se
muestra dejan de coincidir.

### 2. El hint del cliente no puede inflar el número

`app/api/pedidos/route.ts:111` hace `Math.max(input.numero_pedido, maxHoy + 1)`. Ese hint sale de
`orderCounter`, que **se persiste en localStorage** (`src/store/useStore.ts:133`) y hoy se
sincroniza desde un contador ya contaminado. Un navegador con un 700276 guardado volvería a
envenenar la numeración incluso con el filtro del punto 1 puesto.

El hint no se elimina: habilita el salto manual del numerador (`src/components/Total.tsx:51`), que
es una función deliberada. Se acota. Un hint **menor a 100000** —el piso de la web— se respeta como
hoy; uno **igual o mayor** se descarta y se usa `maxHoy + 1`.

Acá el rango sí se usa, aunque más arriba se haya descartado como discriminador: son dos cosas
distintas. Contar los pedidos del POS tiene que ser exacto, y para eso el dato correcto es
`external_reference`. Acotar el hint solo necesita descartar valores absurdos, y para eso alcanza
saber que un número de POS legítimo nunca llega a seis cifras. Si algún día la web cambiara su
rango, esta cota se vuelve conservadora, no incorrecta. El valor viejo del localStorage se
cura solo en el próximo `syncOrderCounter()`, que ya corre al montar.

La cota se descarta en el servidor, no se rechaza el pedido: un hint contaminado no es culpa del
operario y no puede costarle la venta.

### 3. La comanda imprime el número que quedó en la base

- El insert pasa a `.insert([pedido]).select("numero_pedido")`. Es el patrón que `createPedido()`
  de Impasto ya usa en producción para leer el `id`.
- `src/components/FormCliente.tsx:95` deja de caer a `orderCounter`. Si el número vino, se imprime.
  Si no vino, la comanda sale con `—` y el operario ve un aviso de que el pedido **se guardó** pero
  el número hay que mirarlo en el panel.
- `DatosComanda.numero` pasa a `number | null` (`src/lib/print.ts:17`), y los dos lugares que lo
  interpolan —el `<title>` y la fila del ticket— renderizan `—`. Hoy `Number(d.numero) || 0`
  imprimiría `#0`, que parece un número válido y es peor que no mostrar ninguno.

Nunca se imprime un número que no esté en la base: es justamente el defecto que se está arreglando.

## Verificación

Carro Fogón no tiene runner de tests (`package.json` trae solo dev/build/start/lint) y montarle uno
es más trabajo que el arreglo. Se verifica contra el sistema real, que es lo que en este proyecto
viene encontrando los bugs que los tests dan por buenos:

1. Levantar el POS, cargar un pedido y confirmar en la base que el `numero_pedido` guardado es el
   número corto, y que el ticket impreso dice el mismo.
2. Meter un pedido por la web y confirmar que el siguiente del POS **sigue la secuencia corta** en
   vez de saltar a siete cifras.
3. Confirmar que el pedido del POS sigue entrando a la cocina de Impasto (`metodo_pago = 'efectivo'`
   con `estado_pago` en el default `'pendiente'` pasa `esPedidoParaCocina()`), y que el recetario
   lo sigue clasificando como canal `carroFogon`.

`pnpm lint` y `pnpm build` del carro tienen que seguir limpios. Impasto no se toca, así que sus
88 tests no entran en juego.

## Qué documentar al terminar

El `CLAUDE.md` del carro tiene que decir que hay **dos secuencias** y por qué el discriminador es
`external_reference`, o la próxima sesión "arregla" el filtro de vuelta pensando que es un olvido.
