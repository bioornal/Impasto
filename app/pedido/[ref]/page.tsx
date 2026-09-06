"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fmt } from "@/lib/utils";

interface OrderItem {
  name?: string;
  nombre?: string;
  qty?: number;
  cantidad?: number;
  price?: number;
  precio?: number;
  detail?: string;
}

interface OrderData {
  numero: string;
  cliente: string;
  modalidad: "delivery" | "takeaway";
  direccion: string;
  items: OrderItem[];
  subtotal: number;
  envio: number;
  total: number;
  estado: "nuevo" | "preparando" | "en-camino" | "entregado" | "cancelado";
  estadoPago: "pendiente" | "aprobado" | "rechazado" | "reembolsado";
  metodoPago: string;
  cuando: string;
  notas: string;
  fecha: string;
  deliveryEstimate: string;
  bancoInfo?: {
    alias?: string;
    cbu?: string;
    banco?: string;
    titular?: string;
  } | null;
  whatsappPhone: string;
  businessPhone: string;
  businessAddress: string;
}

const STEPS = [
  { key: "nuevo", label: "Recibido", desc: "Registrado en el sistema" },
  { key: "preparando", label: "En preparación", desc: "En cocina y al horno" },
  { key: "en-camino", label: "En camino / Listo", desc: "Saliendo a entrega o listo para retirar" },
  { key: "entregado", label: "Entregado", desc: "¡Buen provecho!" },
];

const ESTADOS_ORDEN: Record<string, number> = {
  nuevo: 0,
  preparando: 1,
  "en-camino": 2,
  entregado: 3,
};

const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: "Efectivo al recibir",
  mercadopago: "Tarjeta (Mercado Pago)",
  transferencia: "Transferencia bancaria",
};

const ESTADO_PAGO_LABEL: Record<string, { label: string; color: string }> = {
  aprobado: { label: "Pago acreditado", color: "#2e7d32" },
  pendiente: { label: "Pago pendiente / en revisión", color: "#b2472a" },
  rechazado: { label: "Pago rechazado", color: "#c62828" },
  reembolsado: { label: "Pago reembolsado", color: "#616161" },
};

export default function PedidoTrackingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargarPedido() {
      try {
        const res = await fetch(`/api/orders/${ref}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (activo) setError(data.error || "No se encontró el pedido");
          return;
        }
        if (activo) {
          setOrder(data.order);
          setError("");
        }
      } catch {
        if (activo) setError("Error de conexión al cargar el pedido");
      } finally {
        if (activo) setLoading(false);
      }
    }

    cargarPedido();
    // Auto-refresh cada 15 segundos
    const intervalo = setInterval(cargarPedido, 15000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [ref]);

  const copiarAlias = async (alias: string) => {
    try {
      await navigator.clipboard.writeText(alias);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* fallback */
    }
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#fbf8f3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#7a6f65" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid #e0d5c5", borderTopColor: "#b2472a", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: "15px" }}>Cargando estado de tu pedido…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main style={{ minHeight: "100vh", background: "#fbf8f3", padding: "48px 20px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: "440px", background: "white", padding: "32px 24px", borderRadius: "16px", boxShadow: "0 8px 24px rgba(42,32,24,.06)", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
          <h1 style={{ fontSize: "20px", color: "#2a2018", margin: "0 0 8px" }}>Pedido no encontrado</h1>
          <p style={{ fontSize: "14px", color: "#7a6f65", margin: "0 0 24px", lineHeight: 1.5 }}>
            No encontramos ningún pedido con la referencia <strong>{ref}</strong>. Verificá el código o comunicate con la pizzería.
          </p>
          <Link
            href="/"
            style={{ display: "inline-block", background: "#b2472a", color: "white", padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}
          >
            ← Volver a Impasto
          </Link>
        </div>
      </main>
    );
  }

  const stepIndex = ESTADOS_ORDEN[order.estado] ?? 0;
  const esCancelado = order.estado === "cancelado";
  const esDelivery = order.modalidad === "delivery";
  const alias = order.bancoInfo?.alias || "IMPASTO.IGUAZU";

  const wspMensaje = `Hola! Consulto por mi pedido ${order.numero} (${order.cliente}).`;
  const wspUrl = `https://wa.me/${order.whatsappPhone}?text=${encodeURIComponent(wspMensaje)}`;

  const pagoInfo = ESTADO_PAGO_LABEL[order.estadoPago] || { label: order.estadoPago, color: "#7a6f65" };

  return (
    <main style={{ minHeight: "100vh", background: "#fbf8f3", padding: "32px 16px 64px", fontFamily: "Inter, system-ui, sans-serif", color: "#2a2018" }}>
      <div style={{ maxWidth: "620px", margin: "0 auto" }}>
        
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "#b2472a", fontWeight: 700, fontSize: "18px" }}>
            <span style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#b2472a", color: "white", display: "grid", placeItems: "center", fontSize: "16px", fontFamily: "Playfair Display, serif" }}>I</span>
            <span>Impasto</span>
          </Link>
          <div style={{ fontSize: "12px", color: "#7a6f65", background: "#f0eae1", padding: "4px 10px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2e7d32", display: "inline-block" }} />
            <span>En vivo</span>
          </div>
        </div>

        {/* Tarjeta de estado principal */}
        <div style={{ background: "white", borderRadius: "20px", padding: "28px 24px", boxShadow: "0 8px 24px rgba(42,32,24,.06)", marginBottom: "20px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#b2472a", background: "#faeee7", padding: "4px 10px", borderRadius: "6px", display: "inline-block", marginBottom: "8px" }}>
              {order.numero}
            </span>
            <h1 style={{ fontSize: "24px", margin: "0 0 6px", fontFamily: "Playfair Display, serif" }}>
              {esCancelado ? "Pedido cancelado" : stepIndex === 3 ? "¡Pedido entregado!" : `¡Hola, ${order.cliente.split(" ")[0]}!`}
            </h1>
            <p style={{ margin: 0, color: "#7a6f65", fontSize: "14.5px" }}>
              {esCancelado
                ? "Este pedido fue cancelado. Comunicate con nosotros ante cualquier duda."
                : stepIndex === 3
                  ? "Gracias por elegir Impasto. ¡Esperamos que lo disfrutes!"
                  : esDelivery
                    ? `Tu pedido está en proceso. Tiempo estimado de entrega: ${order.deliveryEstimate}.`
                    : `Tu pedido está en proceso. Podés pasar a retirarlo en ${order.deliveryEstimate} aproximadamente.`}
            </p>
          </div>

          {/* Stepper de progreso */}
          {!esCancelado && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", margin: "32px 0 20px" }}>
              {STEPS.map((s, i) => {
                const isActive = i === stepIndex;
                const isDone = i < stepIndex;
                const stepLabel = i === 2 ? (esDelivery ? "En camino" : "Listo") : s.label;
                return (
                  <div key={s.key} style={{ textAlign: "center" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      margin: "0 auto 8px",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      background: isDone ? "#2e7d32" : isActive ? "#b2472a" : "#f0eae1",
                      color: isDone || isActive ? "white" : "#a89b8d",
                      boxShadow: isActive ? "0 0 0 4px rgba(178,71,42,.2)" : "none",
                      transition: "all .3s ease",
                    }}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: isActive || isDone ? 700 : 500, color: isActive ? "#b2472a" : isDone ? "#2e7d32" : "#a89b8d" }}>
                      {stepLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Datos de transferencia bancaria si corresponde */}
        {order.metodoPago === "transferencia" && order.estadoPago !== "aprobado" && (
          <div style={{ background: "#faf5eb", border: "1.5px dashed #b2472a", borderRadius: "16px", padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b2472a", fontWeight: 700, fontSize: "15px", marginBottom: "10px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              <span>Transferir {fmt(order.total)}</span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "13.5px", color: "#5a4b3f", lineHeight: 1.4 }}>
              Realizá la transferencia por el total para que cocina confirme tu pedido.
            </p>
            <div style={{ background: "white", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e8decb", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <small style={{ display: "block", color: "#8a7a6b", fontSize: "11px", textTransform: "uppercase" }}>Alias CBU</small>
                <strong style={{ fontSize: "16px", color: "#2a2018", fontFamily: "monospace" }}>{alias}</strong>
              </div>
              <button
                type="button"
                onClick={() => copiarAlias(alias)}
                style={{ background: copiado ? "#2e7d32" : "#b2472a", color: "white", border: "none", padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                {copiado ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            {order.bancoInfo?.titular && (
              <div style={{ fontSize: "12.5px", color: "#6a5c50", marginBottom: "12px" }}>
                <div><b>Titular:</b> {order.bancoInfo.titular}</div>
                {order.bancoInfo.banco && <div><b>Banco:</b> {order.bancoInfo.banco}</div>}
                {order.bancoInfo.cbu && <div><b>CBU/CVU:</b> <span style={{ fontFamily: "monospace" }}>{order.bancoInfo.cbu}</span></div>}
              </div>
            )}
            <a
              href={`https://wa.me/${order.whatsappPhone}?text=${encodeURIComponent(`Hola! Envío comprobante de transferencia para el pedido ${order.numero} por ${fmt(order.total)} (${order.cliente}).`)}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "#25d366", color: "white", textDecoration: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: 600, fontSize: "13.5px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Z"/></svg>
              Enviar comprobante por WhatsApp
            </a>
          </div>
        )}

        {/* Detalle del pedido */}
        <div style={{ background: "white", borderRadius: "20px", padding: "24px", boxShadow: "0 8px 24px rgba(42,32,24,.06)", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", margin: "0 0 16px", color: "#2a2018", textTransform: "uppercase", letterSpacing: ".05em", fontFamily: "Playfair Display, serif" }}>
            Detalle del pedido
          </h2>

          <div style={{ borderBottom: "1px solid #f0eae1", paddingBottom: "12px", marginBottom: "12px" }}>
            {order.items.map((item, idx) => {
              const name = item.name || item.nombre || "Ítem";
              const qty = item.qty || item.cantidad || 1;
              const price = item.price || item.precio || 0;
              return (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "14.5px", padding: "6px 0" }}>
                  <div>
                    <span>{qty}× {name}</span>
                    {item.detail && <small style={{ display: "block", color: "#8a7a6b", fontSize: "12px" }}>{item.detail}</small>}
                  </div>
                  <span style={{ fontWeight: 600, color: "#2a2018" }}>{fmt(price * qty)}</span>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: "13.5px", color: "#6a5c50", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal</span>
              <span>{fmt(order.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{esDelivery ? "Envío" : "Retiro en local"}</span>
              <span>{esDelivery ? (order.envio === 0 ? "Gratis" : fmt(order.envio)) : "Sin cargo"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 700, color: "#2a2018", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #f0eae1" }}>
              <span>Total</span>
              <span>{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Entrega y Pago */}
        <div style={{ background: "white", borderRadius: "20px", padding: "24px", boxShadow: "0 8px 24px rgba(42,32,24,.06)", marginBottom: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px" }}>
            <div>
              <small style={{ display: "block", color: "#8a7a6b", fontSize: "11.5px", textTransform: "uppercase" }}>Modalidad</small>
              <b>{esDelivery ? "🛵 Delivery a domicilio" : "🏪 Retiro en el local"}</b>
              <div style={{ color: "#5a4b3f", marginTop: "2px" }}>{esDelivery ? order.direccion : order.businessAddress}</div>
            </div>

            {order.notas && (
              <div>
                <small style={{ display: "block", color: "#8a7a6b", fontSize: "11.5px", textTransform: "uppercase" }}>Aclaraciones</small>
                <div style={{ color: "#5a4b3f", fontStyle: "italic" }}>&ldquo;{order.notas}&rdquo;</div>
              </div>
            )}

            <div>
              <small style={{ display: "block", color: "#8a7a6b", fontSize: "11.5px", textTransform: "uppercase" }}>Forma de pago</small>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                <b>{METODO_PAGO_LABEL[order.metodoPago] || order.metodoPago}</b>
                <span style={{ fontSize: "12px", color: pagoInfo.color, background: `${pagoInfo.color}15`, padding: "3px 8px", borderRadius: "6px", fontWeight: 600 }}>
                  {pagoInfo.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{ flex: 1, minWidth: "160px", textAlign: "center", padding: "12px 18px", background: "white", color: "#2a2018", border: "1px solid #e0d5c5", borderRadius: "10px", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}
          >
            ← Volver a la pizzería
          </Link>
          <a
            href={wspUrl}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, minWidth: "160px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px 18px", background: "#b2472a", color: "white", borderRadius: "10px", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Z"/></svg>
            Consultar por WhatsApp
          </a>
        </div>

      </div>
    </main>
  );
}
