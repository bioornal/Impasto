# `/cocina` y fotos automáticas

Fecha: 3 de octubre de 2026. Aprobado por el dueño en el chat, parte por parte, el mismo día.
Reemplaza la decisión "contenido en el código" de `2026-10-02-guia-cocina-design.md`.

## Para qué

Hoy `/cocina` tiene los datos escritos a mano en `lib/guia-cocina.ts`: cada cambio de receta,
gramo o foto necesita que alguien edite el código y publique. El 03/10 la guía ya estaba
desalineada con el recetario en siete pizzas. El dueño pidió que la página se actualice sola
cuando cambia una imagen, un ingrediente o una cantidad, y poder subir las fotos desde el
admin de Impasto sin entrar a InsForge.

## Decisiones del dueño

1. **El recetario es la única fuente** del armado: qué va en la base, en el horno y después
   del horno, y cuáles son las preparaciones.
2. **`/cocina` muestra las pizzas en venta** (salen solas de la carta) **más las que marque**
   como "Próximamente" o "En prueba" en Recetas.
3. **Las fotos automáticas valen para la carta de clientes y para `/cocina`.**
4. **Las fotos se suben desde el admin de Impasto**, además de poder subirse a mano al bucket.

## Parte 1: el recetario describe el armado

Repo `recetario-napolitano`, migración en `migrations/` (como `preparaciones`).

### Esquema

- `receta_ingredientes.momento text not null default 'horno'`, con
  `check (momento in ('base','horno','despues'))`.
- `recetas.en_cocina text null`, con `check (en_cocina in ('proximamente','prueba'))`. Solo
  tiene sentido en recetas que no están en la carta; las de la carta se muestran igual.
- `recetas.indicaciones text null`: en una pizza, la nota de armado; en una preparación, el
  paso a paso **sin gramos** (los gramos salen de sus ingredientes).
- `recetas.conservacion text null`: solo para preparaciones.

### Guardado atómico

`guardar_receta_atomica` se reemplaza para:

- Aceptar `momento` en cada línea. **Si una línea no lo trae** (la APK de Android vieja), se
  conserva el que tenía ese mismo ingrediente en esa receta antes de borrar las líneas; si no
  había, `'horno'`.
- Aceptar `en_cocina`, `indicaciones` y `conservacion` en `p_datos`. **Si la clave no viene,
  la columna no se toca**, así Android no borra lo que cargó la web.
- Validar `momento` y `en_cocina` contra sus valores permitidos, con el mismo error `PT400`.

`leer_receta_atomica` ya devuelve las filas completas, así que trae las columnas nuevas sin
cambios.

### Preparaciones nuevas

Como el pesto: receta + fila en `preparaciones` + ingrediente cuyo `precio_kg` mantiene el
trigger. Para las pizzas en venta: **miel picante, miel de ajo, ajo confitado, cebolla dorada,
morrones asados, golf de la casa y aceto reducido**. Para las próximas y en prueba: **manteca
de ajo confitado, cherry asados, miel y mostaza, pesto de pistacho, pesto de verdeo, pesto
rosso y olivada**. Indicaciones y conservación salen del texto actual de la guía, sin gramos.

En cada pizza, las líneas sueltas que forman una preparación se reemplazan por una línea de
esa preparación. **El costo se conserva por construcción** cuando la receta de la pizza y la
de la guía coinciden: la cantidad de la línea nueva es la parte del rinde que corresponde a
los gramos de antes. Si el rinde real no se conoce (cebolla dorada, aceto reducido), se usa
una estimación marcada para que el dueño la corrija; si la corrige, tiene que ajustar también
los gramos de la pizza, que pasan a ser gramos de producto terminado.

**Donde el recetario y la guía no coinciden**, el costo cambia. Casos conocidos:

- Miel picante: el recetario costea 5 g de ají por pizza; la guía usa 5 g por tanda de 125 g
  de miel.
- Miel de ajo: el recetario costea 5 g de ajo por pizza; la guía usa 30 g por tanda y lo cuela.
- Golf de la casa: el recetario usa la golf comprada; la guía es mayonesa, kétchup, limón,
  pimentón e inglesa. El kétchup tiene rendimiento 0 y se costea en $0.

**Ningún precio de la carta cambia sin el OK del dueño.** Antes de aplicar la migración se
simulan los precios con `buildEffectivePrices` de Impasto, y se le presenta al dueño la
lista de pizzas cuyo precio cambia, con el valor actual y el nuevo.

### Carga inicial

La misma migración carga desde la guía actual:

- el momento de cada línea de las 17 pizzas que ya tienen receta;
- las indicaciones de las pizzas que tienen nota;
- `en_cocina = 'proximamente'` en las 8 próximas;
- las 3 pizzas en prueba (Pomodorini Confit e Ricotta, Pesto Rosso e Ricotta, Puttanesca
  Impasto) como recetas sin precio de venta, con `en_cocina = 'prueba'`. Los ingredientes
  que falten (tomate seco, alcaparras) se crean con precio 0, para que el dueño los complete.

### Pantalla Recetas (web)

- Un selector **Base / Horno / Después** en cada línea.
- Un selector **En cocina** (—, Próximamente, En prueba).
- Dos textos: **Indicaciones** y, en las preparaciones, **Conservación**.
- Todo se guarda con "Guardar receta", como el resto (cambia la versión y entra en el aviso de
  cambios sin guardar).

La app de Android no muestra los campos nuevos en esta etapa; el guardado atómico los
conserva.

## Parte 2: `/cocina` lee el recetario

Repo `Impasto`.

- `app/cocina/page.tsx` pasa a `export const revalidate = 60`: se arma con la base y se
  renueva cada minuto. Si la base falla al renovar, Next sigue sirviendo la última versión
  buena.
- **Lectura** (`lib/guia-cocina-datos.ts`, servidor, clave de backend): `productos`
  (`proyecto_id = 'impasto'`, `tipo = 'pizza'`), `precios_venta`, `recetas`,
  `receta_ingredientes`, `ingredientes`, `preparaciones`. Con `readPages` para no cortar en
  la paginación.
- **Armado** (`lib/guia-cocina.ts`, funciones puras sin base ni React): recibe las filas y
  devuelve pizzas y preparaciones.
  - **En venta:** productos no archivados, vinculados a su receta por `precios_venta` (por
    nombre, como el resto del sitio). Orden: el de `PIZZAS_DE_LA_CARTA` de `orden-admin.ts`,
    y las que no figuren, alfabéticas.
  - **Próximamente / En prueba:** recetas con `en_cocina`, alfabéticas.
  - **Base:** "Salsa de tomate, 150 g" si `precio_salsa > 0`, más las líneas `base`. Sin
    ninguna de las dos, "Sin salsa, base blanca".
  - **Horno** y **Después del horno:** las líneas según su momento.
  - **Cantidades:** `kg` → g, `litro` → ml, `unidad` → unidades, `atado` → fracción ("⅓ de
    atado"). Nombres tal como están en `ingredientes`.
  - **Preparaciones:** las que usan las pizzas mostradas, incluidas las que usa otra
    preparación (la manteca usa ajo confitado). Ingredientes con gramos, rinde, indicaciones,
    conservación y "Próximamente" si ninguna pizza en venta la usa.
  - Una pizza en venta **sin receta vinculada** muestra "Receta no cargada en el recetario".
- **Fijas en el código:** solo las dos líneas generales (bollo de 300 g, salsa de 150 g).
- La página nunca muestra costos ni precios.

## Parte 3: fotos automáticas

Repo `Impasto`. Se aplica a la carta (catálogo y ficha), a `/cocina` y a las miniaturas del
admin.

### Elección (`lib/fotos.ts`, funciones puras)

Candidatas de cada producto, gana **la más nueva** por fecha de subida:

1. archivos en `fotos/<id del producto>/` (los que sube el admin, parte 4);
2. archivos en la raíz del bucket que se llaman como el producto, solos o con una versión al
   final (` v4`, `-v2`, ` (1)`). Se compara sin mayúsculas ni tildes y sin la extensión
   (jpg, jpeg, png, webp). Un nombre más largo no cuenta: "Pizza Fugazzeta Rellena.jpg" no
   es candidata de "Pizza Fugazzeta".

Sin candidatas, el respaldo es `REAL_PRODUCT_PHOTOS` y después el stock, como hoy. Las pizzas
en prueba usan solo la regla 2, con el nombre de su receta.

### Lectura del bucket

El servidor lista el bucket `DB` con la clave de backend, con la caché de datos de Next por
un minuto y la etiqueta `fotos` (la API concreta se elige en el plan, según lo que soporte
Next 16 en Netlify). Si la lista falla, se usa el respaldo: la carta nunca
queda sin fotos. La portada y las imágenes de stock no cambian.

### Regla para subir a mano

Nombre exacto del producto más una versión nueva. **Nunca reemplazar un archivo con el mismo
nombre**: el CDN de InsForge redirige a una URL firmada y sigue sirviendo la versión vieja
(comprobado el 03/10 también con `?v=`).

### Sin cambios visibles al publicar

Antes de publicar se compara, producto por producto, la foto elegida contra la que se ve hoy.
Donde la regla elegiría otra (por ejemplo, Porteña y Bondiola usan hoy WebP del repo y el
bucket tiene fotos más viejas con su nombre), se sube la actual con una versión nueva.

## Parte 4: subir la foto desde el admin

Repo `Impasto`.

- **Interfaz:** en Productos → Editar producto, un campo **Foto** con la foto actual, un
  botón "Cambiar foto" (jpg, png o webp, hasta 5 MB) y vista previa antes de guardar.
- **Ruta:** `POST /api/admin/productos/[id]/foto`, protegida con `requireAdmin` como el resto.
  - Valida el tipo por los primeros bytes del archivo, no solo por el que declara el
    navegador.
  - Valida el tamaño y que el producto exista con `proyecto_id = 'impasto'`.
  - Sube a `fotos/<id>/<fecha ISO compacta>.<ext>`. Nunca pisa un archivo; las fotos
    anteriores quedan.
  - Después llama `revalidateTag('fotos')` y `revalidatePath('/cocina')`, para que se vea al
    instante.
- **Miniaturas del admin:** `GET /api/admin/productos` agrega la foto elegida a cada producto,
  y `ProductThumb` la usa antes que el mapa del código.
- **Renombrar no afecta:** la carpeta va por id, y el nombre ahora se sincroniza entre tablas.

Fuera de alcance: recortar o comprimir, borrar fotos desde el admin y volver a una anterior.

## Pruebas

- **Recetario (PGlite):** columnas y checks; guardado con y sin `momento`; claves ausentes que
  no tocan columnas; preparaciones nuevas con su `precio_kg`; costo conservado en las pizzas
  donde la receta coincide.
- **Impasto (`tsx`):**
  - armado de la guía con filas de ejemplo (momentos, unidades, estados, preparaciones
    anidadas, receta faltante, sin costos ni precios);
  - elección de fotos (versiones, tildes, nombres más largos, la más nueva gana, carpeta por
    id, respaldo);
  - ruta de subida (sin login la rechaza, tipo y tamaño, nunca pisa).
- **Antes de publicar:**
  - precios simulados sin cambios no aprobados;
  - `/cocina` nueva comparada con la actual: solo cambia lo que viene del recetario;
  - fotos sin cambios en la carta;
  - en el navegador, una foto de prueba subida a un producto archivado.
- TypeScript, lint, `pnpm test`, build y tests del recetario.

## Orden de trabajo

1. Migración del recetario (esquema, guardado atómico, preparaciones, carga inicial), con la
   simulación de precios presentada al dueño **antes** de aplicarla.
2. Pantalla Recetas (web).
3. `/cocina` desde la base.
4. Elección automática de fotos.
5. Subida desde el admin.

Cada paso se publica por separado y se verifica en producción.

## Fuera de alcance

- Edición de los campos nuevos en la app de Android.
- Corregir los nombres de los ingredientes (tildes): el dueño puede hacerlo desde Ingredientes
  y la cocina lo ve.
- Carro Fogón.
