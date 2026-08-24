import { textoDeLineaSSE, streamDeTexto, hayChat, chatStream } from "../lib/deepseek";

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
chequear("ignora choices vacío", textoDeLineaSSE(`data: ${JSON.stringify({ choices: [] })}`) === null);

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

  // Sin salto de línea final, la data queda entera en el buffer `resto` y
  // solo el flush() del TransformStream la puede recuperar.
  const sinNewlineFinal = await textoDe([delta("Fin")]);
  chequear("el flush recupera lo que quedó pendiente en el buffer", sinNewlineFinal === "Fin");

  // Algunos servidores separan con \r\n en vez de \n.
  const conCRLF = await textoDe([`${delta("Hola")}\r\n\r\n`, `${delta(" mundo")}\r\n\r\n`, "data: [DONE]\r\n\r\n"]);
  chequear("tolera separadores \\r\\n", conCRLF === "Hola mundo");

  /* ── el timeout de conexión no se puede quedar pegado al stream ── */
  // Antes se le pasaba `AbortSignal.timeout(20_000)` directo a `fetch`, que ata
  // la señal también al cuerpo de la respuesta: un stream que viene andando
  // bien se cortaría igual a los 20s, ya después de que la ruta mandó el 200 y
  // sin forma de avisar del error. La implementación actual arma su propio
  // `AbortController` y cancela el timer apenas llegan los headers. Se
  // verifica eso simulando un `fetch` instantáneo: el `clearTimeout` tiene que
  // dispararse con el mismo id que devolvió el `setTimeout` de la conexión, es
  // decir, el timer de 20s no debe seguir vivo mientras el stream corre.
  {
    const timersProgramados: ReturnType<typeof setTimeout>[] = [];
    const timersCancelados: ReturnType<typeof setTimeout>[] = [];
    const setTimeoutOriginal = global.setTimeout;
    const clearTimeoutOriginal = global.clearTimeout;
    global.setTimeout = ((fn: (...args: unknown[]) => void, ms?: number, ...resto: unknown[]) => {
      const id = setTimeoutOriginal(fn as never, ms, ...resto);
      timersProgramados.push(id);
      return id;
    }) as typeof setTimeout;
    global.clearTimeout = ((id?: Parameters<typeof clearTimeout>[0]) => {
      if (id !== undefined) timersCancelados.push(id as ReturnType<typeof setTimeout>);
      return clearTimeoutOriginal(id);
    }) as typeof clearTimeout;

    const fetchOriginal = global.fetch;
    global.fetch = (async () => {
      const encoder = new TextEncoder();
      const cuerpo = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`${delta("hola")}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(cuerpo, { status: 200 });
    }) as typeof fetch;

    const keyPrevia = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "sk-loquesea";

    const resultado = await chatStream([{ role: "user", content: "hola" }]);

    global.fetch = fetchOriginal;
    global.setTimeout = setTimeoutOriginal;
    global.clearTimeout = clearTimeoutOriginal;
    if (keyPrevia === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = keyPrevia;

    chequear("con fetch simulado e instantáneo, la conexión resulta ok", resultado.estado === "ok");
    chequear(
      "el timer de conexión se cancela apenas llegan los headers, no queda pegado al stream",
      timersProgramados.length === 1 && timersCancelados.includes(timersProgramados[0]),
    );
  }

  /* ── el razonamiento tiene que quedar apagado ── */
  // `deepseek-v4-flash` es un modelo de razonamiento. Se verificó contra la API
  // real que sin `thinking: { type: "disabled" }` los 400 tokens de
  // `max_tokens` se los come el razonamiento y la respuesta llega vacía
  // (`finish_reason: length`). `reasoning_effort: "minimal"` no alcanza. Este
  // test no le pega a la API: solo comprueba que el cuerpo del request lo
  // pide, para que nadie lo saque pensando que es superfluo.
  {
    const fetchOriginal = global.fetch;
    let cuerpoEnviado: Record<string, unknown> | null = null;
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      cuerpoEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const encoder = new TextEncoder();
      const cuerpo = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`${delta("hola")}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(cuerpo, { status: 200 });
    }) as typeof fetch;

    const keyPrevia = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "sk-loquesea";

    await chatStream([{ role: "user", content: "hola" }]);

    global.fetch = fetchOriginal;
    if (keyPrevia === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = keyPrevia;

    chequear(
      "el cuerpo del request pide el razonamiento apagado",
      cuerpoEnviado !== null &&
        JSON.stringify((cuerpoEnviado as Record<string, unknown>).thinking) === JSON.stringify({ type: "disabled" }),
    );
  }

  /* ── la key ── */
  delete process.env.DEEPSEEK_API_KEY;
  chequear("sin key el chat no está disponible", hayChat() === false);
  process.env.DEEPSEEK_API_KEY = "sk-loquesea";
  chequear("con key el chat está disponible", hayChat() === true);

  console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
  process.exit(fallos === 0 ? 0 : 1);
}

main();
