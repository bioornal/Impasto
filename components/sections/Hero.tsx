"use client";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { STOCK_IMAGES } from "@/lib/stock-images";
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
          <div className="hero-eyebrow">Pizzería artesanal · Delivery & Take away</div>
          <h1>
            Pizza híbrida:<br />técnica napolitana,<br /><em>alma argentina.</em>
          </h1>
          <p className="hero-lede">
            Hacemos una pizza que no existe en otro lado: borde alto y liviano al estilo napolitano, base crocante y muzzarella abundante como nos gusta acá. Pedí online y recibila en tu casa, o pasá a retirar por el local.
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
              <b>48 hs</b>
              <small>Fermentación en frío</small>
            </div>
            <div>
              <b>400 °C</b>
              <small>Horno a la piedra</small>
            </div>
            <div>
              <b>160 g</b>
              <small>Empanadas al horno</small>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-frame" />
          <div className="hero-media">
            <PizzaIllus
              id={featured?.id || "hero-main"}
              name={featured?.nombre}
              tags={featured?.tags}
              src={STOCK_IMAGES.hero.main}
            />
          </div>
          {featured && (
            <div className="hero-chip">
              <div className="hero-chip-media">
                <PizzaIllus id={featured.id} name={featured.nombre} tags={featured.tags} />
              </div>
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

export function Features({ freeShippingFrom }: { freeShippingFrom?: number }) {
  const features: [string, string][] = [
    ["Pizza Híbrida", "Técnica napolitana y alma argentina"],
    ["Delivery propio", "Envíos en Puerto Iguazú"],
    ["Take away", "Retiro en el local sin esperas"],
    ["Materia prima premium", "Muzzarella y primeras marcas"],
  ];

  return (
    <section className="features">
      <div className="container features-grid">
        {features.map(([title, sub]) => (
          <div className="feature" key={title}>
            <b>{title}</b>
            <small>{sub}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
