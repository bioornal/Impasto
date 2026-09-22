import { validarActualizacionAdminPedido } from "../lib/admin-order-update";

let fallos = 0;

function verificar(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    fallos++;
    console.log(`FALLA  ${nombre}`);
  }
}

const tarjetaPendiente = {
  metodo_pago: "mercadopago",
  estado_pago: "pendiente",
  status: "normal",
};

verificar(
  "Mercado Pago pendiente no puede pasar a preparación",
  validarActualizacionAdminPedido(tarjetaPendiente, { status: "preparando" }) !== null,
);
verificar(
  "Mercado Pago rechazado no puede pasar a reparto",
  validarActualizacionAdminPedido(
    { ...tarjetaPendiente, estado_pago: "rechazado" },
    { status: "en-camino" },
  ) !== null,
);
verificar(
  "Mercado Pago aprobado puede pasar a preparación",
  validarActualizacionAdminPedido(
    { ...tarjetaPendiente, estado_pago: "aprobado" },
    { status: "preparando" },
  ) === null,
);
verificar(
  "Mercado Pago pendiente puede cancelarse",
  validarActualizacionAdminPedido(tarjetaPendiente, { status: "cancelado" }) === null,
);
verificar(
  "el panel no puede acreditar manualmente Mercado Pago",
  validarActualizacionAdminPedido(tarjetaPendiente, { estado_pago: "aprobado" }) !== null,
);
verificar(
  "efectivo pendiente puede acreditarse manualmente",
  validarActualizacionAdminPedido(
    { metodo_pago: "efectivo", estado_pago: "pendiente", status: "normal" },
    { estado_pago: "aprobado" },
  ) === null,
);
verificar(
  "transferencia pendiente puede acreditarse manualmente",
  validarActualizacionAdminPedido(
    { metodo_pago: "transferencia", estado_pago: "pendiente", status: "normal" },
    { estado_pago: "aprobado" },
  ) === null,
);
verificar(
  "efectivo pendiente puede pasar a preparación",
  validarActualizacionAdminPedido(
    { metodo_pago: "efectivo", estado_pago: "pendiente", status: "normal" },
    { status: "preparando" },
  ) === null,
);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
