import Image from "next/image";
import { LOGO_BLANCO } from "@/lib/logo";
import { diasCerrados } from "@/lib/hours";
import { enlaceInstagram, enlaceTelefono, enlaceWhatsapp, MENSAJE_PEDIDO_WHATSAPP } from "@/lib/contacto";
import type { BusinessConfig } from "@/lib/business";

export function Footer({ business }: { business: BusinessConfig }) {
  const [days, hours] = business.hours.split("·").map((part) => part.trim());
  // Sale de los días de apertura del panel: antes decía "Lunes cerrado" fijo.
  const cerrado = diasCerrados(business.diasApertura);
  const telefono = enlaceTelefono(business.phone);
  const instagram = enlaceInstagram(business.instagram);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <Image
              src={LOGO_BLANCO.src}
              alt={business.name}
              width={LOGO_BLANCO.ancho}
              height={LOGO_BLANCO.alto}
              className="footer-logo"
            />
            <p>
              Pizza híbrida: técnica napoletana y alma argentina. Delivery y Take away en {business.locationLabel}.
            </p>
          </div>

          <div>
            <h5>Horarios</h5>
            <ul className="footer-list footer-horarios">
              <li>{days || business.hours}</li>
              {hours && <li>{hours}</li>}
              {cerrado && <li className="footer-cerrado">{cerrado}</li>}
            </ul>
          </div>

          <div>
            <h5>Contacto</h5>
            <ul className="footer-list">
              <li>{business.address}</li>
              <li>{business.locationLabel}</li>
              <li>{telefono ? <a href={telefono}>{business.phone}</a> : business.phone}</li>
              <li><a href={`mailto:${business.email}`}>{business.email}</a></li>
            </ul>
          </div>

          <div>
            <h5>Seguinos</h5>
            <ul className="footer-list footer-redes">
              <li>{instagram ? <a href={instagram} target="_blank" rel="noreferrer">{business.instagram}</a> : business.instagram}</li>
              {/* `facebook` guarda el nombre visible, no la URL de la página: no alcanza para enlazarla. */}
              <li>{business.facebook}</li>
              <li>
                <a href={enlaceWhatsapp(business.whatsappPhone, MENSAJE_PEDIDO_WHATSAPP)} target="_blank" rel="noreferrer">WhatsApp</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {business.name} · {business.city}</span>
          <span className="footer-bottom-extra">Delivery propio & Take away · Pagos con Mercado Pago</span>
          <span>
            <a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a> · <a href="/reembolso">Reembolsos</a> · <a href="/admin-login" aria-label="Acceso administrativo" style={{ opacity: .55 }}>Acceso</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
