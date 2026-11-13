"use client";
import { useId, useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { bebidasParaRegalo } from "@/lib/promos-web";
import { fmt } from "@/lib/utils";

const Check = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/**
 * La promo del carrito, en una línea: la mejor ya viene aplicada; "Cambiar" muestra las otras.
 * Si es un regalo, la bebida se elige con un toque. Comparte la elección con el checkout y el borrador.
 */
export function TuPromo() {
  const id = useId();
  const { items, catalogo, ofertas, promoOpciones, promo, promoAplicada, promoError, setPromo } = useCart();
  const [cambiando, setCambiando] = useState(false);

  const pizzas = items.filter(i => i.type === "pizza" || i.type === "pizza-half").reduce((s, i) => s + i.qty, 0);
  const regaloCerca = ofertas.find(o => o.tipo === "regalo" && pizzas > 0 && pizzas < o.config.minimoPizzas);
  if (!promoOpciones.length && !promo) {
    if (!regaloCerca || regaloCerca.tipo !== "regalo") return null;
    const faltan = regaloCerca.config.minimoPizzas - pizzas;
    return <p className="tu-promo-pista">Sumá {faltan} pizza{faltan > 1 ? "s" : ""} más y te regalamos una bebida.</p>;
  }

  const seleccionada = promoOpciones.find(p => p.oferta.id === promo?.ofertaId)?.oferta;
  const bebidas = seleccionada?.tipo === "regalo"
    ? bebidasParaRegalo(catalogo, items, seleccionada.config.cantidad).filter(b => seleccionada.config.opciones.some(op => op.producto === b.id))
    : [];
  const elegir = (ofertaId: string | null) => {
    const o = promoOpciones.find(x => x.oferta.id === ofertaId);
    setPromo(o ? { ofertaId: o.oferta.id, ...(o.resultado.regalo ? { regaloProductoId: o.resultado.regalo.bebida.id } : {}) } : null);
    setCambiando(false);
  };

  return (
    <section className="tu-promo" aria-labelledby={`${id}-t`}>
      <div className={`tu-promo-aplicada ${promoAplicada ? "on" : ""}`}>
        {promoAplicada ? <span className="tu-promo-icono"><Check /></span> : null}
        <div className="tu-promo-texto">
          <b id={`${id}-t`}>{promoAplicada ? promoAplicada.nombre : "Sin promo"}</b>
          <small>{promoAplicada ? `Ahorrás ${fmt(promoAplicada.ahorro)}` : `Tenés ${promoOpciones.length === 1 ? "una promo disponible" : `${promoOpciones.length} promos disponibles`}`}</small>
        </div>
        {(promoOpciones.length > 1 || !promoAplicada) && (
          <button type="button" className="tu-promo-cambiar" aria-expanded={cambiando} onClick={() => setCambiando(v => !v)}>
            {cambiando ? "Listo" : promoAplicada ? "Cambiar" : "Ver"}
          </button>
        )}
      </div>

      {seleccionada?.tipo === "regalo" && bebidas.length > 0 && !cambiando && (
        <div className="tu-promo-bebidas" role="group" aria-label="Elegí tu bebida de regalo">
          <span>Elegí tu bebida</span>
          <div>
            {bebidas.map(b => (
              <button type="button" key={b.id} aria-pressed={promo?.regaloProductoId === b.id}
                onClick={() => setPromo({ ofertaId: seleccionada.id, regaloProductoId: b.id })}>
                {b.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {cambiando && (
        <div className="tu-promo-lista" role="radiogroup" aria-label="Elegí tu promo">
          {promoOpciones.map(({ oferta, resultado }) => (
            <button type="button" role="radio" aria-checked={promo?.ofertaId === oferta.id} key={oferta.id} onClick={() => elegir(oferta.id)}>
              <span>{oferta.titulo || oferta.nombre}</span><small>Ahorrás {fmt(resultado.ahorro)}</small>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={!promo} onClick={() => elegir(null)}><span>Sin promo</span></button>
          <p>Una promo por pedido.</p>
        </div>
      )}

      {promoError && <p className="tu-promo-error" role="alert">{promoError}</p>}
    </section>
  );
}
