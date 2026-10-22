"use client";
import { useRouter } from "next/navigation";
import { useStore } from "./StoreProvider";
import { useAdminSesion } from "./AdminSesion";
import { Icon } from "./Icons";
import type { SeccionAdmin } from "@/lib/inicio-admin";

interface SidebarProps {
  current: SeccionAdmin;
  onNav: (seccion: SeccionAdmin) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ current, onNav, open, onClose }: SidebarProps) {
  const router = useRouter();
  const { state } = useStore();
  const { email } = useAdminSesion();
  const nuevos = state.orders.filter((o) => o.estado === "nuevo").length;
  const opinionesPendientes = state.testimonials.filter((t) => t.estado === "pendiente").length;

  const grupos: { titulo: string; items: { key: SeccionAdmin; label: string; icon: React.ReactNode; badge?: number }[] }[] = [
    { titulo: "Esta noche", items: [
      { key: "arranque", label: "Arranque", icon: <Icon.Power /> },
      { key: "pedidos", label: "Pedidos", icon: <Icon.Orders />, badge: nuevos },
      { key: "resumen", label: "Resumen diario", icon: <Icon.Calendar /> },
    ] },
    { titulo: "Carta", items: [
      { key: "productos", label: "Productos", icon: <Icon.Pizza /> },
      { key: "etiquetas", label: "Etiquetas", icon: <Icon.Tag /> },
    ] },
    { titulo: "Negocio", items: [
      { key: "dashboard", label: "Dashboard", icon: <Icon.Dashboard /> },
      { key: "clientes", label: "Clientes", icon: <Icon.Users /> },
      { key: "testimonios", label: "Testimonios", icon: <Icon.Star />, badge: opinionesPendientes },
    ] },
    { titulo: "Ajustes", items: [
      { key: "configuracion", label: "Configuración", icon: <Icon.Settings /> },
    ] },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="logo-mark">I</div>
          <div className="sidebar-brand-name">Impasto<small>Panel</small></div>
        </div>
        {grupos.map((g) => (
          <div key={g.titulo}>
            <div className="nav-group">{g.titulo}</div>
            {g.items.map((i) => (
              <button key={i.key} className={`nav-item ${current === i.key ? "active" : ""}`} aria-current={current === i.key ? "page" : undefined} onClick={() => { onNav(i.key); onClose(); }}>
                {i.icon}<span>{i.label}</span>{(i.badge ?? 0) > 0 && <span className="badge">{i.badge}</span>}
              </button>
            ))}
          </div>
        ))}
        <a className="nav-item" href="/" target="_blank" rel="noreferrer"><Icon.ExternalLink /><span>Ver sitio público</span></a>
        <div className="sidebar-footer">
          <div className="sidebar-footer-info"><b title={email}>{email || "Sesión iniciada"}</b><small>Administrador</small></div>
          <button className="sidebar-signout" title="Cerrar sesión" onClick={async () => { await fetch("/api/auth/sign-out", { method: "POST" }); router.replace("/admin-login"); router.refresh(); }}>Salir</button>
        </div>
      </aside>
    </>
  );
}
