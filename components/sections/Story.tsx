"use client";
import { SceneIllus } from "@/components/ui/Illus";
import { STOCK_IMAGES } from "@/lib/stock-images";
import { argumento } from "@/lib/marca";

// Los tres argumentos de proceso, en el orden en que se muestran acá. El
// resto de ARGUMENTOS_MARCA (porciones, muzzarella, empanadas) no va en esta
// sección: cada componente pide solo lo que necesita.
const STATS = [argumento("fermentacion"), argumento("estirado"), argumento("horno")];

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
            {STATS.map((stat) => (
              <div key={stat.id}>
                <b>{stat.titulo}</b>
                <small>{stat.detalle}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
