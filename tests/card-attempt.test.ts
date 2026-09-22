import {
  clearCardAttemptReference,
  createCardAttemptReference,
  decideCardAttempt,
  getOrCreateCardAttemptReference,
  normalizeCardAttemptReference,
  resolveOrderExternalReference,
  shouldConfirmPendingCardAttempt,
  type PersistedCardAttempt,
} from "../lib/card-attempt";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

class Memoria implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private datos = new Map<string, string>();
  getItem(clave: string) { return this.datos.get(clave) ?? null; }
  setItem(clave: string, valor: string) { this.datos.set(clave, valor); }
  removeItem(clave: string) { this.datos.delete(clave); }
}

const bytesCero = { getRandomValues<T extends ArrayBufferView>(array: T): T {
  new Uint32Array(array.buffer, array.byteOffset, array.byteLength / 4).fill(0);
  return array;
} };

chequear(
  "crea la referencia antes del primer envío con formato rastreable",
  createCardAttemptReference(bytesCero) === "IM-100000-AAAA",
);
chequear("el servidor normaliza la referencia enviada por el navegador", normalizeCardAttemptReference(" im-123456-abcd ") === "IM-123456-ABCD");
chequear("el servidor rechaza referencias inventadas", normalizeCardAttemptReference("IM-123456-0000") === null);
chequear(
  "un pedido con tarjeta conserva la referencia creada antes del request",
  resolveOrderExternalReference(" im-123456-abcd ", () => "IM-999999-ZZZZ") === "IM-123456-ABCD",
);
chequear(
  "un pedido offline sigue generando su referencia en el servidor",
  resolveOrderExternalReference(undefined, () => "IM-999999-ZZZZ") === "IM-999999-ZZZZ",
);
chequear(
  "un 202 pendiente abre el seguimiento en vez de invitar a pagar otra vez",
  shouldConfirmPendingCardAttempt(202, { numero: "IM-123456-ABCD", estadoPago: "pendiente" }),
);
chequear(
  "un rechazo definitivo permanece en el checkout para una tarjeta nueva",
  !shouldConfirmPendingCardAttempt(402, { numero: "IM-123456-ABCD", estadoPago: "rechazado" }),
);

const storage = new Memoria();
let creaciones = 0;
const primera = getOrCreateCardAttemptReference(storage, () => {
  creaciones++;
  return "IM-123456-ABCD";
});
const segunda = getOrCreateCardAttemptReference(storage, () => {
  creaciones++;
  return "IM-654321-WXYZ";
});
chequear("una pérdida de respuesta reutiliza la misma referencia", primera === segunda && creaciones === 1);

clearCardAttemptReference(storage, "IM-654321-WXYZ");
chequear("una respuesta vieja no borra un intento más nuevo", getOrCreateCardAttemptReference(storage) === primera);
clearCardAttemptReference(storage, primera);
chequear("un rechazo definitivo permite crear un intento nuevo", getOrCreateCardAttemptReference(storage, () => "IM-654321-WXYZ") !== primera);

const solicitud = {
  nombre: "Ana Pérez",
  tel: "+54 3757 111222",
  email: "ANA@EJEMPLO.COM",
  dir: "Av. Libertad 123",
  mode: "delivery",
  items: [{
    key: "pizza-1",
    cartId: "carrito-cambia",
    type: "pizza" as const,
    name: "Muzzarella",
    price: 999,
    qty: 2,
  }],
};

const existente: PersistedCardAttempt = {
  id: "pedido-1",
  external_reference: primera,
  estado_pago: "aprobado",
  nombre_cliente: " ana  pérez ",
  telefono_cliente: "3757111222",
  email_cliente: "ana@ejemplo.com",
  direccion: "av. libertad 123",
  modalidad: "delivery",
  productos: [{
    key: "pizza-1",
    cartId: "otro-carrito",
    type: "pizza",
    name: "Muzzarella actualizada",
    price: 15000,
    qty: 2,
  }],
};

chequear("un pedido aprobado idéntico se recupera sin cobrar", decideCardAttempt(existente, solicitud) === "recover-approved");
chequear("un pedido pendiente idéntico espera sin cobrar", decideCardAttempt({ ...existente, estado_pago: "pendiente" }, solicitud) === "wait-pending");
chequear("un pedido rechazado idéntico no reutiliza el token", decideCardAttempt({ ...existente, estado_pago: "rechazado" }, solicitud) === "return-rejected");
chequear("una referencia inexistente crea el pedido", decideCardAttempt(null, solicitud) === "create");
chequear(
  "la referencia no se puede reutilizar con otro carrito",
  decideCardAttempt({ ...existente, productos: [{ ...existente.productos[0], qty: 1 }] }, solicitud) === "conflict",
);
chequear(
  "la referencia no se puede reutilizar para otro cliente",
  decideCardAttempt({ ...existente, email_cliente: "otra@ejemplo.com" }, solicitud) === "conflict",
);

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
