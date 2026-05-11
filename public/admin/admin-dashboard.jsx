/* global React, AdminCore */
const { useState, useMemo } = React;
const { fmt, fmtShort, timeAgo, fmtDateTime, useStore, Icon, ProductThumb } = window.AdminCore;

/* ============ SIDEBAR ============ */
function Sidebar({ current, onNav, open, onClose }) {
  const { state } = useStore();
  const newOrders = state.orders.filter(o => o.estado === "nuevo").length;
  const pendingReviews = state.testimonials.filter(t => t.estado === "pendiente").length;

  const items = [
    { key: "dashboard", label: "Dashboard", icon: <Icon.Dashboard /> },
    { key: "orders", label: "Pedidos", icon: <Icon.Orders />, badge: newOrders },
    { key: "products", label: "Productos", icon: <Icon.Pizza /> },
    { key: "customers", label: "Clientes", icon: <Icon.Users /> },
    { key: "testimonials", label: "Testimonios", icon: <Icon.Star />, badge: pendingReviews },
  ];

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand">
        <div className="logo-mark">I</div>
        <div className="sidebar-brand-name">
          Impasto<small>admin panel</small>
        </div>
      </div>

      <div className="nav-section">Operación</div>
      {items.map(i => (
        <div key={i.key} className={`nav-item ${current === i.key ? "active" : ""}`} onClick={() => { onNav(i.key); onClose(); }}>
          {i.icon}
          <span>{i.label}</span>
          {i.badge > 0 && <span className="badge">{i.badge}</span>}
        </div>
      ))}

      <div className="nav-section" style={{ marginTop: 18 }}>Otros</div>
      <a className="nav-item" href="Impasto.html" target="_blank">
        <Icon.ExternalLink />
        <span>Ver sitio público</span>
      </a>
      <div className={`nav-item ${current === "settings" ? "active" : ""}`} onClick={() => { onNav("settings"); onClose(); }}>
        <Icon.Settings />
        <span>Configuración</span>
      </div>

      <div className="sidebar-footer">
        <div className="avatar">M</div>
        <div className="sidebar-footer-info">
          <b>Mauro</b>
          <small>Dueño · admin</small>
        </div>
      </div>
    </aside>
  );
}

/* ============ TOPBAR ============ */
function Topbar({ title, subtitle, onMenu, right }) {
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

/* ============ DASHBOARD ============ */
function Dashboard() {
  const { state } = useStore();
  const today = state.orders.filter(o => (Date.now() - new Date(o.fecha).getTime()) < 86400000);
  const todayRevenue = today.filter(o => o.estado !== "cancelado").reduce((s, o) => s + o.total, 0);
  const activeOrders = state.orders.filter(o => ["nuevo", "preparando", "en-camino"].includes(o.estado)).length;
  const avgTicket = state.orders.length ? state.orders.reduce((s, o) => s + o.total, 0) / state.orders.length : 0;

  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const seed = [42, 58, 61, 73, 128, 156, 118];

  const counts = {};
  state.orders.forEach(o => o.items.forEach(i => {
    counts[i.name] = (counts[i.name] || 0) + i.qty;
  }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const maxRev = Math.max(...seed);

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">
            <div className="kpi-icon"><Icon.Revenue /></div>
            Ventas hoy
          </div>
          <div className="kpi-value">{fmt(todayRevenue)}</div>
          <span className="kpi-delta up">↑ 14,2% vs ayer</span>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <div className="kpi-icon" style={{ background: "var(--a-info-soft)", color: "var(--a-info)" }}><Icon.Orders /></div>
            Pedidos hoy
          </div>
          <div className="kpi-value">{today.length}</div>
          <span className="kpi-delta up">↑ 3 más que ayer</span>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <div className="kpi-icon" style={{ background: "var(--a-warn-soft)", color: "var(--a-warn)" }}><Icon.Clock /></div>
            En preparación
          </div>
          <div className="kpi-value">{activeOrders}</div>
          <span className="kpi-delta" style={{ background: "var(--a-bg-2)", color: "var(--a-muted)" }}>Requieren atención</span>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <div className="kpi-icon" style={{ background: "#ede5fa", color: "#6b3fbf" }}><Icon.Box /></div>
            Ticket promedio
          </div>
          <div className="kpi-value">{fmt(avgTicket)}</div>
          <span className="kpi-delta down">↓ 2,1% esta semana</span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Ventas últimos 7 días</h3>
            <div className="panel-head-spacer" />
            <div className="seg">
              <button className="active">7d</button>
              <button>30d</button>
              <button>90d</button>
            </div>
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
          <div className="panel-head">
            <h3>Top productos</h3>
          </div>
          <div className="panel-body" style={{ padding: 8 }}>
            <div className="top-list">
              {top.map(([name, qty], i) => (
                <div className="top-row" key={name}>
                  <div className="top-rank">{i + 1}</div>
                  <div>
                    <b>{name}</b>
                    <small>{qty} unidades vendidas</small>
                  </div>
                  <div className="top-val">×{qty}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel mt-20">
        <div className="panel-head">
          <h3>Pedidos recientes</h3>
          <div className="panel-head-spacer" />
          <button className="btn btn-ghost btn-sm">Ver todos <Icon.Arrow /></button>
        </div>
        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Items</th>
                  <th>Modalidad</th>
                  <th className="right">Total</th>
                  <th>Estado</th>
                  <th>Hace</th>
                </tr>
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
          </div>
        </div>
      </div>
    </>
  );
}

window.AdminDashboard = { Sidebar, Topbar, Dashboard };
