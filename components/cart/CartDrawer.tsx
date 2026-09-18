"use client";
import { useRef } from "react";
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
  const railRef = useRef<HTMLDivElement>(null);
  if (!open) return null;

  const freeShipping = subtotal >= business.freeShippingFrom;
  const progress = Math.min(100, (subtotal / business.freeShippingFrom) * 100);
  const shipping = freeShipping ? 0 : business.deliveryFee;

  const inCart = new Set(items.map((i) => i.key));
  // Todas las bebidas que todavía no están en el pedido: el carrusel se desliza,
  // así que ya no hace falta recortar a dos.
  const upsells = bebidas.filter((b) => b.disponible !== false && !inCart.has(b.id));
  const deslizar = (sentido: 1 | -1) => railRef.current?.scrollBy({ left: sentido * 260, behavior: "smooth" });

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

          <div className={`drawer-ship ${freeShipping ? "is-free" : ""}`}>
            <div className="drawer-ship-top">
              <span className="ship-icon" aria-hidden="true">
                {freeShipping ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
                )}
              </span>
              <div className="ship-text">
                {freeShipping ? (
                  <>
                    <b>¡Tu envío es GRATIS!</b>
                    <small>Te ahorrás {fmt(business.deliveryFee)}</small>
                  </>
                ) : (
                  <>
                    <b>Sumá {fmt(business.freeShippingFrom - subtotal)} y el envío es GRATIS</b>
                    <small>Envío gratis desde {fmt(business.freeShippingFrom)} · ahorrás {fmt(business.deliveryFee)}</small>
                  </>
                )}
              </div>
            </div>
            {!freeShipping && (
              <div className="ship-track">
                <div className="ship-bar" style={{ width: `${progress}%` }} />
              </div>
            )}
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

              {/* Sugerencias, no ítems del pedido: por eso otra forma (carrusel en
                  vez de filas), "Opcional" a la vista y el precio con "+". Antes
                  eran filas iguales a las del pedido y se confundían con él. */}
              {upsells.length > 0 && (
                <section className="upsells" aria-labelledby="upsells-titulo">
                  <div className="upsells-head">
                    <div>
                      <h5 id="upsells-titulo">¿Algo para tomar?</h5>
                      <small>Opcional · no está en tu pedido</small>
                    </div>
                    {upsells.length > 3 && (
                      <div className="upsell-nav">
                        <button onClick={() => deslizar(-1)} aria-label="Ver bebidas anteriores">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <button onClick={() => deslizar(1)} aria-label="Ver más bebidas">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="upsell-rail" ref={railRef}>
                    {upsells.map((bebida) => (
                      <div className="upsell" key={bebida.id}>
                        <div className="upsell-top">
                          <div className="upsell-media"><DrinkIllus id={bebida.id} label={bebida.nombre} name={bebida.nombre} /></div>
                          <button
                            className="upsell-add"
                            aria-label={`Agregar ${bebida.nombre} al pedido`}
                            onClick={() => {
                              add({ key: bebida.id, type: "bebida", name: bebida.nombre, price: bebida.precio, qty: 1 });
                              toast(`${bebida.nombre} sumada`);
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                          </button>
                        </div>
                        <b>{bebida.nombre}</b>
                        <small>+ {fmt(bebida.precio)}</small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="drawer-foot">
            <div className="tot-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="tot-row">
              <span>Envío</span>
              {freeShipping ? (
                <span className="free"><s className="was">{fmt(business.deliveryFee)}</s> Gratis</span>
              ) : (
                <span>{fmt(business.deliveryFee)}</span>
              )}
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
            <small className="drawer-note">Sin costo de servicio · Entrega estimada {business.deliveryEstimate}</small>
          </div>
        )}
      </aside>
    </div>
  );
}
