"use client";
import { SceneIllus } from "@/components/ui/Illus";
import type { Promo } from "@/types";

interface PromosProps {
  promos: Promo[];
  onNav: (section: string) => void;
}

export function Promos({ promos, onNav }: PromosProps) {
  if (promos.length === 0) return null;
  const [hero, ...rest] = promos.slice(0, 3);
  const stack = rest.slice(0, 2);

  return (
    <section className="promos">
      <div className="container">
        <div className={`promos-grid ${stack.length === 0 ? "single" : ""}`}>
          <article className="promo-hero">
            <div className="promo-hero-media"><SceneIllus id={hero.id} tone="ember" /></div>
            <div className="promo-hero-body">
              <span className="promo-badge">{hero.badge}</span>
              <h3>{hero.titulo}</h3>
              <p>{hero.desc}</p>
              <button className="btn btn-cream btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => onNav("pizzas")}>
                Ver la carta
              </button>
            </div>
          </article>

          {stack.length > 0 && (
            <div className="promo-stack">
              {stack.map((promo, index) => {
                const dark = index === 1;
                const target = dark ? "empanadas" : "pizzas";
                return (
                  <article className={`promo-card ${dark ? "dark" : ""}`} key={promo.id}>
                    <div>
                      <span className="promo-kicker">{promo.badge}</span>
                      <h4>{promo.titulo}</h4>
                      <p>{promo.desc}</p>
                    </div>
                    <div className="promo-foot">
                      <button
                        className={`btn btn-sm ${dark ? "btn-ghost" : "btn-dark"}`}
                        onClick={() => onNav(target)}
                      >
                        {dark ? "Armar caja" : "Ver pizzas"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
