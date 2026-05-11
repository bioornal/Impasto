/* global React */
const { useState, useEffect, useMemo, createContext, useContext, useRef } = React;

const fmt = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const fmtShort = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? Math.round(n / 1000) + "k" : String(n);

const timeAgo = (iso) => {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};

const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/* ============ STORE CONTEXT ============ */
const StoreCtx = createContext();

function LoadingScreen({ error }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16, background: "var(--a-bg)", fontFamily: "var(--a-font-body)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, var(--a-accent), var(--a-gold))", color: "white", display: "grid", placeItems: "center", fontFamily: "var(--a-font-display)", fontWeight: 700, fontSize: 22, transform: "rotate(-6deg)", boxShadow: "0 4px 12px rgba(255,77,31,.35)" }}>I</div>
      {error
        ? <div style={{ color: "var(--a-danger)", fontFamily: "var(--a-font-body)", fontSize: 13.5, maxWidth: 340, textAlign: "center", lineHeight: 1.5 }}>
            <b style={{ display: "block", marginBottom: 6 }}>No se pudo conectar con el servidor</b>
            {error}<br />
            <span style={{ color: "var(--a-muted)", fontSize: 12 }}>Verificá que Node.js esté corriendo con <code>node server.js</code></span>
          </div>
        : <div style={{ color: "var(--a-muted)", fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase" }}>Cargando datos…</div>
      }
    </div>
  );
}

function StoreProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, products: [], orders: [], customers: [], testimonials: [] });
  const [toast, setToast] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = () => {
    setState(s => ({ ...s, loading: true, error: null }));
    return window.ADMIN_API.loadAll()
      .then(data => setState({ loading: false, error: null, ...data }))
      .catch(err => setState(s => ({ ...s, loading: false, error: err.message || "Error de red" })));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const api = {
    state,
    showToast,

    reload: load,

    updateProduct: async (id, patch) => {
      // optimistic
      setState(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, ...patch } : p) }));
      const prod = stateRef.current.products.find(p => p.id === id);
      if (prod) await window.ADMIN_API.updateProduct(prod._dbId, patch);
      showToast("Producto actualizado");
    },

    createProduct: async (p) => {
      await window.ADMIN_API.createProduct(p);
      await load();
      showToast("Producto creado");
    },

    deleteProduct: async (id) => {
      const prod = stateRef.current.products.find(p => p.id === id);
      setState(s => ({ ...s, products: s.products.filter(p => p.id !== id) }));
      if (prod) await window.ADMIN_API.deleteProduct(prod._dbId);
      showToast("Producto eliminado");
    },

    updateOrderStatus: async (id, estado) => {
      setState(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, estado } : o) }));
      const order = stateRef.current.orders.find(o => o.id === id);
      if (order) await window.ADMIN_API.updateOrderStatus(order._dbId, estado);
      showToast(`Pedido ${id} → ${estado}`);
    },

    updateTestimonial: (id, estado) => {
      const next = stateRef.current.testimonials.map(t => t.id === id ? { ...t, estado } : t);
      setState(s => ({ ...s, testimonials: next }));
      window.ADMIN_API.saveTestimonials(next);
      showToast("Testimonio actualizado");
    },

    deleteTestimonial: (id) => {
      const next = stateRef.current.testimonials.filter(t => t.id !== id);
      setState(s => ({ ...s, testimonials: next }));
      window.ADMIN_API.saveTestimonials(next);
      showToast("Testimonio eliminado");
    },

    reset: load,
  };

  if (state.loading || state.error) return <LoadingScreen error={state.error} />;

  return (
    <StoreCtx.Provider value={api}>
      {children}
      {toast && (
        <div className="toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {toast}
        </div>
      )}
    </StoreCtx.Provider>
  );
}

const useStore = () => useContext(StoreCtx);

/* ============ ICONS ============ */
const Icon = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  Orders: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  Pizza: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/></svg>,
  Users: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>,
  Star: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Settings: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.51 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .33-1.82 1.7 1.7 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.51-1.11 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.82.33h.08a1.7 1.7 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.82v.08a1.7 1.7 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Arrow: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  ExternalLink: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Menu: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Truck: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Shop: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Revenue: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Box: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

/* ============ PRODUCT THUMBNAIL ============ */
function ProductThumb({ item }) {
  if (item.type === "pizza") {
    const seed = [...(item.id || "x")].reduce((a, c) => a + c.charCodeAt(0), 0);
    const colors = [
      { cheese: "#efc77a", top: "#b5381f", top2: "#3e5b3a" },
      { cheese: "#e9c180", top: "#8a2f18", top2: "#4a6a2e" },
      { cheese: "#f1cc85", top: "#a03a1c", top2: "#2f4d26" },
    ];
    const c = colors[seed % colors.length];
    return (
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="#b57a3a" />
        <circle cx="20" cy="20" r="13" fill={c.cheese} />
        <circle cx="15" cy="17" r="1.8" fill={c.top} />
        <circle cx="23" cy="15" r="1.5" fill={c.top} />
        <circle cx="22" cy="23" r="1.5" fill={c.top2} />
        <circle cx="16" cy="24" r="1.3" fill={c.top2} />
        <circle cx="26" cy="22" r="1.5" fill={c.top} />
      </svg>
    );
  }
  if (item.type === "empanada") {
    return (
      <svg viewBox="0 0 40 40">
        <ellipse cx="20" cy="22" rx="14" ry="9" fill="#d39a54" />
        <path d="M 8 22 Q 8 18 11 17 Q 14 16 17 15.5 L 17 14 L 19 15 L 21 14 L 21 15.5 Q 26 16 29 17 Q 32 18 32 22" fill="#e5b774" />
        <path d="M 6 21 L 34 21" stroke="#a06328" strokeWidth="1" strokeDasharray="2 2" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40">
      <rect x="14" y="8" width="12" height="26" rx="2" fill="#2a2a2a" />
      <rect x="16" y="14" width="8" height="16" rx="1" fill="#555" />
    </svg>
  );
}

window.AdminCore = { fmt, fmtShort, timeAgo, fmtDateTime, StoreProvider, useStore, Icon, ProductThumb };
