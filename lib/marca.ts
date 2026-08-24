/**
 * Los argumentos de venta de la marca, en un solo lugar.
 *
 * Existe para que **la misma afirmación no esté escrita dos veces**. Lo leen el
 * prompt del chatbot (`lib/chat-prompt.ts`) y las secciones del sitio
 * (`Story.tsx`, `Hero.tsx`, `PizzaList.tsx`, `EmpanadasSection.tsx`,
 * `Header.tsx`): si se cambia el copy acá, el bot cambia con él. Escribir la
 * frase de nuevo en un componente lo desincronizaría el día que se edite acá,
 * sin que nada lo detecte.
 *
 * **Solo va acá lo que es verificablemente cierto del negocio.** Un tiempo de
 * entrega promedio, una cantidad de reseñas o un año de fundación son
 * afirmaciones que el bot va a sostener frente a un cliente: no entran hasta
 * que el dueño las confirme.
 *
 * Cada componente muestra el argumento en un formato distinto — Story lo
 * lista como titular + detalle, Hero lo reduce a una cifra grande, PizzaList
 * y Header lo insertan en una frase corrida — así que cada uno pide los
 * argumentos puntuales que necesita por `id`, con `argumento()`, en vez de
 * recorrer el array entero. Eso es lo que evita que agregar un argumento
 * nuevo cambie, de rebote, lo que ya se veía en una sección que no lo pidió.
 */
export interface ArgumentoMarca {
  /** Slug estable. No se muestra: es lo que usa un componente para pedir un
   *  argumento puntual con `argumento()`, sin depender del orden del array. */
  id: string;
  /** Titular corto. Es lo que muestra la sección Nosotros del sitio. */
  titulo: string;
  /** La explicación, en una frase. */
  detalle: string;
  /**
   * Versión corta y numérica, para vistas compactas (el Hero, que muestra un
   * número grande y una etiqueta abajo). No todos los argumentos tienen un
   * número que mostrar así — "Estirado a mano" no lo necesita.
   */
  cifra?: string;
}

export const ARGUMENTOS_MARCA: ArgumentoMarca[] = [
  {
    id: "fermentacion",
    titulo: "Fermentación en frío",
    detalle: "48 hs con harina de fuerza",
    cifra: "48 hs",
  },
  {
    id: "estirado",
    titulo: "Estirado a mano",
    detalle: "En el momento, sin moldes",
  },
  {
    id: "horno",
    titulo: "Horno a la piedra",
    detalle: "400 °C en 2 a 5 minutos",
    cifra: "400 °C",
  },
  {
    id: "porciones",
    titulo: "Ocho porciones",
    detalle: "Cada pizza rinde ocho porciones",
  },
  {
    id: "muzzarella",
    titulo: "Muzzarella de primera calidad",
    detalle: "Abundante en cada pizza",
  },
  {
    id: "empanadas-peso",
    titulo: "Empanadas al horno",
    detalle: "160 g cada una",
    cifra: "160 g",
  },
  {
    id: "repulgue",
    titulo: "Repulgue a mano",
    detalle: "Cada empanada se cierra a mano",
  },
];

/**
 * Busca un argumento puntual por `id`. Tira si no existe, a propósito: un
 * `id` que no matchea es un typo, y silenciarlo con `undefined` lo dejaría
 * pasar como una sección vacía en vez de romper donde se lo puede ver.
 */
export function argumento(id: string): ArgumentoMarca {
  const encontrado = ARGUMENTOS_MARCA.find((a) => a.id === id);
  if (!encontrado) {
    throw new Error(`No existe un argumento de marca con id "${id}"`);
  }
  return encontrado;
}

/** Un argumento de marca que garantiza tener `cifra`, para quien la necesite
 *  sin volver a chequear `undefined`. */
export interface ArgumentoMarcaConCifra extends ArgumentoMarca {
  cifra: string;
}

/**
 * Como `argumento()`, pero para el subconjunto de llamadas que meten
 * `.cifra` dentro de un template literal (`` `${x.cifra}` ``). TypeScript no
 * marca `undefined` ahí adentro -un `cifra` opcional interpolado compila
 * igual- así que sacarle la cifra a un argumento en `ARGUMENTOS_MARCA` que
 * algún lugar interpola pasaría desapercibido hasta producción: imprimiría
 * literalmente "undefined" en un `<meta description>` o un JSON-LD.
 *
 * Este helper hace fallar esa edición acá, ruidosamente, en el momento en
 * que se pide el argumento, no en el momento en que se renderiza el string.
 */
export function argumentoConCifra(id: string): ArgumentoMarcaConCifra {
  const encontrado = argumento(id);
  if (encontrado.cifra === undefined) {
    throw new Error(`El argumento de marca "${id}" no tiene "cifra", pero algo la interpola`);
  }
  return encontrado as ArgumentoMarcaConCifra;
}
