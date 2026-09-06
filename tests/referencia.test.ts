import { nuevaReferencia, esReferenciaValida } from "../lib/referencia";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

/* ── forma de la referencia ── */

const ref = nuevaReferencia(107345);
chequear("arranca con IM- y el número del pedido", ref.startsWith("IM-107345-"));
chequear("tiene la forma IM-######-XXXX", /^IM-\d{6}-[A-Z0-9]{4}$/.test(ref));

// El cliente la lee en voz alta por teléfono y la tipea en la URL del
// seguimiento: un 0 que era una O manda a un "pedido no encontrado".
const sufijos = Array.from({ length: 400 }, () => nuevaReferencia(107345).split("-")[2]);
chequear(
  "el sufijo no usa caracteres que se confunden al dictarlo (O, I, 0, 1)",
  sufijos.every((s) => !/[OI01]/.test(s)),
);

/* ── impredecibilidad: es lo que protege los datos del cliente ── */

// Con el mismo número de pedido, dos referencias distintas. Si el sufijo fuera
// constante o derivado del número, la referencia volvería a ser adivinable y la
// ruta pública de seguimiento volvería a ser enumerable.
const unicos = new Set(sufijos);
chequear("400 referencias del mismo pedido dan sufijos casi todos distintos", unicos.size > 380);

// El bug que esto también arregla: `Date.now() % 900000` se repetía cada 15
// minutos, y con un índice no único el webhook podía marcar pagado el pedido
// equivocado. Dos pedidos con el mismo número ya no comparten referencia.
chequear(
  "dos pedidos con el MISMO número no comparten referencia",
  nuevaReferencia(107345) !== nuevaReferencia(107345),
);

/* ── validación: lo que la ruta pública acepta antes de tocar la base ── */

chequear("acepta una referencia recién generada", esReferenciaValida(ref));
chequear("acepta en minúsculas (la gente tipea la URL a mano)", esReferenciaValida(ref.toLowerCase()));
chequear("acepta con espacios alrededor", esReferenciaValida(`  ${ref}  `));

// Rechazar el formato viejo -sin sufijo- es a propósito: es el que se podía
// barrer entero (900.000 valores). La tabla `pedidos` estaba vacía cuando se
// hizo el cambio, así que no hay pedidos viejos que romper.
chequear("rechaza el formato viejo sin sufijo", !esReferenciaValida("IM-107345"));
chequear("rechaza un sufijo corto", !esReferenciaValida("IM-107345-K7Q"));
chequear("rechaza otro prefijo", !esReferenciaValida("CF-107345-K7QD"));
chequear("rechaza vacío", !esReferenciaValida(""));
chequear("rechaza basura", !esReferenciaValida("../../etc/passwd"));
chequear("rechaza intento de inyección", !esReferenciaValida("IM-1' or '1'='1"));
chequear("rechaza un número de más dígitos", !esReferenciaValida("IM-1073455-K7QD"));

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
