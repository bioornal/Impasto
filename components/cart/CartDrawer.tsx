"use client";
import { useCart } from "@/components/providers/CartProvider";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { fmt } from "@/lib/utils";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const { items, inc, dec, remove, subtotal } = useCart();
  if (!open) return null;
  return (
    <div className="drawer-bg" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3>Tu pedido</h3>
            <small style={{ color: "var(--muted)" }}>{items.length} ítem{items.length !== 1 ? "s" : ""}</small>
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="drawer-empty">
              <div className="emoji-big">∅</div>
              <h4 style={{ marginBottom: 8 }}>Tu carrito está vacío</h4>
              <p>Agregá alguna pizza o empanada para empezar</p>
            </div>
          ) : items.map((i) => (
            <div className="cart-item" key={i.cartId}>
              <div className="ci-media">
                {i.type === "pizza" || i.type === "pizza-half"
                  ? <PizzaIllus id={i.illus || i.key} />
                  : i.type === "bebida"
                    ? <div className="drink-illus" style={{ position: "absolute", inset: 0, fontSize: 9 }}><span>{i.name.split(" ")[0]}</span></div>
                    : <div className="emp-illus" style={{ position: "absolute", inset: 0 }} />
                }
              </div>
              <div>
                <h4>{i.name}</h4>
                {i.detail && <small>{i.detail}</small>}
                <div className="ci-qty">
                  <div className="qty" style={{ background: "var(--bg-2)" }}>
                    <button onClick={() => dec(i.cartId)}>−</button>
                    <span>{i.qty}</span>
                    <button onClick={() => inc(i.cartId)}>+</button>
                  </div>
                  <button className="remove" onClick={() => remove(i.cartId)}>Quitar</button>
                </div>
              </div>
              <div className="ci-price">{fmt(i.price * i.qty)}</div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="drawer-foot">
            <div className="tot-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="tot-row"><span>Envío</span><span style={{ color: "var(--muted)" }}>Se calcula en checkout</span></div>
            <div className="tot-row big"><span>Total</span><span>{fmt(subtotal)}</span></div>
            <button className="btn btn-primary btn-lg btn-block" onClick={onCheckout}>Continuar al checkout</button>
          </div>
        )}
      </div>
    </div>
  );
}
