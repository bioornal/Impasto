/**
 * Los argumentos de venta de la marca, en un solo lugar.
 *
 * Existe para que **la misma afirmación no esté escrita dos veces**. Lo leen el
 * prompt del chatbot (`lib/chat-prompt.ts`) y las secciones del sitio: si se
 * cambia el copy acá, el bot cambia con él. Copiar la frase al prompt lo
 * desincronizaría el día que se edite el sitio, sin que nada lo detecte.
 *
 * **Solo va acá lo que es verificablemente cierto del negocio.** Un tiempo de
 * entrega promedio, una cantidad de reseñas o un año de fundación son
 * afirmaciones que el bot va a sostener frente a un cliente: no entran hasta
 * que el dueño las confirme.
 */
export interface ArgumentoMarca {
  /** Titular corto. Es lo que muestra la sección Nosotros del sitio. */
  titulo: string;
  /** La explicación. */
  detalle: string;
}

export const ARGUMENTOS_MARCA: ArgumentoMarca[] = [
  { titulo: "Fermentación en frío", detalle: "48 hs con harina de fuerza" },
  { titulo: "Estirado a mano", detalle: "En el momento, sin moldes" },
  { titulo: "Horno a la piedra", detalle: "400 °C en 2 a 5 minutos" },
];
