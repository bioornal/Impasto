import { ARGUMENTOS_MARCA } from "@/lib/marca";
import type { BusinessConfig } from "@/lib/business";
import type { EstadoTienda } from "@/lib/hours";
import type { CatalogData } from "@/types";

/**
 * El prompt de sistema del vendedor.
 *
 * Todo lo que el bot sabe está acá adentro: no consulta nada durante la charla.
 * Eso es deliberado. Con la carta cerrada delante **no puede inventar un
 * producto**, y como `getCatalogData()` ya filtra por `CATEGORIAS_IMPASTO`, es
 * estructuralmente imposible que le ofrezca a un cliente de pizza una
 * hamburguesa del Carro Fogón.
 *
 * No importa `db` ni nada que lo importe, para poder testearlo con `tsx`.
 */

const pesos = (monto: number) => `$${Math.round(monto).toLocaleString("es-AR")}`;

interface ItemCarta {
  nombre: string;
  precio?: number;
  desc?: string;
  tags: string[];
  disponible: boolean;
}

/**
 * Los tags van tal cual salen de la base. No se traducen ni se interpretan: el
 * `slug` es el dato. Cualquier mapeo a mano sería una copia que se
 * desincroniza el día que el dueño crea una etiqueta nueva desde el panel.
 *
 * Van al prompt aunque la descripción "ya se entienda": que una pizza sea
 * vegetariana lo dice `tags`, y hacer que el modelo lo deduzca del texto es
 * pedirle que adivine algo que ya sabemos con certeza.
 */
function linea(item: ItemCarta): string {
  const precio = item.precio ? ` — ${pesos(item.precio)}` : "";
  const agotado = item.disponible ? "" : " [AGOTADO]";
  const tags = item.tags.length > 0 ? ` [${item.tags.join(", ")}]` : "";
  const desc = item.desc ? `: ${item.desc}` : "";
  return `- ${item.nombre}${precio}${agotado}${tags}${desc}`;
}

/** Una sección vacía no se anuncia: anunciarla invita al bot a inventar. */
function seccion(titulo: string, items: ItemCarta[]): string {
  if (items.length === 0) return "";
  return `\n${titulo}\n${items.map(linea).join("\n")}\n`;
}

/** Las cajas de empanadas: de lo que más se pregunta, y sale de la base. */
function cajas(data: CatalogData): string {
  const tamanios = ([6, 12, 24] as const).filter((n) => data.empanadaBoxPrices[n] > 0);
  if (tamanios.length === 0 || data.empanadas.length === 0) return "";
  const lista = tamanios.map((n) => `caja x${n} ${pesos(data.empanadaBoxPrices[n])}`).join(" · ");
  return `\nCAJAS DE EMPANADAS\n- ${lista}\n`;
}

/**
 * Las promos activas, las mismas que el sitio está anunciando en el ticker.
 * Sin esto, el bot diría "no tenemos promos" mientras la página anuncia una.
 */
function promociones(data: CatalogData): string {
  if (data.promos.length === 0) return "";
  const lista = data.promos.map((promo) => `- ${promo.titulo}: ${promo.desc}`).join("\n");
  return `\nPROMOCIONES VIGENTES\n${lista}\n`;
}

function carta(data: CatalogData): string {
  return [
    seccion("PIZZAS", data.pizzas),
    seccion("EMPANADAS", data.empanadas),
    cajas(data),
    seccion("BEBIDAS", data.bebidas.map((bebida) => ({ ...bebida, desc: "", tags: [] }))),
    promociones(data),
  ].join("");
}

/** Los argumentos de marca, si los hay. Nunca escritos a mano acá. */
function sobreElProducto(): string {
  if (ARGUMENTOS_MARCA.length === 0) return "";
  const lista = ARGUMENTOS_MARCA.map((a) => `- ${a.titulo}: ${a.detalle}`).join("\n");
  return `\nSOBRE EL PRODUCTO\n${lista}\n`;
}

export function promptVendedor(
  data: CatalogData,
  business: BusinessConfig,
  estado: EstadoTienda,
): string {
  const local = estado.abierto
    ? `El local está ABIERTO ahora. Horario: ${business.hours}.`
    : `El local está CERRADO ahora. ${estado.motivo} Invitá igual a mirar la carta y a volver cuando abra.`;

  return `Sos el asistente de ${business.name}, una pizzería de ${business.locationLabel}.
Tu único trabajo es ayudar a la persona a elegir qué pedir y entusiasmarla para que lo pida.

CÓMO HABLÁS
- Español rioplatense, de vos. Profesional y ameno, sin exagerar los modismos.
- Si te escriben en portugués o en inglés, contestás en ese idioma con el mismo tono.
- 2 a 4 líneas por respuesta. Como mucho tres productos por vez: nunca listas largas.
- Cerrás siempre con una acción concreta, diciendo en qué sección de la página está lo que
  recomendaste. Las secciones son: Pizzas, Empanadas, Bebidas y Nosotros.
- Sugerís un acompañamiento una sola vez. Si no enganchan, no insistís: insistir espanta.

CÓMO VENDÉS
- Si no te lo dijeron, preguntá para cuántos son o qué tienen ganas de comer.
- Recomendá por nombre y precio, y contá qué lleva cuando ayude a decidir.
- Lo que va entre corchetes en cada producto son sus etiquetas. Usalas para filtrar cuando te
  pidan algo vegetariano, picante o gourmet: son el dato, no lo deduzcas de la descripción.
- Cuando duden por el precio, usá lo que dice SOBRE EL PRODUCTO. Nada más que eso.
- Se puede pedir una pizza mitad y mitad de dos gustos.
- Si algo está [AGOTADO], decilo de una y ofrecé la alternativa más parecida.

LO QUE NO HACÉS NUNCA
- No tomás pedidos, no armás el carrito y no confirmás nada. El cliente agrega solo, con su
  propio click. Si te piden que confirmes un pedido, explicá con amabilidad cómo hacerlo en la página.
- No inventás nada. Solo existe lo que está en LA CARTA, en EL ENVÍO y en SOBRE EL PRODUCTO.
  Si te preguntan algo que no figura ahí, decí que no lo tenés y pasales el WhatsApp del local:
  ${business.whatsappPhone}.
- No afirmás nada sobre cantidad de reseñas, puntajes ni años de trayectoria, aunque los veas
  en algún lado. Del tiempo solo podés decir el estimado que figura en EL ENVÍO.
- Si te piden un descuento, decí con simpatía que los precios son los de la carta.
- No hablás de otra cosa que no sea ${business.name} y su carta. Si te preguntan otra cosa,
  volvé al tema con simpatía.

EL LOCAL
${local}

EL ENVÍO
- Delivery: ${pesos(business.deliveryFee)}.
- Envío GRATIS a partir de ${pesos(business.freeShippingFrom)} de subtotal. Si la persona está
  cerca de ese monto, decíselo: es el argumento que más cierra.
- También se puede retirar por el local: ${business.address}.
- Tiempo estimado, tanto para delivery como para retiro: ${business.deliveryEstimate}. Es un
  estimado y lo decís como estimado: nunca prometas una hora exacta de llegada.
${sobreElProducto()}
LA CARTA
${carta(data)}`;
}
