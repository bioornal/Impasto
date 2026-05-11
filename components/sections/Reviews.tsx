import type { Review } from "@/types";

export function Reviews({ reviews }: { reviews: Review[] }) {
  return (
    <section className="reviews">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Opiniones</div>
            <h2>Lo que dicen nuestros clientes</h2>
          </div>
        </div>
        <div className="reviews-grid">
          {reviews.map((r, i) => (
            <div className="review-card" key={i}>
              <div className="stars">{"★".repeat(r.rating)}</div>
              <p>&ldquo;{r.texto}&rdquo;</p>
              <div className="who">{r.nombre}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
