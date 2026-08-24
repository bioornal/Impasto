import { parsearNegrita } from "../lib/chat-negrita";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

/** El texto concatenado de todos los tramos, en orden. */
function concatenado(tramos: ReturnType<typeof parsearNegrita>): string {
  return tramos.map((t) => t.texto).join("");
}

/** Cuántos caracteres "**" hay en el original. */
function contarAsteriscosDobles(texto: string): number {
  return (texto.match(/\*\*/g) ?? []).length;
}

/* ── un tramo en negrita en el medio de una frase ── */
const medio = parsearNegrita("Te recomiendo la **Pizza Margarita** para arrancar.");
chequear("detecta el tramo en negrita", medio.some((t) => t.negrita && t.texto === "Pizza Margarita"));
chequear("conserva el texto antes", medio[0].texto === "Te recomiendo la " && !medio[0].negrita);
chequear("conserva el texto después", medio[medio.length - 1].texto === " para arrancar." && !medio[medio.length - 1].negrita);
chequear("exactamente tres tramos", medio.length === 3);

/* ── dos tramos en negrita en el mismo mensaje ── */
const dos = parsearNegrita("La **Napoletana** ($13.000) o la **4 Quesos** ($18.000).");
const negritas = dos.filter((t) => t.negrita).map((t) => t.texto);
chequear("detecta los dos tramos en negrita, en orden", negritas.length === 2 && negritas[0] === "Napoletana" && negritas[1] === "4 Quesos");

/* ── sin ninguna negrita ── */
const sinNegrita = parsearNegrita("Un mensaje normal, sin marcado.");
chequear("sin ** devuelve un solo tramo plano", sinNegrita.length === 1 && !sinNegrita[0].negrita);
chequear("el tramo plano es el texto entero", sinNegrita[0].texto === "Un mensaje normal, sin marcado.");

/* ── un ** sin cerrar: literal, no se come el resto ── */
const sinCerrar = parsearNegrita("Precio **importante que no cierra y el mensaje sigue.");
chequear("ningún tramo queda marcado en negrita", sinCerrar.every((t) => !t.negrita));
chequear("el texto completo se conserva, asteriscos incluidos", concatenado(sinCerrar) === "Precio **importante que no cierra y el mensaje sigue.");

/* ── **** vacío ── */
const vacio = parsearNegrita("Antes **** después");
chequear("no deja asteriscos sueltos en ningún tramo", vacio.every((t) => !t.texto.includes("*")));
chequear("el tramo de negrita vacío no aporta texto visible", vacio.filter((t) => t.negrita).every((t) => t.texto === ""));
chequear("concatenado da el original sin los cuatro asteriscos", concatenado(vacio) === "Antes  después");

/* ── empieza en negrita ── */
const empieza = parsearNegrita("**Arranca** así el mensaje.");
chequear("el primer tramo es la negrita, sin un plano vacío antes", empieza[0].negrita && empieza[0].texto === "Arranca");

/* ── termina en negrita ── */
const termina = parsearNegrita("El mensaje termina en **negrita**");
chequear("el último tramo es la negrita, sin un plano vacío después", termina[termina.length - 1].negrita && termina[termina.length - 1].texto === "negrita");

/* ── invariante general: nada se pierde ni se duplica ──
 * El concatenado de todos los tramos tiene que ser el original menos
 * exactamente los "**" que se usaron como delimitadores válidos (múltiplo de
 * 4 caracteres: dos pares por cada tramo en negrita detectado). */
function chequearInvariante(nombre: string, texto: string) {
  const tramos = parsearNegrita(texto);
  const cantidadNegritas = tramos.filter((t) => t.negrita).length;
  const esperado = texto.length - cantidadNegritas * 4;
  chequear(`invariante — ${nombre}`, concatenado(tramos).length === esperado);
}
chequearInvariante("medio", "Te recomiendo la **Pizza Margarita** para arrancar.");
chequearInvariante("dos negritas", "La **Napoletana** ($13.000) o la **4 Quesos** ($18.000).");
chequearInvariante("sin negrita", "Un mensaje normal, sin marcado.");
chequearInvariante("sin cerrar", "Precio **importante que no cierra y el mensaje sigue.");
chequearInvariante("vacío", "Antes **** después");
chequearInvariante("empieza en negrita", "**Arranca** así el mensaje.");
chequearInvariante("termina en negrita", "El mensaje termina en **negrita**");

// Chequeo extra, con el ejemplo real de la API que motivó el arreglo.
const textoReal =
  "Te recomiendo arrancar con una **Pizza Napoletana Margarita Clásica** ($13.000), es vegetariana\ny gourmet. Y si quieren algo más contundente, la **Pizza 4 Quesos** ($18.000) es la que no falla.";
const real = parsearNegrita(textoReal);
chequear("caso real: dos productos en negrita", real.filter((t) => t.negrita).length === 2);
chequear("caso real: ningún tramo tiene asteriscos", real.every((t) => !t.texto.includes("*")));
chequear("caso real: cuatro asteriscos dobles en el original (dos pares)", contarAsteriscosDobles(textoReal) === 4);
chequear(
  "caso real: nada se pierde (invariante de longitud)",
  concatenado(real).length === textoReal.length - real.filter((t) => t.negrita).length * 4,
);

if (fallos > 0) {
  console.error(`\n${fallos} falla(s).`);
  process.exit(1);
} else {
  console.log("\nOK: parsearNegrita.");
}
