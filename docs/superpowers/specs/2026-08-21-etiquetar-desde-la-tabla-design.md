# Etiquetar productos desde la tabla · Diseño

**Fecha:** 21 de agosto de 2026
**Pedido del dueño:** poder ponerle a un producto cualquier etiqueta —o ninguna— desde la
misma tabla de Productos, sin abrir el editor.

Continúa [`2026-08-20-etiquetas-editables-design.md`](2026-08-20-etiquetas-editables-design.md),
que dejó las etiquetas administrables pero solo aplicables desde el modal de edición.

## El problema

Marcar un producto hoy son cinco gestos: abrir el editor, buscar la fila de etiquetas,
tocar el botón, guardar, cerrar. Para una tanda de veinte productos es inviable, y es
exactamente lo que hace falta después de crear una etiqueta nueva.

## Estado de los datos, al 21/08/2026

De los 49 productos de Impasto: **22 sin etiquetas, 24 con una, 3 con dos**. Los tres con
dos son `Pizza Napoletana Margarita Clasica`, `Pizza Napoletana Margarita Especial` y
`Pizzeta Provolone Rellena`, las tres con `vegetariana` + `gourmet`.

Esos tres descartan el control de selección única: elegir una etiqueta borraría la otra, y
como ambas alimentan pestañas del sitio, la pestaña Veggie caería de 15 a 12 o Gourmet de
9 a 6, en silencio. **El control es de selección múltiple.**

## La celda

La columna `Etiquetas` de la tabla pasa de texto a control:

- Muestra los cartelitos actuales del producto y un `+` al final. Toda la celda abre.
- Al abrir, un panelito lista las etiquetas de la tabla `etiquetas`, en su orden, cada una
  con una casilla. Marcar y desmarcar es libre.
- **Se guarda al cerrar** (clic afuera o `Esc`), no en cada clic: marcar tres casillas
  serían tres PUT y tres avisos encimados. Si al cerrar el conjunto no cambió, no se manda
  nada.
- Sin etiquetas se representa desmarcando todo. No hay opción "(ninguna)" separada.

### Lo que queda afuera del panelito

`popular` no es una etiqueta: es una columna booleana de `productos`. Se sigue viendo en la
celda como `★ popular` pero **no aparece entre las casillas**. Mezclar un booleano del
producto con los slugs de `productos.tags` en el mismo control invita a que uno pise al
otro.

## El color de los cartelitos

Hoy `Products.tsx` pinta cada tag con un `if` encadenado por slug: `picante` rojo,
`vegetariana` verde, `gourmet` oscuro, **cualquier otra gris**. Es la misma clase de
hardcodeo que la tarea anterior sacó del sitio, y sobrevivió en el panel.

Con etiquetas editables eso es una contradicción visible: creás "Sin TACC" en verde y en la
tabla sale gris. La celda pasa a usar el color de la etiqueta, resuelto contra
`state.etiquetas` por slug.

Requiere agregar `.tag.c-dorado` … `.c-negro` a `app/admin/admin.css`. Las clases existen
en `app/impasto.css` pero **el panel no carga esa hoja**: `admin/layout.tsx` importa solo
`admin.css`. Es el mismo error que el plan anterior advirtió al revés (`--a-sidebar` existe
solo en el panel).

Un slug que no esté en `etiquetas` —un huérfano— se pinta gris y se muestra igual. No se
oculta: dejarlo invisible es justamente lo que el borrado de etiquetas se cuida de evitar.

## Guardado

Función nueva en el store, `setProductTags(id, tags)`:

1. Actualiza el estado local (la celda responde al instante).
2. `PUT /api/admin/productos/{_dbId}` con `{ tags }`.
3. **Si la respuesta no es OK, revierte el estado local y avisa.**

El punto 3 es lo que `updateProduct` no hace: toastea "Producto actualizado" aunque el PUT
falle. No se toca `updateProduct` —el switch de Activo y el editor siguen igual, y
cambiarlo es alcance de otra tarea— pero esta operación no puede heredar ese defecto: en
una pantalla cuyo propósito es etiquetar en tanda, creer que guardaste sin haber guardado
es el peor resultado posible.

## Alcance

- El control aparece en **todas** las filas, bebidas incluidas. Cualquier etiqueta va en
  cualquier producto: `mostrar_badge` decide dónde se ve el cartelito, no dónde se puede
  marcar. Es lo que ya fijó el spec anterior.
- El editor de producto **no cambia**. Sus botones siguen siendo la otra vía.
- El sitio público **no cambia**: la resolución del badge ya vive en `resolverBadge()` y
  esto solo escribe `productos.tags`.

## Qué queda fuera

- **Etiquetar en lote** (seleccionar varias filas y aplicar una etiqueta a todas). Es el
  paso siguiente natural, pero necesita selección múltiple en la tabla, que hoy no existe.
- **Crear una etiqueta desde el panelito.** Para eso está la sección Etiquetas.
- **Editar `popular` desde la celda.** Sigue estando solo en el editor.

## Verificación

`productos` es una tabla global compartida con el proyecto paralelo. La tabla del panel ya
filtra por `esCategoriaImpasto`, así que el control solo puede escribir en filas de
Impasto, pero conviene confirmarlo contra la base después de probar.

- Que la fila muestre los cartelitos con el color elegido en la sección Etiquetas.
- Que marcar y desmarcar cambie `productos.tags` y nada más de la fila.
- Que los tres productos con dos etiquetas conserven las dos al tocar otra cosa.
- Que las pestañas del sitio sigan en Todas 32, Clásicas 23, Gourmet 9, Veggie 15,
  Picantes 1 mientras no se cambie ningún tag a propósito.
- Que `productos` siga teniendo 65 filas.

**Esta verificación necesita sesión de admin.** El panel está detrás del login y las
credenciales son del dueño, así que la prueba end-to-end no se puede automatizar.
