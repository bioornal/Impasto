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
chequear("incluye las promos activas de la base", prompt.includes("Martes 2x1"));

/* ── mitad y mitad: la regla de precio tiene que estar, no solo el permiso ── */
chequear("dice que se puede pedir mitad y mitad", /mitad y mitad/i.test(prompt));
chequear("dice cómo se cobra: la más cara, sin recargo", /más cara.*sin recargo|precio de la más cara/i.test(prompt));

/* ── empanadas: la regla del prompt tiene que calzar con lo que cobra el
 * carrito (`priceFor()` en components/sections/EmpanadasSection.tsx), no con
 * una tabla de precios de caja que puede no ser la que se usa. ── */
// El fixture de arriba tiene precio unitario cargado (caso real de Impasto
// hoy): ahí `priceFor()` IGNORA `empanadaBoxPrices` por completo y cobra la
// suma de lo elegido. Citar "$22.000" acá sería prometer un precio de caja
// fijo que el carrito nunca usaría con estos datos.
chequear("con precio unitario cargado, no cita el precio de caja fijo", !prompt.includes("$22.000"));
chequear("dice que las empanadas se piden en cajas de 6, 12 o 24", /cajas? de 6, 12 o 24/i.test(prompt));
chequear(
  "explica que el precio sale de sumar cada empanada elegida",
  /suma del precio de cada empanada elegida/i.test(prompt),
);

// Con NINGUNA empanada con precio unitario cargado, `priceFor()` sí usa la
// tabla de cajas fija: ahí el prompt tiene que citarla.
const catalogoSinPrecioUnitario: CatalogData = {
  ...catalogo,
  empanadas: [
    { id: "3", nombre: "Carne suave", desc: "Cortada a cuchillo.", tags: ["picante"], disponible: true },
    { id: "5", nombre: "Jamón y queso", desc: "Clásica.", tags: [], disponible: true },
  ],
};
const promptSinPrecioUnitario = promptVendedor(catalogoSinPrecioUnitario, business, abierto);
chequear(
  "sin precio unitario cargado, usa el precio de caja de la tabla",
  promptSinPrecioUnitario.includes("$22.000"),
);

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

/* ── SOBRE EL PRODUCTO es condicional: si no hay argumentos de marca, no hay
 * que mandarle al bot a usar una sección que no existe (`sobreElProducto()`
 * devuelve "" con ARGUMENTOS_MARCA vacío). ── */
chequear("con argumentos de marca cargados, sí le dice al bot que use SOBRE EL PRODUCTO", prompt.includes("SOBRE EL PRODUCTO"));
const marcaOriginal = [...ARGUMENTOS_MARCA];
ARGUMENTOS_MARCA.length = 0;
const promptSinMarca = promptVendedor(catalogo, business, abierto);
chequear(
  "sin argumentos de marca, ninguna referencia a SOBRE EL PRODUCTO queda colgada",
  !promptSinMarca.includes("SOBRE EL PRODUCTO"),
);
ARGUMENTOS_MARCA.push(...marcaOriginal);

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
