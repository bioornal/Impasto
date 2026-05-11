"use client";
import { useState, useMemo } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import type { AdminCustomer } from "./types";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};
const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function Customers() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recientes");
  const [selected, setSelected] = useState<AdminCustomer | null>(null);

  const filtered = useMemo(() => {
    let list = [...state.customers];
    if (q.trim()) list = list.filter(c => (c.nombre + " " + c.tel + " " + c.email).toLowerCase().includes(q.toLowerCase()));
    if (sort === "recientes") list.sort((a, b) => new Date(b.ultimo).getTime() - new Date(a.ultimo).getTime());
    if (sort === "pedidos") list.sort((a, b) => b.pedidos - a.pedidos);
    if (sort === "total") list.sort((a, b) => b.total - a.total);
    return list;
  }, [state.customers, q, sort]);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <select className="select-input" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="recientes">Ordenar: Últimos pedidos</option>
              <option value="pedidos">Ordenar: Más pedidos</option>
              <option value="total">Ordenar: Mayor facturación</option>
            </select>
          </div>
          <div className="panel-head-spacer" />
          <div className="search-input">
            <Icon.Search />
            <input placeholder="Buscar cliente…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Cliente</th><th>Contacto</th><th>Zona</th><th>Favorito</th><th className="right">Pedidos</th><th className="right">Total</th><th>Último</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setSelected(c)}>
                    <td>
                      <div className="flex" style={{ alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ background: "var(--a-bg-2)", color: "var(--a-ink)" }}>{c.nombre[0]}</div>
                        <div className="tbl-strong">{c.nombre}</div>
                      </div>
                    </td>
                    <td><div className="tbl-mono" style={{ fontSize: 12 }}>{c.tel}</div><div className="tbl-muted" style={{ fontSize: 12 }}>{c.email}</div></td>
                    <td className="tbl-muted" style={{ textTransform: "capitalize" }}>{c.zona?.replace(/-/g, " ")}</td>
                    <td className="tbl-muted">{c.fav}</td>
                    <td className="right tbl-strong">{c.pedidos}</td>
                    <td className="right tbl-price">{fmt(c.total)}</td>
                    <td className="tbl-muted text-mono">{timeAgo(c.ultimo)}</td>
                    <td className="right"><button className="btn btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setSelected(c); }}><Icon.Eye /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty"><div className="empty-icon"><Icon.Users /></div><b>Sin resultados</b><div>Ningún cliente coincide con la búsqueda</div></div>}
          </div>
        </div>
      </div>
      {selected && <CustomerDetail customer={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function CustomerDetail({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  const { state } = useStore();
  const history = state.orders.filter(o => o.cliente === customer.nombre);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="avatar" style={{ background: "var(--a-accent)", color: "white", width: 44, height: 44, fontSize: 18 }}>{customer.nombre[0]}</div>
          <div className="grow"><h3>{customer.nombre}</h3><small>{customer.tel} · {customer.email}</small></div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 18 }}>
            <div className="kpi"><div className="kpi-label">Pedidos</div><div className="kpi-value" style={{ fontSize: 26 }}>{customer.pedidos}</div></div>
            <div className="kpi"><div className="kpi-label">Facturado</div><div className="kpi-value" style={{ fontSize: 22 }}>{fmt(customer.total)}</div></div>
            <div className="kpi"><div className="kpi-label">Ticket prom.</div><div className="kpi-value" style={{ fontSize: 22 }}>{fmt(customer.pedidos ? customer.total / customer.pedidos : 0)}</div></div>
          </div>

          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12 }}>Datos</h4>
          <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, display: "flex", flexDirection: "column", gap: 8 }}>
            <div><b style={{ color: "var(--a-muted)", fontSize: 11, textTransform: "uppercase", fontFamily: "var(--a-font-mono)", letterSpacing: ".1em" }}>Dirección</b><br />{customer.dir || "—"}</div>
            <div><b style={{ color: "var(--a-muted)", fontSize: 11, textTransform: "uppercase", fontFamily: "var(--a-font-mono)", letterSpacing: ".1em" }}>Producto favorito</b><br />{customer.fav}</div>
          </div>

          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12, marginTop: 20 }}>Historial de pedidos</h4>
          {history.length === 0
            ? <div className="empty" style={{ padding: 30 }}><div className="text-muted">Sin pedidos registrados</div></div>
            : <div className="od-items">
                {history.map(o => (
                  <div className="od-row" key={o.id}>
                    <div>
                      <span className="tbl-mono tbl-strong">{o.id}</span>
                      <div className="text-muted" style={{ fontSize: 12 }}>{fmtDateTime(o.fecha)} · {o.items.length} ítem{o.items.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="tbl-price">{fmt(o.total)}</div>
                      <span className={`chip chip-${o.estado}`}>{o.estado.replace("-", " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
        <div className="modal-foot">
          <a className="btn btn-ghost" href={`https://wa.me/54${customer.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
