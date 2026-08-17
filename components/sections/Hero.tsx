"use client";
import { useTweaks } from "@/components/providers/TweakProvider";

export function Hero({ onCta }: { onCta: (n: string) => void }) {
  const { tweaks } = useTweaks();
  void tweaks;
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <div className="eyebrow">Pizza híbrida · desde 2018</div>
          <h1>Pizza <em>híbrida</em>, al gusto argentino.</h1>
          <p className="hero-lede">Inspirada en la napoletana pero más crocante, con fermentación lenta de 48 horas y mozzarella abundante. Hecha en Puerto Iguazú para vos.</p>
          <div className="hero-ctas">
            <button className="btn btn-primary btn-lg" onClick={() => onCta("pizzas")}>Pedir ahora</button>
            <button className="btn btn-ghost btn-lg" onClick={() => onCta("empanadas")}>Ver empanadas</button>
          </div>
          <div className="hero-meta">
            <div><strong>20+</strong>variedades de pizza</div>
            <div><strong>48 h</strong>fermentación lenta</div>
            <div><strong>30 min</strong>delivery promedio</div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden>
          <div className="plate" />
          <div className="stamp"><div><b>48h</b><span>fermentación</span></div></div>
          <div className="hero-badge">
            <div>
              <div className="hero-badge-stars">★★★★★</div>
              <b>4.9 / 5</b>
              <small>+1.200 reseñas</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
