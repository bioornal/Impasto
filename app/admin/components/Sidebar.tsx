"use client";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";

interface SidebarProps {
  current: string;
  onNav: (page: string) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ current, onNav, open, onClose }: SidebarProps) {
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
        <div className="sidebar-brand-name">Impasto<small>admin panel</small></div>
      </div>

      <div className="nav-section">Operación</div>
      {items.map(i => (
        <div key={i.key} className={`nav-item ${current === i.key ? "active" : ""}`} onClick={() => { onNav(i.key); onClose(); }}>
          {i.icon}
          <span>{i.label}</span>
          {(i.badge ?? 0) > 0 && <span className="badge">{i.badge}</span>}
        </div>
      ))}

      <div className="nav-section" style={{ marginTop: 18 }}>Otros</div>
      <a className="nav-item" href="/" target="_blank">
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
