import type { Promo } from "@/types";

const msg = ["Envío en 30 min aprox.", "Fermentación 48 hs", "Masa híbrida crocante", "Mozzarella abundante", "Martes y Miércoles 2x1"];

export function PromoBand() {
  return (
    <div className="promo-band">
      <div className="promo-band-track">
        <span>{msg.join("  ·  ")}</span>
        <span>{msg.join("  ·  ")}</span>
      </div>
    </div>
  );
}

export function PromoCards({ promos }: { promos: Promo[] }) {
  return (
    <section className="promos">
      <div className="container">
        <div className="promos-grid">
          {promos.map((p) => (
            <div className="promo-card" key={p.id}>
              <span className="badge">{p.badge}</span>
              <h4>{p.titulo}</h4>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
