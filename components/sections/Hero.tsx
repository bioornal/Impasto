"use client";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { fmt } from "@/lib/utils";
import type { Pizza } from "@/types";

interface HeroProps {
  onCta: (section: string) => void;
  onHalf: () => void;
  featured?: Pizza;
  varieties: number;
}

export function Hero({ onCta, onHalf, featured, varieties }: HeroProps) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <div className="hero-eyebrow">Pizzería artesanal · desde 2018</div>
          <h1>
            La masa que<br />tarda <em>48 horas</em><br />en estar lista.
          </h1>
          <p className="hero-lede">
            Pizza híbrida: borde aireado de napoletana, base crocante y queso al gusto argentino.
            Amasada cada día en Puerto Iguazú.
          </p>
          <div className="hero-ctas">
            <button className="btn btn-primary btn-lg" onClick={() => onCta("pizzas")}>
              Armar mi pedido
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onHalf}>Pizza mitad y mitad</button>
          </div>
          <div className="hero-stats">
            <div>
              <b>4,9<span> ★</span></b>
              <small>+1.200 reseñas</small>
            </div>
            <div>
              <b>30 min</b>
              <small>delivery promedio</small>
            </div>
            <div>
              <b>{varieties || 20}</b>
              <small>variedades</small>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-frame" />
          <div className="hero-media">
            <PizzaIllus id={featured?.id || "p08"} />
          </div>
          {featured && (
            <div className="hero-chip">
              <div className="hero-chip-media"><PizzaIllus id={featured.id} /></div>
              <div>
                <b>{featured.nombre}</b>
                <small>La más pedida · {fmt(featured.precio)}</small>
              </div>
            </div>
          )}
          <div className="hero-stamp">
            <div>
              <b>2×1</b>
              <small>mar · mié</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES: [string, string][] = [
  ["Fermentación 48 hs", "Masa liviana, borde aireado"],
  ["Horno a 400°", "Cocción en 4 minutos"],
  ["Envío gratis", "En Puerto Iguazú centro"],
  ["Seguimiento real", "Estado del pedido por WhatsApp"],
];

export function Features({ freeShippingFrom }: { freeShippingFrom: number }) {
  return (
    <section className="features">
      <div className="container features-grid">
        {FEATURES.map(([title, sub], index) => (
          <div className="feature" key={title}>
            <b>{index === 2 ? `${title} ${fmt(freeShippingFrom)}` : title}</b>
            <small>{sub}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
