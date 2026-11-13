"use client";
import { useCart } from "@/components/providers/CartProvider";
import { promosAplicables } from "@/lib/promos-aplicar";
import { lineasPromo } from "@/lib/promos-web";
import { fmt } from "@/lib/utils";

const Check = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/**
 * La promo del carrito se aplica sola según lo que armó el cliente: acá solo se confirma y, si le falta
 * poco para una, se le dice qué sumar. El cliente no elige nada.
 */
export function TuPromo({ onBebidas }: { onBebidas?: () => void }) {
  const { items, ofertas, promoAplicada, promoError } = useCart();

  if (promoAplicada) {
    return (
      <section className="tu-promo" aria-live="polite">
        <div className="tu-promo-aplicada on">
          <span className="tu-promo-icono"><Check /></span>
          <div className="tu-promo-texto">
            <b>{promoAplicada.nombre}</b>
            <small>Ya aplicada · ahorrás {fmt(promoAplicada.ahorro)}</small>
          </div>
        </div>
        {promoError && <p className="tu-promo-error" role="alert">{promoError}</p>}
      </section>
    );
  }

  // Sin promo todavía: el aviso más útil para llegar a una (por ahora, el regalo de bebida).
  const pizzas = items.filter(i => i.type === "pizza" || i.type === "pizza-half").reduce((s, i) => s + i.qty, 0);
  const regalo = ofertas.find(o => o.tipo === "regalo");
  if (!regalo || regalo.tipo !== "regalo" || pizzas === 0 || promosAplicables(ofertas, lineasPromo(items), [], new Date()).length) return null;
  const faltan = regalo.config.minimoPizzas - pizzas;
  return (
    <div className="tu-promo-pista" aria-live="polite">
      {faltan > 0
        ? <span>Sumá {faltan} pizza{faltan > 1 ? "s" : ""} más y una bebida: <b>la bebida te la regalamos</b>.</span>
        : <span>Ya tenés {regalo.config.minimoPizzas} pizzas: <b>agregá una bebida y te la regalamos</b>.</span>}
      {faltan <= 0 && onBebidas && <button type="button" onClick={onBebidas}>Ver bebidas</button>}
    </div>
  );
}
