"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import { ItemMedia } from "@/components/ui/ItemMedia";
import { CardPayment, type CardFormData } from "@/components/checkout/CardPayment";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";
import type { CartItem } from "@/types";

export interface CheckoutData {
  mode: "delivery" | "takeaway";
  when: string;
  nombre: string;
  tel: string;
  email: string;
  dir: string;
  ref: string;
  pago: string;
  cambio: string;
  notas: string;
}

export interface CheckoutOrder extends CheckoutData {
  items: CartItem[];
}

interface CheckoutProps {
  onClose: () => void;
  /** Mobile: el botón volver reabre la hoja del carrito, no la carta. */
  onBack: () => void;
  onConfirm: (order: CheckoutOrder) => Promise<void>;
  onCardConfirm: (order: CheckoutOrder, card: CardFormData) => Promise<void>;
  business: BusinessConfig;
}

const WHEN_OPTIONS: [string, string][] = [
  ["asap", "Lo antes posible"],
];

/**
 * El cuarto valor es el chip de la derecha, y dice **cuándo se paga**, nunca
 * cuánto: el total es el mismo por los tres medios (`lib/order-quote.ts` no
 * mira el medio de pago) porque la comisión de Mercado Pago ya está adentro
 * del precio de lista —`config_negocio.comision_en_precio` incluye Pizzas,
 * Empanadas y Bebidas, ver `lib/effective-prices.ts`—.
 *
 * Efectivo y transferencia decían "Sin recargo". Como la tarjeta decía otra
 * cosa, el contraste le inventaba a la tarjeta un recargo que no existe, y de
 * paso insinuaba que el precio depende de cómo se paga. Mantener los tres
 * chips en el mismo eje (el tiempo) es lo que evita que vuelva a pasar.
 */
const PAGOS: [string, string, string, string][] = [
  ["efectivo", "Efectivo", "Pagás al recibir el pedido", "Al recibir"],
  ["mercadopago", "Tarjeta", "Débito o crédito con Mercado Pago", "Ahora"],
  ["transferencia", "Transferencia", "Alias y CBU listos al confirmar", "Al confirmar"],
];

export function Checkout({ onClose, onBack, onConfirm, onCardConfirm, business }: CheckoutProps) {
  const { items, count, subtotal: localSubtotal } = useCart();
  const { delivery } = useStoreStatus();
  const [data, setData] = useState<CheckoutData>({
    mode: delivery.activo ? "delivery" : "takeaway", when: "asap", nombre: "", tel: "", email: "", dir: "", ref: "",
    pago: "efectivo", cambio: "", notas: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutData, string>>>({});
  const [quote, setQuote] = useState<{ key: string; items: CartItem[]; subtotal: number; shipping: number; total: number } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [brickOpen, setBrickOpen] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  // Con el reparto pausado el pedido es para retirar aunque el cliente hubiera
  // elegido delivery antes de la pausa. Derivado, no un efecto que pise el estado.
  const mode: CheckoutData["mode"] = delivery.activo ? data.mode : "takeaway";
  const quoteKey = JSON.stringify({ items, mode });

  useEffect(() => {
    let active = true;
    fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, mode }),
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo actualizar el total");
        if (active) {
          setQuote({ key: quoteKey, items: result.items, subtotal: result.subtotal, shipping: result.shipping, total: result.total });
          setQuoteError("");
        }
      })
      .catch(() => { if (active) { setQuote(null); setQuoteError("No se pudo actualizar el total. Intentá nuevamente."); } });
    return () => { active = false; };
  }, [mode, items, quoteKey]);

  const quoteLoading = quote?.key !== quoteKey;
  const subtotal = quoteLoading ? localSubtotal : (quote?.subtotal ?? localSubtotal);
  const freeShipping = subtotal >= business.freeShippingFrom;
  const shipping = quoteLoading
    ? (mode === "delivery" && !freeShipping ? business.deliveryFee : 0)
    : (quote?.shipping ?? 0);
  const total = quoteLoading ? subtotal + shipping : (quote?.total ?? subtotal + shipping);
  const lineItems = quoteLoading || !quote?.items.length ? items : quote.items;
  const isDelivery = mode === "delivery";

  const set = <K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const next: Partial<Record<keyof CheckoutData, string>> = {};
    if (!data.nombre.trim()) next.nombre = "Ingresá tu nombre";
    if (!/^\d{8,}/.test(data.tel.replace(/\D/g, ""))) next.tel = "Teléfono inválido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) next.email = "Email inválido";
    if (isDelivery && !data.dir.trim()) next.dir = "Dirección requerida";
    setErrors(next);
    return next;
  };

  const confirm = async () => {
    const next = validate();
    if (Object.keys(next).length > 0) {
      // Mobile: el foco va al primer campo con error. Escritorio sigue como estaba.
      if (window.matchMedia("(max-width: 760px)").matches) {
        const primero = (["nombre", "tel", "email", "dir"] as const).find((campo) => next[campo]);
        if (primero) document.getElementById(`co-m-${primero}`)?.focus();
      }
      return;
    }
    setSubmitError("");

    // Con tarjeta primero se cobra: el Brick tokeniza y recién ahí se registra el pedido.
    if (data.pago === "mercadopago") {
      setBrickOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({ ...data, mode, items: [...items] });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo registrar el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const payWithCard = async (card: CardFormData) => {
    await onCardConfirm({ ...data, mode, items: [...items] }, card);
  };

  return (
    <div className="checkout-screen">
      <div className="checkout-bar">
        <div className="checkout-bar-inner">
          <button className="logo" onClick={onClose}>
            <div className="logo-mark">I</div>
            <div className="logo-word">
              {business.name}
              <small>pedido seguro</small>
            </div>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div className="checkout-secure">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              Datos protegidos
            </div>
            <button className="btn btn-light btn-sm" onClick={onClose}>← Seguir comprando</button>
          </div>
        </div>
      </div>

      {/* Mobile: barra superior. El chip de seguridad no se oculta. */}
      <div className="co-topbar">
        <button className="co-back" onClick={onBack} aria-label="Volver al pedido">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <b>Finalizá tu pedido</b>
        <span className="co-secure-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Seguro
        </span>
      </div>

      <div className="checkout-inner">
        <div className="checkout-main">
          <div className="checkout-title">
            <h1>Finalizá tu pedido</h1>
            <p>Todo en una pantalla. Sin registro, sin pasos de más.</p>
          </div>

          <section className="co-card">
            <div className="co-card-head">
              <span className="co-num">1</span>
              <h4>¿Cómo lo querés recibir?</h4>
            </div>
            {!delivery.activo && (
              <div className="co-pickup-note" role="status">
                <b>Por ahora, solo retiro en el local.</b> {delivery.motivo}
              </div>
            )}
            <div className="co-modes">
              <button className={`radio-card ${isDelivery ? "on" : ""}`} onClick={() => set("mode", "delivery")} disabled={!delivery.activo}>
                <span className="radio-card-top">
                  <b>Delivery</b>
                  <span className={`dot ${isDelivery ? "on" : ""}`} />
                </span>
                <small>
                  {delivery.activo ? (
                    <>
                      A domicilio en {business.deliveryEstimate} · {fmt(business.deliveryFee)}<br />
                      Gratis desde {fmt(business.freeShippingFrom)}
                    </>
                  ) : (
                    "Pausado por el momento"
                  )}
                </small>
              </button>
              <button className={`radio-card ${!isDelivery ? "on" : ""}`} onClick={() => set("mode", "takeaway")}>
                <span className="radio-card-top">
                  <b>Retiro en el local</b>
                  <span className={`dot ${!isDelivery ? "on" : ""}`} />
                </span>
                <small>
                  Listo en {business.deliveryEstimate} · sin cargo<br />
                  {business.address}
                </small>
              </button>
            </div>
            <div className="when-row">
              {WHEN_OPTIONS.map(([key, label]) => (
                <button key={key} className={`when ${data.when === key ? "on" : ""}`} onClick={() => set("when", key)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="co-card">
            <div className="co-card-head">
              <span className="co-num">2</span>
              <h4>Tus datos</h4>
            </div>
            <div className="form-grid">
              <div className={`field ${errors.nombre ? "error" : ""}`}>
                <label htmlFor="co-nombre">Nombre y apellido</label>
                <input id="co-nombre" placeholder="Juan Pérez" value={data.nombre} onChange={(e) => set("nombre", e.target.value)} />
                {errors.nombre && <span className="err">{errors.nombre}</span>}
              </div>
              <div className={`field ${errors.tel ? "error" : ""}`}>
                <label htmlFor="co-tel">WhatsApp</label>
                <input id="co-tel" placeholder="3757 55 1234" value={data.tel} onChange={(e) => set("tel", e.target.value)} />
                {errors.tel && <span className="err">{errors.tel}</span>}
              </div>
              <div className={`field ${errors.email ? "error" : ""}`}>
                <label htmlFor="co-email">Email</label>
                <input id="co-email" type="email" placeholder="vos@email.com" autoComplete="email" value={data.email} onChange={(e) => set("email", e.target.value)} />
                {errors.email ? <span className="err">{errors.email}</span> : <span className="hint">Te mandamos la confirmación del pedido acá.</span>}
              </div>

              {isDelivery && (
                <>
                  <div className={`field full ${errors.dir ? "error" : ""}`}>
                    <label htmlFor="co-dir">Dirección</label>
                    <input id="co-dir" placeholder="Calle y altura" value={data.dir} onChange={(e) => set("dir", e.target.value)} />
                    {errors.dir && <span className="err">{errors.dir}</span>}
                  </div>
                  <div className="field full">
                    <label htmlFor="co-ref">Referencia para el repartidor (opcional)</label>
                    <input id="co-ref" placeholder="Casa verde, timbre 2B" value={data.ref} onChange={(e) => set("ref", e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <div className="field form-note">
              <label htmlFor="co-notas">Notas del pedido (opcional)</label>
              <textarea id="co-notas" rows={2} placeholder="Sin cebolla, cortada en 12 porciones…" value={data.notas} onChange={(e) => set("notas", e.target.value)} />
            </div>
          </section>

          <section className="co-card">
            <div className="co-card-head">
              <span className="co-num">3</span>
              <h4>Pago</h4>
            </div>
            <div className="pay-list">
              {PAGOS.map(([key, title, sub, tag]) => (
                <button key={key} className={`pay-row ${data.pago === key ? "on" : ""}`} onClick={() => set("pago", key)}>
                  <span className={`dot ${data.pago === key ? "on" : ""}`} />
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <b>{title}</b>
                    <small>{sub}</small>
                  </span>
                  <span className="tag">{tag}</span>
                </button>
              ))}
            </div>
            {data.pago === "efectivo" && (
              <div className="field form-note">
                <label htmlFor="co-cambio">¿Con cuánto abonás?</label>
                <input id="co-cambio" placeholder="Ej: $20.000" value={data.cambio} onChange={(e) => set("cambio", e.target.value)} />
              </div>
            )}
          </section>
        </div>

        <aside className="co-aside">
          <div className="co-sum">
            <div className="co-sum-head">
              <h4>Tu pedido</h4>
              <span className="eta">{isDelivery ? "Llega en" : "Listo en"} {business.deliveryEstimate}</span>
            </div>

            <div className="co-sum-items">
              {lineItems.map((item) => (
                <div className="co-sum-item" key={item.cartId}>
                  <div className="co-sum-media"><ItemMedia item={item} /></div>
                  <div style={{ minWidth: 0 }}>
                    <b>{item.name}</b>
                    <small>×{item.qty}</small>
                  </div>
                  <span className="line">{fmt(item.price * item.qty)}</span>
                </div>
              ))}
            </div>

            {isDelivery && (
              <div className={`co-free ${shipping === 0 ? "is-free" : ""}`}>
                {shipping === 0 ? (
                  <>
                    <b>¡Tu envío es GRATIS!</b>
                    <small>Te ahorrás {fmt(business.deliveryFee)}</small>
                  </>
                ) : (
                  <>
                    <b>Sumá {fmt(Math.max(0, business.freeShippingFrom - subtotal))} y el envío es GRATIS</b>
                    <div className="ship-track">
                      <div className="ship-bar" style={{ width: `${Math.min(100, (subtotal / business.freeShippingFrom) * 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="co-lines" style={{ paddingTop: 14, borderTop: "1px solid rgba(246,241,231,.16)" }}>
              <div><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div>
                <span>{isDelivery ? "Envío" : "Retiro en local"}</span>
                {isDelivery && shipping === 0 ? (
                  <span className="free"><s className="was">{fmt(business.deliveryFee)}</s> Gratis</span>
                ) : (
                  <span>{shipping === 0 ? "—" : fmt(shipping)}</span>
                )}
              </div>
            </div>

            <div className="co-total">
              <span className="mono">Total</span>
              <b>{fmt(total)}</b>
            </div>

            {quoteError && <div className="co-error">{quoteError}</div>}
            {submitError && <div className="co-error">{submitError}</div>}

            <button className="co-cta" onClick={confirm} disabled={submitting || quoteLoading || Boolean(quoteError)}>
              {submitting
                ? "Registrando pedido…"
                : quoteLoading
                  ? "Actualizando total…"
                  : data.pago === "mercadopago"
                    ? `Pagar con tarjeta · ${fmt(total)}`
                    : `Confirmar · ${fmt(total)}`}
            </button>

            <small className="co-note">
              {isDelivery
                ? `Tarifa única de ${fmt(business.deliveryFee)} en ${business.city} centro. Gratis desde ${fmt(business.freeShippingFrom)}.`
                : `Retirás en ${business.address}. Te avisamos cuando esté listo.`}
            </small>
          </div>

          <div className="co-trust">
            {["Seguimiento en vivo del estado de tu pedido."].map((text) => (
              <div className="co-trust-row" key={text}>
                <span className="check">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <small>{text}</small>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Mobile: resumen colapsado arriba, tarjetas 1-2-3 y pie fijo con el total.
          Escritorio usa .checkout-inner, de arriba; los dos comparten el estado. */}
      <div className="checkout-scroll">
        <div className="co-summary">
          <button className="co-summary-head" onClick={() => setResumenAbierto((v) => !v)} aria-expanded={resumenAbierto}>
            <span className="co-summary-head-main">
              <b>Tu pedido</b>
              <small>{count} ítem{count !== 1 ? "s" : ""} · {resumenAbierto ? "Ocultar detalle" : "Ver detalle"}</small>
            </span>
            <b className="co-summary-head-total">{fmt(total)}</b>
          </button>
          {resumenAbierto && (
            <div className="co-summary-body">
              {lineItems.map((item) => (
                <div className="co-summary-item" key={item.cartId}>
                  <div className="co-sum-media"><ItemMedia item={item} /></div>
                  <div className="co-summary-item-main">
                    <b>{item.name}</b>
                    <small>×{item.qty}</small>
                  </div>
                  <span className="co-summary-price">{fmt(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="co-summary-line"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="co-summary-line">
                <span>{isDelivery ? "Envío" : "Retiro en el local"}</span>
                <span>{isDelivery && shipping === 0 ? "Gratis" : shipping === 0 ? "Sin cargo" : fmt(shipping)}</span>
              </div>
            </div>
          )}
        </div>

        <section className="co-card">
          <div className="co-card-head">
            <span className="co-num">1</span>
            <h4>¿Cómo lo recibís?</h4>
          </div>
          {!delivery.activo && (
            <div className="co-pickup-note" role="status">
              <b>Por ahora, solo retiro en el local.</b> {delivery.motivo}
            </div>
          )}
          <div className="co-modes">
            <button className={`m-radio ${isDelivery ? "on" : ""}`} onClick={() => set("mode", "delivery")} disabled={!delivery.activo}>
              <span className="m-radio-dot" />
              <span className="m-radio-body">
                <b>Delivery</b>
                <small>
                  {delivery.activo
                    ? <>A domicilio en {business.deliveryEstimate} · {fmt(business.deliveryFee)}. Gratis desde {fmt(business.freeShippingFrom)}.</>
                    : "Pausado por el momento"}
                </small>
              </span>
            </button>
            <button className={`m-radio ${!isDelivery ? "on" : ""}`} onClick={() => set("mode", "takeaway")}>
              <span className="m-radio-dot" />
              <span className="m-radio-body">
                <b>Retiro en el local</b>
                <small>Listo en {business.deliveryEstimate}, sin cargo. {business.address}.</small>
              </span>
            </button>
          </div>
        </section>

        <section className="co-card">
          <div className="co-card-head">
            <span className="co-num">2</span>
            <h4>Tus datos</h4>
          </div>
          <div className="form-grid">
            <div className={`field ${errors.nombre ? "error" : ""}`}>
              <label htmlFor="co-m-nombre">Nombre y apellido</label>
              <input id="co-m-nombre" autoComplete="name" placeholder="Juan Pérez" value={data.nombre} onChange={(e) => set("nombre", e.target.value)} />
              {errors.nombre && <span className="err">{errors.nombre}</span>}
            </div>
            <div className={`field ${errors.tel ? "error" : ""}`}>
              <label htmlFor="co-m-tel">WhatsApp</label>
              <input id="co-m-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="3757 55 1234" value={data.tel} onChange={(e) => set("tel", e.target.value)} />
              {errors.tel && <span className="err">{errors.tel}</span>}
            </div>
            <div className={`field ${errors.email ? "error" : ""}`}>
              <label htmlFor="co-m-email">Email</label>
              <input id="co-m-email" type="email" inputMode="email" autoComplete="email" placeholder="vos@email.com" value={data.email} onChange={(e) => set("email", e.target.value)} />
              {errors.email ? <span className="err">{errors.email}</span> : <span className="hint">Te mandamos la confirmación del pedido acá.</span>}
            </div>

            {isDelivery && (
              <>
                <div className={`field full ${errors.dir ? "error" : ""}`}>
                  <label htmlFor="co-m-dir">Dirección</label>
                  <input id="co-m-dir" autoComplete="street-address" placeholder="Calle y altura" value={data.dir} onChange={(e) => set("dir", e.target.value)} />
                  {errors.dir && <span className="err">{errors.dir}</span>}
                </div>
                <div className="field full">
                  <label htmlFor="co-m-ref">Referencia <span className="opt">(opcional)</span></label>
                  <input id="co-m-ref" placeholder="Casa verde, timbre 2B" value={data.ref} onChange={(e) => set("ref", e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="field form-note">
            <label htmlFor="co-m-notas">Notas del pedido <span className="opt">(opcional)</span></label>
            <textarea id="co-m-notas" rows={2} placeholder="Sin cebolla, cortada en 12 porciones…" value={data.notas} onChange={(e) => set("notas", e.target.value)} />
          </div>
        </section>

        <section className="co-card">
          <div className="co-card-head">
            <span className="co-num">3</span>
            <h4>Pago</h4>
          </div>
          <div className="pay-list">
            {PAGOS.map(([key, title, sub, tag]) => (
              <button key={key} className={`pay-row ${data.pago === key ? "on" : ""}`} onClick={() => set("pago", key)}>
                <span className={`dot ${data.pago === key ? "on" : ""}`} />
                <span style={{ flex: 1, textAlign: "left" }}>
                  <b>{title}</b>
                  <small>{sub}</small>
                </span>
                <span className="tag">{tag}</span>
              </button>
            ))}
          </div>
          {data.pago === "efectivo" && (
            <div className="field form-note">
              <label htmlFor="co-m-cambio">¿Con cuánto abonás?</label>
              <input id="co-m-cambio" inputMode="numeric" placeholder="Ej: $20.000" value={data.cambio} onChange={(e) => set("cambio", e.target.value)} />
            </div>
          )}
        </section>

        <div className="co-trust-mobile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
          <small>Seguimiento en vivo del estado de tu pedido, sin registrarte.</small>
        </div>
      </div>

      <div className="co-footbar">
        {(quoteError || submitError) && <div className="co-error-card" role="alert">{quoteError || submitError}</div>}
        <div className="co-footbar-row">
          <div className="co-footbar-total">
            <div className="lbl">Total</div>
            <b>{fmt(total)}</b>
          </div>
          <button className="co-footbar-cta" onClick={confirm} disabled={submitting || quoteLoading || Boolean(quoteError)}>
            {submitting
              ? "Registrando pedido…"
              : quoteLoading
                ? "Actualizando total…"
                : data.pago === "mercadopago"
                  ? "Pagar con tarjeta"
                  : "Confirmar pedido"}
          </button>
        </div>
        <small className="co-footbar-note">
          {isDelivery
            ? `Tarifa única de ${fmt(business.deliveryFee)} en ${business.city} centro. Gratis desde ${fmt(business.freeShippingFrom)}.`
            : `Retirás en ${business.address}. Te avisamos cuando esté listo.`}
        </small>
      </div>

      {brickOpen && (
        <CardPayment
          amount={total}
          email={data.email.trim()}
          onClose={() => setBrickOpen(false)}
          onSubmit={payWithCard}
        />
      )}
    </div>
  );
}
