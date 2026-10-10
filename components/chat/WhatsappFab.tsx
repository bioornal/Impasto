import type { BusinessConfig } from "@/lib/business";
import { enlaceWhatsapp, MENSAJE_CONSULTA_WHATSAPP, telefonoSiEsWhatsapp } from "@/lib/contacto";

/**
 * WhatsApp flotante, abajo a la izquierda: el chat ocupa la esquina derecha y
 * fuera de ahí el número solo aparecía en el footer (pedido del dueño,
 * 10/10/2026). Mismo botón que el del chat (`.chat-fab`): píldora en
 * escritorio, círculo en celular, por encima de la barra de abajo y se
 * desvanece al bajar igual que él.
 *
 * Es la única vía de WhatsApp flotante: sin asistente, `ChatWidget` ya no se
 * convierte en otro botón de WhatsApp, para no tener dos.
 */
export function WhatsappFab({ business, oculto = false }: { business: BusinessConfig; oculto?: boolean }) {
  const enlace = enlaceWhatsapp(business.whatsappPhone, MENSAJE_CONSULTA_WHATSAPP);
  if (!enlace) return null;
  const numero = telefonoSiEsWhatsapp(business.phone, business.whatsappPhone);

  return (
    <a
      className={`chat-fab chat-fab-pill wsp-fab ${oculto ? "is-hidden" : ""}`}
      href={enlace}
      target="_blank"
      rel="noreferrer"
      aria-label={numero ? `Escribinos por WhatsApp al ${numero}` : "Escribinos por WhatsApp"}
    >
      <span className="chat-fab-insignia"><IconoWhatsapp /></span>
      <span className="chat-fab-texto">
        <b>Escribinos por WhatsApp</b>
        {numero && <small>{numero}</small>}
      </span>
    </a>
  );
}

const IconoWhatsapp = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Zm5.4 14.24c-.23.64-1.34 1.23-1.85 1.27-.47.04-1.08.23-3.62-.76-3.06-1.2-5-4.25-5.15-4.45-.15-.2-1.23-1.64-1.23-3.13 0-1.5.78-2.23 1.06-2.54.28-.3.6-.38.8-.38.2 0 .4 0 .57.01.18 0 .43-.07.67.51.23.58.82 2 .89 2.14.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.38-.46.51-.15.15-.31.32-.13.62.17.3.77 1.27 1.65 2.06 1.13 1 2.08 1.32 2.38 1.47.3.15.47.12.65-.07.17-.2.75-.88.95-1.18.2-.3.4-.25.67-.15.27.1 1.7.8 2 .95.28.15.47.22.54.35.07.12.07.72-.16 1.36Z" />
  </svg>
);
