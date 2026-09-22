import {
  clavesDePedidos,
  clavesDePedidosParaCocina,
  esPedidoParaCocina,
  esPedidoValidoParaVentas,
  pedidosNuevosParaCocina,
  registrarPedidosConocidosParaCocina,
} from "../lib/pedido-visible";
import { adaptOrder } from "../lib/adapt-order";

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

function verificar(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    fallos++;
    console.log(`FALLA  ${nombre}`);
  }
}

// El POS numera 1, 2, 3… y reinicia cada día, y el panel recibe el histórico completo.
const filaPos = (uuid: string, fecha: string) => ({
  id: uuid,
  numero_pedido: 1,
  external_reference: "",
  metodo_pago: "efectivo",
  estado_pago: "pendiente",
  status: "normal",
  fecha,
  created_at: `${fecha}T23:00:00Z`,
});
const ayer = adaptOrder(filaPos("5f0c2a1e-ayer", "2026-09-16"));
const hoy = adaptOrder(filaPos("9d41b7c3-hoy", "2026-09-17"));

verificar("dos pedidos de POS de días distintos comparten el id visible", ayer.id === hoy.id);

const nuevosHoy = pedidosNuevosParaCocina(clavesDePedidos([ayer]), [hoy, ayer]);
verificar(
  "el #1 de hoy suena aunque ayer hubo otro #1",
  nuevosHoy.length === 1 && nuevosHoy[0]._dbId === hoy._dbId,
);

verificar(
  "un pedido ya conocido no vuelve a sonar",
  pedidosNuevosParaCocina(clavesDePedidos([ayer, hoy]), [hoy, ayer]).length === 0,
);

const hoyCancelado = adaptOrder({ ...filaPos("c2e8f0aa-cancelado", "2026-09-17"), status: "cancelado" });
verificar(
  "un pedido nuevo pero cancelado no suena",
  pedidosNuevosParaCocina(clavesDePedidos([ayer]), [hoyCancelado]).length === 0,
);

const tarjetaPendiente = adaptOrder({
  ...filaPos("tarjeta-pendiente", "2026-09-17"),
  metodo_pago: "mercadopago",
  estado_pago: "pendiente",
});
const conocidosMientrasPendiente = clavesDePedidosParaCocina([tarjetaPendiente]);
verificar(
  "una tarjeta pendiente no se marca como conocida por cocina",
  conocidosMientrasPendiente.size === 0,
);

const tarjetaAprobada = { ...tarjetaPendiente, pagoEstado: "aprobado" };
const aprobadosNuevos = pedidosNuevosParaCocina(conocidosMientrasPendiente, [tarjetaAprobada]);
verificar(
  "una tarjeta suena cuando pasa de pendiente a aprobada",
  aprobadosNuevos.length === 1 && aprobadosNuevos[0]._dbId === tarjetaAprobada._dbId,
);

const conocidosDespuesDeAprobar = registrarPedidosConocidosParaCocina(
  conocidosMientrasPendiente,
  [tarjetaAprobada],
);
verificar(
  "una tarjeta aprobada no vuelve a sonar en el siguiente sondeo",
  pedidosNuevosParaCocina(conocidosDespuesDeAprobar, [tarjetaAprobada]).length === 0,
);

const aprobadaLuegoCancelada = { ...tarjetaAprobada, estado: "cancelado" };
const conocidosDespuesDeCancelar = registrarPedidosConocidosParaCocina(
  conocidosDespuesDeAprobar,
  [aprobadaLuegoCancelada],
);
verificar(
  "cancelar no olvida un pedido ya anunciado a cocina",
  conocidosDespuesDeCancelar.has(tarjetaAprobada._dbId),
);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
