import { preguntasFrecuentes } from "@/lib/faq";
import type { BusinessConfig } from "@/lib/business";

/**
 * Las preguntas frecuentes que ya viven en `lib/faq.ts`. Se renderizan como
 * `<details>` nativos: el contenido queda en el HTML aunque el panel esté
 * cerrado, que es lo que el rastreador necesita, y el usuario no carga JS para
 * abrir una respuesta.
 */
export function Faq({ business }: { business: BusinessConfig }) {
  const preguntas = preguntasFrecuentes(business);

  return (
    <section className="faq" id="preguntas">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="sec-index">06 — Preguntas</div>
            <h2>Lo que más nos preguntan</h2>
          </div>
          <div className="side-note">Delivery y take away<br />en {business.locationLabel}</div>
        </div>

        <div className="faq-list">
          {preguntas.map((item) => (
            <details className="faq-item" key={item.pregunta}>
              <summary>
                <h3>{item.pregunta}</h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <p>{item.respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
