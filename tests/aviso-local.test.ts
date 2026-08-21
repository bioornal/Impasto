import { plantillaLocal, type AvisoPedido } from "../lib/aviso-local";
import type { CartItem } from "../types";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

const item = (over: Partial<CartItem>): CartItem => ({
  key: "k", cartId: "c", type: "pizza", name: "Muzzarella", price: 10000, qty: 1, ...over,
});

const base: AvisoPedido = {
  pedidoId: "p1",
  referencia: "IM-107345",
  nombre: "Juan Pérez",
  email: "juan@ejemplo.com",
  tel: "3757-123456",
  mode: "delivery",
  dir: "Av. Victoria Aguirre 123",
  items: [item({}), item({ name: "Napolitana", detail: "sin aceitunas", qty: 2 })],
  subtotal: 30000,
  shipping: 2000,
  total: 32000,
  metodoPago: "efectivo",
};

/* ── la referencia y el pedido ── */
const efectivo = plantillaLocal(base, "pedido_recibido");
chequear("encabeza con la referencia del pedido", efectivo.startsWith("PEDIDO NUEVO — IM-107345"));

/* ── qué hacer con la plata ── */
chequear("en efectivo dice cuánto cobrar al entregar", efectivo.includes("COBRAR AL ENTREGAR $32.000"));

const tarjeta = plantillaLocal({ ...base, metodoPago: "mercadopago" }, "pago_aprobado");
chequear("con tarjeta aprobada avisa que ya está pago", tarjeta.includes("PAGADO CON TARJETA"));

const tarjetaSinAprobar = plantillaLocal({ ...base, metodoPago: "mercadopago" }, "pedido_recibido");
chequear("con tarjeta no aprobada pide revisar", tarjetaSinAprobar.includes("PAGO SIN CONFIRMAR"));

const transferencia = plantillaLocal({ ...base, metodoPago: "transferencia" }, "pedido_recibido");
chequear("la transferencia siempre pide revisar", transferencia.includes("PAGO SIN CONFIRMAR"));

const otro = plantillaLocal({ ...base, metodoPago: "canje" }, "pedido_recibido");
chequear("un método desconocido no rompe el aviso", otro.includes("PAGO: canje"));

/* ── entrega ── */
chequear("delivery muestra la dirección", efectivo.includes("Delivery — Av. Victoria Aguirre 123"));

const retiro = plantillaLocal({ ...base, mode: "takeaway", dir: "" }, "pedido_recibido");
chequear("el retiro no inventa dirección", retiro.includes("Retira en el local") && !retiro.includes("Delivery"));

const sinDir = plantillaLocal({ ...base, dir: "" }, "pedido_recibido");
chequear("un delivery sin dirección lo canta en vez de callarlo", sinDir.includes("SIN DIRECCIÓN"));

/* ── contacto ── */
chequear("incluye nombre y teléfono", efectivo.includes("Juan Pérez — 3757-123456"));

const sinTel = plantillaLocal({ ...base, tel: undefined }, "pedido_recibido");
chequear("sin teléfono no deja el guión colgado", sinTel.includes("Juan Pérez") && !sinTel.includes("Juan Pérez —"));

/* ── los ítems, que es lo que hay que producir ── */
chequear("lista cada ítem con su cantidad", efectivo.includes("1x Muzzarella") && efectivo.includes("2x Napolitana"));
chequear("la aclaración del ítem viaja entre paréntesis", efectivo.includes("2x Napolitana (sin aceitunas)"));

const vacio = plantillaLocal({ ...base, items: [] }, "pedido_recibido");
chequear("un pedido sin ítems no rompe la plantilla", vacio.includes("Total $32.000"));

/* ── total ── */
chequear("cierra con el total", efectivo.trimEnd().endsWith("Total $32.000"));

/* ── lo que escribe el cliente no puede falsificar líneas ── */
const inyeccion = plantillaLocal(
  { ...base, nombre: "Juan\nPEDIDO NUEVO — IM-999\nPAGADO CON TARJETA" },
  "pedido_recibido",
);
// Lo que importa no es que la frase no aparezca —el nombre la contiene—, sino
// que quede aplanada dentro de su línea y no genere una línea nueva que se lea
// como encabezado de otro pedido.
chequear(
  "un salto de línea en el nombre no inventa una línea de encabezado",
  inyeccion.split("\n").filter(l => l.startsWith("PEDIDO NUEVO")).length === 1,
);
chequear(
  "el nombre con saltos queda en una sola línea",
  inyeccion.includes("Juan PEDIDO NUEVO — IM-999 PAGADO CON TARJETA"),
);

const inyeccionDir = plantillaLocal({ ...base, dir: "Calle 1\nTotal $1" }, "pedido_recibido");
chequear("un salto de línea en la dirección tampoco agrega líneas", inyeccionDir.split("\n").length === efectivo.split("\n").length);

if (fallos > 0) {
  console.error(`\n${fallos} caso(s) fallaron`);
  process.exit(1);
}
console.log("\nTodos los casos pasan");
