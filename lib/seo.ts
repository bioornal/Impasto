import type { BusinessConfig } from "@/lib/business";
import type { CatalogData, Empanada, Pizza } from "@/types";
import { SITE_URL } from "@/lib/site";
import { argumentoConCifra } from "@/lib/marca";
import { LOGO } from "@/lib/logo";
import { STOCK_IMAGES, getDrinkImage, getEmpanadaImage, getPizzaImage } from "@/lib/stock-images";
import { preguntasFrecuentes } from "@/lib/faq";

/**
 * Datos estructurados schema.org del sitio. Es lo que le permite a Google
 * mostrar el local en el panel lateral y en el mapa: horarios, teléfono,
 * dirección y la carta completa con precios.
 *
 * No importa `db` a propósito, igual que `lib/aviso-local.ts`: así se puede
 * testear con `tsx` sin levantar el SDK. Si alguna vez necesita consultar la
 * base, el test deja de correr.
 */

const DIAS_SCHEMA = [
  "https://schema.org/Sunday",
  "https://schema.org/Monday",
  "https://schema.org/Tuesday",
  "https://schema.org/Wednesday",
  "https://schema.org/Thursday",
  "https://schema.org/Friday",
  "https://schema.org/Saturday",
];

/** "19:30" ya viene en el formato que pide schema.org (ISO 8601 hh:mm). */
const hhmm = (valor: string) => /^\d{1,2}:\d{2}$/.test(valor) ? valor.padStart(5, "0") : undefined;

/**
 * El teléfono en formato internacional, que es el que Google entiende.
 * `whatsappPhone` ya viene solo con dígitos y con el código de país; el campo
 * `phone` está escrito para leer ("(03757) 65-2003") y no sirve para esto.
 */
function telefonoInternacional(business: BusinessConfig): string {
  const digitos = String(business.whatsappPhone || "").replace(/\D/g, "");
  return digitos ? `+${digitos}` : business.phone;
}

/** "@impasto.iguazu" → el perfil real. Si no hay usuario, no se inventa nada. */
function perfilesSociales(business: BusinessConfig): string[] {
  const usuario = String(business.instagram || "").trim().replace(/^@/, "");
  // `facebook` guarda el nombre visible ("Impasto Iguazú"), no el usuario:
  // no alcanza para armar una URL válida, así que queda afuera.
  return usuario ? [`https://www.instagram.com/${usuario}/`] : [];
}

/**
 * `ciudad` en la base guarda "Puerto Iguazú, Misiones", ciudad y provincia
 * juntas, porque el sitio la muestra así en el pie y en el hero. schema.org las
 * quiere separadas: dejar la provincia dentro de `addressLocality` hace que Google
 * lea la localidad como "Puerto Iguazú, Misiones", que no existe.
 */
function partesUbicacion(business: BusinessConfig) {
  const [localidad, provincia] = String(business.city || "").split(",").map((parte) => parte.trim());
  return { localidad: localidad || business.city, provincia: provincia || "Misiones" };
}

function direccion(business: BusinessConfig) {
  const { localidad, provincia } = partesUbicacion(business);
  return {
    "@type": "PostalAddress",
    streetAddress: business.address,
    addressLocality: localidad,
    addressRegion: provincia,
    addressCountry: "AR",
  };
}

function horarios(business: BusinessConfig) {
  const abre = hhmm(business.horaApertura);
  const cierra = hhmm(business.horaCierre);
  if (!abre || !cierra || business.diasApertura.length === 0) return [];
  return [{
    "@type": "OpeningHoursSpecification",
    dayOfWeek: business.diasApertura.map((dia) => DIAS_SCHEMA[dia]).filter(Boolean),
    opens: abre,
    // Es la hora del último pedido (23:45), no la del cierre del local (00:00).
    // Para un sitio de delivery es el dato útil: hasta cuándo se puede pedir.
    closes: cierra,
  }];
}

const DIETAS: Record<string, string> = {
  vegetariana: "https://schema.org/VegetarianDiet",
};

function itemDeCarta(producto: Pizza | Empanada, imagen: string) {
  const dietas = producto.tags.map((tag) => DIETAS[tag]).filter(Boolean);
  return {
    "@type": "MenuItem",
    name: producto.nombre,
    // La foto real del producto (storage) o la de stock que muestra la carta.
    // Google y los motores de IA usan esta imagen para las fichas de menú.
    image: imagen,
    ...(producto.desc ? { description: producto.desc } : {}),
    ...(dietas.length > 0 ? { suitableForDiet: dietas } : {}),
    ...(producto.precio
      ? {
          offers: {
            "@type": "Offer",
            price: String(producto.precio),
            priceCurrency: "ARS",
            availability: producto.disponible
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };
}

function carta(data: CatalogData) {
  const secciones: { name: string; items: { producto: Pizza | Empanada; imagen: string }[] }[] = [
    {
      name: "Pizzas",
      items: data.pizzas.map((pizza) => ({
        producto: pizza,
        imagen: getPizzaImage(pizza.nombre, pizza.id, pizza.tags),
      })),
    },
    {
      name: "Empanadas",
      items: data.empanadas.map((empanada) => ({
        producto: empanada,
        imagen: getEmpanadaImage(empanada.nombre, empanada.id),
      })),
    },
    // Las bebidas no tienen descripción ni etiquetas, pero en la carta se
    // describen igual que una empanada: nombre, precio y disponibilidad.
    {
      name: "Bebidas",
      items: data.bebidas.map((bebida) => ({
        producto: { ...bebida, desc: "", tags: [] },
        imagen: getDrinkImage(bebida.nombre, bebida.id),
      })),
    },
  ].filter((seccion) => seccion.items.length > 0);

  return {
    "@type": "Menu",
    "@id": `${SITE_URL}/#carta`,
    name: "Carta de Impasto",
    description: "Pizzas de fermentación lenta, empanadas al horno y bebidas.",
    inLanguage: "es-AR",
    hasMenuSection: secciones.map((seccion) => ({
      "@type": "MenuSection",
      name: seccion.name,
      hasMenuItem: seccion.items.map(({ producto, imagen }) => itemDeCarta(producto, imagen)),
    })),
  };
}

/**
 * Título del sitio, reusado en el `<title>`, el Open Graph y el JSON-LD.
 * Arranca con la búsqueda real ("pizza napolitana" + ciudad) y recién después
 * la marca: un negocio nuevo no tiene todavía quién lo busque por nombre, pero
 * sí mucha gente buscando dónde comer pizza napolitana en Iguazú.
 *
 * Es, junto con `PALABRAS_CLAVE`, el único lugar que dice "napolitana": el
 * resto del sitio dice "napoletana" (pedido del dueño, 19/09/2026), pero en
 * Google se busca "napolitana". Si se cambia, se cambia a propósito.
 */
export function tituloSitio(business: BusinessConfig): string {
  return `Pizza napolitana en ${business.city} · ${business.name} — Delivery y Take Away`;
}

/**
 * Descripción del local, reusada en el `<meta name="description">` y en el
 * JSON-LD. Las cifras ("48 hs", "160 g") salen de `ARGUMENTOS_MARCA`
 * (`lib/marca.ts`), no están escritas a mano acá: son las mismas que ve el
 * cliente en el sitio y el bot en el prompt.
 */
export function descripcionSitio(business: BusinessConfig): string {
  // `argumentoConCifra`, no `argumento`: las dos se interpolan en el
  // template literal de abajo, y ahí un `cifra` faltante compilaría igual.
  const fermentacion = argumentoConCifra("fermentacion");
  const empanadaPeso = argumentoConCifra("empanadas-peso").cifra;
  return `Pizza napoletana con alma argentina en ${business.city}: fermentación en frío de ${fermentacion.cifra}, `
    + `horno de piedra y muzzarella abundante. Empanadas de ${empanadaPeso}, delivery propio y take away. Pedí online.`;
}

/** La ficha de Google Maps más cercana al domicilio, sin necesidad de un place_id. */
function mapaUrl(business: BusinessConfig): string {
  const consulta = `${business.name}, ${business.address}, ${business.locationLabel}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

/**
 * Los mismos argumentos de búsqueda que el `<meta name="keywords">`, en un
 * solo lugar. Google ignora `keywords` para el ranking, pero los motores de IA
 * y los motores internos del sitio lo usan para entender de qué se trata.
 */
export const PALABRAS_CLAVE = [
  "mejor pizza de Puerto Iguazú",
  "pizza napoletana Iguazú",
  "pizza napolitana Iguazú",
  "pizza artesanal Puerto Iguazú",
  "pizzería Puerto Iguazú",
  "pizza a la piedra Iguazú",
  "delivery de pizza Puerto Iguazú",
  "empanadas Puerto Iguazú",
  "pedir pizza online Iguazú",
  "take away Puerto Iguazú",
  "Impasto Iguazú",
];

export function jsonLdSitio(business: BusinessConfig, data: CatalogData) {
  const restaurante = {
    // `Restaurant` ya es un `FoodEstablishment` y un `LocalBusiness`; Google lo
    // trata como ficha de negocio local. El `@id` es el nodo al que apuntan el
    // sitio, la página y la carta.
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#local`,
    name: business.name,
    alternateName: `${business.name} ${business.city}`,
    slogan: "Pizza híbrida: técnica napoletana, alma argentina.",
    description: descripcionSitio(business),
    url: SITE_URL,
    image: [STOCK_IMAGES.hero.main, `${SITE_URL}/opengraph-image`],
    logo: LOGO.src,
    telephone: telefonoInternacional(business),
    email: business.email,
    servesCuisine: ["Pizza", "Italiana", "Empanadas", "Argentina"],
    priceRange: "$$",
    currenciesAccepted: "ARS",
    paymentAccepted: "Efectivo, Transferencia, Tarjeta de crédito, Tarjeta de débito, Mercado Pago",
    keywords: PALABRAS_CLAVE.join(", "),
    address: direccion(business),
    hasMap: mapaUrl(business),
    areaServed: { "@type": "City", name: partesUbicacion(business).localidad },
    openingHoursSpecification: horarios(business),
    acceptsReservations: false,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: telefonoInternacional(business),
      email: business.email,
      contactType: "customer service",
      areaServed: "AR",
      availableLanguage: ["es", "en", "pt"],
    },
    // Es lo que le dice a Google y a los asistentes de IA que desde el sitio se
    // puede pedir online, con delivery o para retirar.
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: SITE_URL,
        inLanguage: "es-AR",
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
      deliveryMethod: ["https://schema.org/OnSitePickup", "https://schema.org/ParcelService"],
    },
    ...(perfilesSociales(business).length > 0 ? { sameAs: perfilesSociales(business) } : {}),
    hasMenu: carta(data),
    // Sin `aggregateRating`: Google no acepta como rich result las reseñas que
    // el propio negocio recolecta y publica sobre sí mismo.
  };

  const sitio = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#sitio`,
    url: SITE_URL,
    name: business.name,
    alternateName: `${business.name} ${business.city}`,
    description: descripcionSitio(business),
    inLanguage: "es-AR",
    publisher: { "@id": `${SITE_URL}/#local` },
  };

  const pagina = {
    "@type": "WebPage",
    "@id": `${SITE_URL}/#pagina`,
    url: SITE_URL,
    name: tituloSitio(business),
    description: descripcionSitio(business),
    isPartOf: { "@id": `${SITE_URL}/#sitio` },
    about: { "@id": `${SITE_URL}/#local` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image` },
    inLanguage: "es-AR",
    // Le indica a los asistentes de voz e IA qué fragmentos leer en voz alta.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".hero-lede", ".faq-item p"],
    },
  };

  const preguntas = {
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#preguntas`,
    inLanguage: "es-AR",
    isPartOf: { "@id": `${SITE_URL}/#sitio` },
    mainEntity: preguntasFrecuentes(business).map((item) => ({
      "@type": "Question",
      name: item.pregunta,
      acceptedAnswer: { "@type": "Answer", text: item.respuesta },
    })),
  };

  // El orden del `@graph` no es semántico: importan los `@id`. El restaurante
  // va segundo para que los tests que navegan por índice sigan encontrándolo.
  return { "@context": "https://schema.org", "@graph": [sitio, restaurante, pagina, preguntas] };
}

/**
 * Serializa el JSON-LD para meterlo en un `<script type="application/ld+json">`.
 *
 * El `<` se escapa como \u003c porque el JSON incluye texto que escribe el dueño
 * desde el panel: una descripción que contenga `</script>` cortaría la etiqueta y
 * el resto se ejecutaría como HTML. El escape es JSON válido, así que el
 * contenido no cambia; lo que cambia es que ya no puede cerrar la etiqueta.
 */
export function serializarJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
