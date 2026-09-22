import { DatabaseOperationError, requireDbRows, requireUpdatedRow } from "../lib/db-result";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

function captura(fn: () => unknown): unknown {
  try { fn(); } catch (error) { return error; }
  return null;
}

const errorLectura = captura(() => requireDbRows({ data: null, error: new Error("base caída") }, "leer pedido"));
chequear("un error devuelto por el SDK no se confunde con cero filas", errorLectura instanceof DatabaseOperationError);

const filas = [{ id: "pedido-1" }];
chequear("una lectura correcta devuelve sus filas", requireDbRows({ data: filas, error: null }, "leer pedido") === filas);

const sinActualizacion = captura(() => requireUpdatedRow({ data: [], error: null }, "guardar pago"));
chequear("actualizar cero filas es un fallo de persistencia", sinActualizacion instanceof DatabaseOperationError);

const actualizada = { id: "pedido-1", estado_pago: "aprobado" };
chequear(
  "una actualización confirmada devuelve la fila persistida",
  requireUpdatedRow({ data: [actualizada], error: null }, "guardar pago") === actualizada,
);

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
