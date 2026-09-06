"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StoredOrder {
  ref: string;
  at: number;
}

const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Recibido",
  preparando: "En preparación",
  "en-camino": "En camino / Listo",
};

export function ActiveOrderBanner() {
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("impasto_active_order");
      if (!raw) return;
      const parsed: StoredOrder = JSON.parse(raw);
      // Descartar si tiene más de 12 horas
      if (!parsed.ref || Date.now() - parsed.at > 12 * 60 * 60 * 1000) {
        localStorage.removeItem("impasto_active_order");
        return;
      }

      // Consultar estado real del pedido
      fetch(`/api/orders/${parsed.ref}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.order) {
            const st = data.order.estado;
            if (st === "entregado" || st === "cancelado") {
              // Ya terminó: limpiar
              localStorage.removeItem("impasto_active_order");
            } else {
              setActiveRef(parsed.ref);
              setEstado(st);
            }
          }
        })
        .catch(() => {
          /* offline */
        });
    } catch {
      /* storage deshabilitado */
    }
  }, []);

  if (!activeRef || dismissed) return null;

  const label = (estado && ESTADO_LABEL[estado]) || "En proceso";

  return (
    <aside aria-label="Aviso de pedido en curso" style={{
      background: "#2a2018",
      color: "#f6f1e7",
      padding: "8px 16px",
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      zIndex: 90,
      position: "relative",
      boxShadow: "0 2px 8px rgba(0,0,0,.15)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4caf50", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span>Pedido <b>{activeRef}</b>:</span>
        </span>
        <span style={{ background: "rgba(255,255,255,.15)", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>
          {label}
        </span>
        <Link
          href={`/pedido/${activeRef}`}
          style={{
            color: "#f1c40f",
            fontWeight: 600,
            textDecoration: "underline",
            marginLeft: "4px",
          }}
        >
          Ver seguimiento en vivo →
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Cerrar aviso"
        style={{
          background: "transparent",
          border: "none",
          color: "#a89b8d",
          fontSize: "16px",
          cursor: "pointer",
          padding: "2px 6px",
          marginLeft: "8px",
          lineHeight: 1,
        }}
      >
        ×
      </button>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: .7; }
        }
      `}</style>
    </aside>
  );
}
