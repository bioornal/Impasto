"use client";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import { masasVisibles, masaUnica, nombreMasa } from "@/lib/masa";

interface MasasAvisoProps {
  onNav: (section: string) => void;
}

/**
 * Aviso de la masa al molde (desde el 17/10/2026). La napoletana sigue siendo
 * la de la casa: va primero y marcada así. La masa se elige en el carrito, por pizza.
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
          <div className="masas-intro">
            <span className="promo-badge">{queda ? "Hoy" : "Nuevo"}</span>
            <h2 id="masas-titulo">{queda ? `Hoy, solo masa ${nombreMasa(queda)}` : "¿Preferís la masa tradicional al molde?"}</h2>
            <p>
              {queda ? masas.aviso : "Ya la tenemos, al mismo precio. En el carrito elegís el tipo de masa para cada pizza."}
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => onNav("pizzas")}>Ver pizzas</button>
          </div>
          <div className="masas-opciones">
            <article className={`masa ${masas.napoletana ? "" : "agotada"}`}>
              <span className="masa-kicker">{masas.napoletana ? "La de la casa" : "Hoy agotada"}</span>
              <h3>Napoletana</h3>
              <p>Estirada a mano y a la piedra, con el cornicione bien inflado: borde alto y liviano, base fina y tierna.</p>
            </article>
            <article className={`masa ${masas.molde ? "" : "agotada"}`}>
              <span className="masa-kicker">{masas.molde ? "Bien argentina" : "Hoy agotada"}</span>
              <h3>Al molde</h3>
              <p>La pizza de molde de toda la vida: más alta y esponjosa, con el borde dorado.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
