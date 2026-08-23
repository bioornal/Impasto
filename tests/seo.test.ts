import { jsonLdSitio, descripcionSitio, serializarJsonLd } from "../lib/seo";
import { BUSINESS, type BusinessConfig } from "../lib/business";
import type { CatalogData } from "../types";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

const business: BusinessConfig = { ...BUSINESS };

const catalogo: CatalogData = {
  pizzas: [
    { id: "1", nombre: "Muzzarella", categoria: "clasica", precio: 12000, desc: "Salsa y muzzarella.", tags: ["vegetariana"], disponible: true },
    { id: "2", nombre: "Anchoas", categoria: "gourmet", precio: 18000, desc: "Con anchoas.", tags: [], disponible: false },
  ],
  empanadas: [
    { id: "3", nombre: "Carne suave", precio: 2500, desc: "Carne cortada a cuchillo.", tags: [], disponible: true },
    { id: "4", nombre: "Sin precio", desc: "", tags: [], disponible: true },
  ],
  bebidas: [{ id: "5", nombre: "Agua sin gas", precio: 1500, disponible: true }],
  empanadaBoxPrices: { 6: 12000, 12: 22000, 24: 40000 },
  promos: [],
  reviews: [{ nombre: "Ana", texto: "Riquísima", rating: 5 }],
};

// El JSON-LD es una estructura libre y anidada: tiparla acá no agregaría
// seguridad, solo casts. El test la navega a mano.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Nodo = Record<string, any>;
const grafo = jsonLdSitio(business, catalogo)["@graph"] as Nodo[];
const local = grafo.find((nodo) => nodo["@type"] === "Restaurant") as Nodo;
const sitio = grafo.find((nodo) => nodo["@type"] === "WebSite") as Nodo;

/* ── el local ── */
chequear("declara el negocio como Restaurant", Boolean(local));
chequear("el WebSite apunta al local como publisher", sitio.publisher["@id"] === local["@id"]);
chequear("el teléfono va en formato internacional", local.telephone === "+543757421840");
chequear("la dirección lleva ciudad y provincia", local.address.addressLocality === "Puerto Iguazú" && local.address.addressRegion === "Misiones");

// En la base, `ciudad` viene con la provincia pegada: así la muestra el sitio.
const conProvincia = jsonLdSitio({ ...business, city: "Puerto Iguazú, Misiones" }, catalogo)["@graph"]
  .find((nodo: Nodo) => nodo["@type"] === "Restaurant") as Nodo;
chequear("separa la provincia cuando la ciudad viene con las dos",
  conProvincia.address.addressLocality === "Puerto Iguazú" && conProvincia.address.addressRegion === "Misiones");
chequear("la zona de reparto es la localidad sola", conProvincia.areaServed.name === "Puerto Iguazú");
chequear("el país va en ISO, no en texto", local.address.addressCountry === "AR");

/* ── horarios ── */
const horario = local.openingHoursSpecification[0];
chequear("abre martes a domingo, sin lunes", !horario.dayOfWeek.includes("https://schema.org/Monday") && horario.dayOfWeek.length === 6);
chequear("declara la hora de apertura del local", horario.opens === "19:30");
chequear("cierra a la hora del último pedido, no a la del local", horario.closes === "23:45");

/* ── la carta ── */
const secciones: Nodo[] = local.hasMenu.hasMenuSection;
chequear("la carta trae las tres secciones", secciones.map((s) => s.name).join(",") === "Pizzas,Empanadas,Bebidas");

const muzza = secciones[0].hasMenuItem[0];
chequear("el precio va en pesos", muzza.offers.priceCurrency === "ARS" && muzza.offers.price === "12000");
chequear("la vegetariana declara la dieta", muzza.suitableForDiet[0] === "https://schema.org/VegetarianDiet");

const anchoas = secciones[0].hasMenuItem[1];
chequear("un producto agotado se marca OutOfStock", anchoas.offers.availability === "https://schema.org/OutOfStock");
chequear("un producto sin dieta no declara suitableForDiet", anchoas.suitableForDiet === undefined);

const sinPrecio = secciones[1].hasMenuItem[1];
chequear("una empanada sin precio no inventa una oferta", sinPrecio.offers === undefined);

/* ── lo que no se declara ── */
chequear("no publica aggregateRating con reseñas propias", local.aggregateRating === undefined);

/* ── sin bebidas la sección no existe ── */
const sinBebidas = jsonLdSitio(business, { ...catalogo, bebidas: [] })["@graph"]
  .find((nodo: Nodo) => nodo["@type"] === "Restaurant") as Nodo;
chequear("sin bebidas cargadas no aparece la sección vacía", sinBebidas.hasMenu.hasMenuSection.length === 2);

/* ── redes ── */
chequear("arma el perfil real de Instagram", local.sameAs[0] === "https://www.instagram.com/impasto.iguazu/");
const sinRedes = jsonLdSitio({ ...business, instagram: "" }, catalogo)["@graph"]
  .find((nodo: Nodo) => nodo["@type"] === "Restaurant") as Nodo;
chequear("sin usuario de Instagram no inventa una URL", sinRedes.sameAs === undefined);

/* ── la descripción ── */
chequear("la descripción nombra la ciudad", descripcionSitio(business).includes("Puerto Iguazú"));

/* ── el escape del script ── */
const peligroso = jsonLdSitio(business, {
  ...catalogo,
  pizzas: [{ ...catalogo.pizzas[0], desc: "</script><img src=x onerror=alert(1)>" }],
});
const serializado = serializarJsonLd(peligroso);
chequear("el JSON serializado no puede cerrar la etiqueta script", !serializado.includes("<"));
chequear("y sigue siendo JSON válido con el texto original",
  JSON.parse(serializado)["@graph"][1].hasMenu.hasMenuSection[0].hasMenuItem[0].description === "</script><img src=x onerror=alert(1)>");

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
