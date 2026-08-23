import { promptVendedor } from "../lib/chat-prompt";
import { ARGUMENTOS_MARCA } from "../lib/marca";
import { BUSINESS, type BusinessConfig } from "../lib/business";
import { estadoTienda } from "../lib/hours";
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
    { id: "1", nombre: "Muzzarella", categoria: "clasica", precio: 16000, desc: "Salsa, muzzarella y aceitunas.", tags: ["vegetariana"], disponible: true },
    { id: "2", nombre: "Fugazzeta", categoria: "clasica", precio: 18000, desc: "Mucha cebolla.", tags: [], disponible: false },
  ],
  empanadas: [
    { id: "3", nombre: "Carne suave", precio: 2500, desc: "Cortada a cuchillo.", tags: ["picante"], disponible: true },
  ],
  bebidas: [{ id: "4", nombre: "Agua sin gas", precio: 1500, disponible: true }],
  empanadaBoxPrices: { 6: 12000, 12: 22000, 24: 40000 },
  promos: [{ id: "p1", titulo: "Martes 2x1", desc: "Dos pizzas clásicas al precio de una.", badge: "2x1" }],
  reviews: [],
};

// Martes 21:00 en Iguazú: el local está abierto.
const abierto = estadoTienda(business, new Date("2026-08-26T00:00:00Z"));
// Lunes 21:00: el único día que no abre.
const cerrado = estadoTienda(business, new Date("2026-08-25T00:00:00Z"));

const prompt = promptVendedor(catalogo, business, abierto);

/* ── la carta ── */
chequear("nombra cada pizza con su precio", prompt.includes("Muzzarella") && prompt.includes("$16.000"));
chequear("incluye la descripción, que es con lo que vende", prompt.includes("Salsa, muzzarella y aceitunas."));
chequear("marca lo que está agotado", /Fugazzeta.*AGOTADO/.test(prompt));
chequear("no marca como agotado lo que hay", !/Muzzarella.*AGOTADO/.test(prompt));
chequear("trae las tres secciones", prompt.includes("PIZZAS") && prompt.includes("EMPANADAS") && prompt.includes("BEBIDAS"));

/* ── los datos que la base tiene y el bot no debe deducir ── */
chequear("usa los tags y no obliga a deducir del texto", /Muzzarella.*vegetariana/.test(prompt));
chequear("marca la empanada picante", /Carne suave.*picante/.test(prompt));
chequear("incluye el precio de las cajas de empanadas", prompt.includes("$22.000"));
chequear("incluye las promos activas de la base", prompt.includes("Martes 2x1"));

const sinPromos = promptVendedor({ ...catalogo, promos: [] }, business, abierto);
chequear("sin promos cargadas no anuncia ninguna", !sinPromos.includes("PROMOCIONES VIGENTES"));

/* ── los argumentos de marca salen de lib/marca.ts, no del prompt ── */
chequear(
  "los argumentos de marca vienen del módulo compartido",
  ARGUMENTOS_MARCA.every((argumento) => prompt.includes(argumento.titulo) && prompt.includes(argumento.detalle)),
);
// El invariante que importa: si el prompt menciona la fermentación, es porque
// está en ARGUMENTOS_MARCA. Nunca porque alguien la escribió a mano acá.
const promptMenciona = /fermentaci[óo]n/i.test(prompt);
const marcaMenciona = ARGUMENTOS_MARCA.some(
  (argumento) => /fermentaci[óo]n/i.test(`${argumento.titulo} ${argumento.detalle}`),
);
chequear("ninguna afirmación de marca está escrita a mano en el prompt", promptMenciona === marcaMenciona);

/* ── el envío, que es la palanca de venta ── */
chequear("dice cuánto sale el envío", prompt.includes("$3.000"));
chequear("dice desde cuánto es gratis", prompt.includes("$25.000"));

/* ── el estado del local ── */
chequear("con el local abierto lo dice", prompt.includes("ABIERTO"));
const promptCerrado = promptVendedor(catalogo, business, cerrado);
chequear("con el local cerrado lo dice", promptCerrado.includes("CERRADO"));
chequear("y dice cuándo vuelve a abrir", promptCerrado.includes("Abrimos"));

/* ── las reglas de venta ── */
chequear("prohíbe inventar precios y descuentos", /no invent/i.test(prompt) && /descuento/i.test(prompt));
chequear("prohíbe tomar pedidos", /no tom[aá]s pedidos/i.test(prompt));
chequear("incluye el tiempo estimado de entrega", prompt.includes(business.deliveryEstimate));
chequear("lo presenta como estimado y no como promesa",
  /estimado/i.test(prompt) && /nunca prometas una hora exacta/i.test(prompt));
chequear("pide responder en el idioma del cliente", /portugu[ée]s/i.test(prompt));
chequear("pide respuestas cortas", prompt.includes("2 a 4 líneas"));

/* ── el contacto de respaldo tiene que ser real, no una promesa vacía ── */
// Si el prompt le pide al bot ofrecer el WhatsApp del local, el número tiene
// que estar ahí adentro. Si no, el modelo se queda con una instrucción que
// no puede cumplir con datos reales, y ahí es donde empieza a inventar.
chequear(
  "si ofrece el WhatsApp, el número real viaja con la instrucción",
  !/whatsapp/i.test(prompt) || prompt.includes(business.whatsappPhone),
);

/* ── lo que no puede filtrarse ── */
chequear("no menciona pedidos de otros clientes", !/pedido_eventos|clientes\b/i.test(prompt));
chequear("no filtra costos ni márgenes", !/markup|precio_kg|costo/i.test(prompt));

/* ── una carta vacía no rompe ── */
const vacio = promptVendedor(
  { ...catalogo, pizzas: [], empanadas: [], bebidas: [] },
  business,
  abierto,
);
chequear("con la carta vacía sigue devolviendo un prompt usable", vacio.length > 200);
chequear("y no anuncia secciones que no existen", !vacio.includes("BEBIDAS"));

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
