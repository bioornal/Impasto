import type { BusinessConfig } from "@/lib/business";

export function Footer({ business }: { business: BusinessConfig }) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="logo" style={{ color: "var(--bg)", marginBottom: 14 }}>
              <div className="logo-mark">I</div>
              <div>Impasto<small style={{ color: "var(--gold)" }}>pizza híbrida · iguazú</small></div>
            </div>
            <p style={{ fontSize: 13, opacity: 0.7, maxWidth: "34ch" }}>
              Pizza híbrida argentina con fermentación lenta de 48 horas, base crocante y mozzarella abundante. Elaboradas cada día en Puerto Iguazú.
            </p>
          </div>
          <div>
            <h5>Horarios</h5>
            <ul><li>{business.hours}</li></ul>
          </div>
          <div>
            <h5>Contacto</h5>
            <ul><li>{business.address}</li><li>{business.locationLabel}</li><li>{business.phone}</li><li>{business.email}</li></ul>
          </div>
          <div>
            <h5>Social</h5>
            <ul><li>Instagram · {business.instagram}</li><li>Facebook · {business.facebook}</li><li>WhatsApp</li></ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© 2026 Impasto · {business.locationLabel}</div>
          <div>Diseño con ♥ · Delivery tercerizado</div>
        </div>
      </div>
    </footer>
  );
}
