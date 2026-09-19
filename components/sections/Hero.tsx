"use client";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { STOCK_IMAGES } from "@/lib/stock-images";
import { fmt } from "@/lib/utils";
import { argumento } from "@/lib/marca";
import type { Pizza } from "@/types";

// Los tres argumentos que se muestran como cifra + etiqueta. "Estirado a
// mano" no tiene cifra (no hay un número que mostrar) y por eso no está acá.
const HERO_STATS = [argumento("fermentacion"), argumento("horno"), argumento("empanadas-peso")];
const PORCIONES = argumento("porciones");
const INGREDIENTES = argumento("ingredientes");

interface HeroProps {
  onCta: (section: string) => void;
  onHalf: () => void;
  featured?: Pizza;
  varieties: number;
  /** Precio más bajo de la carta (`precioDesde`); null si no hay pizzas disponibles. */
  desde: number | null;
}

export function Hero({ onCta, onHalf, featured, varieties: _varieties, desde }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true">
        <img
          src={STOCK_IMAGES.hero.main}
          alt=""
          className="hero-bg-img"
        />
        <div className="hero-bg-overlay" />
      </div>

      <div className="container hero-grid">
        <div className="hero-content">
          <div className="hero-eyebrow">Pizzería artesanal · Delivery & Take away</div>
          <h1>
            Pizza híbrida:<br />técnica napoletana,<br /><em>alma argentina.</em>
          </h1>
          <p className="hero-lede">
            Hacemos una pizza que no existe en otro lado: borde alto y liviano y base fina y tierna al estilo napoletano, ingredientes de primera y muzzarella abundante como nos gusta acá.{desde !== null && <> {PORCIONES.titulo} desde <b>{fmt(desde)}</b>.</>} Pedí online y recibila en tu casa, o pasá a retirar por el local.
          </p>
          <div className="hero-ctas">
            <button className="btn btn-primary btn-lg" onClick={() => onCta("pizzas")}>
              Armar mi pedido
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onHalf}>Pizza mitad y mitad</button>
          </div>
          <div className="hero-stats">
            {HERO_STATS.map((stat) => (
              <div key={stat.id}>
                <b>{stat.cifra}</b>
                <small>{stat.titulo}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          {featured && (
            <div className="hero-chip">
              <div className="hero-chip-media">
                <PizzaIllus id={featured.id} name={featured.nombre} tags={featured.tags} />
              </div>
              <div>
                <b>{featured.nombre}</b>
                <small>{featured.popular ? "La más pedida" : "La de la foto"} · {fmt(featured.precio)}</small>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function Features({ freeShippingFrom: _freeShippingFrom, desde }: { freeShippingFrom?: number; desde: number | null }) {
  const features: [string, string][] = [
    // La tarjeta de la pizza híbrida repetía el título del hero, que está justo
    // arriba: su lugar lo ocupa el precio. Solo vuelve si no hay "desde".
    desde !== null
      ? [`Pizzas desde ${fmt(desde)}`, `${PORCIONES.titulo}, mitad y mitad sin recargo`]
      : ["Pizza Híbrida", "Técnica napoletana y alma argentina"],
    ["Delivery propio", "Envíos en Puerto Iguazú"],
    ["Take away", "Retiro en el local sin esperas"],
    [INGREDIENTES.titulo, INGREDIENTES.detalle],
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
