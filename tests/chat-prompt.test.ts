import { promptVendedor } from "../lib/chat-prompt";
import { ARGUMENTOS_MARCA, LEMA, ORIGEN_DEL_NOMBRE } from "../lib/marca";
import { preguntasFrecuentes } from "../lib/faq";
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

/* ── negrita: acotada a lo que components/chat/ChatWidget.tsx sabe renderizar
 * (lib/chat-negrita.ts solo entiende **negrita**, nada más de markdown) ── */
chequear("le dice que resalte con ** el nombre y el precio", /\*\*.*negrita.*\*\*/i.test(prompt) || /doble asterisco/i.test(prompt));
chequear("aclara que es nombre y precio, nada más", /nombre y (el )?precio/i.test(prompt));

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
chequear("dice desde cuánto es gratis", prompt.includes("$35.000"));

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

/* ── delivery pausado: el bot no puede ofrecer lo que el checkout rechaza ── */
const sinDelivery: BusinessConfig = { ...business, deliveryActivo: false, mensajeDelivery: "Por la lluvia pausamos el delivery." };
const promptSinDelivery = promptVendedor(catalogo, sinDelivery, estadoTienda(sinDelivery, new Date("2026-08-26T00:00:00Z")));
chequear("con el delivery activo ofrece el envío gratis", /Envío GRATIS a partir/.test(prompt));
chequear("con el delivery pausado dice que solo hay retiro, con la dirección", /solo .*retir/i.test(promptSinDelivery) && promptSinDelivery.includes(business.address));
chequear("y lleva el motivo que cargó el local", promptSinDelivery.includes("Por la lluvia pausamos el delivery."));
chequear("y no ofrece envío gratis ni la tarifa", !/gratis a partir/i.test(promptSinDelivery) && !promptSinDelivery.includes("$3.000"));

chequear("con el delivery pausado omite la pregunta frecuente de delivery", !promptSinDelivery.includes("¿Hacen delivery"));
chequear("con el delivery activo sí la incluye", prompt.includes("¿Hacen delivery"));

/* ── lo que el bot respondía "no lo tengo" (visto en producción el 01/10/2026) ── */
chequear("sabe los medios de pago", /efectivo/i.test(prompt) && /transferencia/i.test(prompt) && /Mercado Pago/.test(prompt));
chequear("no da datos bancarios", /nunca das datos bancarios/i.test(prompt));
chequear("con el local cerrado igual sabe el horario", promptCerrado.includes(business.hours));
chequear("sabe la hora del último pedido", promptCerrado.includes(`Último pedido: ${business.horaCierre}`));
chequear("sabe qué días no abre, desde la configuración", promptCerrado.includes("Lunes cerrado"));
chequear("sabe el teléfono y el Instagram", prompt.includes(business.phone) && prompt.includes(business.instagram));
chequear("sabe el concepto de la marca", prompt.includes(LEMA));
chequear("sabe por qué se llama así", prompt.includes(ORIGEN_DEL_NOMBRE));

/* ── no hay local a la calle: se retira en la cocina (pedido del dueño, 05/10/2026) ── */
// El bot repite lo que lee: si el prompt dice "local", se lo dice al cliente.
for (const [nombre, texto] of [["abierto", prompt], ["cerrado", promptCerrado], ["sin delivery", promptSinDelivery]] as const) {
  chequear(`prompt ${nombre} · no dice "local"`, !/\blocal\b/i.test(texto));
}
chequear("dice que se puede retirar en nuestra cocina", /acercarse a nuestra cocina/i.test(prompt));
chequear("sin delivery, el retiro también es en nuestra cocina", /nuestra cocina/i.test(promptSinDelivery));
chequear("las preguntas frecuentes no dicen \"local\"", preguntasFrecuentes(business).every((item) => !/\blocal\b/i.test(`${item.pregunta} ${item.respuesta}`)));
chequear("las preguntas frecuentes son las del sitio", preguntasFrecuentes(business).every((item) => prompt.includes(item.pregunta)));

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
