import { esPedidoParaCocina, esPedidoValidoParaVentas } from "../lib/pedido-visible";

let fallos = 0;

const casos: [string, Parameters<typeof esPedidoParaCocina>[0], boolean][] = [
  ["tarjeta pendiente", { metodo_pago: "mercadopago", estado_pago: "pendiente", status: "normal" }, false],
  ["tarjeta rechazado", { metodo_pago: "mercadopago", estado_pago: "rechazado", status: "normal" }, false],
  ["tarjeta aprobado", { metodo_pago: "mercadopago", estado_pago: "aprobado", status: "normal" }, true],
  ["efectivo pendiente", { metodo_pago: "efectivo", estado_pago: "pendiente", status: "normal" }, true],
  ["transferencia pendiente", { metodo_pago: "transferencia", estado_pago: "pendiente", status: "normal" }, true],
  ["efectivo cancelado", { metodo_pago: "efectivo", estado_pago: "pendiente", status: "cancelado" }, false],
  ["formato admin (pago/pagoEstado) tarjeta rechazada", { pago: "mercadopago", pagoEstado: "rechazado", estado: "nuevo" }, false],
  ["formato admin (pago/pagoEstado) tarjeta aprobada", { pago: "mercadopago", pagoEstado: "aprobado", estado: "nuevo" }, true],
  ["formato admin (pago/pagoEstado) cancelado", { pago: "efectivo", pagoEstado: "pendiente", estado: "cancelado" }, false],
];

for (const [nombre, p, esperado] of casos) {
  const cocina = esPedidoParaCocina(p);
  if (cocina !== esperado) {
    fallos++;
    console.log(`FALLA  esPedidoParaCocina · ${nombre}: esperado ${esperado}, obtuvo ${cocina}`);
  } else {
    console.log(`PASA   esPedidoParaCocina · ${nombre}`);
  }

  const ventas = esPedidoValidoParaVentas(p);
  if (ventas !== esperado) {
    fallos++;
    console.log(`FALLA  esPedidoValidoParaVentas · ${nombre}: esperado ${esperado}, obtuvo ${ventas}`);
  } else {
    console.log(`PASA   esPedidoValidoParaVentas · ${nombre}`);
  }
}

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
