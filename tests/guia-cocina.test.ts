import { armarGuia, formatearCantidad, idDePreparacion, SALSA, type FilasGuia } from "../lib/guia-cocina";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

/* ── formato de cantidades ── */
chequear("cantidad · kg en gramos", formatearCantidad(0.25, "kg") === "250 g");
chequear("cantidad · decimales con coma", formatearCantidad(0.0125, "kg") === "12,5 g");
chequear("cantidad · litro en ml", formatearCantidad(0.01, "litro") === "10 ml");
chequear("cantidad · una unidad", formatearCantidad(1, "unidad") === "1 unidad");
chequear("cantidad · varias unidades", formatearCantidad(2, "unidad") === "2 unidades");
chequear("cantidad · fracción de unidad, sin redondear a cero", formatearCantidad(0.002, "unidad") === "0,002 unidades");
chequear("cantidad · fracción de atado", formatearCantidad(0.365, "atado") === "⅓ de atado");
chequear("cantidad · atados enteros", formatearCantidad(2, "atado") === "2 atados");
chequear("cantidad · cero o inválida", formatearCantidad(0, "kg") === "—" && formatearCantidad(NaN, "kg") === "—");

/* ── filas de ejemplo ── */
const ing = (id: string, nombre: string, unidad = "kg") => ({ id, nombre, unidad, gramos_por_unidad: null });
const rec = (id: string, nombre: string, extra: Record<string, unknown> = {}) =>
  ({ id, nombre, precio_salsa: 330, en_cocina: null, indicaciones: null, conservacion: null, ...extra });
let n = 0;
const lin = (receta_id: string, ingrediente_id: string, cantidad_kg: number, momento = "horno") =>
  ({ id: `l${++n}`, receta_id, ingrediente_id, cantidad_kg, momento });

const filas: FilasGuia = {
  productos: [
    { id: "p-diavola", nombre: "Diavola al Miele Piccante", categoria: "pizzas", archivado: false },
    { id: "p-muzza", nombre: "Muzzarella Impasto", categoria: "pizzas", archivado: false },
    { id: "p-bianca", nombre: "Bianca all'Aglio Confit", categoria: "pizzas", archivado: true },
    { id: "p-chipa", nombre: "Chipa", categoria: "otros", archivado: false },
    { id: "p-nueva", nombre: "Pizza Nueva", categoria: "pizzas", archivado: false },
  ],
  precios: [
    { id: "v1", receta_id: "r-diavola", nombre: "Diavola al Miele Piccante" },
    { id: "v2", receta_id: "r-muzza", nombre: "Muzzarella Impasto" },
    { id: "v3", receta_id: "r-bianca", nombre: "Bianca all'Aglio Confit" },
    { id: "v4", receta_id: "r-chipa", nombre: "Chipa" },
  ],
  recetas: [
    rec("r-diavola", "Diavola al Miele Piccante", { indicaciones: "La miel va en hilo." }),
    rec("r-muzza", "Muzzarella Impasto", { en_cocina: "proximamente" }),
    rec("r-bianca", "Bianca all'Aglio Confit", { precio_salsa: 0, en_cocina: "proximamente" }),
    rec("r-chipa", "Chipa"),
    rec("r-puttanesca", "Puttanesca Impasto", { en_cocina: "prueba" }),
    rec("r-blanca", "Blanca Sola", { precio_salsa: 0, en_cocina: "prueba" }),
    rec("r-miel", "Miel Picante", { precio_salsa: 0, indicaciones: "Baño María.", conservacion: "Varias semanas." }),
    rec("r-manteca", "Manteca de Ajo Confitado", { precio_salsa: 0 }),
    rec("r-ajo", "Ajo Confitado", { precio_salsa: 0 }),
  ],
  ingredientes: [
    ing("i-muzza", "Muzzarela"), ing("i-cala", "Calabresa"), ing("i-miel", "Miel"), ing("i-aji", "Aji Molido"),
    ing("i-mielp", "Miel Picante"), ing("i-oliva", "Oliva", "litro"), ing("i-ajo", "Ajo"),
    ing("i-ajoc", "Ajo Confitado"), ing("i-manteca", "Manteca"), ing("i-mantecaajo", "Manteca de Ajo Confitado"),
    ing("i-rucula", "Rucula", "atado"), ing("i-huevo", "Huevo", "unidad"),
  ],
  lineas: [
    lin("r-diavola", "i-cala", 0.1), lin("r-diavola", "i-muzza", 0.25), lin("r-diavola", "i-mielp", 0.02, "despues"),
    lin("r-muzza", "i-muzza", 0.25),
    lin("r-bianca", "i-muzza", 0.25), lin("r-bianca", "i-mantecaajo", 0.056, "base"), lin("r-bianca", "i-oliva", 0.003, "despues"),
    lin("r-puttanesca", "i-muzza", 0.22), lin("r-puttanesca", "i-huevo", 1),
    lin("r-blanca", "i-rucula", 0.365, "despues"), lin("r-blanca", "i-muzza", 0.2),
    lin("r-miel", "i-miel", 0.125), lin("r-miel", "i-aji", 0.005),
    lin("r-manteca", "i-manteca", 0.24), lin("r-manteca", "i-ajoc", 0.095),
    lin("r-ajo", "i-ajo", 0.2), lin("r-ajo", "i-oliva", 0.1),
  ],
  preparaciones: [
    { receta_id: "r-miel", ingrediente_id: "i-mielp", rinde_kg: 0.125 },
    { receta_id: "r-manteca", ingrediente_id: "i-mantecaajo", rinde_kg: 0.341 },
    { receta_id: "r-ajo", ingrediente_id: "i-ajoc", rinde_kg: 0.3 },
  ],
};
const fotos: Record<string, string> = { "p-diavola": "/diavola.jpg", "p-bianca": "/bianca.jpg" };
const guia = armarGuia(filas, (id, nombre) => (id ? fotos[id] : undefined) ?? (nombre === "Puttanesca Impasto" ? "/puttanesca.webp" : undefined));
const pizza = (nombre: string) => guia.pizzas.find((p) => p.nombre === nombre)!;
const estados = (e: string) => guia.pizzas.filter((p) => p.estado === e).map((p) => p.nombre);

/* ── qué pizzas y en qué estado ── */
chequear("venta · las no archivadas de la categoría pizzas, en el orden de la carta",
  JSON.stringify(estados("venta")) === JSON.stringify(["Muzzarella Impasto", "Diavola al Miele Piccante", "Pizza Nueva"]));
chequear("venta · la Chipa (categoría otros) no entra", !guia.pizzas.some((p) => p.nombre === "Chipa"));
chequear("próximamente · las marcadas, sin repetir las que están en venta",
  JSON.stringify(estados("proximamente")) === JSON.stringify(["Bianca all'Aglio Confit"]));
chequear("prueba · las marcadas, alfabéticas", JSON.stringify(estados("prueba")) === JSON.stringify(["Blanca Sola", "Puttanesca Impasto"]));
chequear("venta · sin receta vinculada lo avisa", pizza("Pizza Nueva").sinReceta && pizza("Pizza Nueva").horno.length === 0);

/* ── armado de cada pizza ── */
const diavola = pizza("Diavola al Miele Piccante");
chequear("armado · salsa si la receta la costea", diavola.salsa && !pizza("Bianca all'Aglio Confit").salsa);
chequear("armado · horno ordenado por cantidad",
  JSON.stringify(diavola.horno) === JSON.stringify([{ nombre: "Muzzarela", cantidad: "250 g" }, { nombre: "Calabresa", cantidad: "100 g" }]));
chequear("armado · después del horno con enlace a la preparación",
  JSON.stringify(diavola.despues) === JSON.stringify([{ nombre: "Miel Picante", cantidad: "20 g", preparacion: "miel-picante" }]));
chequear("armado · nota desde las indicaciones", diavola.nota === "La miel va en hilo.");
const bianca = pizza("Bianca all'Aglio Confit");
chequear("armado · línea de base", bianca.base.length === 1 && bianca.base[0].nombre === "Manteca de Ajo Confitado" && bianca.base[0].cantidad === "56 g");
chequear("armado · unidades y atados", pizza("Puttanesca Impasto").horno.some((l) => l.cantidad === "1 unidad")
  && pizza("Blanca Sola").despues[0].cantidad === "⅓ de atado");
chequear("armado · fotos por producto o por nombre", diavola.foto === "/diavola.jpg" && pizza("Puttanesca Impasto").foto === "/puttanesca.webp"
  && pizza("Muzzarella Impasto").foto === undefined);
chequear("armado · productoId solo si hay producto", bianca.productoId === "p-bianca" && pizza("Puttanesca Impasto").productoId === undefined);

/* ── preparaciones ── */
const prep = (nombre: string) => guia.preparaciones.find((p) => p.nombre === nombre)!;
chequear("preparaciones · las que usan las pizzas mostradas, incluidas las anidadas",
  JSON.stringify(guia.preparaciones.map((p) => p.nombre)) === JSON.stringify(["Miel Picante", "Manteca de Ajo Confitado", "Ajo Confitado"]));
chequear("preparaciones · para quién", JSON.stringify(prep("Ajo Confitado").para) === JSON.stringify(["Manteca de Ajo Confitado"])
  && JSON.stringify(prep("Manteca de Ajo Confitado").para) === JSON.stringify(["Bianca all'Aglio Confit"]));
chequear("preparaciones · próximamente si ninguna pizza en venta la usa",
  !prep("Miel Picante").proximamente && prep("Ajo Confitado").proximamente && prep("Manteca de Ajo Confitado").proximamente);
chequear("preparaciones · rinde, ingredientes, indicaciones y conservación",
  prep("Miel Picante").rinde === "125 g" && prep("Miel Picante").ingredientes[0].nombre === "Miel"
  && prep("Miel Picante").indicaciones === "Baño María." && prep("Miel Picante").conservacion === "Varias semanas.");
chequear("preparaciones · enlace entre preparaciones", prep("Manteca de Ajo Confitado").ingredientes.some((l) => l.preparacion === "ajo-confitado"));
chequear("preparaciones · ids de ancla únicos y sin espacios",
  new Set(guia.preparaciones.map((p) => p.id)).size === guia.preparaciones.length && guia.preparaciones.every((p) => /^[a-z0-9-]+$/.test(p.id)));
chequear("ancla · sin tildes", idDePreparacion("Pesto de Morrón") === "pesto-de-morron");

/* ── nada interno en lo que se ve ── */
const visible = JSON.stringify(guia);
chequear("visible · sin precios ni costos", !/\$|precio|costo|rinde_kg|cantidad_kg/i.test(visible.replace(/"rinde":/g, "")));
chequear("visible · la salsa por defecto", SALSA === "Salsa de tomate, 150 g");

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
