import { motivoNoEliminable, MAXIMO_POR_VEZ } from "../lib/eliminar-pedidos";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { console.error(`FALLA  ${nombre}`); fallos++; }
}

chequear("efectivo pendiente se puede eliminar", motivoNoEliminable({ metodo_pago: "efectivo", estado_pago: "pendiente" }, false) === null);
chequear("efectivo cobrado y entregado se puede eliminar", motivoNoEliminable({ metodo_pago: "efectivo", estado_pago: "aprobado" }, false) === null);
chequear("transferencia acreditada sin registro contable se puede eliminar", motivoNoEliminable({ metodo_pago: "transferencia", estado_pago: "aprobado" }, false) === null);
chequear("tarjeta pendiente se puede eliminar", motivoNoEliminable({ metodo_pago: "mercadopago", estado_pago: "pendiente" }, false) === null);
chequear("tarjeta rechazada se puede eliminar", motivoNoEliminable({ metodo_pago: "mercadopago", estado_pago: "rechazado" }, false) === null);
chequear("tarjeta acreditada NO se elimina", motivoNoEliminable({ metodo_pago: "mercadopago", estado_pago: "aprobado" }, false) !== null);
chequear("tarjeta devuelta NO se elimina", motivoNoEliminable({ metodo_pago: "mercadopago", estado_pago: "reembolsado" }, false) !== null);
chequear("tarjeta con devolución parcial NO se elimina", motivoNoEliminable({ metodo_pago: "MercadoPago", estado_pago: "parcialmente_reembolsado" }, false) !== null);
chequear("con costeo o movimientos guardados NO se elimina", motivoNoEliminable({ metodo_pago: "transferencia", estado_pago: "aprobado" }, true) !== null);
chequear("hay un tope por vez", MAXIMO_POR_VEZ > 0 && MAXIMO_POR_VEZ <= 200);

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
