"use client";
import { useState } from "react";
import { StoreProvider } from "./components/StoreProvider";
import { Sidebar } from "./components/Sidebar";
import { Topbar, Dashboard } from "./components/Dashboard";
import { Orders } from "./components/Orders";
import { Products } from "./components/Products";
import { Etiquetas } from "./components/Etiquetas";
import { Customers } from "./components/Customers";
import { Testimonials } from "./components/Testimonials";
import { Settings } from "./components/Settings";

type Page = "dashboard" | "orders" | "products" | "etiquetas" | "customers" | "testimonials" | "settings";

const TITLES: Record<Page, [string, string]> = {
  dashboard:    ["Dashboard",      "Un vistazo general de tu negocio"],
  orders:       ["Pedidos",        "Administrá los pedidos entrantes"],
  products:     ["Productos",      "Tu carta de pizzas, empanadas y bebidas"],
  etiquetas:    ["Etiquetas",      "Los cartelitos que aparecen en las tarjetas del sitio"],
  customers:    ["Clientes",       "Base de clientes y su historial"],
  testimonials: ["Testimonios",    "Moderá las reseñas que aparecen en el sitio"],
  settings:     ["Configuración",  "Datos del local y zonas de envío"],
};

function AdminApp() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [title, subtitle] = TITLES[page];

  return (
    <div className="admin">
      <Sidebar current={page} onNav={(p) => setPage(p as Page)} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenu={() => setSidebarOpen(true)}
          right={page === "dashboard" ? (
            <a className="btn btn-ghost" href="/" target="_blank">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Ver sitio
            </a>
          ) : undefined}
        />
        <div className="content">
          {page === "dashboard"    && <Dashboard />}
          {page === "orders"       && <Orders />}
          {page === "products"     && <Products />}
          {page === "etiquetas"    && <Etiquetas />}
          {page === "customers"    && <Customers />}
          {page === "testimonials" && <Testimonials />}
          {page === "settings"     && <Settings />}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <StoreProvider>
      <AdminApp />
    </StoreProvider>
  );
}
