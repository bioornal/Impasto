/**
 * Enlaces de contacto del negocio, armados desde la configuración. No importa
 * `db` ni React, para poder testearlo con `tsx` (`tests/contacto.test.ts`).
 */

/** "(03757) 65-2003" → "tel:+543757652003". Sin dígitos, null. */
export function enlaceTelefono(telefono: string): string | null {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("54")) return `tel:+${digitos}`;
  if (digitos.startsWith("0")) return `tel:+54${digitos.slice(1)}`;
  if (digitos.length === 10) return `tel:+54${digitos}`;
  return `tel:${digitos}`;
}

/** "@impasto.iguazu" (o la URL completa) → el perfil. Sin usuario, null: no se inventa nada. */
export function enlaceInstagram(instagram: string): string | null {
  const valor = String(instagram || "").trim();
  if (/^https?:\/\//i.test(valor)) return valor;
  const usuario = valor.replace(/^@/, "");
  return usuario ? `https://www.instagram.com/${usuario}/` : null;
}

/** Lo que aparece ya escrito al abrir WhatsApp desde un botón de "pedí por WhatsApp". */
export const MENSAJE_PEDIDO_WHATSAPP = "¡Hola! Quiero hacer un pedido.";

/** El del botón flotante: es para cualquier consulta, no solo para pedir. */
export const MENSAJE_CONSULTA_WHATSAPP = "¡Hola! Les escribo desde la web.";

/**
 * El teléfono tal como se muestra ("(03757) 65-2003"), solo si es el mismo
 * número que el de WhatsApp: se comparan los últimos diez dígitos (sin 54, 9
 * ni 0). Son dos campos aparte en el panel; si difieren, mostrar el teléfono
 * junto a "WhatsApp" sería dar un número que no atiende el chat.
 */
export function telefonoSiEsWhatsapp(telefono: string, whatsapp: string): string | null {
  const fin = (valor: string) => String(valor || "").replace(/\D/g, "").slice(-10);
  const deTelefono = fin(telefono);
  return deTelefono.length === 10 && deTelefono === fin(whatsapp) ? telefono.trim() : null;
}

/** Puerto Iguazú: la de un número local escrito sin característica. */
const CARACTERISTICA_LOCAL = "3757";

/**
 * Las características argentinas de 3 cifras (la 11 es la única de 2; el resto,
 * de 4). Hacen falta para saber dónde va el 15 en "0376 15 4123456".
 */
const CARACTERISTICAS_DE_3 = new Set([
  "220", "221", "223", "230", "236", "237", "249", "260", "261", "263", "264", "266",
  "280", "291", "294", "297", "298", "299", "336", "341", "342", "343", "345", "348",
  "351", "353", "358", "362", "364", "370", "376", "379", "380", "381", "383", "385",
  "387", "388",
]);

/**
 * El WhatsApp que dejó un cliente, listo para `wa.me`: 54 + característica +
 * número, como el de Impasto ("54 3757 652002"). Acepta como lo escribe la
 * gente: con 0, con 15, con +54 o +54 9, o solo el número local de Iguazú.
 * Un número de otro país sirve si viene con +. Lo que no se reconoce da null:
 * mejor sin enlace que abrir el chat de otra persona.
 */
export function whatsappDeCliente(telefono: string): string | null {
  const texto = String(telefono || "").trim();
  let digitos = texto.replace(/\D/g, "");
  const conPrefijo = texto.startsWith("+") || digitos.startsWith("00");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);

  let nacional = digitos;
  if (digitos.startsWith("54") && (conPrefijo || digitos.length >= 12)) {
    nacional = digitos.slice(2).replace(/^0/, "").replace(/^9/, "");
  } else if (conPrefijo) {
    return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
  } else {
    nacional = nacional.replace(/^0/, "");
  }

  if (nacional.length === 6) nacional = CARACTERISTICA_LOCAL + nacional;
  if (nacional.length === 8 && nacional.startsWith("15")) nacional = CARACTERISTICA_LOCAL + nacional.slice(2);
  if (nacional.length === 12) {
    const largo = nacional.startsWith("11") ? 2 : CARACTERISTICAS_DE_3.has(nacional.slice(0, 3)) ? 3 : 4;
    if (nacional.slice(largo, largo + 2) !== "15") return null;
    nacional = nacional.slice(0, largo) + nacional.slice(largo + 2);
  }
  return /^[123]\d{9}$/.test(nacional) ? `54${nacional}` : null;
}

/**
 * Lo que aparece escrito al abrir el chat con un cliente desde el panel. La
 * referencia va solo si es de la web (`IM-107345-K7QD`): la del POS
 * (`IM-3`) el cliente nunca la vio.
 */
export function mensajeAlCliente(nombre: string, referencia?: string): string {
  const primero = String(nombre || "").trim().split(/\s+/)[0];
  const saludo = primero && primero !== "—" ? `¡Hola, ${primero}!` : "¡Hola!";
  const pedido = referencia === undefined ? "" : /^IM-\d{6}-\w+$/.test(referencia) ? ` por tu pedido ${referencia}` : " por tu pedido";
  return `${saludo} Te escribimos de Impasto${pedido}.`;
}

/** wa.me con el número internacional y, si se pasa, el mensaje ya escrito. */
export function enlaceWhatsapp(numero: string, mensaje?: string): string {
  let digitos = String(numero || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `54${digitos}`;
  return `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}
