/**
 * Logo del sitio (Pizzas a la piedra · Puerto Iguazú, 01/10/2026).
 *
 * Las dos variantes derivan de `4.jpg` del bucket `DB`: es el mismo dibujo que
 * `5.jpg`, pero con fondo blanco liso. `5.jpg` trae el damero de "transparente"
 * horneado en los píxeles, porque un JPG no tiene canal alfa. A las derivadas
 * se les quitó el fondo y viven en `public/`, por ser assets fijos del sitio.
 *
 * Las dos comparten medidas; si se regeneran con otra proporción, actualizar
 * `ancho`/`alto`, o `next/image` deforma el hueco antes de que cargue.
 */
export type VarianteLogo = { src: string; ancho: number; alto: number };

/** Para fondos claros (navbar): llama terracota y texto marrón, sin fondo. */
export const LOGO: VarianteLogo = { src: "/logo.png", ancho: 1200, alto: 383 };

/**
 * Para fondos oscuros (footer sobre `--ink-deep`): todo en blanco, llama incluida.
 * El hueco de la llama es transparente, así que la espiga se lee contra el fondo.
 */
export const LOGO_BLANCO: VarianteLogo = { src: "/logo-blanco-v2.png", ancho: 1200, alto: 383 };
