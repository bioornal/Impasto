"use client";
import { useState, useMemo } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import type { AdminOrder, Testimonial } from "./types";
import { EMPANADAS, SEPARADOR_PRODUCTOS, lineaProducto, productosDelPedido } from "@/lib/opiniones";

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};

/**
 * El recuadro de la tarjeta: lo mismo que lee el cliente en la web bajo el
 * nombre. Nada de pedido, fecha, monto ni bebidas (pedido del dueño): la
 * tarjeta del panel es la de la web.
 */
function QueProbo({ t }: { t: Testimonial }) {
  const linea = lineaProducto(t.producto);
  return (
    <div style={{ fontSize: 12, color: "var(--a-ink-2)" }}>
      {linea || <>Cliente de Impasto <span className="tbl-muted">(sin pizza elegida: tocá Editar)</span></>}
    </div>
  );
}

/** Nombre publicado y sobre qué opinó, editables antes de aprobar. */
function EditarPublicacion({ t, pedido, pizzasDeLaCarta, onListo }: {
  t: Testimonial;
  pedido?: AdminOrder;
  pizzasDeLaCarta: string[];
  onListo: () => void;
}) {
  const { updateTestimonial } = useStore();
  const [nombre, setNombre] = useState(t.nombre);
  const [producto, setProducto] = useState(t.producto);
  const [guardando, setGuardando] = useState(false);

  // Del pedido: lo que compró, junto o cada cosa. De la home: la carta.
  const opciones = useMemo(() => {
    const lista: { valor: string; texto: string }[] = [];
    if (pedido) {
      const comprados = productosDelPedido(pedido.items);
      if (comprados.length > 1) lista.push({ valor: comprados.join(SEPARADOR_PRODUCTOS), texto: `Todo el pedido: ${comprados.join(", ")}` });
      comprados.forEach(p => lista.push({ valor: p, texto: p }));
    } else {
      [...pizzasDeLaCarta, EMPANADAS].forEach(p => lista.push({ valor: p, texto: p }));
    }
    if (t.producto && !lista.some(o => o.valor === t.producto)) lista.unshift({ valor: t.producto, texto: t.producto });
    return lista;
  }, [pedido, pizzasDeLaCarta, t.producto]);

  const guardar = async () => {
    setGuardando(true);
    const ok = await updateTestimonial(t.id, { nombre, producto });
    setGuardando(false);
    if (ok) onListo();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="field">
        <label>Nombre que se publica</label>
        <input value={nombre} maxLength={40} onChange={e => setNombre(e.target.value)} />
        {pedido && pedido.cliente !== "—" && nombre.trim() !== pedido.cliente.trim() && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setNombre(pedido.cliente.slice(0, 40))}>
            Usar el del pedido: {pedido.cliente}
          </button>
        )}
      </div>
      <div className="field">
        <label>Sobre qué opinó</label>
        <select value={producto} onChange={e => setProducto(e.target.value)}>
          <option value="">Sin producto</option>
          {opciones.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
      </div>
      <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onListo} disabled={guardando}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={guardar} disabled={guardando || !nombre.trim()}>{guardando ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );
}

export function Testimonials() {
  const { state, updateTestimonial, deleteTestimonial } = useStore();
  const [filter, setFilter] = useState("todos");
  const [editando, setEditando] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "todos") return state.testimonials;
    return state.testimonials.filter(t => t.estado === filter);
  }, [state.testimonials, filter]);

  const pedidos = useMemo(() => new Map(state.orders.map(o => [o._dbId, o])), [state.orders]);
  const pizzasDeLaCarta = useMemo(
    () => state.products.filter(p => p.type === "pizza" && !p.archivado).map(p => p.nombre),
    [state.products],
  );

  const counts = {
    todos: state.testimonials.length,
    pendiente: state.testimonials.filter(t => t.estado === "pendiente").length,
    aprobado: state.testimonials.filter(t => t.estado === "aprobado").length,
    rechazado: state.testimonials.filter(t => t.estado === "rechazado").length,
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="toolbar">
          <div className="seg">
            <button className={filter === "todos" ? "active" : ""} onClick={() => setFilter("todos")}>Todos<span className="count">{counts.todos}</span></button>
            <button className={filter === "pendiente" ? "active" : ""} onClick={() => setFilter("pendiente")}>Pendientes<span className="count">{counts.pendiente}</span></button>
            <button className={filter === "aprobado" ? "active" : ""} onClick={() => setFilter("aprobado")}>Aprobados<span className="count">{counts.aprobado}</span></button>
            <button className={filter === "rechazado" ? "active" : ""} onClick={() => setFilter("rechazado")}>Rechazados<span className="count">{counts.rechazado}</span></button>
          </div>
        </div>
      </div>
      <div className="panel-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map(t => {
            const pedido = t.pedidoId ? pedidos.get(t.pedidoId) : undefined;
            return (
              <div key={t.id} style={{ padding: 18, border: "1px solid var(--a-line)", borderRadius: 14, background: "var(--a-surface)", display: "flex", flexDirection: "column" }}>
                <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span className={`chip chip-${t.estado}`}>{t.estado}</span>
                  <span className="tbl-muted text-mono" style={{ fontSize: 11 }}>{timeAgo(t.fecha)}</span>
                </div>
                <div className="stars" style={{ fontSize: 16, marginBottom: 8 }}>
                  {"★".repeat(t.rating)}<span className="stars-empty">{"★".repeat(5 - t.rating)}</span>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--a-ink-2)", lineHeight: 1.45 }}>&ldquo;{t.texto}&rdquo;</p>

                {editando === t.id ? (
                  <EditarPublicacion t={t} pedido={pedido} pizzasDeLaCarta={pizzasDeLaCarta} onListo={() => setEditando(null)} />
                ) : (
                  <>
                    <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div className="tbl-strong" style={{ fontSize: 13 }}>— {t.nombre}</div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditando(t.id)}>Editar</button>
                    </div>
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--a-bg)" }}>
                      <QueProbo t={t} />
                    </div>
                  </>
                )}

                <div className="flex gap-8" style={{ justifyContent: "flex-end", marginTop: "auto", paddingTop: 12 }}>
                  {t.estado !== "aprobado" && <button className="btn btn-success btn-sm" disabled={editando === t.id} onClick={() => updateTestimonial(t.id, { estado: "aprobado" })}><Icon.Check /> Aprobar y publicar</button>}
                  {t.estado !== "rechazado" && <button className="btn btn-danger btn-sm" disabled={editando === t.id} onClick={() => updateTestimonial(t.id, { estado: "rechazado" })}><Icon.X /> {t.estado === "aprobado" ? "Despublicar" : "Rechazar"}</button>}
                  <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("¿Eliminar?")) deleteTestimonial(t.id); }}><Icon.Trash /></button>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <div className="empty"><div className="empty-icon"><Icon.Star /></div><b>Sin testimonios</b><div>No hay testimonios en esta categoría</div></div>}
      </div>
    </div>
  );
}
