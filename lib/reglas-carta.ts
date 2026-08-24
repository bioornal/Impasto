/**
 * Reglas de cotización que tienen que decir lo mismo en dos lugares a la vez:
 * el carrito, que es el que cobra, y el prompt del vendedor, que es el que
 * promete. Viven acá juntas para que quien cambie el cálculo vea, en el mismo
 * archivo, la frase que el bot repite — y no se desincronicen.
 *
 * No importa `db` ni nada que lo importe (`@/lib/insforge`, `@/lib/catalog`,
 * `@/lib/business-server`), ni componentes de React: lo usa `lib/chat-prompt.ts`,
 * que se testea con `tsx`, y `components/cart/HalfModal.tsx`.
 */

/**
 * Mitad y mitad: se cobra la mitad más cara, sin recargo.
 * Es lo que hace `components/cart/HalfModal.tsx` al armar el precio del ítem.
 */
export const precioMitadYMitad = (a: number, b: number): number => Math.max(a, b);

/**
 * Partida en dos piezas componibles porque no las usan los mismos lectores
 * con el mismo alcance. El bot necesita las dos frases: primero decir que se
 * puede pedir, después cómo se cobra. El modal (`components/cart/HalfModal.tsx`)
 * solo necesita la segunda — el cliente ya está adentro del modal, así que
 * "se puede pedir" sobra ahí. Repetir la frase completa a mano en el modal, o
 * cortarla ahí con un `.split()`, era la misma clase de copia que esta regla
 * existe para evitar.
 */
export const SE_PUEDE_PEDIR_MITAD_Y_MITAD = "Se puede pedir una pizza mitad y mitad de dos gustos.";
export const COMO_SE_COBRA_MITAD_Y_MITAD = "Se cobra el precio de la más cara, sin recargo.";

/**
 * La frase completa que lee el bot en el prompt. El cliente la lee partida:
 * ver `SE_PUEDE_PEDIR_MITAD_Y_MITAD` y `COMO_SE_COBRA_MITAD_Y_MITAD` arriba.
 */
export const REGLA_MITAD_Y_MITAD = `${SE_PUEDE_PEDIR_MITAD_Y_MITAD} ${COMO_SE_COBRA_MITAD_Y_MITAD}`;

/** Tamaños de caja en los que se venden las empanadas. Nunca sueltas. */
export const TAMANIOS_CAJA_EMPANADAS = [6, 12, 24] as const;

/**
 * Refleja `priceFor()` de `components/sections/EmpanadasSection.tsx:28-33`,
 * que es la fuente real de lo que cobra el carrito — esto es una copia
 * deliberada de esa condición para que el prompt la pueda usar sin importar
 * un componente de React.
 *
 * Ahí, apenas CUALQUIER empanada de la carta tiene precio unitario cargado,
 * el total de la caja sale de sumar el precio de cada empanada elegida, y el
 * precio de caja fijo (`empanadaBoxPrices`) se ignora por completo, aunque
 * exista. La tabla de cajas fija solo se usa cuando NINGUNA empanada tiene
 * precio unitario.
 *
 * Hoy las 9 empanadas de Impasto tienen precio unitario cargado, así que en
 * la práctica la tabla de cajas nunca se usa — pero la condición es esta, no
 * "si hay precio de caja cargado".
 */
export function seCobraPorUnidad(empanadas: { precio?: number }[]): boolean {
  return empanadas.some((e) => Number(e.precio) > 0);
}

/** "6, 12, 24" → "6, 12 o 24", para que el prompt lea natural. */
export function listaConO(nums: readonly number[]): string {
  return nums.join(", ").replace(/, (\d+)$/, " o $1");
}
