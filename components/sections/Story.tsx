"use client";
import { SceneIllus } from "@/components/ui/Illus";
import { STOCK_IMAGES } from "@/lib/stock-images";
import { argumento, argumentoConCifra } from "@/lib/marca";

// Las tres cifras grandes de abajo, en el orden del proceso: masa, estirado,
// horno. Salen de ARGUMENTOS_MARCA para que el bot y el sitio digan lo mismo;
// el resto (porciones, muzzarella, empanadas) no va en esta sección.
//
// "Estirado a mano" no tiene `cifra` (no hay número que mostrar), así que su
// cifra grande es "A mano" y el texto de abajo es su detalle: con el titular
// quedaría "A mano / Estirado a mano", la misma idea dos veces.
const FERMENTACION = argumentoConCifra("fermentacion");
const ESTIRADO = argumento("estirado");
const HORNO = argumentoConCifra("horno");
// A este tamaño el espacio común de "400 °C" separa demasiado el grado: se
// cambia por el espacio fino que no corta (U+202F). Solo antes del grado: en
// "48 hs" el espacio fino de Playfair casi no se ve y pega el número a la unidad.
const fino = (s: string) => s.replace(/ °/g, "\u202F°");
const CIFRAS = [
  { id: FERMENTACION.id, grande: fino(FERMENTACION.cifra), texto: FERMENTACION.titulo },
  { id: ESTIRADO.id, grande: "A mano", texto: ESTIRADO.detalle },
  { id: HORNO.id, grande: fino(HORNO.cifra), texto: HORNO.titulo },
];

export function Story({ onCta }: { onCta: (section: string) => void }) {
  return (
    <section className="story" id="nosotros">
      <div className="story-bg" aria-hidden>
        <SceneIllus id="story" tone="dark" src={STOCK_IMAGES.story.dough} />
      </div>
      <div className="container story-inner">
        <div className="story-copy">
          <div className="sec-index gold">04 — Nosotros</div>
          <h2>Impasto<br />significa <em>masa.</em></h2>
          <p className="story-sub">Y acá todo empieza ahí.</p>
          <p className="story-lede">
            En italiano, <em>impasto</em> es la masa: el corazón de toda buena pizza. Le pusimos así a nuestro proyecto en Puerto Iguazú porque creemos en el tiempo, el oficio y los ingredientes de primera. Borde alto y aireado, base fina y tierna, y muzzarella abundante: la pizza para cerrar un día de Cataratas o una gran noche en casa.
          </p>
        </div>
        <div className="story-cifras">
          {CIFRAS.map((c) => (
            <div key={c.id}>
              <b>{c.grande}</b>
              <span>{c.texto}</span>
            </div>
          ))}
          <button className="btn btn-primary btn-lg story-cta" onClick={() => onCta("pizzas")}>
            Ver la carta →
          </button>
        </div>
      </div>
    </section>
  );
}
