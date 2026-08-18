"use client";
import { SceneIllus } from "@/components/ui/Illus";

const STATS: [string, string][] = [
  ["Masa madre", "Viva desde 2018"],
  ["Fiordilatte", "De tambo local"],
  ["Horno a piedra", "400° constantes"],
];

export function Story() {
  return (
    <section className="story" id="nosotros">
      <div className="container story-grid">
        <div className="story-media"><SceneIllus id="story" tone="dark" /></div>
        <div>
          <div className="sec-index gold">04 — Nuestra masa</div>
          <h2>Tres días de trabajo<br />para cuatro minutos<br />de horno.</h2>
          <p>
            Fermentamos en frío durante 48 horas con masa madre y harina de fuerza. El resultado es un borde
            alveolado, liviano, que no cae — y una base que se sostiene aunque le pongamos queso de más.
            Que siempre le ponemos.
          </p>
          <div className="story-stats">
            {STATS.map(([title, sub]) => (
              <div key={title}>
                <b>{title}</b>
                <small>{sub}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
