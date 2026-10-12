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

/**
 * El nombre con que se completa el formulario del seguimiento: el del pedido,
 * entero (decisión del dueño del 12/10/2026), en una línea y sin pasar el
 * tope. Si no entra, se cortan palabras del final, nunca a mitad de una.
 */
export function nombreParaPublicar(cliente: unknown): string {
  const nombre = unaLinea(cliente);
  if (nombre.length <= NOMBRE_MAX) return nombre;
  const palabras = nombre.split(" ");
  while (palabras.length > 1 && palabras.join(" ").length > NOMBRE_MAX) palabras.pop();
  return palabras.join(" ").slice(0, NOMBRE_MAX);
}

/**
 * Cuando la opinión es sobre varios productos (todo el pedido), `producto` los
 * guarda separados así. Ningún nombre de la carta lo lleva.
 */
export const SEPARADOR_PRODUCTOS = " + ";

/** Los productos de los que habla una opinión guardada. */
export function productosDeTestimonio(producto: unknown): string[] {
  return unaLinea(producto).split(SEPARADOR_PRODUCTOS).map((p) => p.trim()).filter(Boolean);
}

/**
 * Sobre qué queda la opinión de un pedido: lo que eligió el cliente, o si no
 * eligió nada, todo lo que compró. Así la tarjeta publicada dice qué probó y
 * se entiende a qué se refiere ("Muy buena." solo no dice nada).
 */
export function productoDeLaOpinion(elegido: string, delPedido: string[]): string {
  return elegido || delPedido.join(SEPARADOR_PRODUCTOS);
}

const conArticulo = (producto: string) => (producto === EMPANADAS ? "las empanadas" : `la ${producto}`);

/** La línea chica de la tarjeta publicada: "Probó la Fugazzeta y las empanadas". */
export function lineaProducto(producto: string): string {
  const partes = productosDeTestimonio(producto).map(conArticulo);
  if (partes.length === 0) return "";
  const ultima = partes.pop();
  return `Probó ${partes.length ? `${partes.join(", ")} y ${ultima}` : ultima}`;
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

export type EstadoTestimonio = "pendiente" | "aprobado" | "rechazado";

export interface CambioTestimonio {
  estado?: EstadoTestimonio;
  nombre?: string;
  producto?: string;
}

/** Alcanza para los seis productos de un pedido (`MAX_PRODUCTOS`). */
const PRODUCTO_MAX = 300;
const ESTADOS: EstadoTestimonio[] = ["pendiente", "aprobado", "rechazado"];

/**
 * Lo que el dueño cambia desde el panel antes de publicar: el estado, el
 * nombre que se publica y sobre qué opinó. Solo viaja lo que se cambia.
 */
export function validarCambioTestimonio(
  input: unknown,
): { ok: true; cambio: CambioTestimonio } | { ok: false; error: string } {
  if (!esObjeto(input)) return { ok: false, error: "Cambio inválido" };
  const cambio: CambioTestimonio = {};
  if (input.estado !== undefined) {
    if (!ESTADOS.includes(input.estado as EstadoTestimonio)) return { ok: false, error: "estado inválido" };
    cambio.estado = input.estado as EstadoTestimonio;
  }
  if (input.nombre !== undefined) {
    const nombre = unaLinea(input.nombre);
    if (!nombre) return { ok: false, error: "El nombre no puede quedar vacío" };
    if (nombre.length > NOMBRE_MAX) return { ok: false, error: `El nombre puede tener hasta ${NOMBRE_MAX} caracteres` };
    cambio.nombre = nombre;
  }
  if (input.producto !== undefined) {
    const producto = unaLinea(input.producto);
    if (producto.length > PRODUCTO_MAX) return { ok: false, error: "Producto inválido" };
    cambio.producto = producto;
  }
  if (Object.keys(cambio).length === 0) return { ok: false, error: "No hay nada para cambiar" };
  return { ok: true, cambio };
}

/**
 * El aviso al dueño. Sin marcado: todo lo escribió el cliente. Del pedido va
 * el nombre del cliente, no la referencia: esa no le dice nada a nadie.
 */
export function textoAvisoOpinion(opinion: Opinion, pedido: { cliente: string } | null): string {
  const estrellas = "★".repeat(opinion.rating) + "☆".repeat(5 - opinion.rating);
  const cliente = pedido ? unaLinea(pedido.cliente) : "";
  const lineas = [
    `OPINIÓN NUEVA ${estrellas}`,
    `Se publica como: ${unaLinea(opinion.nombre)}`,
    pedido ? (cliente ? `Pedido de ${cliente}` : "Pedido verificado") : "Desde la home (sin pedido)",
  ];
  if (opinion.producto) lineas.push(`Sobre: ${productosDeTestimonio(opinion.producto).join(", ")}`);
  lineas.push("", `"${unaLinea(opinion.texto)}"`, "", "Aprobala o rechazala en el panel → Testimonios.");
  return lineas.join("\n");
}
