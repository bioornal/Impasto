import {
  productosDelPedido,
  preguntaOpinion,
  lineaProducto,
  validarOpinion,
  textoAvisoOpinion,
  EMPANADAS,
} from "../lib/opiniones";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

/* ── productos del pedido ── */
const items = [
  { type: "pizza", name: "Diavola al Miele" },
  { type: "pizza-half", name: "Mitad Fugazzeta / Mitad Muzzarella" },
  { type: "empanadas", name: "Caja x12" },
  { type: "bebida", name: "Coca-Cola 1.5 L" },
  { type: "pizza", name: "Diavola al Miele" },
  { type: "empanadas", name: "Caja x6" },
];
const productos = productosDelPedido(items);
chequear("productosDelPedido · pizzas por nombre", productos[0] === "Diavola al Miele");
chequear("productosDelPedido · mitad y mitad en sus dos gustos", productos.includes("Fugazzeta") && productos.includes("Muzzarella"));
chequear("productosDelPedido · las cajas son Empanadas, una sola vez", productos.filter((p) => p === EMPANADAS).length === 1);
chequear("productosDelPedido · sin bebidas", !productos.some((p) => /coca/i.test(p)));
chequear("productosDelPedido · sin repetidos", productos.filter((p) => p === "Diavola al Miele").length === 1);
chequear("productosDelPedido · basura → vacío", productosDelPedido(null).length === 0 && productosDelPedido([1, "x"]).length === 0);
chequear(
  "productosDelPedido · tope de 6",
  productosDelPedido(Array.from({ length: 9 }, (_, i) => ({ type: "pizza", name: `Pizza ${i}` }))).length === 6,
);

/* ── la pregunta ── */
chequear("pregunta · un producto", preguntaOpinion(["Diavola al Miele"]) === "¿Qué te pareció la Diavola al Miele?");
chequear("pregunta · solo empanadas", preguntaOpinion([EMPANADAS]) === "¿Qué te parecieron las empanadas?");
chequear("pregunta · varios", preguntaOpinion(["Diavola al Miele", EMPANADAS]) === "¿Qué te pareció tu pedido?");
chequear("pregunta · desde la home", preguntaOpinion([]) === "¿Qué te pareció lo que probaste?");

/* ── línea de la tarjeta ── */
chequear("línea · pizza", lineaProducto("Fugazzeta") === "Probó la Fugazzeta");
chequear("línea · empanadas", lineaProducto(EMPANADAS) === "Probó las empanadas");
chequear("línea · sin producto", lineaProducto("") === "");

/* ── validación ── */
const base = { rating: 5, texto: "Riquísima, la masa súper tierna.", nombre: "Juan", producto: "Fugazzeta" };
const permitidos = ["Fugazzeta", EMPANADAS];
const error = (r: ReturnType<typeof validarOpinion>) => (r.ok ? "" : r.error);
chequear("validar · opinión válida", validarOpinion(base, permitidos).ok);
chequear("validar · 0 estrellas", /estrellas/i.test(error(validarOpinion({ ...base, rating: 0 }, permitidos))));
chequear("validar · 6 estrellas", !validarOpinion({ ...base, rating: 6 }, permitidos).ok);
chequear("validar · estrellas con decimales", !validarOpinion({ ...base, rating: 2.5 }, permitidos).ok);
chequear("validar · estrellas como texto", !validarOpinion({ ...base, rating: "5" }, permitidos).ok);
chequear("validar · texto demasiado corto", !validarOpinion({ ...base, texto: " ok " }, permitidos).ok);
chequear("validar · texto demasiado largo", !validarOpinion({ ...base, texto: "a".repeat(501) }, permitidos).ok);
const colapsado = validarOpinion({ ...base, texto: "  Muy\n\n buena   pizza  " }, permitidos);
chequear("validar · colapsa espacios y saltos", colapsado.ok && colapsado.opinion.texto === "Muy buena pizza");
chequear("validar · sin nombre", /nombre/i.test(error(validarOpinion({ ...base, nombre: "  " }, permitidos))));
chequear("validar · nombre demasiado largo", !validarOpinion({ ...base, nombre: "a".repeat(41) }, permitidos).ok);
chequear("validar · producto fuera de la lista", !validarOpinion({ ...base, producto: "Hamburguesa" }, permitidos).ok);
const sinProducto = validarOpinion({ ...base, producto: "" }, permitidos);
chequear("validar · producto vacío es válido", sinProducto.ok && sinProducto.opinion.producto === "");
chequear("validar · no es objeto", !validarOpinion("basura", permitidos).ok);

/* ── aviso por Telegram ── */
const aviso = textoAvisoOpinion({ rating: 4, texto: "Muy rica", nombre: "Ana\nFALSA LÍNEA", producto: "Fugazzeta" }, { ref: "IM-123456-ABCD" });
chequear("aviso · encabezado con estrellas", aviso.startsWith("OPINIÓN NUEVA ★★★★☆"));
chequear("aviso · el nombre no puede agregar una línea", !aviso.split("\n").some((l) => l.startsWith("FALSA")));
chequear("aviso · dice el pedido", aviso.includes("IM-123456-ABCD"));
chequear("aviso · dice el producto", aviso.includes("Fugazzeta"));
chequear("aviso · pide revisar en el panel", /panel/i.test(aviso));
const avisoHome = textoAvisoOpinion({ rating: 5, texto: "Excelente", nombre: "Leo", producto: "" }, {});
chequear("aviso · desde la home", /desde la home/i.test(avisoHome));

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
