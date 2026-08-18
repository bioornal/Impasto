"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
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
  onConfirm: (order: CheckoutOrder) => Promise<void>;
  onCardConfirm: (order: CheckoutOrder, card: CardFormData) => Promise<void>;
  business: BusinessConfig;
}

const WHEN_OPTIONS: [string, string][] = [
  ["asap", "Lo antes posible"],
  ["21:00", "Programar 21:00"],
  ["22:00", "Programar 22:00"],
];

const PAGOS: [string, string, string, string][] = [
  ["efectivo", "Efectivo", "Pagás al recibir el pedido", "Sin recargo"],
  ["mercadopago", "Tarjeta", "Débito o crédito con Mercado Pago", "Pagás ahora"],
  ["transferencia", "Transferencia", "Te enviamos el CBU al confirmar", "Al confirmar"],
];

export function Checkout({ onClose, onConfirm, onCardConfirm, business }: CheckoutProps) {
  const { items, subtotal: localSubtotal } = useCart();
  const [data, setData] = useState<CheckoutData>({
    mode: "delivery", when: "asap", nombre: "", tel: "", email: "", dir: "", ref: "",
    pago: "efectivo", cambio: "", notas: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutData, string>>>({});
  const [quote, setQuote] = useState<{ key: string; items: CartItem[]; subtotal: number; shipping: number; total: number } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [brickOpen, setBrickOpen] = useState(false);
  const quoteKey = JSON.stringify({ items, mode: data.mode });

  useEffect(() => {
    let active = true;
    fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, mode: data.mode }),
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
  }, [data.mode, items, quoteKey]);

  const quoteLoading = quote?.key !== quoteKey;
  const subtotal = quoteLoading ? localSubtotal : (quote?.subtotal ?? localSubtotal);
  const freeShipping = subtotal >= business.freeShippingFrom;
  const shipping = quoteLoading
    ? (data.mode === "delivery" && !freeShipping ? business.deliveryFee : 0)
    : (quote?.shipping ?? 0);
  const total = quoteLoading ? subtotal + shipping : (quote?.total ?? subtotal + shipping);
  const lineItems = quoteLoading || !quote?.items.length ? items : quote.items;
  const isDelivery = data.mode === "delivery";

  const set = <K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const next: Partial<Record<keyof CheckoutData, string>> = {};
    if (!data.nombre.trim()) next.nombre = "Ingresá tu nombre";
    if (!/^\d{8,}/.test(data.tel.replace(/\D/g, ""))) next.tel = "Teléfono inválido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) next.email = "Email inválido";
    if (isDelivery && !data.dir.trim()) next.dir = "Dirección requerida";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const confirm = async () => {
    if (!validate()) return;
    setSubmitError("");

    // Con tarjeta primero se cobra: el Brick tokeniza y recién ahí se registra el pedido.
    if (data.pago === "mercadopago") {
      setBrickOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({ ...data, items: [...items] });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo registrar el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const payWithCard = async (card: CardFormData) => {
    await onCardConfirm({ ...data, items: [...items] }, card);
  };

  return (
    <div className="checkout-screen">
      <div className="checkout-bar">
        <div className="checkout-bar-inner">
          <button className="logo" onClick={onClose}>
            <div className="logo-mark">I</div>
            <div className="logo-word">
              {business.name}
              <small>checkout seguro</small>
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
            <div className="co-modes">
              <button className={`radio-card ${isDelivery ? "on" : ""}`} onClick={() => set("mode", "delivery")}>
                <span className="radio-card-top">
                  <b>Delivery</b>
                  <span className={`dot ${isDelivery ? "on" : ""}`} />
                </span>
                <small>
                  A domicilio en 30-40 min · {fmt(business.deliveryFee)}<br />
                  Gratis desde {fmt(business.freeShippingFrom)}
                </small>
              </button>
              <button className={`radio-card ${!isDelivery ? "on" : ""}`} onClick={() => set("mode", "takeaway")}>
                <span className="radio-card-top">
                  <b>Retiro en el local</b>
                  <span className={`dot ${!isDelivery ? "on" : ""}`} />
                </span>
                <small>
                  Listo en 20 min · sin cargo<br />
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
              <span className="eta">{isDelivery ? "Llega en 30-40 min" : "Listo en 20 min"}</span>
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

            <div className="co-lines" style={{ paddingTop: 14, borderTop: "1px solid rgba(246,241,231,.16)" }}>
              <div><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div>
                <span>{isDelivery ? (shipping === 0 ? "Envío (gratis)" : "Envío") : "Retiro en local"}</span>
                <span className={shipping === 0 && isDelivery ? "free" : ""}>
                  {shipping === 0 ? (isDelivery ? "Gratis" : "—") : fmt(shipping)}
                </span>
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
            {["Te avisamos por WhatsApp cuando la pizza entra al horno.", "Si algo no llega bien, lo reponemos sin vueltas."].map((text) => (
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
