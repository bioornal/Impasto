import Image from "next/image";
import { LOGO_BLANCO } from "@/lib/logo";
import type { BusinessConfig } from "@/lib/business";

export function Footer({ business }: { business: BusinessConfig }) {
  const [days, hours] = business.hours.split("·").map((part) => part.trim());

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
            <ul className="footer-list">
              <li>{days || business.hours}</li>
              {hours && <li>{hours}</li>}
              <li>Lunes cerrado</li>
            </ul>
          </div>

          <div>
            <h5>Contacto</h5>
            <ul className="footer-list">
              <li>{business.address}</li>
              <li>{business.locationLabel}</li>
              <li>{business.phone}</li>
              <li>{business.email}</li>
            </ul>
          </div>

          <div>
            <h5>Seguinos</h5>
            <ul className="footer-list">
              <li>{business.instagram}</li>
              <li>{business.facebook}</li>
              <li>
                <a href={`https://wa.me/${business.whatsappPhone}`} target="_blank" rel="noreferrer">WhatsApp</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {business.name} · {business.city}</span>
          <span>Delivery propio & Take away · Pagos con Mercado Pago</span>
          <span>
            <a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a> · <a href="/reembolso">Reembolsos</a> · <a href="/admin-login" aria-label="Acceso administrativo" style={{ opacity: .55 }}>Acceso</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
