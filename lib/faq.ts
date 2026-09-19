import { argumentoConCifra } from "@/lib/marca";
import { REGLA_MITAD_Y_MITAD, TAMANIOS_CAJA_EMPANADAS, listaConO } from "@/lib/reglas-carta";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";

/**
 * Las preguntas frecuentes, en un solo lugar.
 *
 * Existen dos consumidores y **tienen que decir lo mismo**: la sección visible
 * de la página y el `FAQPage` del JSON-LD (`lib/seo.ts`). Google y los motores
 * de IA leen ese marcado, pero una respuesta que no está en la página es
 * exactamente lo que las guías de datos estructurados piden no hacer. Así que
 * la sección renderiza esta misma lista y el JSON-LD la vuelve a leer.
 *
 * **Solo entra lo que es verificablemente cierto del negocio** y lo que ya vive
 * en otro lado: los horarios y el envío salen de `BusinessConfig`, la
 * fermentación de `ARGUMENTOS_MARCA`, la regla de mitad y mitad de
 * `lib/reglas-carta.ts`. Nada se escribe dos veces ni se promete una demora
 * exacta. No importa `db`, igual que `lib/seo.ts`, para poder testearlo con `tsx`.
 */
export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export function preguntasFrecuentes(business: BusinessConfig): PreguntaFrecuente[] {
  const fermentacion = argumentoConCifra("fermentacion");
  const horno = argumentoConCifra("horno");
  const empanada = argumentoConCifra("empanadas-peso");
  const tamanios = listaConO(TAMANIOS_CAJA_EMPANADAS);

  return [
    {
      pregunta: "¿Dónde queda Impasto?",
      respuesta: `Estamos en ${business.address}, ${business.locationLabel}. `
        + "Atendemos con delivery propio en la ciudad y también podés retirar tu pedido por el local.",
    },
    {
      pregunta: "¿Cuáles son los horarios?",
      respuesta: `Nuestro horario es ${business.hours}. El último pedido se toma a las 23:45 y los lunes permanecemos cerrados.`,
    },
    {
      pregunta: "¿Hacen delivery en Puerto Iguazú?",
      respuesta: `Sí, hacemos delivery propio en ${business.locationLabel}. El envío cuesta ${fmt(business.deliveryFee)} `
        + `y es gratis a partir de ${fmt(business.freeShippingFrom)} de subtotal. El tiempo estimado es de ${business.deliveryEstimate}, `
        + "siempre como estimado: el clima, el tránsito y la cantidad de pedidos pueden variar la demora.",
    },
    {
      pregunta: "¿Qué significa que la pizza sea híbrida?",
      respuesta: `Es nuestra forma de decir "técnica napolitana, alma argentina": fermentación en frío ${fermentacion.detalle.toLowerCase()}, `
        + `estirado a mano sin moldes y horno a la piedra a ${horno.cifra}. `
        + "El resultado es un borde alto y liviano, con muzzarella abundante como nos gusta en Argentina.",
    },
    {
      pregunta: "¿Se puede pedir pizza mitad y mitad?",
      respuesta: `${REGLA_MITAD_Y_MITAD} Escribinos por WhatsApp o elegí la opción "mitad y mitad" al armar el pedido.`,
    },
    {
      pregunta: "¿Las empanadas se venden sueltas?",
      respuesta: `Las empanadas son de ${empanada.cifra} y van al horno. Se piden en cajas de ${tamanios} unidades, `
        + "combinando los sabores que quieras.",
    },
    {
      pregunta: "¿Cuánto tarda mi pedido?",
      respuesta: `El tiempo estimado es de ${business.deliveryEstimate} para delivery y para retiro. Es un estimado, no una hora `
        + "exacta: te avisamos cuando el pedido sale del horno.",
    },
    {
      pregunta: "¿Qué medios de pago aceptan?",
      respuesta: "Aceptamos efectivo, transferencia bancaria y tarjeta de crédito o débito a través de Mercado Pago. "
        + "El pago con tarjeta se procesa en la plataforma de Mercado Pago: no guardamos los datos de tu tarjeta.",
    },
    {
      pregunta: "¿Hay opciones vegetarianas o sin picante?",
      respuesta: "Sí. En la carta cada producto muestra sus etiquetas (vegetariano, picante, gourmet), así podés "
        + "identificarlas antes de pedir. Si tenés una alergia o restricción, avisanos por WhatsApp.",
    },
  ];
}
