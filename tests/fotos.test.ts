import { elegirFoto, type ObjetoFoto } from "../lib/fotos";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}
const o = (key: string, uploadedAt: string): ObjetoFoto => ({ key, uploadedAt, url: `https://b/${encodeURIComponent(key)}` });
const objetos = [
  o("Diavola al Miele Piccante.jpg", "2026-10-01T10:00:00Z"),
  o("Diavola al Miele Piccante v3.jpg", "2026-10-03T13:30:00Z"),
  o("Diavola al Miele Piccante v2.jpg", "2026-10-03T13:13:00Z"),
  o("Pizza Fugazzeta Rellena.jpg", "2026-10-02T00:00:00Z"),
  o("pizza-fugazzeta (1).png", "2026-09-01T00:00:00Z"),
  o("Porteña de Jamón y Morrones.jpg", "2026-09-16T00:00:00Z"),
  o("PORTENA_DE_JAMON_Y_MORRONES-v2.webp", "2026-10-03T15:00:00Z"),
  o("fotos/p-quattro/20261003T150000.jpg", "2026-10-03T15:00:00Z"),
  o("Quattro Formaggi v9.jpg", "2026-10-03T16:00:00Z"),
  o("fotos/p-quattro/20261003T170000.jpg", "2026-10-03T17:00:00Z"),
  o("fotos/p-otro/20261004T000000.jpg", "2026-10-04T00:00:00Z"),
  o("Diavola al Miele Piccante.txt", "2026-10-05T00:00:00Z"),
];
const url = (producto: { id?: string; nombre: string }) => elegirFoto(producto, objetos)?.split("/").pop();

chequear("la versión más nueva gana", url({ id: "p-diavola", nombre: "Diavola al Miele Piccante" }) === encodeURIComponent("Diavola al Miele Piccante v3.jpg"));
chequear("sin mayúsculas, tildes, guiones ni guiones bajos", url({ nombre: "Porteña de Jamón y Morrones" }) === encodeURIComponent("PORTENA_DE_JAMON_Y_MORRONES-v2.webp"));
chequear("un nombre más largo no cuenta", url({ nombre: "Pizza Fugazzeta" }) === encodeURIComponent("pizza-fugazzeta (1).png"));
chequear("la carpeta del producto cuenta y gana si es más nueva", url({ id: "p-quattro", nombre: "Quattro Formaggi" }) === encodeURIComponent("fotos/p-quattro/20261003T170000.jpg"));
chequear("la carpeta de otro producto no cuenta", url({ id: "p-x", nombre: "Nada" }) === undefined);
chequear("solo imágenes", url({ nombre: "Diavola al Miele Piccante" }) === encodeURIComponent("Diavola al Miele Piccante v3.jpg"));
chequear("sin candidatas devuelve undefined", elegirFoto({ nombre: "Muzzarella Impasto" }, objetos) === undefined);
chequear("fecha inválida no gana", elegirFoto({ nombre: "X" }, [o("X v2.jpg", "basura"), o("X.jpg", "2026-01-01T00:00:00Z")])?.endsWith("X.jpg") === true);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
