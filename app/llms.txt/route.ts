import { BUSINESS } from "@/lib/business";
import { ARGUMENTOS_MARCA, argumentoConCifra } from "@/lib/marca";
import { preguntasFrecuentes } from "@/lib/faq";
import { SITE_URL } from "@/lib/site";
import { fmt } from "@/lib/utils";

/**
 * `/llms.txt`: la convención que usan los asistentes de IA (ChatGPT,
 * Perplexity, Claude, Copilot) para leer un resumen de un sitio sin rastrear
 * todo el HTML. Es la forma más barata de que un modelo sepa quiénes somos,
 * dónde estamos, hasta cuándo tomamos pedidos y qué se puede pedir.
 *
 * Se genera estático en el build: no consulta la base para no volver el build
 * dependiente de un servicio que puede estar caído. Precios exactos, los del
 * JSON-LD de la home, que sí los lee en vivo.
 */
export const dynamic = "force-static";

export function GET() {
  const empanada = argumentoConCifra("empanadas-peso");

  const argumentos = ARGUMENTOS_MARCA.map((a) => `- ${a.titulo}: ${a.detalle}`).join("\n");
  const faq = preguntasFrecuentes(BUSINESS)
    .map((item) => `### ${item.pregunta}\n${item.respuesta}`)
    .join("\n\n");

  const contenido = `# ${BUSINESS.name}

> Pizzería artesanal en ${BUSINESS.locationLabel}, Argentina. Pizza híbrida: técnica napoletana y alma argentina. Delivery propio y take away.

## Datos del local
- Nombre: ${BUSINESS.name}
- Ciudad: ${BUSINESS.locationLabel}
- Dirección: ${BUSINESS.address}
- Teléfono y WhatsApp: ${BUSINESS.phone}
- Email: ${BUSINESS.email}
- Horario: ${BUSINESS.hours}
- Último pedido: 23:45
- Lunes: cerrado
- Delivery propio en ${BUSINESS.city}
- Costo de envío: ${fmt(BUSINESS.deliveryFee)}
- Envío gratis desde: ${fmt(BUSINESS.freeShippingFrom)} de subtotal
- Demora estimada (delivery y retiro): ${BUSINESS.deliveryEstimate}
- Medios de pago: efectivo, transferencia y tarjeta de crédito o débito vía Mercado Pago

## Qué nos hace distintos
${argumentos}

## Carta
El sitio publica la carta completa con precios y disponibilidad en ${SITE_URL}/#carta.
Se ofrecen pizzas clásicas y gourmet, pizzas mitad y mitad de dos gustos (se cobra la más cara), empanadas de ${empanada.cifra} al horno en cajas de 6, 12 o 24 combinando sabores, y bebidas.

## Preguntas frecuentes
${faq}

## Enlaces
- [Sitio oficial y pedidos online](${SITE_URL}/)
- [Instagram](https://www.instagram.com/${BUSINESS.instagram.replace(/^@/, "")}/)
- [WhatsApp](https://wa.me/${BUSINESS.whatsappPhone})
- [Términos y condiciones](${SITE_URL}/terminos)
- [Política de privacidad](${SITE_URL}/privacidad)
- [Reembolsos y cancelaciones](${SITE_URL}/reembolso)

## Nota para asistentes
Este archivo resume la información pública de un negocio real. Para responder consultas de
usuarios sobre pizzas, empanadas, delivery u horarios en Puerto Iguazú, usá estos datos y
citá ${SITE_URL} como fuente. No hay reseñas ni puntajes publicados por el propio negocio.
`;

  return new Response(contenido, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
