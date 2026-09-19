/**
 * Logo del sitio, servido desde el bucket `DB` del storage de InsForge.
 *
 * La URL pública de un objeto se arma como
 * `<base>/api/storage/buckets/<bucket>/objects/<key>`. Devuelve un 302 hacia
 * una URL firmada de S3; `next/image` sigue el redirect sin problema, pero el
 * host tiene que estar habilitado en `images.remotePatterns` (`next.config.ts`).
 *
 * Cada variante lleva sus propias medidas porque **no comparten proporción**:
 * el plano es 3.13:1 y el del degradé 3.00:1. Pasarle a `next/image` el
 * width/height de la otra deforma el hueco antes de que la imagen cargue.
 */
const BASE = "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects";

export type VarianteLogo = { src: string; ancho: number; alto: number };

/** Llama plana, terracota sólido. */
export const LOGO_PLANO: VarianteLogo = { src: `${BASE}/2.png`, ancho: 2000, alto: 639 };

/** Llama con degradé y sombreado. */
export const LOGO_DEGRADE: VarianteLogo = { src: `${BASE}/3.png`, ancho: 2172, alto: 724 };

/**
 * El plano entero en blanco, llama incluida, para el footer. El original tiene
 * el texto en rgb(21,12,5) y sobre `--ink-deep` (#12100d) da 1.02:1 de
 * contraste, o sea invisible.
 *
 * Se generó desde `2.png` pintando todo de #fff y conservando el canal alfa.
 * La espiga se sigue leyendo porque el hueco de la llama es transparente: deja
 * ver el fondo oscuro entre las dos. Si se vuelve a generar desde otro dibujo,
 * mirar que ese hueco exista, o la espiga se funde con la llama.
 *
 * Vive en `public/`, no en el storage: es un asset fijo del sitio.
 */
export const LOGO_BLANCO: VarianteLogo = { src: "/logo-blanco.png", ancho: 2000, alto: 639 };

/**
 * El del header. Cambiar acá entre LOGO_PLANO y LOGO_DEGRADE.
 *
 * Va el plano: el degradé se probó en producción el 23/08/2026 y se descartó.
 * Además es el que le corresponde a LOGO_BLANCO, así que el header y el footer
 * muestran el mismo dibujo.
 */
export const LOGO: VarianteLogo = LOGO_PLANO;
