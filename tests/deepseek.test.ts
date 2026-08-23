import { textoDeLineaSSE, streamDeTexto, hayChat } from "../lib/deepseek";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

const delta = (texto: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: texto } }] })}`;

/* ── una línea por vez ── */
chequear("saca el texto de una línea de datos", textoDeLineaSSE(delta("Hola")) === "Hola");
chequear("ignora la línea de fin", textoDeLineaSSE("data: [DONE]") === null);
chequear("ignora las líneas en blanco", textoDeLineaSSE("") === null);
chequear("ignora lo que no es data", textoDeLineaSSE(": keep-alive") === null);
chequear("no explota con JSON roto", textoDeLineaSSE("data: {no es json") === null);
chequear("ignora un delta sin contenido", textoDeLineaSSE(`data: ${JSON.stringify({ choices: [{ delta: {} }] })}`) === null);

/* ── el stream completo ── */
async function textoDe(trozos: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const origen = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const trozo of trozos) controller.enqueue(encoder.encode(trozo));
      controller.close();
    },
  });
  let salida = "";
  const decoder = new TextDecoder();
  for await (const parte of streamDeTexto(origen) as unknown as AsyncIterable<Uint8Array>) {
    salida += decoder.decode(parte, { stream: true });
  }
  return salida;
}

// Todo lo asincrónico va acá adentro: `tsx` compila a CJS en este repo y el
// top-level await no compila. Se verificó: falla con "Top-level await is
// currently not supported with the cjs output format".
async function main() {
  const completo = await textoDe([`${delta("Hola")}\n\n`, `${delta(" mundo")}\n\n`, "data: [DONE]\n\n"]);
  chequear("junta los fragmentos en orden", completo === "Hola mundo");

  // El caso que rompe las implementaciones ingenuas: un chunk de red puede
  // cortar una línea al medio, y el pedazo suelto no es JSON válido por sí solo.
  const partido = await textoDe([`${delta("Che")}\n\ndata: {"choices":[{"delta":{"con`, `tent":" bo"}}]}\n\n`]);
  chequear("arma las líneas partidas entre dos chunks", partido === "Che bo");

  const soloRuido = await textoDe([": keep-alive\n\n", "\n"]);
  chequear("un stream sin texto devuelve vacío", soloRuido === "");

  /* ── la key ── */
  delete process.env.DEEPSEEK_API_KEY;
  chequear("sin key el chat no está disponible", hayChat() === false);
  process.env.DEEPSEEK_API_KEY = "sk-loquesea";
  chequear("con key el chat está disponible", hayChat() === true);

  console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
  process.exit(fallos === 0 ? 0 : 1);
}

main();
