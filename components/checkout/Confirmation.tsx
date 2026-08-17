"use client";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";

interface Order {
  numero: string;
  nombre: string;
  mode: string;
  dir?: string;
  tel: string;
  total: number;
  pago: string;
}

export function Confirmation({ order, onClose, business }: { order: Order; onClose: () => void; business: BusinessConfig }) {
  return (
    <div className="confirm-screen">
      <div className="confirm-card modern">
        <div className="confirm-header">
          <div className="confirm-pulse">
            <div className="pulse-ring" />
            <div className="pulse-ring" style={{ animationDelay: ".6s" }} />
            <div className="confirm-check">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div className="confirm-order-num">{order.numero}</div>
          <h2>Pedido recibido, {order.nombre.split(" ")[0]}</h2>
          <p>{order.mode === "delivery" ? "Ya tomamos tu pedido. En breve empezamos a prepararlo." : "Ya tomamos tu pedido. Podés pasar en aproximadamente 20 min."}</p>
        </div>
        <div className="confirm-eta">
          <div className="eta-bar">
            {["Recibido", "Preparando", order.mode === "delivery" ? "En camino" : "Listo", "Entregado"].map((s, i) => (
              <div key={s} style={{ display: "contents" }}>
                {i > 0 && <div className="eta-line" />}
                <div className={`eta-step ${i === 0 ? "done" : i === 1 ? "active" : ""}`}><span>{i + 1}</span><small>{s}</small></div>
              </div>
            ))}
          </div>
          <div className="eta-time">
            <div><small>Tiempo estimado</small><b>{order.mode === "delivery" ? "30-40 min" : "20 min"}</b></div>
            <div style={{ textAlign: "right" }}><small>Total del pedido</small><b>{fmt(order.total)}</b></div>
          </div>
        </div>
        <div className="confirm-details">
          <div className="cd-row">
            <div className="cd-icon">
              {order.mode === "delivery"
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 18H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11h-5"/><path d="M14 8h4l4 4v5a1 1 0 0 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              }
            </div>
             <div><small>{order.mode === "delivery" ? "Entregamos en" : "Retirás en"}</small><b>{order.mode === "delivery" ? order.dir : business.address}</b></div>
          </div>
          <div className="cd-row">
            <div className="cd-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
            <div><small>Método de pago</small><b style={{ textTransform: "capitalize" }}>{order.pago === "mercadopago" ? "Mercado Pago" : order.pago}</b></div>
          </div>
          <div className="cd-row">
            <div className="cd-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div>
            <div><small>Te avisamos por WhatsApp</small><b>{order.tel}</b></div>
          </div>
        </div>
        <div className="confirm-actions">
          <button className="btn btn-light" onClick={onClose}>Seguir explorando</button>
            <a className="btn btn-primary" href={`https://wa.me/${business.whatsappPhone}`} target="_blank" rel="noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Z"/></svg>
            Abrir WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
