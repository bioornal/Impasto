/* global React, ReactDOM, AdminCore, AdminDashboard, AdminPages1, AdminPages2 */
const { useState } = React;
const { StoreProvider } = window.AdminCore;
const { Sidebar, Topbar, Dashboard } = window.AdminDashboard;
const { Orders, Products } = window.AdminPages1;
const { Customers, Testimonials, Settings } = window.AdminPages2;

const TITLES = {
  dashboard: ["Dashboard", "Un vistazo general de tu negocio"],
  orders: ["Pedidos", "Administrá los pedidos entrantes"],
  products: ["Productos", "Tu carta de pizzas, empanadas y bebidas"],
  customers: ["Clientes", "Base de clientes y su historial"],
  testimonials: ["Testimonios", "Moderá las reseñas que aparecen en el sitio"],
  settings: ["Configuración", "Datos del local y zonas de envío"],
};

function App() {
  const hash = (location.hash || "#dashboard").slice(1);
  const [page, setPage] = useState(TITLES[hash] ? hash : "dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  React.useEffect(() => { location.hash = page; }, [page]);

  const [title, subtitle] = TITLES[page];

  return (
    <StoreProvider>
      <div className="admin">
        <Sidebar current={page} onNav={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main">
          <Topbar
            title={title}
            subtitle={subtitle}
            onMenu={() => setSidebarOpen(true)}
            right={page === "dashboard" && (
              <a className="btn btn-ghost" href="Impasto.html" target="_blank">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Ver sitio
              </a>
            )}
          />
          <div className="content">
            {page === "dashboard" && <Dashboard />}
            {page === "orders" && <Orders />}
            {page === "products" && <Products />}
            {page === "customers" && <Customers />}
            {page === "testimonials" && <Testimonials />}
            {page === "settings" && <Settings />}
          </div>
        </div>
      </div>
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
