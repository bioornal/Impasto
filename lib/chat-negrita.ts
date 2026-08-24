/**
 * Parseo de `**negrita**` en las respuestas del chatbot.
 *
 * El modelo responde en markdown por su cuenta (ver la línea nueva en
 * `lib/chat-prompt.ts`, CÓMO HABLÁS), pero el widget no puede confiar ciegamente
 * en ese texto: viene de un LLM que a su vez procesó lo que escribió el
 * cliente. Por eso este módulo **no genera HTML**: devuelve una lista de
 * tramos de datos (`{ texto, negrita }`) que `ChatWidget.tsx` mapea a
 * `<strong>` o texto plano. Así es imposible que un `**` termine convertido
 * en markup real, por más que el cliente logre que el modelo escriba algo
 * como `<script>`.
 *
 * Alcance deliberadamente angosto: solo `**negrita**`. Nada de itálicas,
 * links, listas ni títulos — el prompt le pide al modelo exactamente eso, y
 * es todo lo que este parser entiende.
 *
 * Es un módulo puro (sin `db`, sin React) para poder testearlo con `tsx`,
 * igual que `lib/aviso-local.ts` y `lib/chat-prompt.ts`.
 */

export interface TramoTexto {
  texto: string;
  negrita: boolean;
}

/**
 * Parte `texto` en tramos de negrita y texto plano.
 *
 * Reglas:
 * - Un `**` sin `**` de cierre más adelante se muestra literal (incluidos
 *   los dos asteriscos) y no se come el resto del mensaje: se sigue
 *   escaneando después de él.
 * - `****` (negrita vacía) produce un tramo en negrita con `texto: ""` — no
 *   deja asteriscos sueltos ni rompe el resto del parseo.
 * - Invariante: concatenar `texto` de todos los tramos, en orden, da el
 *   original menos los `**` que se consumieron como delimitadores válidos.
 *   Nada del contenido se pierde ni se duplica.
 */
export function parsearNegrita(texto: string): TramoTexto[] {
  const tramos: TramoTexto[] = [];
  let buffer = "";
  let i = 0;

  while (i < texto.length) {
    const apertura = texto.indexOf("**", i);

    if (apertura === -1) {
      buffer += texto.slice(i);
      break;
    }

    const cierre = texto.indexOf("**", apertura + 2);

    if (cierre === -1) {
      // No hay cierre: el "**" es literal. Se conserva en el buffer de texto
      // plano y se sigue escaneando justo después, sin perder el resto.
      buffer += texto.slice(i, apertura + 2);
      i = apertura + 2;
      continue;
    }

    buffer += texto.slice(i, apertura);
    if (buffer) {
      tramos.push({ texto: buffer, negrita: false });
      buffer = "";
    }

    tramos.push({ texto: texto.slice(apertura + 2, cierre), negrita: true });
    i = cierre + 2;
  }

  if (buffer) {
    tramos.push({ texto: buffer, negrita: false });
  }

  return tramos;
}
