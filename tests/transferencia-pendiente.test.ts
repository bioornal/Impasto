import { esperaComprobante, estadoVisibleAlCliente } from "../lib/transferencia-pendiente";
import { plantilla } from "../lib/plantilla-email";
import type { BusinessConfig } from "../lib/business";
import type { AvisoPedido } from "../lib/aviso-local";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

/* ── cuándo se espera el comprobante ── */

chequear("transferencia pendiente espera el comprobante", esperaComprobante("transferencia", "pendiente") === true);
chequear("sin estado de pago cuenta como pendiente", esperaComprobante("transferencia", "") === true);
chequear("tolera mayúsculas y espacios", esperaComprobante(" Transferencia ", "Pendiente") === true);
chequear("transferencia acreditada ya no espera", esperaComprobante("transferencia", "aprobado") === false);
chequear("efectivo no espera comprobante", esperaComprobante("efectivo", "pendiente") === false);
chequear("tarjeta no espera comprobante", esperaComprobante("mercadopago", "pendiente") === false);

/* ── qué estado ve el cliente ── */

chequear("sin pagar, 'preparando' se ve como 'nuevo'", estadoVisibleAlCliente("preparando", "transferencia", "pendiente") === "nuevo");
chequear("sin pagar, 'en-camino' se ve como 'nuevo'", estadoVisibleAlCliente("en-camino", "transferencia", "pendiente") === "nuevo");
chequear("sin pagar, 'nuevo' sigue 'nuevo'", estadoVisibleAlCliente("nuevo", "transferencia", "pendiente") === "nuevo");
chequear("sin pagar, 'cancelado' se respeta", estadoVisibleAlCliente("cancelado", "transferencia", "pendiente") === "cancelado");
chequear("pagada, 'preparando' se ve igual", estadoVisibleAlCliente("preparando", "transferencia", "aprobado") === "preparando");
chequear("efectivo, 'preparando' se ve igual", estadoVisibleAlCliente("preparando", "efectivo", "pendiente") === "preparando");

/* ── el mail ── */

const negocio = { name: "Impasto", locationLabel: "Puerto Iguazú", address: "Calle 1", phone: "3757000000" } as unknown as BusinessConfig;
const aviso = (metodoPago: string): AvisoPedido => ({
  pedidoId: "x", referencia: "IM-000001-ABCD", nombre: "Ana Pérez", email: "a@b.c", mode: "takeaway",
  items: [], subtotal: 1000, shipping: 0, total: 1000, metodoPago,
});

const mailTransferencia = plantilla(aviso("transferencia"), negocio, "pedido_recibido");
chequear("mail de transferencia no dice que lo estamos preparando", !/preparando/i.test(mailTransferencia.html));
chequear("mail de transferencia pide el comprobante", /comprobante/i.test(mailTransferencia.html));
chequear("el asunto de transferencia no dice 'Recibimos tu pedido'", !/Recibimos tu pedido/.test(mailTransferencia.subject));

const mailEfectivo = plantilla(aviso("efectivo"), negocio, "pedido_recibido");
chequear("mail de efectivo conserva 'Ya lo estamos preparando'", /Ya lo estamos preparando/.test(mailEfectivo.html));

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
