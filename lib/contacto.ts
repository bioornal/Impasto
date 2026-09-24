/**
 * Enlaces de contacto del negocio, armados desde la configuración. No importa
 * `db` ni React, para poder testearlo con `tsx` (`tests/contacto.test.ts`).
 */

/** "(03757) 42-1840" → "tel:+543757421840". Sin dígitos, null. */
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

/** wa.me con el número internacional y, si se pasa, el mensaje ya escrito. */
export function enlaceWhatsapp(numero: string, mensaje?: string): string {
  let digitos = String(numero || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `54${digitos}`;
  return `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}
