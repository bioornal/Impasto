"use client";
import { useEffect, useState } from "react";
import { StoreProvider } from "./components/StoreProvider";
import { SucursalProvider, useSucursal } from "./components/SucursalProvider";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Dashboard } from "./components/Dashboard";
import { Orders } from "./components/Orders";
import { NotificationsRecovery } from "./components/NotificationsRecovery";
import { Products } from "./components/Products";
import { Etiquetas } from "./components/Etiquetas";
import { Customers } from "./components/Customers";
import { Testimonials } from "./components/Testimonials";
import { Settings } from "./components/Settings";
import { ResumenDiario } from "./components/ResumenDiario";
import { Arranque } from "./components/Arranque";
import { seccionInicial, type SeccionAdmin } from "@/lib/inicio-admin";

const CLAVE_SECCION = "impasto_admin_seccion";

const TITLES: Record<SeccionAdmin, [string, string]> = {
  arranque:      ["Arranque de la noche", "Venta, delivery, masas, cupos y pedidos activos"],
  pedidos:       ["Pedidos", "Los pedidos de la web y del POS"],
  resumen:       ["Resumen diario", "Pizzas, pedidos y cobros de cada noche"],
  productos:     ["Productos", "Pizzas, empanadas y bebidas de la carta"],
  etiquetas:     ["Etiquetas", "Los cartelitos de las tarjetas del sitio"],
  dashboard:     ["Dashboard", "Cómo vienen las ventas"],
  clientes:      ["Clientes", "Base de clientes y su historial"],
  testimonios:   ["Testimonios", "Opiniones que aparecen en el sitio"],
  configuracion: ["Configuración", "Horario, delivery, datos del local y cuentas"],
};

const leerGuardada = () => { try { return sessionStorage.getItem(CLAVE_SECCION); } catch { return null; } };

function AdminApp() {
  const { sucursal, cargando } = useSucursal();
  const [page, setPage] = useState<SeccionAdmin | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // La sección inicial depende de los días de apertura: se decide cuando llega la sucursal.
  useEffect(() => {
    if (page || cargando) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se decide una sola vez, al cargar la sucursal
    setPage(seccionInicial(sucursal?.dias_apertura, new Date(), leerGuardada()));
  }, [page, cargando, sucursal]);

  const irA = (seccion: SeccionAdmin) => {
    setPage(seccion);
    try { sessionStorage.setItem(CLAVE_SECCION, seccion); } catch { /* sin sessionStorage, no se recuerda */ }
  };

  const actual = page ?? "dashboard";
  const [title, subtitle] = TITLES[actual];

  return (
    <div className="admin">
      <Sidebar current={actual} onNav={irA} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar title={title} subtitle={subtitle} onMenu={() => setSidebarOpen(true)} onEstado={() => irA("arranque")} />
        <div className="content">
          {page === null && <div className="text-muted">Cargando…</div>}
          {page === "arranque"      && <Arranque onVerPedidos={() => irA("pedidos")} />}
          {page === "pedidos"       && <><NotificationsRecovery /><Orders /></>}
          {page === "resumen"       && <ResumenDiario />}
          {page === "productos"     && <Products />}
          {page === "etiquetas"     && <Etiquetas />}
          {page === "dashboard"     && <Dashboard />}
          {page === "clientes"      && <Customers />}
          {page === "testimonios"   && <Testimonials />}
          {page === "configuracion" && <Settings />}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <StoreProvider>
      <SucursalProvider>
        <AdminApp />
      </SucursalProvider>
    </StoreProvider>
  );
}
