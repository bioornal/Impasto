"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";
import type { CartItem } from "@/types";

export interface CheckoutData {
  mode: "delivery" | "takeaway"; nombre: string; tel: string; dir: string;
  ref: string; pago: string; cambio: string; notas: string;
}

export interface CheckoutOrder extends CheckoutData {
  items: CartItem[];
}

interface CheckoutProps {
  onClose: () => void;
  onConfirm: (order: CheckoutOrder) => Promise<void>;
  business: BusinessConfig;
}

export function Checkout({ onClose, onConfirm, business }: CheckoutProps) {
  const { items, subtotal: localSubtotal } = useCart();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CheckoutData>({ mode: "delivery", nombre: "", tel: "", dir: "", ref: "", pago: "efectivo", cambio: "", notas: "" });
  const [errors, setErrors] = useState<Partial<CheckoutData>>({});
  const [quote, setQuote] = useState<{ key: string; items: CartItem[]; subtotal: number; shipping: number; total: number } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
  const shipping = quoteLoading ? (data.mode === "delivery" ? business.deliveryFee : 0) : (quote?.shipping ?? 0);
  const total = quoteLoading ? subtotal + shipping : (quote?.total ?? subtotal + shipping);
  const lineItems = quoteLoading || !quote?.items.length ? items : quote.items;
  const set = <K extends keyof CheckoutData>(k: K, v: CheckoutData[K]) => setData((d) => ({ ...d, [k]: v }));

  const validateStep1 = () => {
    const e: Partial<CheckoutData> = {};
    if (!data.nombre.trim()) e.nombre = "Ingresá tu nombre";
    if (!/^\d{8,}/.test(data.tel.replace(/\D/g, ""))) e.tel = "Teléfono inválido";
    if (data.mode === "delivery" && !data.dir.trim()) e.dir = "Dirección requerida";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (step === 1 && !validateStep1()) return; setStep(step + 1); };
  const pay = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await onConfirm({ ...data, items: [...items] });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo registrar el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout-screen">
      <div className="container">
        <div className="checkout-head">
          <button className="logo" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <div className="logo-mark">I</div>
            <div>Impasto<small>checkout</small></div>
          </button>
          <button className="btn btn-light btn-sm" onClick={onClose}>← Volver</button>
        </div>
      </div>
      <div className="checkout-inner">
        <div>
          <div className="steps">
            <div className={`step ${step >= 1 ? (step > 1 ? "done" : "active") : ""}`}>1 · Entrega</div>
            <div className={`step ${step >= 2 ? "active" : ""}`}>2 · Pago</div>
          </div>

          {step === 1 && (
            <>
              <div className="form-section">
                <h4>Modalidad</h4>
                <div className="radio-row">
                  <div className={`radio-card ${data.mode === "delivery" ? "active" : ""}`} onClick={() => set("mode", "delivery")}><b>Delivery</b><small>Te lo llevamos a domicilio · 30 min aprox.</small></div>
                  <div className={`radio-card ${data.mode === "takeaway" ? "active" : ""}`} onClick={() => set("mode", "takeaway")}><b>Retiro en local</b><small>Pasás a buscarlo · 20 min</small></div>
                </div>
              </div>
              <div className="form-section">
                <h4>Datos de contacto</h4>
                <div className="form-row">
                  <div className={`field ${errors.nombre ? "error" : ""}`}>
                    <label>Nombre y apellido</label>
                    <input value={data.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Juan Pérez" />
                    {errors.nombre && <span className="err">{errors.nombre}</span>}
                  </div>
                  <div className={`field ${errors.tel ? "error" : ""}`}>
                      <label>Teléfono</label>
                      <input value={data.tel} onChange={(e) => set("tel", e.target.value)} placeholder="3757 555 1234" />
                    {errors.tel && <span className="err">{errors.tel}</span>}
                  </div>
                </div>
              </div>
              {data.mode === "delivery" && (
                <div className="form-section">
                  <h4>Dirección de entrega</h4>
                  <div className="form-row">
                    <div className={`field ${errors.dir ? "error" : ""}`} style={{ gridColumn: "1 / -1" }}>
                      <label>Calle y altura</label>
                      <input value={data.dir} onChange={(e) => set("dir", e.target.value)} placeholder="Calle, altura y referencias" />
                      {errors.dir && <span className="err">{errors.dir}</span>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label>Envío</label>
                      <input value={`Tarifa única · ${fmt(business.deliveryFee)}`} readOnly />
                    </div>
                    <div className="field">
                      <label>Referencia (opcional)</label>
                      <input value={data.ref} onChange={(e) => set("ref", e.target.value)} placeholder="Casa color verde, timbre 2B" />
                    </div>
                  </div>
                </div>
              )}
              <div className="form-section">
                <h4>Notas del pedido</h4>
                <div className="field">
                  <label>Observaciones (opcional)</label>
                  <textarea rows={3} value={data.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Sin cebolla, porfa" />
                </div>
              </div>
              <button className="btn btn-primary btn-lg btn-block" onClick={next}>Continuar al pago</button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-section">
                <h4>Método de pago</h4>
                <div className="radio-row" style={{ flexDirection: "column" }}>
                  {([ ["tarjeta", "Tarjeta de débito/crédito", "Al momento de la entrega con POS"], ["efectivo", "Efectivo", "Pagás al recibir el pedido"], ["transferencia", "Transferencia bancaria", "Te enviamos CBU al confirmar"] ] as [string,string,string][]).map(([k, t, s]) => (
                    <div key={k} className={`radio-card ${data.pago === k ? "active" : ""}`} onClick={() => set("pago", k)}><b>{t}</b><small>{s}</small></div>
                  ))}
                </div>
                {data.pago === "efectivo" && (
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <div className="field"><label>¿Con cuánto abonás?</label><input value={data.cambio} onChange={(e) => set("cambio", e.target.value)} placeholder="Ej: $20.000" /></div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-light" onClick={() => setStep(1)}>← Atrás</button>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={pay} disabled={submitting || quoteLoading || Boolean(quoteError)}>
                  {submitting ? "Registrando pedido…" : quoteLoading ? "Actualizando total…" : `Confirmar pedido · ${fmt(total)}`}
                </button>
              </div>
              {quoteError && <div className="field err" style={{ marginTop: 12 }}>{quoteError}</div>}
              {submitError && <div className="field err" style={{ marginTop: 12 }}>{submitError}</div>}
            </>
          )}
        </div>

        <aside className="summary">
          <h4>Resumen</h4>
           {lineItems.map((i) => (
            <div className="line" key={i.cartId}><span>{i.qty}× {i.name}</span><span>{fmt(i.price * i.qty)}</span></div>
          ))}
          <div className="line"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="line"><span>Envío {data.mode === "takeaway" ? "(take away)" : ""}</span><span>{shipping === 0 ? "—" : fmt(shipping)}</span></div>
          <div className="tot-row big"><span>Total</span><span>{fmt(total)}</span></div>
          <div style={{ marginTop: 16, padding: 12, background: "var(--bg-2)", borderRadius: 8, fontSize: 12, color: "var(--muted)" }}>
             {data.mode === "delivery" ? `Envío con tarifa única de ${fmt(business.deliveryFee)}. Tiempo estimado: 30-40 min.` : `Retiro en ${business.address}, ${business.city}. Listo en 20 min.`}
          </div>
        </aside>
      </div>
    </div>
  );
}
