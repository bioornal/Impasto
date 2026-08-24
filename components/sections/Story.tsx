"use client";
import { SceneIllus } from "@/components/ui/Illus";
import { STOCK_IMAGES } from "@/lib/stock-images";
import { argumento } from "@/lib/marca";

// Los tres argumentos de proceso, en el orden en que se muestran acá. El
// resto de ARGUMENTOS_MARCA (porciones, muzzarella, empanadas) no va en esta
// sección: cada componente pide solo lo que necesita.
//
// El lede de arriba (el <p> antes de .story-stats) cita dos de estos tres
// mismos argumentos con las variables de abajo, para no repetir a mano lo
// que este array ya centraliza. "48 horas" queda hardcodeado a propósito:
// `FERMENTACION.cifra` es "48 hs", no "48 horas", así que insertarlo
// deformaría la prosa del dueño. Si mañana cambia la fermentación, ese
// número puntual va a quedar desincronizado del stat de abajo — es el costo
// aceptado de no reescribir el copy en esta pasada.
const FERMENTACION = argumento("fermentacion");
const ESTIRADO = argumento("estirado");
const HORNO = argumento("horno");
const STATS = [FERMENTACION, ESTIRADO, HORNO];

export function Story() {
  return (
    <section className="story" id="nosotros">
      <div className="container story-grid">
        <div className="story-media"><SceneIllus id="story" tone="dark" src={STOCK_IMAGES.story.dough} /></div>
        <div>
          <div className="sec-index gold">04 — Nosotros</div>
          <h2>Impasto significa masa.<br />Y acá todo empieza ahí.</h2>
          <p>
            En italiano, <em>impasto</em> significa &ldquo;masa&rdquo;: el origen y corazón de toda buena pizza. Le pusimos así a nuestro proyecto en Puerto Iguazú porque creemos en el tiempo y el oficio: 48 horas de fermentación en frío, {ESTIRADO.titulo.toLowerCase()} en el momento y fuego de piedra a {HORNO.cifra}.
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
