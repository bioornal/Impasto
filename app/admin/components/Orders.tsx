"use client";
import { useState, useMemo } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import type { AdminOrder } from "./types";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};
const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const FILTERS: [string, string][] = [["todos","Todos"],["nuevo","Nuevos"],["preparando","Preparando"],["en-camino","En camino"],["entregado","Entregados"],["cancelado","Cancelados"]];

export function Orders() {
  const { state, updateOrderStatus } = useStore();
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const filtered = useMemo(() => {
    let list = state.orders;
    if (filter !== "todos") list = list.filter(o => o.estado === filter);
    if (q.trim()) list = list.filter(o => (o.id + " " + o.cliente + " " + o.tel).toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [state.orders, filter, q]);

  const counts: Record<string, number> = { todos: state.orders.length };
  ["nuevo","preparando","en-camino","entregado","cancelado"].forEach(k => { counts[k] = state.orders.filter(o => o.estado === k).length; });

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <div className="seg">
              {FILTERS.map(([k, l]) => (
                <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>
                  {l}<span className="count">{counts[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="panel-head-spacer" />
          <div className="search-input">
            <Icon.Search />
            <input placeholder="Buscar N° de orden o cliente…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Orden</th><th>Cliente</th><th>Items</th><th>Modalidad</th><th>Pago</th><th className="right">Total</th><th>Estado</th><th>Hace</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setSelected(o)}>
                    <td className="tbl-mono tbl-strong">{o.id}</td>
                    <td><div className="tbl-strong">{o.cliente}</div><div className="tbl-muted">{o.tel}</div></td>
                    <td className="tbl-muted">{o.items.map(i => `${i.qty}× ${i.name}`).join(", ").slice(0, 40)}…</td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{o.mode === "delivery" ? <Icon.Truck /> : <Icon.Shop />}{o.mode === "delivery" ? "Delivery" : "Retiro"}</span></td>
                    <td className="tbl-muted" style={{ textTransform: "capitalize" }}>{o.pago === "mercadopago" ? "MercadoPago" : o.pago}</td>
                    <td className="right tbl-price">{fmt(o.total)}</td>
                    <td><span className={`chip chip-${o.estado}`}>{o.estado.replace("-", " ")}</span></td>
                    <td className="tbl-muted text-mono">{timeAgo(o.fecha)}</td>
                    <td className="right"><button className="btn btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setSelected(o); }}><Icon.Eye /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty"><div className="empty-icon"><Icon.Orders /></div><b>Sin pedidos</b><div>No hay pedidos con ese filtro</div></div>}
          </div>
        </div>
      </div>

      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onUpdate={(estado) => { updateOrderStatus(selected.id, estado); setSelected({ ...selected, estado }); }}
        />
      )}
    </>
  );
}

function OrderDetail({ order, onClose, onUpdate }: { order: AdminOrder; onClose: () => void; onUpdate: (estado: string) => void }) {
  const steps = ["nuevo", "preparando", "en-camino", "entregado"];
  const currentIdx = steps.indexOf(order.estado);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="grow"><h3>Orden {order.id}</h3><small>{fmtDateTime(order.fecha)} · {timeAgo(order.fecha)}</small></div>
          <span className={`chip chip-${order.estado}`}>{order.estado.replace("-", " ")}</span>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12 }}>Seguimiento</h4>
          <div className="timeline">
            {[["nuevo","Pedido recibido"],["preparando","En preparación"],["en-camino", order.mode === "delivery" ? "En camino" : "Listo para retirar"],["entregado","Entregado"]].map(([k, l], i) => (
              <div key={k} className={`tl-item ${i < currentIdx ? "done" : i === currentIdx ? "active" : ""}`}>
                <b>{l}</b>
                <small>{i <= currentIdx ? timeAgo(new Date(Date.now() - (currentIdx - i) * 600000).toISOString()) : "pendiente"}</small>
              </div>
            ))}
          </div>

          {order.estado !== "entregado" && order.estado !== "cancelado" && (
            <div className="flex gap-8 mt-12" style={{ flexWrap: "wrap" }}>
              {currentIdx < 3 && (
                <button className="btn btn-primary" onClick={() => onUpdate(steps[currentIdx + 1])}>
                  <Icon.Arrow /> Marcar como &ldquo;{steps[currentIdx + 1].replace("-", " ")}&rdquo;
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => onUpdate("cancelado")}>Cancelar pedido</button>
            </div>
          )}

          <div className="od-customer">
            <div className="avatar" style={{ background: "var(--a-accent)", color: "white" }}>{order.cliente[0]}</div>
            <div className="grow"><b>{order.cliente}</b><div className="text-muted text-mono" style={{ fontSize: 12 }}>{order.tel}</div></div>
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/54${order.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>

          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12, marginTop: 20 }}>Detalle</h4>
          <div className="od-items">
            {order.items.map((i, idx) => <div className="od-row" key={idx}><span>{i.qty}× {i.name}</span><span className="tbl-price">{fmt(i.price * i.qty)}</span></div>)}
            <div className="od-row"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {order.shipping > 0 && <div className="od-row"><span>Envío</span><span>{fmt(order.shipping)}</span></div>}
            <div className="od-row tot"><span>Total</span><span>{fmt(order.total)}</span></div>
          </div>

          {order.mode === "delivery" && (
            <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, marginTop: 16 }}>
              {order.dir}
            </div>
          )}
          {order.notas && (
            <div style={{ padding: 14, background: "var(--a-warn-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--a-warn)", marginTop: 12 }}>{order.notas}</div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Imprimir comanda</button>
        </div>
      </div>
    </div>
  );
}
