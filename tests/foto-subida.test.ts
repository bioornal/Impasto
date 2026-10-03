import { TAMANO_MAXIMO, claveDeFoto, idValido, validarFoto } from "../lib/foto-subida";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}
const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
const GIF = bytes(0x47, 0x49, 0x46, 0x38);

const ok = (r: ReturnType<typeof validarFoto>) => (r.ok ? r.tipo.ext : r.error);
chequear("tipo · jpg", ok(validarFoto(JPG, JPG.length)) === "jpg");
chequear("tipo · png", ok(validarFoto(PNG, PNG.length)) === "png");
chequear("tipo · webp", ok(validarFoto(WEBP, WEBP.length)) === "webp");
chequear("tipo · otro formato se rechaza", ok(validarFoto(GIF, GIF.length)) === "La foto tiene que ser JPG, PNG o WebP.");
chequear("tamaño · vacío se rechaza", ok(validarFoto(new Uint8Array(), 0)) === "Elegí una foto.");
chequear("tamaño · más de 4 MB se rechaza", ok(validarFoto(JPG, TAMANO_MAXIMO + 1)) === "La foto pesa más de 4 MB.");
chequear("clave · carpeta del producto y fecha con milésimas",
  claveDeFoto("0d871df5-0e5c-4fe3-8450-5e63261de27a", new Date("2026-10-03T15:30:00.123Z"), "jpg") === "fotos/0d871df5-0e5c-4fe3-8450-5e63261de27a/20261003T153000123Z.jpg");
chequear("id · uuid válido", idValido("0d871df5-0e5c-4fe3-8450-5e63261de27a"));
chequear("id · rechaza rutas y basura", !idValido("../x") && !idValido("abc") && !idValido("0d871df5-0e5c-4fe3-8450-5e63261de27a/../y"));

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
