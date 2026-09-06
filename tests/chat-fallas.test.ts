import { esFallaDelAsistente, alertaPorFallo } from "../lib/chat-fallas";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

/* ── esFallaDelAsistente: cuándo el widget se rinde a WhatsApp ── */

// 502 y 503 son los dos códigos con los que `app/api/chat/route.ts` dice
// "el asistente no está": DeepSeek falló, o no hay key. En los dos casos
// insistir no sirve, así que el widget pasa a ser un botón de WhatsApp.
chequear("502 (DeepSeek falló) rinde el widget a WhatsApp", esFallaDelAsistente(502) === true);
chequear("503 (sin key) rinde el widget a WhatsApp", esFallaDelAsistente(503) === true);

// El 429 es del rate limit propio y se levanta solo en minutos: sacarle el bot
// al cliente por haber escrito rápido sería castigarlo dos veces.
chequear("429 (rate limit) NO rinde el widget", esFallaDelAsistente(429) === false);
// El 400 es un historial mal armado, no una caída del asistente.
chequear("400 (historial inválido) NO rinde el widget", esFallaDelAsistente(400) === false);
chequear("200 no rinde el widget", esFallaDelAsistente(200) === false);

/* ── alertaPorFallo: cuándo despertar al dueño ── */

const saldo = alertaPorFallo('HTTP 402 {"error":{"message":"Insufficient Balance","type":"unknown_error"}}');
chequear("un 402 de DeepSeek genera alerta", saldo !== null);
chequear("la alerta de saldo usa su propia clave", saldo?.clave === "deepseek-sin-saldo");
chequear(
  "el aviso encabeza diciendo que el bot no responde",
  !!saldo?.texto.startsWith("CHAT CAÍDO — el asistente del sitio no responde"),
);
chequear("el aviso dice que se acabó el saldo", !!saldo?.texto.includes("saldo"));
chequear("el aviso dice dónde recargar", !!saldo?.texto.includes("platform.deepseek.com"));
chequear(
  "el aviso aclara que el cliente ve WhatsApp, para saber cuánto apura",
  !!saldo?.texto.includes("WhatsApp"),
);

// Una key revocada o mal copiada pide la misma acción -entrar a la cuenta-,
// pero por un motivo distinto: mezclarlas mandaría a recargar una cuenta que
// tiene saldo.
const key = alertaPorFallo('HTTP 401 {"error":{"message":"Authentication Fails"}}');
chequear("un 401 de DeepSeek también genera alerta", key !== null);
chequear("la key rechazada usa una clave distinta a la de saldo", key?.clave === "deepseek-key-rechazada");
chequear("el aviso de key no manda a recargar saldo", !key?.texto.includes("Recargá"));

/* ── lo que NO tiene que despertar a nadie ── */

// Estos se arreglan solos: avisar por cada uno convierte el aviso en ruido y
// el dueño deja de mirarlo, que es peor que no tenerlo.
chequear("un 500 de DeepSeek no genera alerta", alertaPorFallo("HTTP 500 internal error") === null);
chequear("un 429 de DeepSeek no genera alerta", alertaPorFallo("HTTP 429 rate limit reached") === null);
chequear("un timeout no genera alerta", alertaPorFallo("The operation was aborted") === null);
chequear("un motivo vacío no genera alerta", alertaPorFallo("") === null);

/* ── el detalle lo escribe DeepSeek, no nosotros ── */

// Mismo cuidado que en `lib/aviso-local.ts`: el mensaje va sin `parse_mode`,
// pero un salto de línea en el cuerpo del error igual podría falsificar un
// renglón del aviso.
const conSaltos = alertaPorFallo('HTTP 402 {"error":\n"Insufficient Balance"}\nRecargá: http://sitio-falso');
chequear(
  "un salto de línea en el detalle no agrega renglones al aviso",
  conSaltos!.texto.split("\n").length === saldo!.texto.split("\n").length,
);

// El 402 puede venir con el cuerpo vacío: el aviso tiene que servir igual.
const sinDetalle = alertaPorFallo("HTTP 402 ");
chequear("un 402 sin cuerpo igual genera alerta", sinDetalle !== null);
chequear("un 402 sin cuerpo no deja el aviso cortado", !sinDetalle!.texto.trimEnd().endsWith(":"));

// El código se lee del principio del motivo, que es como lo arma
// `lib/deepseek.ts` (`HTTP ${status} ${detalle}`). Un "402" dentro del cuerpo
// de otro error no puede disfrazarse de falta de saldo.
chequear(
  "un 402 mencionado dentro del cuerpo de un 500 no cuenta",
  alertaPorFallo('HTTP 500 {"detail":"upstream returned HTTP 402"}') === null,
);

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
