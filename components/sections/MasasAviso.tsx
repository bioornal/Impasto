"use client";

interface MasasAvisoProps {
  onNav: (section: string) => void;
}

/**
 * Aviso de la masa al molde (desde el 17/10/2026). La napoletana sigue siendo
 * la de la casa: va primero y marcada así. La masa se elige en el carrito, por pizza.
 */
export function MasasAviso({ onNav }: MasasAvisoProps) {
  return (
    <section className="masas" aria-labelledby="masas-titulo">
      <div className="container">
        <div className="masas-card">
          <div className="masas-intro">
            <span className="promo-badge">Nuevo</span>
            <h2 id="masas-titulo">Ahora también, al molde</h2>
            <p>
              Dos masas bien distintas, al mismo precio. La elegís en el carrito, pizza por pizza.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => onNav("pizzas")}>Ver pizzas</button>
          </div>
          <div className="masas-opciones">
            <article className="masa">
              <span className="masa-kicker">La de la casa</span>
              <h3>Napoletana</h3>
              <p>Estirada a mano y a la piedra, con el cornicione bien inflado: borde alto y liviano, base fina y tierna.</p>
            </article>
            <article className="masa">
              <span className="masa-kicker">Bien argentina</span>
              <h3>Al molde</h3>
              <p>La pizza de molde de toda la vida: más alta y esponjosa, con el borde dorado.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
