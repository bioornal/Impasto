# Ficha de producto: ver la foto en grande y pedir desde ahí

Fecha: 28/09/2026. Aprobado por el dueño en la misma fecha.

## Problema

Las fotos de la carta no se pueden ampliar. En mobile —la principal fuente de pedidos— cada
pizza de la lista se ve en una miniatura de 72–76 px; solo la destacada se ve grande. Tocar una
foto no hace nada, en ninguna pantalla. El cliente que quiere mirar mejor una pizza antes de
pedirla no tiene cómo.

## Decisiones del dueño

- Al tocar la foto se abre una **ficha para pedir**, no un visor de fotos: foto grande, nombre,
  precio, descripción y los botones para agregar. El que se tentó mirando la foto pide sin cerrar.
- En mobile: **cerrar deslizando hacia abajo** y **deslizar a los costados** para pasar al
  producto anterior o siguiente.
- **Sin pellizcar para acercar.** Las fotos reales miden 1200 × 896 px (Bianca ai Funghi,
  1448 × 1086): es lo que un teléfono muestra a todo el ancho (375 px × densidad 3). Acercar más
  pixelaría. Se puede sumar si algún día se suben fotos más grandes.
- **Componente propio, sin librerías** de lightbox.
- En escritorio también (el pedido es "con un clic"), pero el resto de escritorio no cambia: ver
  "Escritorio" y la verificación.

## Qué ve el cliente

### Mobile (≤ 760 px)

Una hoja que sube desde abajo, sobre el fondo oscurecido:

1. Manija arriba y contador `4 / 19` (posición dentro de la lista que se está recorriendo).
2. La foto a todo el ancho, proporción 4:3.
3. Los cartelitos que ya muestra la tarjeta (★ Más pedida, Veggie, Picante; en empanadas, la
   etiqueta), nombre, precio y la descripción **completa** (en las filas se corta). Los
   cartelitos van junto al nombre y no sobre la foto: la etiqueta de empanadas es de contorno,
   pensada para fondo crema, y sobre una foto no se lee.
4. Pie fijo con la acción, según el tipo (ver "Por tipo de producto").
5. Botón ✕ visible para cerrar (no todos descubren el arrastre).

Gestos:

- **Arrastrar hacia abajo** desde la manija o la foto cierra (mismo umbral que el carrito:
  120 px, o un gesto rápido).
- **Deslizar a los costados** sobre la foto pasa al producto anterior o siguiente. La foto sigue
  al dedo; al soltar, completa el paso si se movió más de un cuarto del ancho o fue un gesto
  rápido, y si no, vuelve a su lugar. En el primero y el último no hay vuelta circular: la foto
  se resiste (se mueve un tercio de lo que se mueve el dedo) y vuelve.
- El texto de la ficha se desplaza normal si la descripción no entra.
- Con `prefers-reduced-motion`, los pasos y el cierre son instantáneos.

**Cómo se abre en mobile:** tocando la foto en cualquier tarjeta, y en las filas de pizzas y
bebidas también tocando el nombre o la descripción (la miniatura sola es un blanco chico). Los
botones `+`, `− n +` y `½½` de la fila siguen haciendo lo mismo que hoy y **no** abren la ficha.
La foto de la tarjeta destacada lleva un pequeño ícono de "ampliar" en una esquina como pista;
las filas no, para no ensuciarlas.

### Escritorio (> 760 px)

Ventana centrada sobre el fondo oscurecido: foto grande a la izquierda, ficha a la derecha
(nombre, cartelitos, precio, descripción, acción), contador y flechas ‹ › a los costados.
Flechas del teclado para pasar, Esc o clic en el fondo para cerrar, ✕ arriba a la derecha.

En las tarjetas, al pasar el mouse por la foto: cursor de lupa (`zoom-in`) y un ícono de lupa
en una esquina. Nada más cambia en la tarjeta.

### Atrás del teléfono

Abrir la ficha agrega una entrada al historial (misma URL, sin recargar). El botón Atrás de
Android —o el del navegador— **cierra la ficha** en vez de sacar al cliente del sitio. Pasar de
producto no agrega entradas: un Atrás siempre cierra. Cerrar desde la interfaz consume esa
entrada, para no dejar un Atrás "vacío".

## Por tipo de producto

La ficha recorre **la misma lista que el cliente está viendo en esa sección**, en el mismo orden:

| Sección | Lista que recorre | Acción del pie |
|---|---|---|
| Pizzas | La lista filtrada y buscada de `PizzaList` (incluida la destacada primero) | `Agregar` → `− n +` si ya está; `½½` al lado |
| Empanadas | Todas las empanadas de la grilla | `− n +` de la caja, con el mismo tope (`selected >= tier`) y el avance de la caja ("3 de 12 elegidas", como la barra de abajo) |
| Bebidas | Todas las bebidas | `Agregar` → `− n +` si ya está |

- La acción usa **las mismas funciones** que la tarjeta (`add`, `incKey`, `decKey`, `onPick`) y
  el mismo aviso ("X agregada"). La ficha no tiene reglas propias de venta: si la tarjeta deja
  agregar, la ficha también.
- **½½** cierra la ficha y abre la mitad y mitad con esa pizza (`openHalf(pizza)`).
- **Agotado:** la ficha abre, muestra la foto y la barra "Agotado", y el botón queda
  deshabilitado con el texto "Agotado".
- Todo producto abre ficha, tenga foto real, foto de banco o ilustración dibujada: la ficha
  muestra **la misma imagen que la tarjeta**.
- Empanadas: el precio muestra lo mismo que la tarjeta (precio unitario si existe, si no el
  peso).

## Cómo se construye

### Lógica pura — `lib/ficha.ts` (testeable con `tsx`, sin React ni `db`)

- `vecino(indice, total, sentido)`: índice anterior o siguiente, o `null` en los bordes.
- `ejeDelGesto(dx, dy)`: `null` hasta que el dedo se mueve 10 px; después `"horizontal"` o
  `"vertical"` según qué desplazamiento domina. Una vez decidido, el eje queda fijo durante el
  gesto (así un deslizamiento en diagonal no mueve la foto en dos direcciones).
- `resolverSoltar({ eje, dx, dy, dt, ancho, hayAnterior, haySiguiente })`:
  `"anterior" | "siguiente" | "cerrar" | "quedarse"`. Umbrales: horizontal, un cuarto del ancho
  o velocidad promedio ≥ 0,3 px/ms; vertical hacia abajo, 120 px o velocidad ≥ 0,3 px/ms. Un
  gesto rápido cuenta solo si recorre al menos 30 px (si no, un toque nervioso cerraría la
  ficha). La primera versión pedía 0,5 px/ms y no pasaba un deslizamiento corto y decidido
  medido en Chrome (70 px en 163 ms).
- `resistencia(dx, hayVecino)`: el desplazamiento visible (`dx`, o `dx / 3` en un borde).

### Imagen — una sola resolución

Hoy cada ilustración (`PizzaIllus`, `EmpanadaIllus`, `DrinkIllus`) resuelve su URL adentro. La
ficha necesita la misma URL, así que se reusan esos mismos componentes dentro de la ficha (con
`loading="eager"` para la foto visible) en vez de duplicar la resolución. La miniatura ya
descargó la foto original, así que en general abre al instante.

Las miniaturas usan `loading="lazy"`: una fila lejos de la pantalla puede no haber descargado
su foto. Al mostrar el producto `i`, la ficha **precarga** las fotos de `i − 1` e `i + 1`
(`new Image().src = url`) para que el deslizamiento no muestre un hueco. Para eso se exporta
desde `lib/stock-images.ts` una función que devuelve la URL por tipo, la misma que ya usan las
ilustraciones.

### Componente — `components/ui/ProductSheet.tsx`

Solo presentación y gestos. Recibe:

- `items`: lista normalizada `{ id, tipo: "pizza" | "empanada" | "bebida", nombre, desc?,
  precioTexto, badges, agotado, tags? }`;
- `indice` y `onIndice(i)`;
- `accion`: el nodo del pie, que arma quien abre la ficha (así la ficha no conoce el carrito ni
  la caja de empanadas);
- `onClose`.

Mobile y escritorio son el mismo componente con dos disposiciones por CSS (corte 760 px, igual
que el resto del sitio). Los gestos de arrastre y deslizamiento se activan solo con
`matchMedia("(max-width: 760px)")`, como la hoja del carrito.

Accesibilidad: `role="dialog"`, `aria-modal="true"` y `aria-label` con el nombre del producto;
foco atrapado mientras está abierta (mismo patrón que `CartDrawer`); al cerrar, el foco vuelve
al elemento que la abrió. En mobile el fondo no se desplaza; en escritorio queda como con el
carrito y la mitad y mitad (sin bloquear), porque ocultar la barra de desplazamiento correría el
ancho de la página. El contador se anuncia con `aria-live="polite"`
al pasar de producto. Las zonas de arrastre llevan `touch-action:none` (sin eso el navegador
toma el gesto como scroll y lo cancela, como pasó con el carrito).

### Estado y cableado

- `Shell` guarda la ficha abierta: `{ seccion, ids, indice } | null`. Guarda **ids**, no
  objetos: cada render busca el producto vivo en `data`, así la cantidad en el carrito y el
  estado agotado están siempre al día. El catálogo llega como props estáticas de la página: un id
  no desaparece con la ficha abierta (si pasara, la ficha no se muestra).
- `PizzaList`, `EmpanadasSection` y `Bebidas` reciben `onVerFicha(ids, indice)` y lo llaman con
  la lista que están mostrando.
- Disparador: dentro de cada contenedor de foto (`.p-media`, `.lrow-media`, `.p-feat-media`,
  `.p-row-media`, `.emp-media`, `.drink-media`) se agrega un `<button className="media-zoom">`
  transparente, posicionado encima de toda la foto, con `aria-label="Ver <nombre> en grande"`.
  Así el contenedor, su tamaño y sus estilos quedan iguales. Los cartelitos ya tienen
  `pointer-events:none`; el precio sobre la foto también lo lleva, para que el toque llegue al
  botón.
- En las filas mobile (`.p-row-main`, y el bloque de texto de la fila de bebida) el toque en el
  texto también abre la ficha, con un `onClick` que ignora los toques sobre botones. Para lector
  de pantalla y teclado, el control es el botón de la foto: no se duplica.
- Historial: al abrir, `history.pushState({ fichaImpasto: true }, "")`; un listener de
  `popstate` cierra la ficha. Cerrar desde la interfaz llama a `history.back()` si la entrada
  de la ficha sigue arriba, y el cierre real ocurre en el `popstate`. **Riesgo a verificar:** el
  router de Next 16 también escucha `popstate`; con la misma URL no debería navegar, pero hay
  que comprobarlo en el navegador (ni recarga, ni salto de scroll, ni pérdida del carrito).

### Escritorio no cambia salvo lo pedido

El botón `.media-zoom`, el cursor y el ícono de lupa, y la ventana de la ficha son lo único
nuevo en escritorio. El `transform:scale(1.04)` del hover de la foto se conserva.

## Casos borde

- Abrir la ficha con una búsqueda activa: recorre solo los resultados. Mientras la ficha está
  abierta, la lista no puede cambiar (el filtro y la búsqueda quedan detrás).
- La ficha queda por encima del header, la barra inferior y el botón del chat: mientras está
  abierta no se puede abrir el carrito ni otra cosa. La única salida hacia otro panel es ½½, que
  cierra la ficha antes de abrir la mitad y mitad.
- El aviso "X agregada" se ve por encima de la ficha (hoy se ubica sobre la barra inferior,
  que queda tapada).
- Una foto que falla muestra la ilustración dibujada, igual que hoy en la tarjeta.
- Un toque sin arrastre sobre la foto no hace nada (no cierra por error).
- Pantallas muy bajas (horizontal en el teléfono): la foto se achica para que el pie con la
  acción siga visible; la ficha nunca tapa el botón de agregar.

## Verificación

- `tests/ficha.test.ts` para `lib/ficha.ts` (vecinos y bordes, eje del gesto, umbrales de
  soltar, resistencia), sumado al script `pnpm test`.
- `pnpm test`, TypeScript, `pnpm exec eslint` sobre los archivos tocados y `pnpm build`.
- Chrome real (headless por CDP si el panel del navegador está oculto), con
  `/api/cart/draft` interceptado para no escribir en `carritos`:
  - 375 px: abrir desde la destacada, desde una fila (foto y texto), desde empanadas y bebidas;
    deslizar a los costados en el medio y en los bordes; cerrar arrastrando, con ✕, con el fondo
    y con Atrás; agregar, sumar y restar desde la ficha y ver el cambio en la fila; ½½ abre la
    mitad y mitad; producto agotado; capturas.
  - 1280 px: abrir con clic, flechas del teclado, Esc, clic en el fondo, Atrás; capturas.
  - Atrás no recarga ni mueve el scroll de la carta.
  - Escritorio: comparar los estilos calculados de página, carrito y checkout a 1280, 1000 y
    800 px contra la hoja de `HEAD` (con los elementos nuevos ocultos). Tiene que dar 0
    diferencias fuera de los elementos nuevos.
- Al terminar, carrito de prueba vacío y `GET /api/cart/draft` sin borrador.

## Fuera de alcance

- Pellizcar y doble toque para acercar.
- Una URL propia por producto (`/pizza/...`) para compartir o para SEO.
- Más de una foto por producto.
- Cambios en el panel, la base o las fotos.
