import type { Review } from "@/types";
import type { BusinessConfig } from "@/lib/business";

export function Reviews({ reviews, business }: { reviews: Review[]; business: BusinessConfig }) {
  if (reviews.length === 0) return null;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section className="reviews">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="sec-index">05 — Opiniones</div>
            <h2>Lo que dicen los que ya probaron</h2>
          </div>
          <div className="side-note">Opiniones de<br />clientes de Impasto</div>
        </div>

        <div className="reviews-grid">
          {reviews.slice(0, 3).map((review, index) => (
            <article className="review-card" key={`${review.nombre}-${index}`}>
              <div className="review-stars">{"★".repeat(Math.max(1, Math.min(5, review.rating)))}</div>
              <p>&ldquo;{review.texto}&rdquo;</p>
              <div className="review-who">
                <div className="review-avatar">{review.nombre.trim().charAt(0).toUpperCase()}</div>
                <div>
                  <b>{review.nombre}</b>
                  <small>Cliente de Impasto</small>
                </div>
              </div>
            </article>
          ))}

          <article className="wsp-card">
            <div>
              <b>Pedí por WhatsApp si preferís</b>
              <small>Te confirmamos el pedido y te avisamos cuando sale del horno.</small>
            </div>
            <a
              className="btn btn-cream"
              href={`https://wa.me/${business.whatsappPhone}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir WhatsApp
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
