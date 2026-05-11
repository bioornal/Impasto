export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="logo" style={{ color: "var(--bg)", marginBottom: 14 }}>
              <div className="logo-mark">I</div>
              <div>Impasto<small style={{ color: "var(--gold)" }}>pizza híbrida · neuquén</small></div>
            </div>
            <p style={{ fontSize: 13, opacity: 0.7, maxWidth: "34ch" }}>
              Pizza híbrida argentina con fermentación lenta de 48 horas, base crocante y mozzarella abundante. Elaboradas cada día en Neuquén Capital.
            </p>
          </div>
          <div>
            <h5>Horarios</h5>
            <ul><li>Martes a Domingo</li><li>19:30 — 00:00</li><li>Lunes cerrado</li></ul>
          </div>
          <div>
            <h5>Contacto</h5>
            <ul><li>Av. Argentina 875</li><li>Neuquén Capital</li><li>(0299) 555-0184</li><li>hola@impasto.com.ar</li></ul>
          </div>
          <div>
            <h5>Social</h5>
            <ul><li>Instagram · @impasto.nqn</li><li>Facebook · Impasto Neuquén</li><li>WhatsApp</li></ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© 2026 Impasto · Neuquén Capital</div>
          <div>Diseño con ♥ · Delivery tercerizado</div>
        </div>
      </div>
    </footer>
  );
}
