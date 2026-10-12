import {
  productosDelPedido,
  preguntaOpinion,
  lineaProducto,
  validarOpinion,
  textoAvisoOpinion,
  nombreParaPublicar,
  validarCambioTestimonio,
  productoDeLaOpinion,
  productosDeTestimonio,
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
chequear(
  "línea · dos productos",
  lineaProducto("Diavola al Miele Piccante + Muzzarela y Jamon") === "Probó la Diavola al Miele Piccante y la Muzzarela y Jamon",
);
chequear("línea · tres, con empanadas", lineaProducto("Fugazzeta + Muzzarella + Empanadas") === "Probó la Fugazzeta, la Muzzarella y las empanadas");

/* ── sobre qué queda una opinión de pedido ── */
const delPedido = productosDelPedido([
  { type: "pizza-half", name: "Mitad Diavola al Miele Piccante / Mitad Muzzarela y Jamon" },
  { type: "bebida", name: "Pepsi 1.5 L" },
]);
chequear("producto · eligió uno", productoDeLaOpinion("Muzzarela y Jamon", delPedido) === "Muzzarela y Jamon");
const todoElPedido = productoDeLaOpinion("", delPedido);
chequear("producto · no eligió: todo lo que compró", todoElPedido === "Diavola al Miele Piccante + Muzzarela y Jamon");
chequear("producto · se vuelve a separar igual", productosDeTestimonio(todoElPedido).join("|") === "Diavola al Miele Piccante|Muzzarela y Jamon");
chequear("producto · pedido sin pizzas ni empanadas", productoDeLaOpinion("", []) === "");

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

/* ── nombre con que se completa el formulario del seguimiento ── */
chequear("nombre · el del pedido, entero", nombreParaPublicar("Carlos Alberto Barrios") === "Carlos Alberto Barrios");
chequear("nombre · en una línea", nombreParaPublicar("  Carlos\n Alberto  ") === "Carlos Alberto");
const largo = nombreParaPublicar("María Fernanda de los Ángeles Rodríguez Etchegaray");
chequear("nombre · largo: corta palabras enteras y entra en el tope", largo === "María Fernanda de los Ángeles Rodríguez" && largo.length <= 40);
chequear("nombre · una sola palabra larga se recorta", nombreParaPublicar("a".repeat(50)).length === 40);
chequear("nombre · sin nombre", nombreParaPublicar(null) === "" && nombreParaPublicar(undefined) === "");

/* ── cambios del dueño en el panel ── */
const cambio = (input: unknown) => validarCambioTestimonio(input);
const aprobar = cambio({ estado: "aprobado" });
chequear("cambio · aprobar", aprobar.ok && aprobar.cambio.estado === "aprobado" && !("nombre" in aprobar.cambio));
chequear("cambio · estado inventado", !cambio({ estado: "publicado" }).ok);
const renombrar = cambio({ nombre: "  Carlos\nAlberto Barrios ", producto: " Diavola al Miele Piccante " });
chequear(
  "cambio · nombre y producto en una línea",
  renombrar.ok && renombrar.cambio.nombre === "Carlos Alberto Barrios" && renombrar.cambio.producto === "Diavola al Miele Piccante",
);
chequear("cambio · nombre vacío", !cambio({ nombre: "   " }).ok);
chequear("cambio · nombre demasiado largo", !cambio({ nombre: "a".repeat(41) }).ok);
const sinProductoCambio = cambio({ producto: "" });
chequear("cambio · sacar el producto", sinProductoCambio.ok && sinProductoCambio.cambio.producto === "");
chequear("cambio · producto demasiado largo", !cambio({ producto: "a".repeat(301) }).ok);
chequear("cambio · nada para cambiar", !cambio({}).ok && !cambio("basura").ok);

/* ── aviso por Telegram ── */
const aviso = textoAvisoOpinion(
  { rating: 4, texto: "Muy rica", nombre: "Ana\nFALSA LÍNEA", producto: "Fugazzeta" },
  { cliente: "Ana María\nOTRA FALSA" },
);
chequear("aviso · encabezado con estrellas", aviso.startsWith("OPINIÓN NUEVA ★★★★☆"));
chequear("aviso · el nombre no puede agregar una línea", !aviso.split("\n").some((l) => /^(FALSA|OTRA)/.test(l)));
chequear("aviso · cómo se publica", aviso.includes("Se publica como: Ana FALSA LÍNEA"));
chequear("aviso · de quién es el pedido, sin referencia", aviso.includes("Pedido de Ana María OTRA FALSA") && !/IM-/.test(aviso));
chequear("aviso · dice el producto", aviso.includes("Fugazzeta"));
chequear("aviso · pide revisar en el panel", /panel/i.test(aviso));
const avisoSinCliente = textoAvisoOpinion({ rating: 5, texto: "Excelente", nombre: "Leo", producto: "" }, { cliente: "" });
chequear("aviso · pedido sin nombre de cliente", avisoSinCliente.includes("Pedido verificado"));
const avisoHome = textoAvisoOpinion({ rating: 5, texto: "Excelente", nombre: "Leo", producto: "" }, null);
chequear("aviso · desde la home", /desde la home/i.test(avisoHome));

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
