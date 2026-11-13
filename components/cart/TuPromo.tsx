"use client";
import { useCart } from "@/components/providers/CartProvider";
import { aplicarPromo, promosAplicables } from "@/lib/promos-aplicar";
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

  // Sin promo todavía: el aviso sale del mismo motor que cobra, así nunca promete algo que no aplica.
  const pizzas = items.filter(i => i.type === "pizza" || i.type === "pizza-half").reduce((s, i) => s + i.qty, 0);
  const regalo = ofertas.find(o => o.tipo === "regalo");
  if (!regalo || pizzas === 0 || promosAplicables(ofertas, lineasPromo(items), [], new Date()).length) return null;
  const r = aplicarPromo(regalo, lineasPromo(items));
  if (!("error" in r)) return null;
  return (
    <div className="tu-promo-pista" aria-live="polite">
      <span>{r.error}</span>
      {onBebidas && /bebida a tu pedido/.test(r.error) && <button type="button" onClick={onBebidas}>Ver bebidas</button>}
    </div>
  );
}
