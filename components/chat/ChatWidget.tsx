"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessConfig } from "@/lib/business";

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
class ErrorServidor extends Error {}

/**
 * El chat del sitio. Ocupa el lugar que dejó el botón flotante de WhatsApp:
 * dos burbujas en la misma esquina se pisan.
 *
 * El bot **no arma pedidos**: recomienda y dice dónde está el producto. El que
 * agrega al carrito es siempre el cliente.
 *
 * `disponible` lo calcula el servidor en `app/page.tsx`. Sin key, el widget es
 * directamente un botón de WhatsApp: no vale la pena fingir que hay un bot ni
 * intentar una request que se sabe que va a fallar.
 */
export function ChatWidget({ business, disponible }: { business: BusinessConfig; disponible: boolean }) {
  const saludo = `¡Hola! Soy el asistente de ${business.name}. ¿Te doy una mano para elegir? Contame para cuántos son o qué tenés ganas de comer.`;

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => [{ role: "assistant", content: saludo }]);
  const [texto, setTexto] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

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
    // cliente queda con "Escribiendo…" para siempre y sin ninguna vía de
    // contacto: esta task le sacó el botón flotante de WhatsApp, así que el
    // chat es la única puerta.
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
        throw new ErrorServidor(mensajeError);
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
    } finally {
      // Pase lo que pase -éxito, error del servidor o timeout propio- el timer
      // no puede quedar vivo, y el cliente tiene que poder volver a escribir.
      if (inactividad) clearTimeout(inactividad);
      setEsperando(false);
    }
  }

  if (!disponible) {
    return (
      <a className="chat-fab" href={wsp} target="_blank" rel="noreferrer" aria-label="Escribinos por WhatsApp">
        <IconoWhatsapp />
      </a>
    );
  }

  return (
    <>
      <button
        ref={burbujaRef}
        className="chat-fab"
        onClick={() => setAbierto((estaba) => !estaba)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar el asistente" : "Abrir el asistente para elegir tu pedido"}
      >
        {abierto ? <IconoCerrar /> : <IconoChat />}
      </button>

      {abierto && (
        <div className="chat-panel" role="dialog" aria-modal="true" aria-label="Asistente de Impasto" ref={panelRef}>
          <div className="chat-head">
            <div>
              {/* Nada de promesas acá: "respondo al toque" o "24 hs" son
                  afirmaciones que nadie verificó. */}
              <strong>Te ayudo a elegir</strong>
              <span>{business.name} · {business.city}</span>
            </div>
            <button onClick={cerrar} aria-label="Cerrar">
              <IconoCerrar />
            </button>
          </div>

          <div className="chat-hilo">
            {mensajes.map((mensaje, indice) => (
              <p key={indice} className={`chat-msg chat-msg-${mensaje.role}`}>
                {mensaje.content}
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
        </div>
      )}
    </>
  );
}

const IconoChat = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3c5 0 9 3.4 9 7.6 0 4.2-4 7.6-9 7.6-.9 0-1.8-.1-2.6-.3L4 20l1.2-3.3C3.8 15.3 3 13.1 3 10.6 3 6.4 7 3 12 3Z" />
  </svg>
);

const IconoCerrar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const IconoWhatsapp = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Zm5.4 14.24c-.23.64-1.34 1.23-1.85 1.27-.47.04-1.08.23-3.62-.76-3.06-1.2-5-4.25-5.15-4.45-.15-.2-1.23-1.64-1.23-3.13 0-1.5.78-2.23 1.06-2.54.28-.3.6-.38.8-.38.2 0 .4 0 .57.01.18 0 .43-.07.67.51.23.58.82 2 .89 2.14.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.38-.46.51-.15.15-.31.32-.13.62.17.3.77 1.27 1.65 2.06 1.13 1 2.08 1.32 2.38 1.47.3.15.47.12.65-.07.17-.2.75-.88.95-1.18.2-.3.4-.25.67-.15.27.1 1.7.8 2 .95.28.15.47.22.54.35.07.12.07.72-.16 1.36Z" />
  </svg>
);
