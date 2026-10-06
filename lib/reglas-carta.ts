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
 * Partida en dos piezas componibles porque no todos los lectores necesitan las
 * dos frases.
 *
 * **El bot necesita las dos y no se le pueden sacar**: es el único que cotiza
 * de memoria, así que sin "se cobra la más cara" sumaría dos precios donde el
 * carrito cobra uno, y le mentiría al cliente.
 *
 * En el sitio, en cambio, la regla **no se enuncia**: el modal
 * (`components/cart/HalfModal.tsx`) muestra el "Total" real y lo recalcula con
 * cada mitad elegida, así que el precio está a la vista antes de agregar nada
 * al carrito. Decirlo además con palabras ("sin recargo", "sin costo extra")
 * invitaba a comparar precios donde no hay nada que comparar. Por eso hoy
 * `COMO_SE_COBRA_MITAD_Y_MITAD` solo se usa para armar `REGLA_MITAD_Y_MITAD`
 * (bot y FAQ); se deja separada para que el día que alguna vista la necesite
 * no vuelva a escribirse a mano.
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

/**
 * El precio más bajo de la carta de pizzas, para el "desde $X" del sitio.
 * Nunca se escribe a mano: los precios cambian, así que se toma de la carta
 * viva en cada carga. Deja afuera las agotadas (no se puede ofrecer lo que no
 * se vende) y cualquier precio 0 o inválido. Sin ninguna pizza que cumpla,
 * devuelve `null` y el sitio no muestra la frase.
 */
export function precioDesde(pizzas: readonly { precio: number; disponible: boolean }[]): number | null {
  const precios = pizzas
    .filter((p) => p.disponible !== false && Number.isFinite(p.precio) && p.precio > 0)
    .map((p) => p.precio);
  return precios.length > 0 ? Math.min(...precios) : null;
}

/** "6, 12, 24" → "6, 12 o 24", para que el prompt lea natural. */
export function listaConO(nums: readonly number[]): string {
  return nums.join(", ").replace(/, (\d+)$/, " o $1");
}
