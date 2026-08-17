"use client";
import { useState } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fmtShort = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? Math.round(n / 1000) + "k" : String(n);
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};
void fmtShort;

export function Topbar({ title, subtitle, onMenu, right }: { title: string; subtitle: string; onMenu: () => void; right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <button className="sidebar-toggle" onClick={onMenu}><Icon.Menu /></button>
      <h1>{title}{subtitle && <small>{subtitle}</small>}</h1>
      <div className="topbar-spacer" />
      <div className="topbar-search">
        <Icon.Search />
        <input placeholder="Buscar pedido, cliente, producto…" />
        <kbd>⌘K</kbd>
      </div>
      {right}
    </header>
  );
}

export function Dashboard() {
  const { state } = useStore();
  const [now] = useState(() => Date.now());
  const today = state.orders.filter(o => (now - new Date(o.fecha).getTime()) < 86400000);
  const todayRevenue = today.filter(o => o.estado !== "cancelado").reduce((s, o) => s + o.total, 0);
  const activeOrders = state.orders.filter(o => ["nuevo", "preparando", "en-camino"].includes(o.estado)).length;
  const avgTicket = state.orders.length ? state.orders.reduce((s, o) => s + o.total, 0) / state.orders.length : 0;

  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const seed = [42, 58, 61, 73, 128, 156, 118];
  const maxRev = Math.max(...seed);

  const counts: Record<string, number> = {};
  state.orders.forEach(o => o.items.forEach(i => { counts[i.name] = (counts[i.name] || 0) + i.qty; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon"><Icon.Revenue /></div>Ventas hoy</div>
          <div className="kpi-value">{fmt(todayRevenue)}</div>
          <span className="kpi-delta up">↑ 14,2% vs ayer</span>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "var(--a-info-soft)", color: "var(--a-info)" }}><Icon.Orders /></div>Pedidos hoy</div>
          <div className="kpi-value">{today.length}</div>
          <span className="kpi-delta up">↑ 3 más que ayer</span>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "var(--a-warn-soft)", color: "var(--a-warn)" }}><Icon.Clock /></div>En preparación</div>
          <div className="kpi-value">{activeOrders}</div>
          <span className="kpi-delta" style={{ background: "var(--a-bg-2)", color: "var(--a-muted)" }}>Requieren atención</span>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "#ede5fa", color: "#6b3fbf" }}><Icon.Box /></div>Ticket promedio</div>
          <div className="kpi-value">{fmt(avgTicket)}</div>
          <span className="kpi-delta down">↓ 2,1% esta semana</span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Ventas últimos 7 días</h3>
            <div className="panel-head-spacer" />
            <div className="seg"><button className="active">7d</button><button>30d</button><button>90d</button></div>
          </div>
          <div className="panel-body" style={{ paddingBottom: 36 }}>
            <div className="chart">
              {seed.map((v, i) => (
                <div key={i} className="chart-bar" style={{ height: (v / maxRev * 100) + "%" }} data-label={days[i]}>
                  <span className="val">{fmt(v * 1000)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Top productos</h3></div>
          <div className="panel-body" style={{ padding: 8 }}>
            <div className="top-list">
              {top.map(([name, qty], i) => (
                <div className="top-row" key={name}>
                  <div className="top-rank">{i + 1}</div>
                  <div><b>{name}</b><small>{qty} unidades vendidas</small></div>
                  <div className="top-val">×{qty}</div>
                </div>
              ))}
              {top.length === 0 && <div style={{ padding: 20, color: "var(--a-muted)", fontSize: 13 }}>Sin datos de pedidos aún</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="panel mt-20">
        <div className="panel-head">
          <h3>Pedidos recientes</h3>
          <div className="panel-head-spacer" />
        </div>
        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Pedido</th><th>Cliente</th><th>Items</th><th>Modalidad</th><th className="right">Total</th><th>Estado</th><th>Hace</th></tr>
              </thead>
              <tbody>
                {state.orders.slice(0, 5).map(o => (
                  <tr key={o.id}>
                    <td className="tbl-mono tbl-strong">{o.id}</td>
                    <td>{o.cliente}</td>
                    <td className="tbl-muted">{o.items.length} ítem{o.items.length !== 1 ? "s" : ""}</td>
                    <td>{o.mode === "delivery" ? "Delivery" : "Retiro"}</td>
                    <td className="right tbl-price">{fmt(o.total)}</td>
                    <td><span className={`chip chip-${o.estado}`}>{o.estado.replace("-", " ")}</span></td>
                    <td className="tbl-muted text-mono">{timeAgo(o.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.orders.length === 0 && (
              <div className="empty"><div className="empty-icon"><Icon.Orders /></div><b>Sin pedidos</b><div>Los pedidos del sitio aparecerán aquí</div></div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
