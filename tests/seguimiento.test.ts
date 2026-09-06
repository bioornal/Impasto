import { esRespuestaDefinitiva, esEstadoFinal } from "../lib/seguimiento";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

/* ── cuándo dejar de preguntar por el pedido ── */

// Una referencia mal escrita o que no existe no va a aparecer sola: seguir
// consultando cada 15 s es machacar la API para siempre.
chequear("400 (referencia inválida) es definitivo", esRespuestaDefinitiva(400) === true);
chequear("404 (pedido inexistente) es definitivo", esRespuestaDefinitiva(404) === true);

// Estos sí se arreglan solos, así que la página tiene que seguir intentando:
// cortar acá dejaría al cliente con un pedido real y una pantalla muerta.
chequear("429 (rate limit) NO es definitivo: la ventana se libera sola", esRespuestaDefinitiva(429) === false);
chequear("500 NO es definitivo", esRespuestaDefinitiva(500) === false);
chequear("502 NO es definitivo", esRespuestaDefinitiva(502) === false);
chequear("200 NO es definitivo", esRespuestaDefinitiva(200) === false);

/* ── cuándo el pedido ya no va a cambiar ── */

chequear("entregado es estado final", esEstadoFinal("entregado") === true);
chequear("cancelado es estado final", esEstadoFinal("cancelado") === true);

chequear("nuevo no es final", esEstadoFinal("nuevo") === false);
chequear("preparando no es final", esEstadoFinal("preparando") === false);
chequear("en-camino no es final", esEstadoFinal("en-camino") === false);

// Ante un estado que no conocemos conviene seguir consultando: parar de más
// congela la pantalla de un pedido que sí estaba avanzando.
chequear("un estado desconocido no corta el refresco", esEstadoFinal("inventado") === false);
chequear("vacío no corta el refresco", esEstadoFinal("") === false);
chequear("undefined no corta el refresco", esEstadoFinal(undefined) === false);

// El estado sale de la base y lo escribe el panel: no vale la pena romperse
// por un espacio o una mayúscula.
chequear("tolera mayúsculas", esEstadoFinal("Entregado") === true);
chequear("tolera espacios", esEstadoFinal("  cancelado ") === true);

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
