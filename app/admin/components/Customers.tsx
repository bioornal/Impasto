"use client";
import { useState, useMemo } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { pedidosDelCliente } from "@/lib/adapt-customer";
import { enlaceWhatsapp, mensajeAlCliente, whatsappDeCliente } from "@/lib/contacto";
import type { AdminCustomer } from "./types";

const fmt = (n: number) => "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const timeAgo = (iso: string | null) => {
  if (!iso) return "Sin compra documentada";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};
const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function Customers() {
  const { state, reloadCustomers } = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recientes");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...state.customers];
    if (q.trim()) list = list.filter(c => (c.nombre + " " + c.tel + " " + c.email).toLowerCase().includes(q.toLowerCase()));
    if (sort === "recientes") list.sort((a, b) => (b.ultimo ? Date.parse(b.ultimo) : 0) - (a.ultimo ? Date.parse(a.ultimo) : 0));
    if (sort === "pedidos") list.sort((a, b) => b.pedidos - a.pedidos);
    if (sort === "total") list.sort((a, b) => b.total - a.total);
    return list;
  }, [state.customers, q, sort]);

  const selectedCustomer = !state.customersError ? state.customers.find(c => c.id === selected) : undefined;
  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <select aria-label="Ordenar clientes" className="select-input" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="recientes">Ordenar: Últimas compras</option>
              <option value="pedidos">Ordenar: Más compras</option>
              <option value="total">Ordenar: Mayor neto cobrado</option>
            </select>
          </div>
          <button type="button" className="btn btn-ghost" disabled={state.customersLoading} onClick={() => void reloadCustomers()}>{state.customersLoading ? "Actualizando…" : "Actualizar compras"}</button>
          <div className="panel-head-spacer" />
          <div className="search-input">
            <Icon.Search />
            <input aria-label="Buscar cliente por nombre, teléfono o email" placeholder="Buscar cliente…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div style={{ padding: "12px 18px", fontSize: 12, color: "var(--a-muted)" }}>
          Compras con neto cobrado documentado positivo; una devolución total deja de contar y una parcial conserva el neto.
          <div role="status">{state.customersLoading ? "Consultando compras…" : state.customersUpdatedAt ? `Última actualización: ${fmtDateTime(state.customersUpdatedAt)}. Actualizá para consultar cambios recientes.` : "Sin lectura confirmada del CRM."}</div>
        </div>
        {state.customersError && <div role="alert" style={{ padding: "12px 18px", color: "var(--a-danger)" }}><b>Compras no disponibles.</b> {state.customersError} Usá Actualizar compras para reintentar.</div>}
        {!state.customersError && <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Cliente</th><th>Contacto</th><th>Zona</th><th>Notas</th><th className="right">Compras</th><th className="right">Neto cobrado</th><th>Última compra</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setSelected(c.id)}>
                    <td>
                      <div className="flex" style={{ alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ background: "var(--a-bg-2)", color: "var(--a-ink)" }}>{c.nombre[0]}</div>
                        <div className="tbl-strong">{c.nombre}</div>
                      </div>
                    </td>
                    <td><div className="tbl-mono" style={{ fontSize: 12 }}>{c.tel}</div><div className="tbl-muted" style={{ fontSize: 12 }}>{c.email}</div></td>
                    <td className="tbl-muted" style={{ textTransform: "capitalize" }}>{c.zona?.replace(/-/g, " ")}</td>
                    <td className="tbl-muted">{c.notas || "—"}</td>
                    <td className="right tbl-strong">{c.pedidos}{c.comprasSinImporte > 0 && <div className="tbl-muted" style={{ fontSize: 11 }}>{c.comprasSinImporte} sin importe documentado</div>}</td>
                    <td className="right tbl-price">{fmt(c.total)}</td>
                    <td className="tbl-muted text-mono">{timeAgo(c.ultimo)}</td>
                    <td className="right"><button type="button" aria-label={`Ver contacto y compras de ${c.nombre}`} className="btn btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setSelected(c.id); }}><Icon.Eye /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!state.customersLoading && filtered.length === 0 && <div className="empty"><div className="empty-icon"><Icon.Users /></div><b>Sin resultados</b><div>Ningún cliente coincide con la búsqueda</div></div>}
          </div>
        </div>}
      </div>
      {selectedCustomer && <CustomerDetail customer={selectedCustomer} onClose={() => setSelected(null)} />}
    </>
  );
}

function CustomerDetail({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  const { state } = useStore();
  const history = pedidosDelCliente(state.orders, customer.tel);
  const whatsapp = whatsappDeCliente(customer.tel);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" role="dialog" aria-labelledby="crm-cliente-titulo" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="avatar" style={{ background: "var(--a-accent)", color: "white", width: 44, height: 44, fontSize: 18 }}>{customer.nombre[0]}</div>
          <div className="grow"><h3 id="crm-cliente-titulo">{customer.nombre}</h3><small>{customer.tel} · {customer.email}</small></div>
          <button type="button" aria-label="Cerrar detalle del cliente" className="btn btn-icon btn-ghost" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 18 }}>
            <div className="kpi"><div className="kpi-label">Compras</div><div className="kpi-value" style={{ fontSize: 26 }}>{customer.pedidos}</div></div>
            <div className="kpi"><div className="kpi-label">Neto cobrado</div><div className="kpi-value" style={{ fontSize: 22 }}>{fmt(customer.total)}</div></div>
            <div className="kpi"><div className="kpi-label">Ticket prom.</div><div className="kpi-value" style={{ fontSize: 22 }}>{fmt(customer.pedidos ? customer.total / customer.pedidos : 0)}</div></div>
          </div>

          {customer.comprasSinImporte > 0 && <p role="status" style={{ color: "var(--a-danger)", fontSize: 12 }}>{customer.comprasSinImporte} pedido(s) parcialmente reembolsados sin importes documentados. Están fuera del conteo y neto hasta conciliar.</p>}
          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12 }}>Datos</h4>
          <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, display: "flex", flexDirection: "column", gap: 8 }}>
            <div><b style={{ color: "var(--a-muted)", fontSize: 11, textTransform: "uppercase", fontFamily: "var(--a-font-mono)", letterSpacing: ".1em" }}>Dirección</b><br />{customer.dir || "—"}</div>
            <div><b style={{ color: "var(--a-muted)", fontSize: 11, textTransform: "uppercase", fontFamily: "var(--a-font-mono)", letterSpacing: ".1em" }}>Notas del contacto</b><br />{customer.notas || "—"}</div>
          </div>

          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12, marginTop: 20 }}>Pedidos cargados con este teléfono</h4>
          <p className="text-muted" style={{ fontSize: 12 }}>Esta muestra contiene los pedidos cargados en el panel. Sus totales son importes del pedido; las compras y el neto se consultan por separado en el historial completo.</p>
          {history.length === 0
            ? <div className="empty" style={{ padding: 30 }}><div className="text-muted">Sin pedidos de este teléfono en la muestra cargada</div></div>
            : <div className="od-items">
                {history.map(o => (
                  <div className="od-row" key={o._dbId}>
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
          {whatsapp
            ? <a className="btn btn-ghost" href={enlaceWhatsapp(whatsapp, mensajeAlCliente(customer.nombre))} target="_blank" rel="noreferrer"><Icon.Whatsapp /> WhatsApp</a>
            : <span className="text-muted" style={{ fontSize: 12 }}>Número incompleto: sin WhatsApp</span>}
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
