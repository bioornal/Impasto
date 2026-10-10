import { enlaceTelefono, enlaceInstagram, enlaceWhatsapp, MENSAJE_PEDIDO_WHATSAPP, mensajeAlCliente, telefonoSiEsWhatsapp, whatsappDeCliente } from "../lib/contacto";

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

/* ── WhatsApp del cliente: el panel le escribe al número que dejó en el pedido ── */

chequear("formato estándar de Iguazú (54 3757 652002) se respeta", whatsappDeCliente("54 3757 652002"), "543757652002");
chequear("como pide el checkout (3757 55 1234) → se le agrega 54", whatsappDeCliente("3757 551234"), "543757551234");
chequear("con el 0 de larga distancia", whatsappDeCliente("(03757) 65-2002"), "543757652002");
chequear("con 15 después de la característica", whatsappDeCliente("3757 15 652002"), "543757652002");
chequear("con 0 y 15", whatsappDeCliente("03757-15-652002"), "543757652002");
chequear("con +54 9 de celular → sin el 9, como el de Impasto", whatsappDeCliente("+54 9 3757 652002"), "543757652002");
chequear("con 549 sin el +", whatsappDeCliente("5493757652002"), "543757652002");
chequear("con 0054", whatsappDeCliente("0054 3757 652002"), "543757652002");
chequear("solo el número local (6 cifras) → es de Iguazú", whatsappDeCliente("65-2002"), "543757652002");
chequear("15 + número local → es de Iguazú", whatsappDeCliente("15 652002"), "543757652002");
chequear("Buenos Aires con 15 (característica 11)", whatsappDeCliente("11 15 4123-4567"), "541141234567");
chequear("Posadas con 15 (característica 376)", whatsappDeCliente("0376 15 4123456"), "543764123456");
chequear("Brasil con + → tal cual", whatsappDeCliente("+55 45 99999-8888"), "5545999998888");
chequear("Paraguay con + → tal cual", whatsappDeCliente("+595 981 123456"), "595981123456");
chequear("9 cifras sin característica → no se adivina", whatsappDeCliente("334123456"), null);
chequear("10 cifras que no empiezan con característica → no se adivina", whatsappDeCliente("5461234567"), null);
chequear("12 cifras sin el 15 donde va → no se adivina", whatsappDeCliente("375712652002"), null);
chequear("vacío → sin enlace", whatsappDeCliente(""), null);

chequear("mensaje con el nombre y la referencia web", mensajeAlCliente("Juan Pérez", "IM-107345-K7QD"), "¡Hola, Juan! Te escribimos de Impasto por tu pedido IM-107345-K7QD.");
chequear("pedido del POS: sin referencia que el cliente no conoce", mensajeAlCliente("Ana", "IM-3"), "¡Hola, Ana! Te escribimos de Impasto por tu pedido.");
chequear("sin pedido (desde Clientes)", mensajeAlCliente("Ana"), "¡Hola, Ana! Te escribimos de Impasto.");
chequear("sin nombre", mensajeAlCliente("—", "IM-107345-K7QD"), "¡Hola! Te escribimos de Impasto por tu pedido IM-107345-K7QD.");

/* ── el número junto al botón de WhatsApp: solo si es el mismo ── */

chequear("teléfono de Impasto = su WhatsApp → se muestra como está escrito", telefonoSiEsWhatsapp("(03757) 65-2003", "543757652003"), "(03757) 65-2003");
chequear("WhatsApp con el 9 de celular también coincide", telefonoSiEsWhatsapp("(03757) 65-2003", "5493757652003"), "(03757) 65-2003");
chequear("otro número → no se muestra", telefonoSiEsWhatsapp("(03757) 42-1840", "543757652003"), null);
chequear("teléfono vacío → no se muestra", telefonoSiEsWhatsapp("", "543757652003"), null);
chequear("teléfono corto → no coincide por casualidad", telefonoSiEsWhatsapp("652003", "543757652003"), null);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
