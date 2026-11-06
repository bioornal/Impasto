"use client";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import { masasVisibles, masaUnica, nombreMasa } from "@/lib/masa";
import { MASA_MOLDE } from "@/lib/marca";
import { STOCK_IMAGES } from "@/lib/stock-images";

interface MasasAvisoProps {
  onNav: (section: string) => void;
}

/**
 * Bloque de la masa al molde (desde el 17/10/2026; con foto y el proceso real
 * desde el 06/11/2026). La napoletana sigue siendo la de la casa y viene marcada
 * en el carrito, donde se elige la masa pizza por pizza.
 */
export function MasasAviso({ onNav }: MasasAvisoProps) {
  // Si el dueño marcó una masa como agotada, el bloque deja de anunciarla y lo dice.
  const { masas } = useStoreStatus();
  const queda = masaUnica(masas);
  // Con el molde apagado el bloque entero desaparece: el cliente no tiene que saber que existe.
  if (!masasVisibles(masas)) return null;
  return (
    <section className="masas" aria-labelledby="masas-titulo">
      <div className="container">
        <div className="masas-card">
          <figure className="masas-foto">
            <img
              src={STOCK_IMAGES.molde.grande}
              srcSet={`${STOCK_IMAGES.molde.chica} 480w, ${STOCK_IMAGES.molde.grande} 1200w`}
              sizes="(max-width: 760px) 140px, (max-width: 980px) 100vw, 560px"
              width={1200}
              height={800}
              alt="Prepizzas al molde con salsa de tomate, altas y con el borde dorado"
              loading="lazy"
              decoding="async"
            />
            <span className="masas-sello" aria-hidden="true">Mismo<br />precio</span>
            <figcaption>Al molde · bien argentina</figcaption>
          </figure>

          <div className="masas-cuerpo">
            <span className="promo-badge">{queda ? "Hoy" : "Nuevo"}</span>
            <h2 id="masas-titulo">{queda ? `Hoy, solo masa ${nombreMasa(queda)}` : "¿Preferís la masa tradicional al molde?"}</h2>
            <p className="masas-lede">
              {queda ? masas.aviso : "Ya la tenemos, al mismo precio. En el carrito elegís el tipo de masa para cada pizza."}
            </p>

            <ol className="masas-pasos" aria-label="Cómo hacemos la masa al molde">
              {MASA_MOLDE.pasos.map((paso, i) => (
                <li key={paso.titulo}>
                  <span className="masas-paso-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <b>{paso.titulo}</b>
                  <span>{paso.detalle}</span>
                </li>
              ))}
            </ol>

            <div className="masas-pie">
              <button className="btn btn-primary btn-sm" onClick={() => onNav("pizzas")}>Ver pizzas</button>
              {!queda && (
                <p className="masas-nota">La napoletana sigue siendo la de la casa: viene marcada y la cambiás en el carrito.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
