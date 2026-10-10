"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessConfig } from "@/lib/business";
import { parsearNegrita } from "@/lib/chat-negrita";
import { esFallaDelAsistente } from "@/lib/chat-fallas";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

const SIN_CHAT = "El asistente no está disponible en este momento.";

/**
 * Error cuya `message` viene del JSON `{ ok: false, error }` que devuelve
 * `/api/chat` en 400/429/502/503. Se muestra tal cual: es el único mensaje
 * sobre el que el cliente puede actuar (el del 429 dice cuántos minutos
 * esperar). Cualquier otra falla (red caída, stream vacío) usa `SIN_CHAT`.
 */
class ErrorServidor extends Error {
  /** El código con el que respondió la ruta: decide si el bot se da por caído. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * El chat del sitio, abajo a la derecha. WhatsApp tiene su propio botón
 * flotante en la esquina izquierda (`WhatsappFab.tsx`): dos burbujas en la
 * misma esquina se pisan.
 *
 * El bot **no arma pedidos**: recomienda y dice dónde está el producto. El que
 * agrega al carrito es siempre el cliente.
 *
 * `disponible` lo calcula el servidor en `app/page.tsx`. Sin key, el widget no
 * se muestra: no vale la pena fingir que hay un bot ni intentar una request que
 * se sabe que va a fallar, y el botón de WhatsApp ya está a la vista.
 */
/**
 * `business.name` sale de la base y hoy es "Impasto - Pizzeria y Empanadas":
 * en el saludo y en el encabezado del panel se lee mal y en el encabezado se
 * parte en dos líneas. No hay un campo corto aparte en `sucursales`, así que
 * se recorta acá: todo lo que va antes de " - " (que ya está en el dato, no
 * es un nombre inventado). Si el nombre no trae ese separador, se usa entero.
 */
function nombreCorto(nombre: string): string {
  const [primero] = nombre.split(" - ");
  return primero.trim() || nombre;
}

/**
 * Renderiza el contenido de un mensaje resaltando `**negrita**`.
 *
 * El parseo vive en `lib/chat-negrita.ts`, aparte del componente, para poder
 * testearlo con `tsx` (este archivo es `"use client"` y no corre ahí). Acá
 * solo se mapea la lista de tramos a elementos de React: nunca se arma HTML
 * a mano ni se usa `dangerouslySetInnerHTML`, así que un tramo no puede
 * convertirse en markup por más que el modelo (o, a través de él, el
 * cliente) intente colar algo como `<script>`.
 */
function ContenidoMensaje({ texto }: { texto: string }) {
  return (
    <>
      {parsearNegrita(texto).map((tramo, indice) =>
        tramo.negrita ? <strong key={indice}>{tramo.texto}</strong> : <span key={indice}>{tramo.texto}</span>,
      )}
    </>
  );
}

export function ChatWidget({ business, disponible, oculto = false }: { business: BusinessConfig; disponible: boolean; oculto?: boolean }) {
  const nombre = nombreCorto(business.name);
  const saludo = `¡Hola! Soy el asistente de ${nombre}. ¿Te doy una mano para elegir? Contame para cuántos son o qué tenés ganas de comer.`;

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => [{ role: "assistant", content: saludo }]);
  const [texto, setTexto] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  /**
   * El asistente se dio por caído para lo que queda de esta visita.
   *
   * Es de sesión, no del sitio: `disponible` lo calcula el servidor en
   * `app/page.tsx` y solo mira si hay key, así que el próximo visitante vuelve
   * a ver el bot hasta que él también choque. Dejarlo así es a propósito —
   * apagar el bot para todos exigiría estado compartido en la base—, y el
   * aviso por Telegram de `lib/aviso-sistema.ts` cubre el hueco: el dueño se
   * entera con el primer cliente que choca, no con el último.
   */
  const [sinBot, setSinBot] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);
  const burbujaRef = useRef<HTMLButtonElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const wsp = `https://wa.me/${business.whatsappPhone}`;

  const cerrar = useCallback(() => {
    setAbierto(false);
    burbujaRef.current?.focus();
  }, []);

  // Esc cierra, y el foco vuelve a la burbuja de donde salió.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
      if (evento.key !== "Tab" || !panelRef.current) return;
      // Trampa de foco: el tabulador no sale del panel mientras está abierto.
      // `:not(:disabled)` importa: "Enviar" arranca deshabilitado (input vacío)
      // y un botón disabled nunca recibe foco del navegador. Si se lo cuenta
      // como "último", la condición de wrap-around no se cumple nunca y el
      // tabulador se escapa del panel en el estado inicial.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input, a[href], textarea",
      );
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    entradaRef.current?.focus();
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto, cerrar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes, esperando]);

  async function enviar() {
    const consulta = texto.trim();
    if (!consulta || esperando) return;

    const historial: Mensaje[] = [...mensajes, { role: "user", content: consulta }];
    setMensajes(historial);
    setTexto("");
    setEsperando(true);
    setFallo(null);

    // Vigía de inactividad: `lib/deepseek.ts` documenta que su AbortController
    // de 20s cubre solo la conexión, no el cuerpo del stream. Si DeepSeek abre
    // la respuesta y se cuelga a mitad de camino -sin cerrar y sin mandar más
    // datos- `lector.read()` de más abajo no resuelve nunca, y sin esto el
    // cliente queda con "Escribiendo…" para siempre, mirando un chat que no
    // contesta.
    //
    // Dos plazos, no uno, porque cubren riesgos distintos:
    //
    // - Hasta el primer fragmento: cubre la conexión a `/api/chat` Y la
    //   espera del primer token de DeepSeek, que ya no está acotada por
    //   ningún timeout del servidor una vez que sus headers llegaron (ver
    //   `lib/deepseek.ts:109`, el `clearTimeout` corre apenas resuelve el
    //   `fetch`, no cuando termina el stream). Tiene que ser holgadamente
    //   mayor que los 20s de `lib/deepseek.ts:93`
    //   (`setTimeout(() => controller.abort(), 20_000)`), para que si
    //   DeepSeek tarda en conectar sea siempre el servidor el que se rinda
    //   primero y conteste con su propio error -en vez de que este vigía
    //   aborte una conexión que el servidor todavía estaba atendiendo bien y
    //   que probablemente hubiera terminado bien-. No se importa esa
    //   constante desde acá: este archivo es "use client" y
    //   `lib/deepseek.ts` es server-only (ahí vive la key). Queda espejada a
    //   mano en `TIMEOUT_ABORT_DEEPSEEK_MS`; si ese 20_000 cambia, este
    //   cálculo hay que revisarlo también.
    // - Entre fragmentos, una vez que el stream ya arrancó: ahí sí un
    //   silencio largo es un cuelgue de verdad, sin relación con la conexión
    //   a DeepSeek. Se reinicia con cada fragmento que llega, así que no
    //   corta una respuesta larga y legítima: se midió una de 44,9s con
    //   pausas de 8-9s entre fragmentos, y no se cortó. 15s sigue siendo
    //   bastante más que esa pausa y bastante menos que la paciencia de
    //   alguien mirando un "Escribiendo…" que no avanza.
    const TIMEOUT_ABORT_DEEPSEEK_MS = 20_000; // espejo de lib/deepseek.ts:93
    const TIMEOUT_INACTIVIDAD_MS = 15_000;
    const TIMEOUT_PRIMER_BYTE_MS = TIMEOUT_ABORT_DEEPSEEK_MS + TIMEOUT_INACTIVIDAD_MS; // 35s, con margen

    const controlador = new AbortController();
    let inactividad: ReturnType<typeof setTimeout> | undefined;
    // Antes de que llegue el primer fragmento se usa el plazo largo; después,
    // el corto. `reiniciarInactividad` lee esta bandera en cada llamada.
    let primerFragmentoLlegado = false;
    // Declaradas acá afuera -no dentro del `try`- para que el `catch` también
    // pueda verlas: necesita saber si la burbuja vacía llegó a agregarse y
    // cuánto texto trajo, para poder limpiarla igual que el camino feliz.
    let burbujaAgregada = false;
    let acumulado = "";
    const reiniciarInactividad = () => {
      if (inactividad) clearTimeout(inactividad);
      const plazo = primerFragmentoLlegado ? TIMEOUT_INACTIVIDAD_MS : TIMEOUT_PRIMER_BYTE_MS;
      inactividad = setTimeout(() => controlador.abort(), plazo);
    };

    try {
      reiniciarInactividad();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Se manda el saludo también: es parte del hilo que ve el modelo.
        body: JSON.stringify({ mensajes: historial }),
        signal: controlador.signal,
      });

      if (!response.ok) {
        // La ruta manda { ok: false, error } en 400/429/502/503. El texto de
        // `error` está escrito para el cliente (el del 429 dice cuántos
        // minutos esperar), así que hay que leerlo y no tirarlo.
        let mensajeError = SIN_CHAT;
        try {
          const cuerpo = await response.json();
          if (cuerpo && typeof cuerpo.error === "string" && cuerpo.error.trim()) {
            mensajeError = cuerpo.error;
          }
        } catch {
          // El cuerpo no era JSON parseable: se usa el mensaje genérico.
        }
        throw new ErrorServidor(mensajeError, response.status);
      }
      if (!response.body) throw new Error(SIN_CHAT);

      // Se agrega el mensaje vacío del bot y se va llenando con el stream.
      setMensajes((previos) => [...previos, { role: "assistant", content: "" }]);
      burbujaAgregada = true;
      const lector = response.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        // Llegó un fragmento: la conexión sigue viva. De acá en más el vigía
        // usa el plazo corto (ver el comentario de arriba): el riesgo del
        // primer byte ya pasó.
        primerFragmentoLlegado = true;
        reiniciarInactividad();
        acumulado += decoder.decode(value, { stream: true });
        setMensajes((previos) => {
          const copia = [...previos];
          copia[copia.length - 1] = { role: "assistant", content: acumulado };
          return copia;
        });
      }

      // Un stream que no trajo nada es una falla, aunque el status haya sido 200:
      // cuando el stream ya empezó, no hay forma de mandar un código de error.
      if (!acumulado.trim()) {
        setMensajes((previos) => previos.slice(0, -1));
        setFallo(SIN_CHAT);
      }
    } catch (error) {
      // Un cuelgue cae acá como AbortError, igual que cualquier otra falla de
      // red: no es un ErrorServidor, así que muestra el genérico con el link
      // de WhatsApp. Lo que ya se acumuló en `mensajes` (si el cuelgue llegó
      // después de texto parcial) queda como está: no se pisa ni se borra, se
      // le agrega el aviso debajo.
      //
      // Pero si la burbuja vacía llegó a agregarse y el cuelgue pasó ANTES de
      // que llegara texto -`lector.read()` rechaza, por ejemplo, por el
      // aborto del vigía de inactividad-, no puede quedar una píldora vacía
      // en el hilo para siempre: es el mismo caso que ya cubre el camino
      // feliz un poco más arriba, solo que llegando por el `catch`.
      if (burbujaAgregada && !acumulado.trim()) {
        setMensajes((previos) => previos.slice(0, -1));
      }
      setFallo(error instanceof ErrorServidor ? error.message : SIN_CHAT);

      // Si el que falló fue el asistente -no el rate limit, no un historial
      // mal armado-, insistir no lo va a revivir: el widget se rinde y
      // desaparece (queda el WhatsApp flotante). El panel sigue abierto con el
      // error a la vista; el cambio se ve recién cuando el cliente lo cierra,
      // para no arrancarle de la pantalla el link que estaba por tocar.
      if (error instanceof ErrorServidor && esFallaDelAsistente(error.status)) setSinBot(true);
    } finally {
      // Pase lo que pase -éxito, error del servidor o timeout propio- el timer
      // no puede quedar vivo, y el cliente tiene que poder volver a escribir.
      if (inactividad) clearTimeout(inactividad);
      setEsperando(false);
    }
  }

  // Sin key nunca hubo bot; con `sinBot` lo hubo y se cayó. En los dos casos
  // no se muestra nada: el WhatsApp flotante de la otra esquina
  // (`WhatsappFab.tsx`) ya es la vía de contacto, y antes acá el chat se volvía
  // un segundo botón de WhatsApp.
  if (!disponible || (sinBot && !abierto)) return null;

  return (
    <>
      <button
        ref={burbujaRef}
        className={`${abierto ? "chat-fab" : "chat-fab chat-fab-pill"} ${oculto && !abierto ? "is-hidden" : ""}`}
        onClick={() => setAbierto((estaba) => !estaba)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar el asistente" : "Abrir el asistente para elegir tu pedido"}
      >
        {abierto ? (
          <IconoCerrar />
        ) : (
          <>
            <span className="chat-fab-insignia">
              <IconoBot />
              <span className="chat-fab-punto" />
            </span>
            {/* La misma frase que abre el panel ("Te ayudo a elegir"). */}
            <span className="chat-fab-texto">
              <b>¿Te ayudo a elegir?</b>
              <small>Asistente de {nombre}</small>
            </span>
          </>
        )}
      </button>

      {abierto && (
        <div className="chat-panel" role="dialog" aria-modal="true" aria-label="Asistente de Impasto" ref={panelRef}>
          <div className="chat-head">
            <div>
              {/* Nada de promesas acá: "respondo al toque" o "24 hs" son
                  afirmaciones que nadie verificó. */}
              <strong>Te ayudo a elegir</strong>
              <span>{nombre} · {business.city}</span>
            </div>
            <button onClick={cerrar} aria-label="Cerrar">
              <IconoCerrar />
            </button>
          </div>

          <div className="chat-hilo">
            {mensajes.map((mensaje, indice) => (
              <p key={indice} className={`chat-msg chat-msg-${mensaje.role}`}>
                <ContenidoMensaje texto={mensaje.content} />
              </p>
            ))}
            {esperando && <p className="chat-msg chat-msg-assistant chat-escribiendo">Escribiendo…</p>}
            {fallo && (
              <p className="chat-msg chat-msg-assistant">
                {fallo}
                <br />
                Si preferís, escribinos por{" "}
                <a href={wsp} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                .
              </p>
            )}
            <div ref={finRef} />
          </div>

          {/* Caído el asistente, el campo de texto no lleva a ningún lado:
              ocupa su lugar la única vía que sí funciona. Se reemplaza en vez
              de deshabilitarse para que la trampa de foco de más arriba no
              tenga que contar un input deshabilitado, que no recibe foco. */}
          {sinBot ? (
            <div className="chat-envio">
              <a className="chat-wsp" href={wsp} target="_blank" rel="noreferrer">
                Escribinos por WhatsApp
              </a>
            </div>
          ) : (
          <form
            className="chat-envio"
            onSubmit={(evento) => {
              evento.preventDefault();
              enviar();
            }}
          >
            <input
              ref={entradaRef}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              maxLength={500}
              placeholder="¿Qué me recomendás?"
              aria-label="Escribí tu consulta"
            />
            <button type="submit" disabled={esperando || !texto.trim()} aria-label="Enviar">
              Enviar
            </button>
          </form>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Cara de robot dibujada a mano: cabecita redondeada, antena y dos ojos. El
 * dueño pidió explícitamente "un ícono propio de bot", no un emoji ni una
 * librería de íconos. `currentColor` para heredar el carbón de la insignia
 * dorada (`.chat-fab-insignia`).
 */
const IconoBot = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.4v2.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="2" r="1.15" fill="currentColor" />
    <rect x="4.2" y="5.6" width="15.6" height="13.4" rx="4.4" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="9" cy="12.3" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12.3" r="1.5" fill="currentColor" />
    <path d="M8.7 16c1.05.85 4.55.85 5.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M2.6 10.2v3M21.4 10.2v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconoCerrar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

