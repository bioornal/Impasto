import { precioDesde } from "../lib/reglas-carta";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

const pizza = (precio: number, disponible = true) => ({ precio, disponible });

chequear("toma el precio más bajo", precioDesde([pizza(18000), pizza(14000), pizza(15500)]) === 14000);

/* El "desde" es una promesa: si la más barata está agotada, no se puede pedir. */
chequear(
  "deja afuera las agotadas",
  precioDesde([pizza(14000, false), pizza(15500), pizza(18000)]) === 15500,
);

/* Un precio 0 o roto en la carta no puede terminar en "desde $0" en el hero. */
chequear(
  "deja afuera precios 0 o inválidos",
  precioDesde([pizza(0), pizza(Number.NaN), pizza(-100), pizza(16000)]) === 16000,
);

chequear("sin pizzas devuelve null", precioDesde([]) === null);
chequear("con todas agotadas devuelve null", precioDesde([pizza(14000, false), pizza(15000, false)]) === null);

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
