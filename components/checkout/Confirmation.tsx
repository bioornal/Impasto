"use client";
import { useState } from "react";
import Link from "next/link";
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
  estadoPago?: string;
}

const PAGO_LABEL: Record<string, string> = {
  aprobado: "Pago acreditado",
  pendiente: "Pago en revisión",
  rechazado: "Pago rechazado",
  reembolsado: "Pago reembolsado",
};

export function Confirmation({ order, onClose, business }: { order: Order; onClose: () => void; business: BusinessConfig }) {
  const [copiado, setCopiado] = useState(false);
  const alias = business.aliasCbu || "";
  const titular = business.titularCuenta || "";
  const banco = business.banco || "";
  /**
   * Sin alias ni CBU no hay a dónde transferir. Antes acá había valores de
   * ejemplo como respaldo, y eso es lo peor que se puede hacer con este dato:
   * el cliente le manda plata a un alias que no es del local. Si falta la
   * configuración se muestra el pedido igual y se le dice que los pida por
   * WhatsApp.
   */
  const hayDatosBancarios = Boolean(alias || business.cbu);
  const paraCopiar = alias || business.cbu || "";

  const copiarAlias = async () => {
    try {
      await navigator.clipboard.writeText(paraCopiar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* fallback silencioso */
    }
  };

  const wspMensaje = order.pago === "transferencia"
    ? `Hola! Te envío el comprobante de transferencia del pedido ${order.numero} por ${fmt(order.total)} (${order.nombre}).`
    : `Hola! Hice el pedido ${order.numero} por ${fmt(order.total)} a nombre de ${order.nombre}.`;

  const wspUrl = `https://wa.me/${business.whatsappPhone}?text=${encodeURIComponent(wspMensaje)}`;

  return (
    <div className="confirm-screen">
      <div className="confirm-card">
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
          <p className="confirm-lede">
            Ya tomamos tu pedido. {order.mode === "delivery"
              ? `Lo estamos preparando y te llega en ${business.deliveryEstimate} aproximadamente.`
              : `Lo estamos preparando: podés pasar a retirarlo en ${business.deliveryEstimate} aproximadamente.`}
          </p>
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
            <div><small>Tiempo estimado</small><b>{business.deliveryEstimate}</b></div>
            <div style={{ textAlign: "right" }}><small>Total del pedido</small><b>{fmt(order.total)}</b></div>
          </div>
        </div>

        {order.pago === "transferencia" && !hayDatosBancarios && (
          <div style={{ padding: "16px", background: "#faf5eb", border: "1.5px dashed #b2472a", borderRadius: "12px", margin: "16px 0", textAlign: "left" }}>
            <div style={{ color: "#b2472a", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
              Datos para transferir {fmt(order.total)}
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#4a3e35" }}>
              Escribinos por WhatsApp y te pasamos el alias en el momento. Tu pedido ya quedó
              registrado con el número <b>{order.numero}</b>.
            </p>
            <a
              style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px", background: "#25d366", color: "white", textDecoration: "none", fontWeight: 600, padding: "9px 14px", borderRadius: "8px" }}
              href={wspUrl}
              target="_blank"
              rel="noreferrer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Z"/></svg>
              Pedir los datos por WhatsApp
            </a>
          </div>
        )}

        {order.pago === "transferencia" && hayDatosBancarios && (
          <div style={{ padding: "16px", background: "#faf5eb", border: "1.5px dashed #b2472a", borderRadius: "12px", margin: "16px 0", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b2472a", fontWeight: 700, fontSize: "14px", marginBottom: "8px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              <span>Datos para transferir {fmt(order.total)}</span>
            </div>
            <div style={{ fontSize: "13px", color: "#4a3e35", display: "flex", flexDirection: "column", gap: "6px" }}>
              {banco && <div><b>Banco:</b> {banco}</div>}
              {titular && <div><b>Titular:</b> {titular}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5dacb", marginTop: "4px" }}>
                <div>
                  <small style={{ display: "block", color: "#8a7a6b", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".05em" }}>{alias ? "Alias" : "CBU / CVU"}</small>
                  <strong style={{ fontSize: "15px", color: "#2a2018", fontFamily: "var(--font-mono, monospace)" }}>{paraCopiar}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: copiado ? "#2e7d32" : "#b2472a", color: "white", padding: "6px 12px", fontSize: "12px", border: "none", borderRadius: "6px", cursor: "pointer", transition: "background .2s" }}
                  onClick={copiarAlias}
                >
                  {copiado ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              {/* Solo como complemento del alias: si no hay alias, el CBU ya
                  ocupa el recuadro de arriba y repetirlo confunde. */}
              {alias && business.cbu && (
                <div style={{ fontSize: "11.5px", color: "#8a7a6b", marginTop: "2px" }}>
                  CBU/CVU: <span style={{ fontFamily: "monospace" }}>{business.cbu}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: "12px" }}>
              <a
                className="btn btn-success btn-sm"
                style={{ width: "100%", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: "6px", background: "#25d366", color: "white", textDecoration: "none", fontWeight: 600, padding: "9px 14px", borderRadius: "8px" }}
                href={wspUrl}
                target="_blank"
                rel="noreferrer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Z"/></svg>
                Enviar comprobante por WhatsApp
              </a>
            </div>
          </div>
        )}

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
            <div>
              <small>Método de pago</small>
              <b style={{ textTransform: "capitalize" }}>{order.pago === "mercadopago" ? "Mercado Pago" : order.pago}</b>
              {order.estadoPago && PAGO_LABEL[order.estadoPago] && (
                <small className={`pago-estado pago-${order.estadoPago}`}>{PAGO_LABEL[order.estadoPago]}</small>
              )}
            </div>
          </div>
          <div className="cd-row">
            <div className="cd-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
            <div><small>Teléfono de contacto</small><b>{order.tel}</b></div>
          </div>
        </div>

        <div style={{ margin: "16px 0 8px" }}>
          <Link
            href={`/pedido/${order.numero}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 18px",
              background: "#b2472a",
              color: "white",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "14px",
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(178,71,42,.25)",
            }}
          >
            <span>🛵 Ver seguimiento del pedido en vivo</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        </div>

        <div className="confirm-actions">
          <button className="btn btn-light" onClick={onClose}>Seguir explorando</button>
          <a className="btn btn-ghost" href={wspUrl} target="_blank" rel="noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Z"/></svg>
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
