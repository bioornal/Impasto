import type { BusinessConfig } from "@/lib/business";
import type { CatalogData, Empanada, Pizza } from "@/types";
import { SITE_URL } from "@/lib/site";

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
 * `phone` está escrito para leer ("(03757) 42-1840") y no sirve para esto.
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

function itemDeCarta(producto: Pizza | Empanada) {
  const dietas = producto.tags.map((tag) => DIETAS[tag]).filter(Boolean);
  return {
    "@type": "MenuItem",
    name: producto.nombre,
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
  const secciones: { name: string; items: (Pizza | Empanada)[] }[] = [
    { name: "Pizzas", items: data.pizzas },
    { name: "Empanadas", items: data.empanadas },
    // Las bebidas no tienen descripción ni etiquetas, pero en la carta se
    // describen igual que una empanada: nombre, precio y disponibilidad.
    { name: "Bebidas", items: data.bebidas.map((bebida) => ({ ...bebida, desc: "", tags: [] })) },
  ].filter((seccion) => seccion.items.length > 0);

  return {
    "@type": "Menu",
    "@id": `${SITE_URL}/#carta`,
    name: "Carta de Impasto",
    inLanguage: "es-AR",
    hasMenuSection: secciones.map((seccion) => ({
      "@type": "MenuSection",
      name: seccion.name,
      hasMenuItem: seccion.items.map(itemDeCarta),
    })),
  };
}

/** Descripción del local, reusada en el `<meta name="description">` y en el JSON-LD. */
export function descripcionSitio(business: BusinessConfig): string {
  return `Pizza híbrida en ${business.locationLabel}: técnica napolitana y alma argentina. Fermentación en frío de 48 hs, empanadas de 160 g al horno y bebidas. `
    + `Pedí online con delivery propio o take away: ${business.hours}.`;
}

export function jsonLdSitio(business: BusinessConfig, data: CatalogData) {
  const restaurante = {
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#local`,
    name: business.name,
    description: descripcionSitio(business),
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image`,
    telephone: telefonoInternacional(business),
    email: business.email,
    servesCuisine: ["Pizza", "Italiana", "Empanadas"],
    priceRange: "$$",
    currenciesAccepted: "ARS",
    paymentAccepted: "Efectivo, Transferencia, Tarjeta de crédito, Tarjeta de débito, Mercado Pago",
    address: direccion(business),
    areaServed: { "@type": "City", name: partesUbicacion(business).localidad },
    openingHoursSpecification: horarios(business),
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
    inLanguage: "es-AR",
    publisher: { "@id": `${SITE_URL}/#local` },
  };

  return { "@context": "https://schema.org", "@graph": [sitio, restaurante] };
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
