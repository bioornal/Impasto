import { validarCuando } from "../lib/validar-cuando";

let fallos = 0;

try {
  const r = validarCuando("asap");
  if (r === "asap") console.log("PASA   validarCuando('asap') devuelve 'asap'");
  else { fallos++; console.log("FALLA  esperado 'asap', obtuvo", r); }
} catch (e) {
  fallos++;
  console.log("FALLA  validarCuando('asap') lanzó error:", e);
}

try {
  const r = validarCuando("");
  if (r === "asap") console.log("PASA   validarCuando('') asume 'asap'");
  else { fallos++; console.log("FALLA  esperado 'asap', obtuvo", r); }
} catch (e) {
  fallos++;
  console.log("FALLA  validarCuando('') lanzó error:", e);
}

try {
  validarCuando("21:00");
  fallos++;
  console.log("FALLA  validarCuando('21:00') debió lanzar error");
} catch (e) {
  const msg = (e as Error).message;
  if (msg === "Por ahora solo tomamos pedidos para ya") {
    console.log("PASA   validarCuando('21:00') rechaza con mensaje esperado");
  } else {
    fallos++;
    console.log("FALLA  mensaje incorrecto:", msg);
  }
}

try {
  validarCuando("22:00");
  console.log("FALLA  validarCuando('22:00') debió lanzar error");
  fallos++;
} catch {
  console.log("PASA   validarCuando('22:00') rechaza programado");
}

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
