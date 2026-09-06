"use client";
import { useState } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};

export function Topbar({ title, subtitle, onMenu, right }: { title: string; subtitle: string; onMenu: () => void; right?: React.ReactNode }) {
  const { soundEnabled, toggleSound } = useStore();
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
      <button
        className={`btn btn-sm ${soundEnabled ? "btn-ghost" : "btn-muted"}`}
        onClick={toggleSound}
        title={soundEnabled ? "Notificaciones sonoras activas (clic para silenciar)" : "Notificaciones sonoras silenciadas (clic para activar)"}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px" }}
      >
        {soundEnabled ? <Icon.Volume2 /> : <Icon.VolumeX />}
        <span style={{ fontSize: 12 }}>{soundEnabled ? "Sonido ON" : "Silenciado"}</span>
      </button>
      {right}
    </header>
  );
}

export function Dashboard() {
  const { state } = useStore();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  // Calcs for today and yesterday
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  const validOrders = state.orders.filter(o => o.estado !== "cancelado");
  const todayOrders = validOrders.filter(o => new Date(o.fecha).getTime() >= startOfToday);
  const yesterdayOrders = validOrders.filter(o => {
    const t = new Date(o.fecha).getTime();
    return t >= startOfYesterday && t < startOfToday;
  });

  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + o.total, 0);

  const revDiff = todayRevenue - yesterdayRevenue;
  const revPct = yesterdayRevenue > 0
    ? Math.round((revDiff / yesterdayRevenue) * 100)
    : todayRevenue > 0 ? 100 : 0;

  const ordersDiff = todayOrders.length - yesterdayOrders.length;
  const activeOrders = state.orders.filter(o => ["nuevo", "preparando", "en-camino"].includes(o.estado)).length;
  const avgTicket = validOrders.length ? validOrders.reduce((s, o) => s + o.total, 0) / validOrders.length : 0;

  // Chart calculation based on selected period
  const dayCount = period === "7d" ? 7 : period === "30d" ? 14 : 30;
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const chartBars = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (dayCount - 1 - i));
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const rev = validOrders
      .filter(o => {
        const t = new Date(o.fecha).getTime();
        return t >= dayStart && t < dayEnd;
      })
      .reduce((s, o) => s + o.total, 0);

    return {
      label: period === "7d" ? dayNames[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`,
      rev,
    };
  });

  const maxChartRev = Math.max(...chartBars.map(b => b.rev), 1);

  // Top products from non-cancelled orders
  const counts: Record<string, number> = {};
  validOrders.forEach(o => o.items.forEach(i => { counts[i.name] = (counts[i.name] || 0) + i.qty; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon"><Icon.Revenue /></div>Ventas hoy</div>
          <div className="kpi-value">{fmt(todayRevenue)}</div>
          <span className={`kpi-delta ${revDiff >= 0 ? "up" : "down"}`}>
            {yesterdayRevenue > 0
              ? `${revDiff >= 0 ? "↑" : "↓"} ${Math.abs(revPct)}% vs ayer`
              : todayRevenue > 0
              ? "↑ Primera venta hoy"
              : "Sin ventas hoy aún"}
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "var(--a-info-soft)", color: "var(--a-info)" }}><Icon.Orders /></div>Pedidos hoy</div>
          <div className="kpi-value">{todayOrders.length}</div>
          <span className={`kpi-delta ${ordersDiff >= 0 ? "up" : "down"}`}>
            {ordersDiff > 0
              ? `↑ ${ordersDiff} más que ayer`
              : ordersDiff < 0
              ? `↓ ${Math.abs(ordersDiff)} menos que ayer`
              : "= igual que ayer"}
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "var(--a-warn-soft)", color: "var(--a-warn)" }}><Icon.Clock /></div>En preparación</div>
          <div className="kpi-value">{activeOrders}</div>
          <span className="kpi-delta" style={{ background: "var(--a-bg-2)", color: "var(--a-muted)" }}>
            {activeOrders > 0 ? "Requieren atención" : "Al día"}
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "#ede5fa", color: "#6b3fbf" }}><Icon.Box /></div>Ticket promedio</div>
          <div className="kpi-value">{fmt(avgTicket)}</div>
          <span className="kpi-delta" style={{ background: "var(--a-bg-2)", color: "var(--a-muted)" }}>
            {validOrders.length} pedido{validOrders.length !== 1 ? "s" : ""} facturado{validOrders.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Ventas {period === "7d" ? "últimos 7 días" : period === "30d" ? "últimos 14 días" : "últimos 30 días"}</h3>
            <div className="panel-head-spacer" />
            <div className="seg">
              <button className={period === "7d" ? "active" : ""} onClick={() => setPeriod("7d")}>7d</button>
              <button className={period === "30d" ? "active" : ""} onClick={() => setPeriod("30d")}>14d</button>
              <button className={period === "90d" ? "active" : ""} onClick={() => setPeriod("90d")}>30d</button>
            </div>
          </div>
          <div className="panel-body" style={{ paddingBottom: 36 }}>
            <div className="chart">
              {chartBars.map((b, i) => (
                <div
                  key={i}
                  className="chart-bar"
                  style={{ height: b.rev > 0 ? `${Math.max(10, (b.rev / maxChartRev) * 100)}%` : "4px" }}
                  data-label={b.label}
                  title={`${b.label}: ${fmt(b.rev)}`}
                >
                  <span className="val">{b.rev > 0 ? fmt(b.rev) : "$0"}</span>
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
