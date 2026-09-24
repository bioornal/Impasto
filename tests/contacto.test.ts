import { enlaceTelefono, enlaceInstagram, enlaceWhatsapp, MENSAJE_PEDIDO_WHATSAPP } from "../lib/contacto";

let fallos = 0;

function chequear(nombre: string, real: unknown, esperado: unknown) {
  if (real === esperado) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}: esperado ${JSON.stringify(esperado)}, obtuvo ${JSON.stringify(real)}`);
    fallos++;
  }
}

/* ── teléfono: el que muestra el footer tiene que poder tocarse ── */

chequear("fijo con 0 de larga distancia → +54 sin el 0", enlaceTelefono("(03757) 42-1840"), "tel:+543757421840");
chequear("teléfono actual de Impasto (03757) 65-2003 → formato tel:+543757652003", enlaceTelefono("(03757) 65-2003"), "tel:+543757652003");
chequear("ya en formato internacional", enlaceTelefono("+54 3757 42-1840"), "tel:+543757421840");
chequear("diez dígitos sin 0 → se le agrega +54", enlaceTelefono("3757 421840"), "tel:+543757421840");
chequear("sin dígitos no arma un enlace", enlaceTelefono(""), null);

/* ── Instagram ── */

chequear("usuario con @", enlaceInstagram("@impasto.iguazu"), "https://www.instagram.com/impasto.iguazu/");
chequear("usuario sin @", enlaceInstagram("impasto.iguazu"), "https://www.instagram.com/impasto.iguazu/");
chequear("si ya es una URL, se respeta", enlaceInstagram("https://www.instagram.com/otro/"), "https://www.instagram.com/otro/");
chequear("vacío no inventa un perfil", enlaceInstagram("  "), null);

/* ── WhatsApp ── */

chequear("sin mensaje: el número solo", enlaceWhatsapp("543757421840"), "https://wa.me/543757421840");
chequear(
  "con mensaje: codificado para la URL",
  enlaceWhatsapp("543757421840", MENSAJE_PEDIDO_WHATSAPP),
  "https://wa.me/543757421840?text=%C2%A1Hola!%20Quiero%20hacer%20un%20pedido.",
);
chequear("limpia lo que no es dígito", enlaceWhatsapp("+54 3757 42-1840"), "https://wa.me/543757421840");
chequear("diez dígitos sin 54 → se le agrega 54", enlaceWhatsapp("3757 652003"), "https://wa.me/543757652003");
chequear("diez dígitos con 0 → se quita el 0 y agrega 54", enlaceWhatsapp("(03757) 652003"), "https://wa.me/543757652003");

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
