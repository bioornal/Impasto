/**
 * Opiniones de clientes: qué se pregunta, qué se acepta y cómo se avisa.
 *
 * Todo lo escribe el cliente, así que nada de acá confía en el formato: el
 * texto se aplana antes de guardarlo y el aviso al local va sin marcado, igual
 * que `lib/aviso-local.ts`. Nada se publica sin que el dueño lo apruebe en el
 * panel (Testimonios).
 *
 * Sin dependencias: se testea con `tsx`.
 */

export const EMPANADAS = "Empanadas";

export interface Opinion {
  rating: number;
  texto: string;
  nombre: string;
  /** Sobre qué opina ("Diavola al Miele", "Empanadas") o vacío. */
  producto: string;
}

const MAX_PRODUCTOS = 6;
const TEXTO_MIN = 5;
const TEXTO_MAX = 500;
const NOMBRE_MAX = 40;

/** Colapsa espacios y saltos: un salto en el nombre falsificaría una línea del aviso. */
const unaLinea = (valor: unknown) => (typeof valor === "string" ? valor.replace(/\s+/g, " ").trim() : "");

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

/**
 * Lo que se puede opinar de un pedido: las pizzas por su nombre (la mitad y
 * mitad en sus dos gustos) y las cajas como "Empanadas". Las bebidas no.
 */
export function productosDelPedido(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const productos: string[] = [];
  const sumar = (nombre: string) => {
    if (nombre && !productos.includes(nombre)) productos.push(nombre);
  };
  for (const item of items) {
    if (!esObjeto(item)) continue;
    const nombre = unaLinea(item.name ?? item.nombre);
    if (item.type === "pizza") sumar(nombre);
    else if (item.type === "pizza-half") {
      const mitades = /^Mitad (.+) \/ Mitad (.+)$/.exec(nombre);
      if (mitades) { sumar(mitades[1].trim()); sumar(mitades[2].trim()); }
      else sumar(nombre);
    } else if (item.type === "empanadas") sumar(EMPANADAS);
  }
  return productos.slice(0, MAX_PRODUCTOS);
}

/** La pregunta del formulario, según lo que se pueda opinar. */
export function preguntaOpinion(productos: string[]): string {
  if (productos.length === 0) return "¿Qué te pareció lo que probaste?";
  if (productos.length > 1) return "¿Qué te pareció tu pedido?";
  return productos[0] === EMPANADAS
    ? "¿Qué te parecieron las empanadas?"
    : `¿Qué te pareció la ${productos[0]}?`;
}

/** La línea chica de la tarjeta publicada. */
export function lineaProducto(producto: string): string {
  if (!producto) return "";
  return producto === EMPANADAS ? "Probó las empanadas" : `Probó la ${producto}`;
}

/** Valida lo que manda el formulario. Los mensajes se muestran tal cual al cliente. */
export function validarOpinion(
  input: unknown,
  productosPermitidos: string[],
): { ok: true; opinion: Opinion } | { ok: false; error: string } {
  if (!esObjeto(input)) return { ok: false, error: "No pudimos leer tu opinión. Probá de nuevo." };

  const rating = input.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Elegí de 1 a 5 estrellas" };
  }
  const texto = unaLinea(input.texto);
  if (texto.length < TEXTO_MIN) return { ok: false, error: "Contanos un poquito más" };
  if (texto.length > TEXTO_MAX) return { ok: false, error: `Tu opinión puede tener hasta ${TEXTO_MAX} caracteres` };
  const nombre = unaLinea(input.nombre);
  if (!nombre) return { ok: false, error: "Decinos tu nombre (es el que se publica)" };
  if (nombre.length > NOMBRE_MAX) return { ok: false, error: `El nombre puede tener hasta ${NOMBRE_MAX} caracteres` };
  const producto = unaLinea(input.producto);
  if (producto && !productosPermitidos.includes(producto)) {
    return { ok: false, error: "Elegí uno de los productos de la lista" };
  }
  return { ok: true, opinion: { rating, texto, nombre, producto } };
}

/** El aviso al dueño. Sin marcado: todo lo escribió el cliente. */
export function textoAvisoOpinion(opinion: Opinion, origen: { ref?: string }): string {
  const estrellas = "★".repeat(opinion.rating) + "☆".repeat(5 - opinion.rating);
  const lineas = [
    `OPINIÓN NUEVA ${estrellas}`,
    unaLinea(opinion.nombre),
    origen.ref ? `Pedido ${unaLinea(origen.ref)}` : "Desde la home (sin pedido)",
  ];
  if (opinion.producto) lineas.push(`Sobre: ${unaLinea(opinion.producto)}`);
  lineas.push("", `"${unaLinea(opinion.texto)}"`, "", "Aprobala o rechazala en el panel → Testimonios.");
  return lineas.join("\n");
}
