# Guía de armado para la cocina (`/cocina`)

Fecha: 2 de octubre de 2026. Aprobado por el dueño en el chat el mismo día.

## Para qué

Los cocineros arman las pizzas siguiendo la carta de Impasto. Hoy esa información vive en
el recetario y en la memoria del dueño. Queremos una página que cualquiera de la cocina
abra en una tablet o en el teléfono y que muestre, por cada pizza, cómo se arma: foto,
base, ingredientes con gramos y lo que va después del horno, más las recetas de las
preparaciones (mieles, pestos, provenzal, manteca de ajo).

## Decisiones del dueño

- **Una ruta sola: `/cocina`.** Sin login, sin código en el link y sin ningún botón o
  enlace desde el sitio. Se le avisó dos veces que quien escriba la dirección verá las
  recetas; eligió esa opción por simpleza.
- **Contenido en el código**, no en la base. Con la ruta abierta, guardarlo en la base no
  protegía nada: el repo es público y la ruta es adivinable. A cambio, la página funciona
  aunque se caiga la base, y cada cambio de receta es un deploy.
- **Solo lo confirmado.** Lo marcado "a probar" en la hoja de trabajo queda afuera hasta que
  el dueño lo apruebe.

## Qué incluye

- `app/cocina/page.tsx`: página de servidor, sin consultas a la base.
- `app/cocina/layout.tsx`: `noindex, nofollow` (misma defensa doble que `/pedido` y
  `/admin`) y los estilos propios.
- `app/cocina/cocina.css`: estilos con prefijo `ck-`, para no tocar el sitio ni el panel.
- `lib/guia-cocina.ts`: los datos y sus tipos. Sin importar la base ni React, para poder
  testearse con `tsx`.
- `tests/guia-cocina.test.ts`, agregado a `pnpm test`.

No se toca: `robots.ts` (nombrar `/cocina` ahí anunciaría que existe), `sitemap.ts`, la
base de datos, el recetario ni Carro Fogón.

## Contenido de cada pizza

Nombre, estado (`venta` o `proximamente`), base (salsa de tomate, crema de hongos secos,
manteca de ajo confitado o sin base), ingredientes con cantidad, lo que va después del
horno, nota de armado (solo si es una instrucción de armado) y los nombres de las
preparaciones que usa. La foto sale de `REAL_PRODUCT_PHOTOS` por id de producto y se muestra
con `next/image`: el bucket ya está permitido en `next.config.ts` y en el CSP.

Entran 18 pizzas: las 10 de la carta de hoy y 8 "Próximamente". Las 3 nuevas con tomate
(Pomodorini, Pesto Rosso, Puttanesca) quedan afuera porque sus gramos son propuestas para
probar. Nada de costos, precios, pendientes ni notas del dueño.

## Preparaciones

Receta, para qué pizza va y conservación. Solo las que usan las 18 pizzas: miel picante,
miel de ajo, crema de hongos secos, golf de la casa, pesto de albahaca, provenzal, ajo
confitado, cebolla dorada, morrones asados, aceto reducido, almendras tostadas, cherry
confitados, manteca de ajo confitado, pesto de pistacho y pesto de verdeo. La salsa de
morrón asado, el pesto rosso, la olivada y el tomate seco quedan afuera. El chimichurri
no tiene receta cargada: la pizza lo nombra y la página no inventa una.

La base de todas: bollo y salsa de tomate (150 g por pizza). El agua del lote de masa no
entra: en el audio del 1 de octubre estaba sin confirmar.

## Pruebas

`tests/guia-cocina.test.ts` comprueba:

1. Cada pizza tiene al menos un ingrediente con cantidad.
2. Los nombres de pizza no se repiten.
3. Cada `productoId` existe en `REAL_PRODUCT_PHOTOS`.
4. Cada preparación que nombra una pizza existe, y cada preparación la usa alguna pizza.
5. Ningún texto visible contiene `$` ni las palabras "costo", "precio", "recetario" o
   "a probar": evita filtrar cifras o notas internas.

Después de las pruebas: TypeScript, `pnpm build` y revisión en el navegador local.

## Publicación

Commit en `main` con solo los archivos de esta tarea (hay archivos ajenos sin seguimiento:
`.codex/`, `docs/impresion-termica.md`, `migrations/20260922153137_compras-items.sql` y
`scripts/`; no se tocan). Rebase si el remoto avanzó, tests otra vez y push. Netlify
despliega solo. Después se verifica `www.impastopizzas.com/cocina` y que `/cocina` no esté
en `robots.txt` ni en el sitemap.

## Fuera de alcance

Código de acceso, login, editor de contenido, contenido en la base y las 3 pizzas nuevas
con tomate. Si alguna vez se quiere cualquiera de eso, es un cambio aparte.
