"use client";
import { Icon } from "./Icons";
import type { AdminOrder } from "./types";
import { esPedidoParaCocina } from "@/lib/pedido-visible";
import { etiquetaEstado, numeroCorto, resumenItems, siguienteEstado } from "@/lib/admin-pedidos";
import { enlaceWhatsapp, mensajeAlCliente, whatsappDeCliente } from "@/lib/contacto";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const hace = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
};
const medio = (o: AdminOrder) => (o.pago === "mercadopago" ? "Mercado Pago" : o.pago.charAt(0).toUpperCase() + o.pago.slice(1));

/** El teléfono en la lista: abre el chat de WhatsApp sin abrir el detalle. */
export function TelCliente({ order }: { order: AdminOrder }) {
  const numero = whatsappDeCliente(order.tel);
  if (!numero) return <span className="tbl-muted">{order.tel}</span>;
  return (
    <a className="tbl-muted tbl-wa" href={enlaceWhatsapp(numero, mensajeAlCliente(order.cliente, order.id))} target="_blank" rel="noreferrer" title={`Escribirle a ${order.cliente} por WhatsApp`} onClick={(e) => e.stopPropagation()}>
      <Icon.Whatsapp /> {order.tel}
    </a>
  );
}

function AvisoPago({ o }: { o: AdminOrder }) {
  if (o.estado === "cancelado") return null;
  if (o.pago === "transferencia" && o.pagoEstado === "pendiente") {
    return <span className="order-payment-reminder">{o.comprobanteSubidoAt ? "📎 comprobante" : "sin comprobante"}</span>;
  }
  if (o.pagoEstado === "pendiente") {
    return <span className="order-payment-reminder">{o.estado === "entregado" ? "falta registrar pago" : "pago pendiente"}</span>;
  }
  return null;
}

interface OrdersTableProps {
  pedidos: AdminOrder[];
  onAbrir: (o: AdminOrder) => void;
  onAvanzar: (o: AdminOrder, estado: string) => void;
  onImprimir: (o: AdminOrder) => void;
  imprimiendo: boolean;
  seleccionando: boolean;
  marcados: Set<string>;
  onMarcar: (id: string, marcado: boolean) => void;
  onMarcarTodos: (marcado: boolean) => void;
}

/** Una fila por pedido (~44 px); en el celular, una tarjeta. Avanzar e imprimir sin abrir el detalle. */
export function OrdersTable({ pedidos, onAbrir, onAvanzar, onImprimir, imprimiendo, seleccionando, marcados, onMarcar, onMarcarTodos }: OrdersTableProps) {
  const acciones = (o: AdminOrder, ancho = false) => {
    const sig = siguienteEstado(o);
    const cocina = esPedidoParaCocina(o);
    return (
      <>
        {sig && (
          <button className="btn-next" style={ancho ? { flex: 1, justifyContent: "center" } : undefined} onClick={(e) => { e.stopPropagation(); onAvanzar(o, sig.estado); }}>
            → {sig.etiqueta}
          </button>
        )}
        {!sig && o.pago === "mercadopago" && !cocina && o.estado !== "cancelado" && <span className="tbl-muted">tarjeta sin acreditar</span>}
        <button className="btn btn-icon btn-ghost" title={cocina ? "Imprimir comanda" : "Pago sin acreditar: la comanda está bloqueada"} aria-label={`Imprimir el pedido ${numeroCorto(o)}`} disabled={!cocina || imprimiendo} onClick={(e) => { e.stopPropagation(); onImprimir(o); }}>
          <Icon.Printer />
        </button>
      </>
    );
  };

  return (
    <>
      <div className="tbl-wrap ord-tabla">
        <table className="tbl">
          <thead>
            <tr>
              {seleccionando && <th style={{ width: 32 }}><input type="checkbox" aria-label="Seleccionar todos" checked={pedidos.length > 0 && pedidos.every((o) => marcados.has(o._dbId))} onChange={(e) => onMarcarTodos(e.target.checked)} /></th>}
              <th>#</th><th>Cliente</th><th>Pedido</th><th>Entrega</th><th>Pago</th><th className="right">Total</th><th>Estado</th><th className="right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((o) => {
              const items = resumenItems(o.items);
              return (
                <tr key={o._dbId} className={o.pagoEstado === "pendiente" && o.estado !== "cancelado" ? "order-payment-pending" : undefined} style={{ cursor: "pointer" }} onClick={() => onAbrir(o)}>
                  {seleccionando && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar el pedido ${numeroCorto(o)}`} checked={marcados.has(o._dbId)} onChange={(e) => onMarcar(o._dbId, e.target.checked)} /></td>}
                  <td className="tbl-mono tbl-strong nowrap">{numeroCorto(o)}</td>
                  <td className="nowrap"><span className="tbl-strong">{o.cliente}</span> <span className="tbl-muted">· {hace(o.fecha)}</span><div><TelCliente order={o} /></div></td>
                  <td className="ellipsis" style={{ width: "32%" }} title={o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}>{items.texto}{items.resto > 0 && <span className="tbl-muted"> +{items.resto}</span>}</td>
                  <td className="nowrap"><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{o.mode === "delivery" ? <Icon.Truck /> : <Icon.Shop />}{o.mode === "delivery" ? "Delivery" : "Retiro"}</span></td>
                  <td className="nowrap">{medio(o)}<AvisoPago o={o} /></td>
                  <td className="right tbl-price nowrap">{fmt(o.total)}</td>
                  <td className="nowrap"><span className={`chip chip-${o.estado}`}>{etiquetaEstado(o.estado, o.mode)}</span></td>
                  <td className="right nowrap"><div className="tbl-actions" style={{ alignItems: "center" }}>{acciones(o)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ord-cards">
        {pedidos.map((o) => {
          const items = resumenItems(o.items, 40);
          return (
            <div key={o._dbId} className={`ord-card ${o.pagoEstado === "pendiente" && o.estado !== "cancelado" ? "pendiente" : ""}`} onClick={() => onAbrir(o)}>
              <div className="ord-card-top"><b className="tbl-mono">{numeroCorto(o)}</b><span className={`chip chip-${o.estado}`}>{etiquetaEstado(o.estado, o.mode)}</span></div>
              <div><b>{o.cliente}</b> · {o.mode === "delivery" ? "Delivery" : "Retiro"} · <b>{fmt(o.total)}</b> <span className="tbl-muted">· {hace(o.fecha)}</span></div>
              <div className="tbl-muted ord-card-items">{items.texto}{items.resto > 0 && ` +${items.resto}`}</div>
              <div className="tbl-muted">{medio(o)}<AvisoPago o={o} /></div>
              <div className="ord-card-acciones">{acciones(o, true)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
