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

/** wa.me con el número internacional y, si se pasa, el mensaje ya escrito. */
export function enlaceWhatsapp(numero: string, mensaje?: string): string {
  let digitos = String(numero || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `54${digitos}`;
  return `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}
