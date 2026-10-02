"use client";
import { providerRefundConfirmed } from "@/lib/provider-refund-intent";
import type { ManualRefund } from "@/lib/manual-refund";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { AdminState, AdminProduct, AdminEtiqueta, Testimonial, AdminOrder, AdminCustomer } from "./types";
import { esCategoriaImpasto } from "@/lib/categorias";
import { adaptOrder } from "@/lib/adapt-order";
import { loadAdminCustomers } from "@/lib/adapt-customer";
import { confirmAdminMutation } from "@/lib/stabilization";
import {
  clavesDePedidosParaCocina,
  pedidosNuevosParaCocina,
  registrarPedidosConocidosParaCocina,
} from "@/lib/pedido-visible";

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
    archivado: p.archivado === true,
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
    producto: String(t.producto || ""),
    pedidoRef: String(t.pedido_ref || ""),
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

/** Web Audio API: campanilla bitonal elegante sin dependencias de audio externas */
function playKitchenChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Tono 1: Mi5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tono 2: La5 (880 Hz) con leve retraso
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.75);
  } catch {
    // Ignorar si el navegador bloquea audio antes de interacción
  }
}

async function loadAll(): Promise<{
  products: AdminProduct[];
  orders: AdminOrder[];
  customers: AdminCustomer[];
  customersError: string | null;
  customersLoading: boolean;
  customersUpdatedAt: string | null;
  testimonials: Testimonial[];
  etiquetas: AdminEtiqueta[];
}> {
  const [prodRes, pedRes, crm, etiRes] = await Promise.all([
    fetch("/api/admin/productos").then(r => r.json()).catch(() => ({ data: [] })),
    fetch("/api/admin/pedidos").then(r => r.json()).catch(() => ({ data: [] })),
    loadAdminCustomers(() => fetch("/api/admin/clientes", { cache: "no-store" }))
      .then(customers => ({ customers, customersError: null, customersUpdatedAt: new Date().toISOString() }))
      .catch(error => ({ customers: [], customersError: error instanceof Error ? error.message : "No se pudo verificar el CRM", customersUpdatedAt: null })),
    fetch("/api/admin/etiquetas").then(r => r.json()).catch(() => ({ data: [] })),
  ]);
  const testiRes = await fetch("/api/admin/testimonios").then(r => r.json()).catch(() => ({ data: [] }));
  
  const orders = (pedRes.data || []).map(adaptOrder);

  return {
    products: (prodRes.data || []).filter((p: Record<string, unknown>) => esCategoriaImpasto(String(p.categoria || ""))).map(adaptProduct),
    orders,
    ...crm,
    customersLoading: false,
    testimonials: Array.isArray(testiRes.data) ? testiRes.data.map(adaptTestimonial) : [],
    etiquetas: (etiRes.data || []).map(adaptEtiqueta),
  };
}

/* ── context ── */
interface StoreCtx {
  state: AdminState;
  reload: () => Promise<void>;
  reloadCustomers: () => Promise<void>;
  showToast: (msg: string) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  updateProduct: (id: string, patch: Partial<AdminProduct>) => Promise<void>;
  createProduct: (p: Partial<AdminProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  /** Guarda las etiquetas de un producto y revierte si el PUT falla. */
  setProductTags: (id: string, tags: string[]) => Promise<void>;
  createEtiqueta: (label: string, color: string, mostrar_badge: string) => Promise<void>;
  updateEtiqueta: (id: string, patch: Partial<AdminEtiqueta>) => Promise<void>;
  deleteEtiqueta: (id: string) => Promise<void>;
  updateOrderStatus: (dbId: string, estado: string) => Promise<boolean>;
  updateOrderPayment: (dbId: string, estado: string) => Promise<boolean>;
  /** Sin `monto` devuelve el total; con `monto` hace una devolución parcial. */
  recordManualRefund: (dbId: string, body: ManualRefund) => Promise<string>;
  refundOrder: (dbId: string, monto?: number, operationId?: string) => Promise<boolean>;
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
  const [state, setState] = useState<AdminState>({ loading: true, error: null, products: [], orders: [], customers: [], customersError: null, customersLoading: true, customersUpdatedAt: null, testimonials: [], etiquetas: [] });
  const [toast, setToast] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const stateRef = useRef(state);
  stateRef.current = state;
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Initialize sound preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("impasto_admin_sound");
      if (saved !== null) {
        const val = saved === "true";
        setSoundEnabled(val);
        soundEnabledRef.current = val;
      }
    } catch {}
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      soundEnabledRef.current = next;
      try {
        localStorage.setItem("impasto_admin_sound", String(next));
      } catch {}
      if (next) {
        playKitchenChime();
        showToast("🔔 Sonido de pedidos activado");
      } else {
        showToast("🔕 Sonido silenciado");
      }
      return next;
    });
  };

  const load = async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await loadAll();
      knownOrderIdsRef.current = clavesDePedidosParaCocina(data.orders);
      isInitialLoadRef.current = false;
      setState({ loading: false, error: null, ...data });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err instanceof Error ? err.message : "Error de red" }));
    }
  };

  useEffect(() => {
    load();

    // Auto-polling every 15s for new orders + kitchen chime
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/pedidos");
        if (!res.ok) {
          if (res.status === 401) {
            setState(s => ({
              ...s,
              error: "Sesión vencida — por favor volvé a iniciar sesión para seguir recibiendo pedidos",
            }));
          }
          return;
        }
        const j = await res.json();
        if (!j.ok || !Array.isArray(j.data)) return;

        const newOrders: AdminOrder[] = j.data.map(adaptOrder);
        const prevIds = knownOrderIdsRef.current;

        if (!isInitialLoadRef.current) {
          const freshOrders = pedidosNuevosParaCocina(prevIds, newOrders);
          if (freshOrders.length > 0) {
            if (soundEnabledRef.current) {
              playKitchenChime();
            }
            showToast(`🔔 ¡${freshOrders.length} nuevo(s) pedido(s) recibido(s)!`);
          }
        }

        knownOrderIdsRef.current = registrarPedidosConocidosParaCocina(prevIds, newOrders);

        setState(s => ({ ...s, orders: newOrders }));
      } catch {
        // Silently ignore polling hiccups
      }
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  const customersRefreshRef = useRef(false);
  const reloadCustomers = async () => {
    if (customersRefreshRef.current) return;
    customersRefreshRef.current = true;
    setState(s => ({ ...s, customersLoading: true }));
    try {
      const customers = await loadAdminCustomers(() => fetch("/api/admin/clientes", { cache: "no-store" }));
      setState(s => ({ ...s, customers, customersError: null, customersLoading: false, customersUpdatedAt: new Date().toISOString() }));
    } catch (error) {
      setState(s => ({ ...s, customers: [], customersError: error instanceof Error ? error.message : "No se pudo verificar el CRM", customersLoading: false, customersUpdatedAt: null }));
    } finally {
      customersRefreshRef.current = false;
    }
  };

  const api: StoreCtx = {
    state,
    reload: load,
    reloadCustomers,
    showToast,
    soundEnabled,
    toggleSound,

    updateProduct: async (id, patch) => {
      try {
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
        await confirmAdminMutation(() => fetch(`/api/admin/productos/${prod._dbId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
        setState(s => ({ ...s, products: s.products.map(p => p.id === id ? { ...p, ...patch } : p) }));
      } else {
        throw new Error("Producto no encontrado. Actualizá el panel.");
      }
      if (patch.active !== undefined && Object.keys(patch).length === 1) {
        showToast(patch.active ? "Producto marcado como Disponible" : "Producto marcado como Agotado");
      } else {
        showToast("Producto actualizado");
      }
      } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo actualizar el producto"); }
    },

    createProduct: async (p) => {
      try {
      await confirmAdminMutation(() => fetch("/api/admin/productos", {
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
      }));
      await load();
      showToast("Producto creado");
      } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo crear el producto"); }
    },

    deleteProduct: async (id) => {
      try {
      const prod = stateRef.current.products.find(p => p.id === id);
      if (!prod) throw new Error("Producto no encontrado. Actualizá el panel.");
      await confirmAdminMutation(() => fetch(`/api/admin/productos/${prod._dbId}`, { method: "DELETE" }));
      setState(s => ({ ...s, products: s.products.filter(p => p.id !== id) }));
      showToast("Producto eliminado");
      } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo eliminar el producto"); }
    },

    // Un 400 de validación debe verse y conservar el estado confirmado.
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

    updateOrderStatus: async (dbId, estado) => {
      const prevOrder = stateRef.current.orders.find(o => o._dbId === dbId);
      const prevEstado = prevOrder?.estado;
      setState(s => ({ ...s, orders: s.orders.map(o => o._dbId === dbId ? { ...o, estado } : o) }));
      const order = stateRef.current.orders.find(o => o._dbId === dbId);
      if (order) {
        const res = await fetch(`/api/admin/pedidos/${order._dbId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: estado }),
        }).catch(() => null);
        if (!res || !res.ok) {
          if (prevEstado) {
            setState(s => ({ ...s, orders: s.orders.map(o => o._dbId === dbId ? { ...o, estado: prevEstado } : o) }));
          }
          const result = res ? await res.json().catch(() => ({})) : {};
          showToast(result.error || "Error al actualizar el estado del pedido");
          return false;
        }
      } else {
        return false;
      }
      showToast(`Pedido ${prevOrder?.id ?? ""} → ${estado}`);
      return true;
    },

    updateOrderPayment: async (dbId, estado) => {
      const prevOrder = stateRef.current.orders.find(o => o._dbId === dbId);
      const prevPagoEstado = prevOrder?.pagoEstado;
      setState(s => ({ ...s, orders: s.orders.map(o => o._dbId === dbId ? { ...o, pagoEstado: estado } : o) }));
      const order = stateRef.current.orders.find(o => o._dbId === dbId);
      if (order) {
        const res = await fetch(`/api/admin/pedidos/${order._dbId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado_pago: estado }),
        }).catch(() => null);
        if (!res || !res.ok) {
          if (prevPagoEstado) {
            setState(s => ({ ...s, orders: s.orders.map(o => o._dbId === dbId ? { ...o, pagoEstado: prevPagoEstado } : o) }));
          }
          const result = res ? await res.json().catch(() => ({})) : {};
          showToast(result.error || "Error al actualizar el estado de pago");
          return false;
        }
      } else {
        return false;
      }
      showToast(`Pago de ${prevOrder?.id ?? ""} → ${estado}`);
      return true;
    },

    recordManualRefund: async (dbId, body) => {
      const response=await fetch(`/api/admin/pedidos/${dbId}/devolucion-manual`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();
      if(!response.ok || !result.ok || result.operacion_id!==body.operacion_id || !['parcialmente_reembolsado','reembolsado'].includes(result.estado_pago))throw new Error(result.error || 'Registro no confirmado; reintentá la misma operación');
      await load();
      showToast('Devolución ya realizada registrada; no se movió dinero desde este panel');
      return result.estado_pago;
    },

    refundOrder: async (dbId, monto, operationId) => {
      const order = stateRef.current.orders.find(o => o._dbId === dbId);
      if (!order) return false;
      const response = await fetch(`/api/admin/pedidos/${order._dbId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(monto === undefined ? {} : { amount: monto }), ...(operationId ? { operationId } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !providerRefundConfirmed(result,operationId)) {
        // MP may have refunded successfully while the local database failed.
        if (result.refundCompleted) {
          await load();
          showToast(result.error || "Devolución confirmada por Mercado Pago; falta conciliar el estado local.");
          return false;
        }
        showToast(result.error || "No se pudo procesar la devolución");
        return false;
      }
      setState(s => ({ ...s, orders: s.orders.map(o => o._dbId === dbId ? { ...o, pagoEstado: result.estadoPago } : o) }));
      showToast(result.recovered ? `Devolución existente de ${order.id} conciliada; no se realizó otra devolución` : result.parcial ? `Devolución parcial de ${order.id} realizada` : `Pedido ${order.id} devuelto por completo`);
      return true;
    },

    updateTestimonial: async (id, estado) => {
      try {
      await confirmAdminMutation(() => fetch(`/api/admin/testimonios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      }));
      setState(s => ({ ...s, testimonials: s.testimonials.map(t => t.id === id ? { ...t, estado: estado as Testimonial["estado"] } : t) }));
      showToast("Testimonio actualizado");
      } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo actualizar el testimonio"); }
    },

    deleteTestimonial: async (id) => {
      try {
      await confirmAdminMutation(() => fetch(`/api/admin/testimonios/${id}`, { method: "DELETE" }));
      setState(s => ({ ...s, testimonials: s.testimonials.filter(t => t.id !== id) }));
      showToast("Testimonio eliminado");
      } catch (error) { showToast(error instanceof Error ? error.message : "No se pudo eliminar el testimonio"); }
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
