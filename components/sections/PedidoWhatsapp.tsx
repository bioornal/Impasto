import { enlaceWhatsapp, MENSAJE_PEDIDO_WHATSAPP } from "@/lib/contacto";
import type { BusinessConfig } from "@/lib/business";

/**
 * Mobile: "pedí por WhatsApp" al cierre de la carta, en una sola fila. En
 * escritorio la tarjeta sigue dentro de Opiniones (`Reviews.tsx`); en mobile esa
 * se oculta, porque quedaba a más de nueve pantallas de scroll.
 */
export function PedidoWhatsapp({ business }: { business: BusinessConfig }) {
  return (
    <section className="wsp-strip" aria-label="Pedir por WhatsApp">
      <div className="container">
        <div className="wsp-strip-card">
          <b>Pedí por WhatsApp si preferís</b>
          <a
            className="btn btn-cream"
            href={enlaceWhatsapp(business.whatsappPhone, MENSAJE_PEDIDO_WHATSAPP)}
            target="_blank"
            rel="noreferrer"
          >
            Abrir WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
