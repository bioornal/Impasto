"use client";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ItemMedia } from "@/components/ui/ItemMedia";
import { DrinkIllus } from "@/components/ui/Illus";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";
import type { Bebida } from "@/types";

/** Mismo corte que `@media (max-width:760px)` en impasto.css. */
const esMobile = () => window.matchMedia("(max-width: 760px)").matches;

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
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const arrastre = useRef<{ inicio: number; puntero: number } | null>(null);

  // Mobile: Esc cierra la hoja y el foco queda atrapado mientras está abierta.
  // En escritorio el panel lateral sigue como estaba.
  useEffect(() => {
    if (!open) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (!esMobile()) return;
      if (evento.key === "Escape") { onClose(); return; }
      if (evento.key !== "Tab" || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input, a[href], textarea",
      );
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [open, onClose]);

  if (!open) return null;

  const sinDelivery = !tienda.delivery.activo;
  const freeShipping = subtotal >= business.freeShippingFrom;
  const progress = Math.min(100, (subtotal / business.freeShippingFrom) * 100);
  // Sin reparto no hay envío que cobrar: el pedido es para retirar.
  const shipping = sinDelivery || freeShipping ? 0 : business.deliveryFee;

  const inCart = new Set(items.map((i) => i.key));
  // Todas las bebidas que todavía no están en el pedido: el carrusel se desliza,
  // así que ya no hace falta recortar a dos.
  const upsells = bebidas.filter((b) => b.disponible !== false && !inCart.has(b.id));
  const deslizar = (sentido: 1 | -1) => railRef.current?.scrollBy({ left: sentido * 260, behavior: "smooth" });

  // Mobile: arrastrar la manija o la cabecera hacia abajo cierra la hoja. El
  // puntero queda capturado y esas zonas llevan touch-action:none (impasto.css):
  // sin eso el navegador toma el gesto como scroll y cancela el arrastre.
  const alApoyar = (e: React.PointerEvent<HTMLElement>) => {
    if (!esMobile() || (e.pointerType === "mouse" && e.button !== 0)) return;
    arrastre.current = { inicio: e.clientY, puntero: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const alMover = (e: React.PointerEvent<HTMLElement>) => {
    if (arrastre.current?.puntero !== e.pointerId) return;
    setDragY(Math.max(0, e.clientY - arrastre.current.inicio));
  };
  const alSoltar = (e: React.PointerEvent<HTMLElement>) => {
    if (arrastre.current?.puntero !== e.pointerId) return;
    const cerrar = e.clientY - arrastre.current.inicio > 120;
    arrastre.current = null;
    setDragY(0);
    if (cerrar) onClose();
  };
  const alCancelar = () => { arrastre.current = null; setDragY(0); };
  const zonaDeArrastre = { onPointerDown: alApoyar, onPointerMove: alMover, onPointerUp: alSoltar, onPointerCancel: alCancelar };

  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside
        ref={sheetRef}
        className="drawer"
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tu pedido"
      >
        <button className="drawer-handle" onClick={onClose} aria-label="Cerrar pedido" {...zonaDeArrastre}>
          <span />
        </button>

        <div className="drawer-head" {...zonaDeArrastre}>
          <div className="drawer-head-top">
            <div>
              <h3>Tu pedido</h3>
              <small>{items.length} ítem{items.length !== 1 ? "s" : ""}</small>
            </div>
            <button className="drawer-close" onClick={onClose} aria-label="Cerrar carrito">✕</button>
          </div>

          {sinDelivery ? (
            <div className="drawer-ship is-pickup">
              <div className="drawer-ship-top">
                <span className="ship-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10l2-6h16l2 6" /><path d="M2 10h20" /><path d="M4 10v10h16V10" /><path d="M10 20v-5h4v5" /></svg>
                </span>
                <div className="ship-text">
                  <b>Por ahora, solo retiro en el local</b>
                  <small>{tienda.delivery.motivo}</small>
                </div>
              </div>
            </div>
          ) : (
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
          )}
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
              <span>{sinDelivery ? "Retiro en el local" : "Envío"}</span>
              {sinDelivery ? (
                <span>Sin cargo</span>
              ) : freeShipping ? (
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
              {tienda.abierto ? "Continuar con el pedido" : "Cerrado por ahora"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
            </button>
            {!tienda.abierto && <small className="drawer-closed">{tienda.motivo}</small>}
            <small className="drawer-note">
              Sin costo de servicio · {sinDelivery ? "Listo para retirar en" : "Entrega estimada"} {business.deliveryEstimate}
            </small>
          </div>
        )}
      </aside>
    </div>
  );
}
