"use client";
import { useCart } from "@/components/providers/CartProvider";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ItemMedia } from "@/components/ui/ItemMedia";
import { DrinkIllus } from "@/components/ui/Illus";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";
import type { Bebida } from "@/types";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  onBrowse: () => void;
  business: BusinessConfig;
  bebidas: Bebida[];
}

export function CartDrawer({ open, onClose, onCheckout, onBrowse, business, bebidas }: CartDrawerProps) {
  const { items, add, inc, dec, remove, subtotal } = useCart();
  const tienda = useStoreStatus();
  const toast = useToast();
  if (!open) return null;

  const freeShipping = subtotal >= business.freeShippingFrom;
  const progress = Math.min(100, (subtotal / business.freeShippingFrom) * 100);
  const shipping = freeShipping ? 0 : business.deliveryFee;

  const inCart = new Set(items.map((i) => i.key));
  const upsells = bebidas.filter((b) => !inCart.has(b.id)).slice(0, 2);

  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tu pedido">
        <div className="drawer-head">
          <div className="drawer-head-top">
            <div>
              <h3>Tu pedido</h3>
              <small>{items.length} ítem{items.length !== 1 ? "s" : ""}</small>
            </div>
            <button className="drawer-close" onClick={onClose} aria-label="Cerrar carrito">✕</button>
          </div>

          <div className="drawer-ship">
            <div className="drawer-ship-top">
              <span>
                {freeShipping
                  ? "¡Tenés envío gratis!"
                  : `Te faltan ${fmt(business.freeShippingFrom - subtotal)} para envío gratis`}
              </span>
              <span className="flag">{freeShipping ? "✓ Gratis" : fmt(business.freeShippingFrom)}</span>
            </div>
            <div className="ship-track">
              <div className={`ship-bar ${freeShipping ? "free" : ""}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="drawer-empty">
              <div className="icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              </div>
              <h4>Todavía no hay nada acá</h4>
              <p>Sumá una pizza, una caja de empanadas o una bebida.</p>
              <button className="btn btn-primary" onClick={onBrowse}>Ver la carta</button>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <div className="cart-item" key={item.cartId}>
                  <div className="ci-media"><ItemMedia item={item} /></div>
                  <div style={{ minWidth: 0 }}>
                    <h4>{item.name}</h4>
                    {item.detail && <small className="ci-detail">{item.detail}</small>}
                    <div className="ci-qty">
                      <div className="qty-pill">
                        <button onClick={() => dec(item.cartId)} aria-label="Restar">−</button>
                        <span>{item.qty}</span>
                        <button onClick={() => inc(item.cartId)} aria-label="Sumar">+</button>
                      </div>
                      <button className="ci-remove" onClick={() => remove(item.cartId)}>Quitar</button>
                    </div>
                  </div>
                  <b className="ci-price">{fmt(item.price * item.qty)}</b>
                </div>
              ))}

              {upsells.length > 0 && (
                <div className="upsells">
                  <h5>Completá el pedido</h5>
                  {upsells.map((bebida) => (
                    <div className="upsell" key={bebida.id}>
                      <div className="upsell-media"><DrinkIllus id={bebida.id} label={bebida.nombre} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{bebida.nombre}</b>
                        <small>{fmt(bebida.precio)}</small>
                      </div>
                      <button
                        onClick={() => {
                          add({ key: bebida.id, type: "bebida", name: bebida.nombre, price: bebida.precio, qty: 1 });
                          toast(`${bebida.nombre} sumada`);
                        }}
                      >
                        Sumar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="drawer-foot">
            <div className="tot-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="tot-row">
              <span>Envío</span>
              <span className={freeShipping ? "free" : ""}>{freeShipping ? "Gratis" : fmt(business.deliveryFee)}</span>
            </div>
            <div className="tot-row total">
              <span className="mono">Total</span>
              <b>{fmt(subtotal + shipping)}</b>
            </div>
            <button className="drawer-cta" onClick={onCheckout} disabled={!tienda.abierto}>
              {tienda.abierto ? "Ir al checkout" : "Cerrado por ahora"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
            </button>
            {!tienda.abierto && <small className="drawer-closed">{tienda.motivo}</small>}
            <small className="drawer-note">Sin costo de servicio · Listo en 30 min</small>
          </div>
        )}
      </aside>
    </div>
  );
}
