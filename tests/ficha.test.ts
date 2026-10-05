import {
  vecino,
  ejeDelGesto,
  resolverSoltar,
  resistencia,
  fichaDePizza,
  fichaDeEmpanada,
  fichaDeBebida,
  cartelitosDePizza,
  cartelitosDeEmpanada,
  lineaDePizza,
  lineaDeBebida,
  UMBRAL_CIERRE,
} from "../lib/ficha";
import { imagenDeProducto, REAL_PRODUCT_PHOTOS, getPizzaImage, getEmpanadaImage, getDrinkImage } from "../lib/stock-images";
import type { Pizza, Empanada, Bebida } from "../types";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

/* ── vecinos: sin vuelta circular ── */
chequear("vecino · siguiente en el medio", vecino(3, 10, 1) === 4);
chequear("vecino · anterior en el medio", vecino(3, 10, -1) === 2);
chequear("vecino · no hay anterior del primero", vecino(0, 10, -1) === null);
chequear("vecino · no hay siguiente del último", vecino(9, 10, 1) === null);
chequear("vecino · lista de uno no tiene vecinos", vecino(0, 1, 1) === null && vecino(0, 1, -1) === null);

/* ── eje del gesto ── */
chequear("eje · un temblor no decide", ejeDelGesto(4, 5) === null);
chequear("eje · horizontal", ejeDelGesto(-30, 8) === "horizontal");
chequear("eje · vertical", ejeDelGesto(6, 40) === "vertical");
chequear("eje · diagonal gana el mayor", ejeDelGesto(20, -25) === "vertical");

/* ── soltar ── */
const base = { dt: 400, ancho: 400, hayAnterior: true, haySiguiente: true };
chequear("soltar · sin eje se queda (toque)", resolverSoltar({ ...base, eje: null, dx: 0, dy: 0 }) === "quedarse");
chequear("soltar · izquierda lejos pasa al siguiente", resolverSoltar({ ...base, eje: "horizontal", dx: -120, dy: 0 }) === "siguiente");
chequear("soltar · derecha lejos vuelve al anterior", resolverSoltar({ ...base, eje: "horizontal", dx: 120, dy: 0 }) === "anterior");
chequear("soltar · poco y lento se queda", resolverSoltar({ ...base, eje: "horizontal", dx: -60, dy: 0 }) === "quedarse");
chequear("soltar · poco pero rápido pasa", resolverSoltar({ ...base, eje: "horizontal", dx: -60, dy: 0, dt: 80 }) === "siguiente");
// Medido en Chrome con un deslizamiento corto y decidido: 70 px en 163 ms.
chequear("soltar · deslizamiento corto y decidido pasa", resolverSoltar({ ...base, eje: "horizontal", dx: -70, dy: 0, dt: 163 }) === "siguiente");
chequear("soltar · rápido pero cortito no pasa", resolverSoltar({ ...base, eje: "horizontal", dx: -20, dy: 0, dt: 20 }) === "quedarse");
chequear("soltar · en el último no pasa", resolverSoltar({ ...base, eje: "horizontal", dx: -200, dy: 0, haySiguiente: false }) === "quedarse");
chequear("soltar · en el primero no vuelve", resolverSoltar({ ...base, eje: "horizontal", dx: 200, dy: 0, hayAnterior: false }) === "quedarse");
chequear("soltar · bajar más del umbral cierra", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: UMBRAL_CIERRE + 1 }) === "cerrar");
chequear("soltar · bajar poco y lento se queda", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: 60 }) === "quedarse");
chequear("soltar · bajar rápido cierra", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: 60, dt: 90 }) === "cerrar");
chequear("soltar · subir nunca cierra", resolverSoltar({ ...base, eje: "vertical", dx: 0, dy: -300, dt: 90 }) === "quedarse");

/* ── resistencia en los bordes ── */
chequear("resistencia · con vecino sigue al dedo", resistencia(-90, true) === -90);
chequear("resistencia · sin vecino, un tercio", resistencia(-90, false) === -30);

/* ── normalización ── */
// Las etiquetas salen del panel (`badges`), no de los tags: "vegetariana" está
// en los tags pero el panel no la manda a pizzas, así que no aparece.
const pizza: Pizza = {
  id: "p1", nombre: "Diavola", categoria: "gourmet", precio: 14500, desc: "Salame picante y miel",
  tags: ["picante", "vegetariana", "gourmet"], disponible: true, popular: true,
  badges: [{ label: "Gourmet", color: "dorado" }, { label: "Picante", color: "rojo" }],
};
const fp = fichaDePizza(pizza);
chequear("pizza · tipo y precio", fp.tipo === "pizza" && fp.precio === 14500 && fp.precioTexto === "$14.500");
chequear("pizza · descripción completa", fp.desc === "Salame picante y miel");
chequear("pizza · cartelitos en el orden de la tarjeta",
  fp.badges.map((b) => b.texto).join("|") === "★ Más pedida|Gourmet|Picante");
chequear("pizza · clases de la tarjeta",
  fp.badges.map((b) => b.clase).join("|") === "p-badge top|p-badge c-dorado|p-badge c-rojo");
chequear("pizza · los tags sin etiqueta del panel no generan cartelito", !fp.badges.some((b) => /veggie|vegetariana/i.test(b.texto)));
chequear("cartelitos · la tarjeta usa los mismos que la ficha",
  JSON.stringify(cartelitosDePizza(pizza)) === JSON.stringify(fp.badges));
const agotada = fichaDePizza({ ...pizza, disponible: false });
chequear("pizza · agotada", agotada.agotado === true);
chequear("pizza · agotada no dice Más pedida", !agotada.badges.some((b) => b.texto.includes("Más pedida")));
chequear("pizza · agotada conserva las etiquetas del panel", agotada.badges.map((b) => b.texto).join("|") === "Gourmet|Picante");

const empanada: Empanada = { id: "e1", nombre: "Carne", precio: 1800, desc: "Cortada a cuchillo", tags: [], disponible: true, badges: [{ label: "Nueva", color: "dorado" }] };
const fe = fichaDeEmpanada(empanada, "180 g");
chequear("empanada · precio unitario", fe.tipo === "empanada" && fe.precioTexto === "$1.800");
chequear("empanada · etiqueta", fe.badges.length === 1 && fe.badges[0].clase === "p-badge c-dorado" && fe.badges[0].texto === "Nueva");
chequear("cartelitos · la tarjeta de empanada usa los mismos que la ficha",
  JSON.stringify(cartelitosDeEmpanada(empanada)) === JSON.stringify(fe.badges));
const sinPrecio = fichaDeEmpanada({ ...empanada, precio: undefined, badges: [] }, "180 g");
chequear("empanada · sin precio muestra el peso", sinPrecio.precioTexto === "180 g" && sinPrecio.precio === 0);
chequear("empanada · sin etiqueta", sinPrecio.badges.length === 0);

const bebida: Bebida = { id: "b1", nombre: "Quilmes", precio: 3500, disponible: false };
const fb = fichaDeBebida(bebida);
chequear("bebida · sin descripción ni cartelitos", fb.tipo === "bebida" && fb.desc === "" && fb.badges.length === 0);
chequear("bebida · agotada", fb.agotado === true);

/* ── líneas del carrito: las mismas que arma la tarjeta ── */
const lp = lineaDePizza(pizza);
chequear("línea pizza", lp.key === "p1" && lp.type === "pizza" && lp.name === "Diavola" && lp.price === 14500 && lp.illus === "p1" && lp.qty === 1);
const lb = lineaDeBebida(bebida);
chequear("línea bebida", lb.key === "b1" && lb.type === "bebida" && lb.name === "Quilmes" && lb.price === 3500 && lb.qty === 1 && lb.illus === undefined);

/* ── imagen: la misma que resuelve cada ilustración ── */
const idConFoto = Object.keys(REAL_PRODUCT_PHOTOS)[0];
chequear("imagen · foto real por id", imagenDeProducto("pizza", "x", idConFoto) === REAL_PRODUCT_PHOTOS[idConFoto]);
chequear("imagen · pizza igual que getPizzaImage", imagenDeProducto("pizza", "Fugazzeta", "sin-foto", ["gourmet"]) === getPizzaImage("Fugazzeta", "sin-foto", ["gourmet"]));
chequear("imagen · empanada igual que getEmpanadaImage", imagenDeProducto("empanada", "Pollo", "sin-foto") === getEmpanadaImage("Pollo", "sin-foto"));
chequear("imagen · bebida igual que getDrinkImage", imagenDeProducto("bebida", "Coca-Cola", "sin-foto") === getDrinkImage("Coca-Cola", "sin-foto"));

for (const nombre of ["Muzzarela y Jamon", "Blue Bacon", "Quattro Fratelli"]) {
  const foto = `https://example.com/fotos/${encodeURIComponent(nombre)}.webp`;
  chequear(`${nombre} · ficha conserva foto del catálogo`, fichaDePizza({ ...pizza, nombre, foto }).foto === foto);
}
chequear("pizza · sin foto permite respaldo", fichaDePizza(pizza).foto === undefined);
chequear("empanada · conserva foto", fichaDeEmpanada({ ...empanada, foto: "empanada.webp" }, "180 g").foto === "empanada.webp");
chequear("bebida · conserva foto", fichaDeBebida({ ...bebida, foto: "bebida.webp" }).foto === "bebida.webp");

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
