"use client";
import { useState, useMemo } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};

export function Testimonials() {
  const { state, updateTestimonial, deleteTestimonial } = useStore();
  const [filter, setFilter] = useState("todos");

  const filtered = useMemo(() => {
    if (filter === "todos") return state.testimonials;
    return state.testimonials.filter(t => t.estado === filter);
  }, [state.testimonials, filter]);

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
          {filtered.map(t => (
            <div key={t.id} style={{ padding: 18, border: "1px solid var(--a-line)", borderRadius: 14, background: "var(--a-surface)" }}>
              <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className={`chip chip-${t.estado}`}>{t.estado}</span>
                <span className="tbl-muted text-mono" style={{ fontSize: 11 }}>{timeAgo(t.fecha)}</span>
              </div>
              <div className="stars" style={{ fontSize: 16, marginBottom: 8 }}>
                {"★".repeat(t.rating)}<span className="stars-empty">{"★".repeat(5 - t.rating)}</span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--a-ink-2)", lineHeight: 1.45 }}>&ldquo;{t.texto}&rdquo;</p>
              <div className="tbl-strong" style={{ fontSize: 13 }}>— {t.nombre}</div>
              <div className="flex gap-8 mt-12" style={{ justifyContent: "flex-end" }}>
                {t.estado !== "aprobado" && <button className="btn btn-success btn-sm" onClick={() => updateTestimonial(t.id, "aprobado")}><Icon.Check /> Aprobar</button>}
                {t.estado !== "rechazado" && <button className="btn btn-danger btn-sm" onClick={() => updateTestimonial(t.id, "rechazado")}><Icon.X /> Rechazar</button>}
                <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("¿Eliminar?")) deleteTestimonial(t.id); }}><Icon.Trash /></button>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <div className="empty"><div className="empty-icon"><Icon.Star /></div><b>Sin testimonios</b><div>No hay testimonios en esta categoría</div></div>}
      </div>
    </div>
  );
}
