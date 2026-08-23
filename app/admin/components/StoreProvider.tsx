"use client";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { AdminState, AdminProduct, AdminEtiqueta, Testimonial } from "./types";
import { DELIVERY_FEE } from "@/lib/business";
import { esCategoriaImpasto } from "@/lib/categorias";

const TESTI_KEY = "impasto_testimonials_v2";

function defaultTestimonials(): Testimonial[] {
  const h = (hrs: number) => new Date(Date.now() - hrs * 3600000).toISOString();
  return [
    { id: "t01", nombre: "María L.", texto: "La mejor fugazzetta de Iguazú, masa perfecta y sabor único.", rating: 5, estado: "aprobado", fecha: h(48) },
    { id: "t02", nombre: "Joaquín P.", texto: "Las empanadas de carne cortada a cuchillo son de otro nivel. Recomendado 100%.", rating: 5, estado: "aprobado", fecha: h(72) },
    { id: "t03", nombre: "Carolina S.", texto: "Pedí la Patagónica y la Tartufo, las dos espectaculares. Llegó calentita.", rating: 5, estado: "aprobado", fecha: h(96) },
    { id: "t04", nombre: "Valentina R.", texto: "Excelente atención y la pizza llegó rapidísimo. La Diavola es adictiva.", rating: 5, estado: "pendiente", fecha: h(2) },
    { id: "t05", nombre: "Lucas F.", texto: "La masa estuvo un poco cruda esta vez pero el sabor sigue siendo bueno.", rating: 3, estado: "pendiente", fecha: h(4) },
  ];
}

function loadTestimonials(): Testimonial[] {
  try {
    const raw = localStorage.getItem(TESTI_KEY);
    return raw ? JSON.parse(raw) : defaultTestimonials();
  } catch { return defaultTestimonials(); }
}

function saveTestimonials(list: Testimonial[]) {
  localStorage.setItem(TESTI_KEY, JSON.stringify(list));
}

/* ── adaptadores InsForge → admin ── */
function adaptProduct(p: Record<string, unknown>): AdminProduct {
  const nombre = String(p.nombre || "");
  const category = String(p.categoria || "").toLowerCase();
  const type = category.includes("empan") ? "empanada" : category.includes("bebida") ? "bebida" : (p.tipo as string) || "pizza";
  return {
    _dbId: String(p.id),
    id: String(p.id),
    nombre,
    precio: Number(p.precio) || 0,
    active: p.disponible !== false,
    type: (type as AdminProduct["type"]) || "pizza",
    categoria: String(p.categoria || "clasica"),
    desc: String(p.desc || ""),
    tags: Array.isArray(p.tags) ? p.tags : [],
    popular: Boolean(p.popular),
    stock: 24,
  };
}

function adaptOrder(p: Record<string, unknown>) {
  const mode = p.modalidad === "takeaway" ? "takeaway" : p.modalidad === "delivery" ? "delivery" : p.direccion && p.direccion !== "Retiro en local" ? "delivery" : "takeaway";
  const isDelivery = mode === "delivery";
  const total = Number(p.total || 0);
  const shipping = Number(p.envio ?? (isDelivery ? DELIVERY_FEE : 0));
  const items = Array.isArray(p.productos)
    ? p.productos.map((i: Record<string, unknown>) => ({ name: String(i.name || i.nombre || "?"), qty: Number(i.qty || i.cantidad || 1), price: Number(i.price || i.precio || 0) }))
    : [];
  const num = String(p.numero_pedido || "").padStart(4, "0");
  return {
    _dbId: String(p.id),
    id: "IM-" + num,
    cliente: String(p.nombre_cliente || "—"),
    tel: String(p.telefono_cliente || "—"),
    mode: mode as "delivery" | "takeaway",
    dir: isDelivery ? String(p.direccion || "") : "",
    zona: "",
    items,
    subtotal: Number(p.subtotal ?? Math.max(0, Number(p.total_con_descuento || total) - shipping)),
    shipping,
    total,
    pago: String(p.metodo_pago || "n/d"),
    pagoEstado: String(p.estado_pago || "pendiente"),
    cambio: String(p.cambio || ""),
    referencia: String(p.referencia || ""),
    cuando: String(p.cuando || "asap"),
    estado: String(p.status || "nuevo") === "normal" ? "nuevo" : String(p.status || "nuevo"),
    fecha: String(p.created_at || new Date().toISOString()),
    notas: String(p.notas || ""),
  };
}

function adaptCustomer(c: Record<string, unknown>) {
  const id = String(c.id || c.telefono || "");
  return {
    _dbId: id,
    id,
    nombre: String(c.nombre || "—"),
    tel: String(c.telefono || "—"),
    email: String(c.email || ""),
    dir: String(c.direccion || ""),
    zona: "",
    pedidos: Number(c.cant_compras || 0),
    total: 0,
    fav: String(c.detalles || "—"),
    ultimo: String(c.updated_at || c.created_at || new Date().toISOString()),
  };
}

function adaptTestimonial(t: Record<string, unknown>): Testimonial {
  return {
    id: String(t.id),
    nombre: String(t.nombre || "Cliente"),
    texto: String(t.texto || ""),
    rating: Number(t.rating || 5),
    estado: (String(t.estado || "pendiente") as Testimonial["estado"]),
    fecha: String(t.created_at || t.updated_at || new Date().toISOString()),
  };
}

function adaptEtiqueta(e: Record<string, unknown>): AdminEtiqueta {
  return {
    _dbId: String(e.id),
    slug: String(e.slug || ""),
    label: String(e.label || e.slug || ""),
    color: String(e.color || "gris"),
    orden: Number(e.orden ?? 100),
    mostrar_badge: String(e.mostrar_badge || "ambos"),
    sistema: Boolean(e.sistema),
    usos: Number(e.usos ?? 0),
  };
}

async function loadAll() {
  const [prodRes, pedRes, cliRes, etiRes] = await Promise.all([
    fetch("/api/admin/productos").then(r => r.json()).catch(() => ({ data: [] })),
    fetch("/api/admin/pedidos").then(r => r.json()).catch(() => ({ data: [] })),
    fetch("/api/admin/clientes").then(r => r.json()).catch(() => ({ data: [] })),
    fetch("/api/admin/etiquetas").then(r => r.json()).catch(() => ({ data: [] })),
  ]);
  const testiRes = await fetch("/api/admin/testimonios").then(r => r.json()).catch(() => ({ data: [] }));
  return {
    products: (prodRes.data || []).filter((p: Record<string, unknown>) => esCategoriaImpasto(String(p.categoria || ""))).map(adaptProduct),
    orders: (pedRes.data || []).map(adaptOrder),
    customers: (cliRes.data || []).map(adaptCustomer),
    testimonials: Array.isArray(testiRes.data) && testiRes.data.length > 0
      ? testiRes.data.map(adaptTestimonial)
      : loadTestimonials(),
    etiquetas: (etiRes.data || []).map(adaptEtiqueta),
  };
}

/* ── context ── */
interface StoreCtx {
  state: AdminState;
  reload: () => Promise<void>;
  showToast: (msg: string) => void;
  updateProduct: (id: string, patch: Partial<AdminProduct>) => Promise<void>;
  createProduct: (p: Partial<AdminProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  /** Guarda las etiquetas de un producto y revierte si el PUT falla. */
  setProductTags: (id: string, tags: string[]) => Promise<void>;
  createEtiqueta: (label: string, color: string, mostrar_badge: string) => Promise<void>;
  updateEtiqueta: (id: string, patch: Partial<AdminEtiqueta>) => Promise<void>;
  deleteEtiqueta: (id: string) => Promise<void>;
  updateOrderStatus: (id: string, estado: string) => Promise<void>;
  updateOrderPayment: (id: string, estado: string) => Promise<void>;
  /** Sin `monto` devuelve el total; con `monto` hace una devolución parcial. */
  refundOrder: (id: string, monto?: number) => Promise<void>;
  updateTestimonial: (id: string, estado: string) => Promise<void>;
  deleteTestimonial: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);
export const useStore = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
};

function LoadingScreen({ error }: { error: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16, background: "var(--a-bg)", fontFamily: "var(--a-font-body)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, var(--a-accent), var(--a-gold))", color: "white", display: "grid", placeItems: "center", fontFamily: "var(--a-font-display)", fontWeight: 700, fontSize: 22, transform: "rotate(-6deg)", boxShadow: "0 4px 12px rgba(255,77,31,.35)" }}>I</div>
      {error
        ? <div style={{ color: "var(--a-danger)", fontSize: 13.5, maxWidth: 340, textAlign: "center", lineHeight: 1.5 }}>
            <b style={{ display: "block", marginBottom: 6 }}>No se pudo conectar con el servidor</b>
            {error}
          </div>
        : <div style={{ color: "var(--a-muted)", fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase" }}>Cargando datos…</div>
      }
    </div>
  );
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>({ loading: true, error: null, products: [], orders: [], customers: [], testimonials: [], etiquetas: [] });
  const [toast, setToast] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await loadAll();
      setState({ loading: false, error: null, ...data });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err instanceof Error ? err.message : "Error de red" }));
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const api: StoreCtx = {
    state,
    reload: load,
    showToast,

    updateProduct: async (id, patch) => {
      setState(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, ...patch } : p) }));
      const prod = stateRef.current.products.find(p => p.id === id);
      if (prod) {
        const body: Record<string, unknown> = {};
        if (patch.nombre !== undefined) body.nombre = patch.nombre;
        if (patch.precio !== undefined) body.precio = patch.precio;
        if (patch.active !== undefined) body.disponible = patch.active;
        if (patch.type !== undefined) body.tipo = patch.type;
        if (patch.categoria !== undefined) body.categoria = patch.categoria;
        if (patch.desc !== undefined) body.desc = patch.desc;
        if (patch.tags !== undefined) body.tags = patch.tags;
        if (patch.popular !== undefined) body.popular = patch.popular;
        await fetch(`/api/admin/productos/${prod._dbId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      if (patch.active !== undefined && Object.keys(patch).length === 1) {
        showToast(patch.active ? "Producto marcado como Disponible" : "Producto marcado como Agotado");
      } else {
        showToast("Producto actualizado");
      }
    },

    createProduct: async (p) => {
      await fetch("/api/admin/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: p.nombre,
          precio: p.precio || 0,
          disponible: p.active !== false,
          tipo: p.type || "pizza",
          categoria: p.categoria || "pizzas",
          desc: p.desc || "",
          tags: p.tags || [],
          popular: Boolean(p.popular),
        }),
      });
      await load();
      showToast("Producto creado");
    },

    deleteProduct: async (id) => {
      const prod = stateRef.current.products.find(p => p.id === id);
      setState(s => ({ ...s, products: s.products.filter(p => p.id !== id) }));
      if (prod) await fetch(`/api/admin/productos/${prod._dbId}`, { method: "DELETE" });
      showToast("Producto eliminado");
    },

    // Las tres miran el status de la respuesta, a diferencia de updateProduct,
    // que toastea exito siempre: un 400 de la validacion tiene que verse.
    createEtiqueta: async (label, color, mostrar_badge) => {
      const orden = Math.max(0, ...stateRef.current.etiquetas.map(e => e.orden)) + 1;
      const r = await fetch("/api/admin/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, color, mostrar_badge, orden }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(j.error || "No se pudo crear la etiqueta"); return; }
      await load();
      showToast("Etiqueta creada");
    },

    updateEtiqueta: async (id, patch) => {
      const eti = stateRef.current.etiquetas.find(e => e._dbId === id);
      if (!eti) return;
      const body: Record<string, unknown> = {};
      if (patch.label !== undefined) body.label = patch.label;
      if (patch.color !== undefined) body.color = patch.color;
      if (patch.orden !== undefined) body.orden = patch.orden;
      if (patch.mostrar_badge !== undefined) body.mostrar_badge = patch.mostrar_badge;
      const r = await fetch(`/api/admin/etiquetas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(j.error || "No se pudo actualizar"); return; }
      await load();
      showToast("Etiqueta actualizada");
    },

    deleteEtiqueta: async (id) => {
      const r = await fetch(`/api/admin/etiquetas/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(j.error || "No se pudo borrar"); return; }
      await load();
      showToast(j.limpiados > 0 ? `Etiqueta borrada y quitada de ${j.limpiados} producto(s)` : "Etiqueta borrada");
    },

    setProductTags: async (id, tags) => {
      const prod = stateRef.current.products.find(p => p.id === id);
      if (!prod) return;
      const previos = prod.tags || [];
      setState(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, tags } : p) }));
      const r = await fetch(`/api/admin/productos/${prod._dbId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      }).catch(() => null);
      if (!r || !r.ok) {
        // Revertir: la celda no puede quedar mostrando algo que no se guardo.
        // updateProduct toastea exito siempre; aca no, porque el sentido de la
        // pantalla es etiquetar en tanda y un fallo silencioso se arrastra.
        setState(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, tags: previos } : p) }));
        const j = r ? await r.json().catch(() => ({})) : {};
        showToast(j.error || "No se pudieron guardar las etiquetas");
        return;
      }
      showToast("Etiquetas actualizadas");
    },

    updateOrderStatus: async (id, estado) => {
      setState(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, estado } : o) }));
      const order = stateRef.current.orders.find(o => o.id === id);
      if (order) await fetch(`/api/admin/pedidos/${order._dbId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: estado }) });
      showToast(`Pedido ${id} → ${estado}`);
    },

    updateOrderPayment: async (id, estado) => {
      setState(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, pagoEstado: estado } : o) }));
      const order = stateRef.current.orders.find(o => o.id === id);
      if (order) await fetch(`/api/admin/pedidos/${order._dbId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado_pago: estado }) });
      showToast(`Pago de ${id} → ${estado}`);
    },

    refundOrder: async (id, monto) => {
      const order = stateRef.current.orders.find(o => o.id === id);
      if (!order) return;
      const response = await fetch(`/api/admin/pedidos/${order._dbId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(monto === undefined ? {} : { amount: monto }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        // No tocamos el estado local: la plata no se movió.
        showToast(result.error || "No se pudo procesar la devolución");
        return;
      }
      setState(s => ({ ...s, orders: s.orders.map(o => o.id === id ? { ...o, pagoEstado: result.estadoPago } : o) }));
      showToast(result.parcial ? `Devolución parcial de ${id} realizada` : `Pedido ${id} devuelto por completo`);
    },

    updateTestimonial: async (id, estado) => {
      const next = stateRef.current.testimonials.map(t => t.id === id ? { ...t, estado: estado as Testimonial["estado"] } : t);
      setState(s => ({ ...s, testimonials: next }));
      const response = await fetch(`/api/admin/testimonios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      }).catch(() => null);
      if (!response?.ok) saveTestimonials(next);
      showToast("Testimonio actualizado");
    },

    deleteTestimonial: async (id) => {
      const next = stateRef.current.testimonials.filter(t => t.id !== id);
      setState(s => ({ ...s, testimonials: next }));
      const response = await fetch(`/api/admin/testimonios/${id}`, { method: "DELETE" }).catch(() => null);
      if (!response?.ok) saveTestimonials(next);
      showToast("Testimonio eliminado");
    },

    reset: load,
  };

  if (state.loading || state.error) return <LoadingScreen error={state.error} />;

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast && (
        <div className="toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}
