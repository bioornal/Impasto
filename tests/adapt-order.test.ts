import { adaptOrder } from "../lib/adapt-order";

let fallos = 0;

const rawConDetalle = {
  id: "order-123",
  numero_pedido: 1042,
  external_reference: "IM-1042-AB12",
  nombre_cliente: "Juan Pérez",
  telefono_cliente: "3757123456",
  total: 33000,
  productos: [
    { name: "Caja x12", qty: 1, price: 30000, detail: "4 Pollo, 4 Carne, 4 Árabe" },
    { name: "Coca-Cola 1.5 L", qty: 1, price: 3000 }
  ],
};

const adapted = adaptOrder(rawConDetalle);

if (adapted.items.length === 2) {
  console.log("PASA   adaptOrder conserva la cantidad de items");
} else {
  fallos++;
  console.log("FALLA  cantidad de items inesperada:", adapted.items.length);
}

if (adapted.items[0]?.detail === "4 Pollo, 4 Carne, 4 Árabe") {
  console.log("PASA   adaptOrder conserva el detail de la caja de empanadas");
} else {
  fallos++;
  console.log("FALLA  detail esperado '4 Pollo, 4 Carne, 4 Árabe', obtuvo:", adapted.items[0]?.detail);
}

if (adapted.items[1]?.detail === "") {
  console.log("PASA   adaptOrder asigna string vacío cuando no hay detail");
} else {
  fallos++;
  console.log("FALLA  item sin detail esperado '', obtuvo:", adapted.items[1]?.detail);
}

const rawConDetalleAlternativo = {
  id: "order-124",
  productos: [
    { nombre: "Pizza Mitad y Mitad", cantidad: 1, precio: 18000, detalle: "1/2 Margarita + 1/2 Cuatro Quesos" }
  ]
};

const adapted2 = adaptOrder(rawConDetalleAlternativo);
if (adapted2.items[0]?.detail === "1/2 Margarita + 1/2 Cuatro Quesos") {
  console.log("PASA   adaptOrder soporta campo alternativo 'detalle'");
} else {
  fallos++;
  console.log("FALLA  soporte 'detalle' falló:", adapted2.items[0]?.detail);
}

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
