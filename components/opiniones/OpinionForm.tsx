"use client";
import { useState, type FormEvent } from "react";
import { preguntaOpinion } from "@/lib/opiniones";

interface OpinionFormProps {
  /** "pedido": desde el seguimiento, pregunta por lo que pidió. "home": abierto a cualquiera. */
  modo: "pedido" | "home";
  /** Pedido: los productos del pedido. Home: pizzas de la carta y "Empanadas". */
  productos: string[];
  /** Referencia del pedido (solo modo "pedido"). */
  referencia?: string;
  nombreInicial?: string;
  /** El pedido ya tiene opinión: se muestra directamente el agradecimiento. */
  yaOpino?: boolean;
}

const ESTRELLAS = [1, 2, 3, 4, 5];

/**
 * Formulario de opinión. Las reglas son las de `validarOpinion` (el servidor
 * valida igual); se repiten acá las básicas para no gastar intentos del límite
 * por IP con un campo vacío.
 */
export function OpinionForm({ modo, productos, referencia, nombreInicial = "", yaOpino = false }: OpinionFormProps) {
  const [rating, setRating] = useState(0);
  const [producto, setProducto] = useState(modo === "pedido" && productos.length === 1 ? productos[0] : "");
  const [texto, setTexto] = useState("");
  const [nombre, setNombre] = useState(nombreInicial);
  const [sitio, setSitio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gracias, setGracias] = useState(yaOpino ? "Ya recibimos tu opinión sobre este pedido." : "");
  const [error, setError] = useState("");

  if (gracias) {
    return (
      <div className="opinion opinion-gracias" role="status">
        <span className="opinion-gracias-estrellas" aria-hidden="true">★★★★★</span>
        <b>¡Gracias por contarnos!</b>
        <p>{gracias}</p>
      </div>
    );
  }

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (rating < 1) return setError("Elegí de 1 a 5 estrellas");
    if (texto.trim().length < 5) return setError("Contanos un poquito más");
    if (!nombre.trim()) return setError("Decinos tu nombre (es el que se publica)");
    setError("");
    setEnviando(true);
    try {
      const respuesta = await fetch("/api/opiniones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, texto, nombre, producto, ref: modo === "pedido" ? referencia : undefined, sitio }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.ok && datos.ok) {
        setGracias("Tu opinión aparece en el sitio cuando la revisamos.");
        return;
      }
      // Una opinión repetida no es un error para el cliente: ya la tenemos.
      if (respuesta.status === 409 && /gracias/i.test(String(datos.error || ""))) {
        setGracias(String(datos.error));
        return;
      }
      setError(String(datos.error || "No pudimos enviar tu opinión. Probá de nuevo."));
    } catch {
      setError("No pudimos enviar tu opinión. Revisá tu conexión y probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="opinion" onSubmit={enviar} noValidate>
      <h3 className="opinion-pregunta">{preguntaOpinion(modo === "pedido" ? productos : [])}</h3>

      {modo === "pedido" && productos.length > 1 && (
        <div className="opinion-chips" role="group" aria-label="¿Sobre cuál nos contás?">
          {productos.map((nombreProducto) => (
            <button
              type="button"
              key={nombreProducto}
              className={`opinion-chip ${producto === nombreProducto ? "on" : ""}`}
              aria-pressed={producto === nombreProducto}
              onClick={() => setProducto(producto === nombreProducto ? "" : nombreProducto)}
            >
              {nombreProducto}
            </button>
          ))}
        </div>
      )}

      {modo === "home" && productos.length > 0 && (
        <label className="opinion-campo">
          <span>¿Qué probaste? <em>(opcional)</em></span>
          <select value={producto} onChange={(e) => setProducto(e.target.value)}>
            <option value="">Elegí…</option>
            {productos.map((nombreProducto) => <option key={nombreProducto} value={nombreProducto}>{nombreProducto}</option>)}
          </select>
        </label>
      )}

      <div className="opinion-estrellas" role="group" aria-label="Tu puntaje">
        {ESTRELLAS.map((n) => (
          <button
            type="button"
            key={n}
            className={n <= rating ? "on" : ""}
            aria-label={`${n} de 5 estrellas`}
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>

      <label className="opinion-campo">
        <span>Tu opinión</span>
        <textarea rows={3} maxLength={500} placeholder="Contanos en pocas palabras…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>

      <div className="opinion-fila">
        <label className="opinion-campo">
          <span>Tu nombre <em>(así se publica)</em></span>
          <input maxLength={40} autoComplete="given-name" placeholder="Juan" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary opinion-enviar" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar opinión"}
        </button>
      </div>

      {/* Trampa para bots: fuera de la vista y del foco. Si llega completo, el
          servidor responde OK sin guardar. */}
      <input
        className="opinion-trampa"
        name="sitio"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={sitio}
        onChange={(e) => setSitio(e.target.value)}
      />

      {error && <p className="opinion-error" role="alert">{error}</p>}
      <small className="opinion-nota">La leemos antes de publicarla.</small>
    </form>
  );
}
