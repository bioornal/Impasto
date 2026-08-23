"use client";
import { SceneIllus } from "@/components/ui/Illus";
import { STOCK_IMAGES } from "@/lib/stock-images";

const STATS: [string, string][] = [
  ["Fermentación en frío", "48 hs con harina de fuerza"],
  ["Estirado a mano", "En el momento, sin moldes"],
  ["Horno a la piedra", "400 °C en 2 a 5 minutos"],
];

export function Story() {
  return (
    <section className="story" id="nosotros">
      <div className="container story-grid">
        <div className="story-media"><SceneIllus id="story" tone="dark" src={STOCK_IMAGES.story.dough} /></div>
        <div>
          <div className="sec-index gold">04 — Nosotros</div>
          <h2>Impasto significa masa.<br />Y acá todo empieza ahí.</h2>
          <p>
            En italiano, <em>impasto</em> significa &ldquo;masa&rdquo;: el origen y corazón de toda buena pizza. Le pusimos así a nuestro proyecto en Puerto Iguazú porque creemos en el tiempo y el oficio: 48 horas de fermentación en frío, estirado a mano en el momento y fuego de piedra a 400 °C.
          </p>
          <p style={{ marginTop: 14 }}>
            Una pizzería artesanal pensada para quienes buscan una experiencia auténtica y memorable: borde aireado, base crocante y abundante muzzarella, perfecta para coronar un día de Cataratas o una gran noche en casa.
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
