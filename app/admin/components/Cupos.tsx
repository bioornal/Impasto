"use client";
import { useStore } from "./StoreProvider";
import { CupoControl, useCuposNoche } from "./CupoControl";
import { quedanPizzas } from "@/lib/cupos";
import { etiquetaDia } from "@/lib/resumen-diario";

/**
 * Cupos de la noche (pedido del dueño, 18/10/2026): cuántas pizzas de cada sabor quedan para vender
 * esta noche. Todas arrancan en 100 (sin límite) y el dueño baja las que no tiene; cada venta, de la
 * web o del POS, descuenta sola. Controla la base. A las 06:00 todo vuelve a 100.
 * El mismo control está en la tabla de Productos. Solo lo usa el Arranque de la noche.
 */
export function Cupos() {
  const { state } = useStore();
  const cupos = useCuposNoche();
  // Agotadas primero, después las de 2 o menos, después el resto. Se ordena por lo GUARDADO (no por lo que
  // el dueño acaba de tocar): si no, la fila se mueve bajo el dedo y el toque siguiente cae en otra pizza.
  // Sin fila de cupo = sin límite = al final. Se ordena en cada render (~15 pizzas).
  const prioridad = (id: string) => { const n = quedanPizzas(cupos.fila(id)); return n === 0 ? 0 : n <= 2 ? 1 : 2; };
  const pizzas = state.products
    .filter((p) => /pizz/i.test(p.categoria) && !p.archivado)
    .sort((a, b) => prioridad(a._dbId) - prioridad(b._dbId) || a.nombre.localeCompare(b.nombre));

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Cupos {cupos.noche ? `· ${etiquetaDia(cupos.noche)}` : "de esta noche"}</h3>
        <div className="panel-head-spacer" />
        <button className="btn btn-ghost" onClick={cupos.recargar}>Actualizar</button>
      </div>
      <div className="panel-body cupos-ayuda">
        Arrancan en 100 (sin límite). Bajá las que tenés pocas; cada venta descuenta sola y a las 06:00 vuelve todo a 100.
      </div>
      {cupos.error && <div className="panel-body" style={{ color: "var(--a-danger)", fontSize: 13 }}>{cupos.error}</div>}
      <div className="cupos-grid">
        {pizzas.map((p) => {
          const n = cupos.quedan(p._dbId);
          const fila = cupos.fila(p._dbId);
          const nota = !p.active ? "Marcada agotada en Productos" : n === 0 ? "Agotada" : fila && fila.vendidas_mitades > 0 ? `Vendidas ${(fila.vendidas_mitades / 2).toLocaleString("es-AR", { maximumFractionDigits: 1 })}` : "";
          return (
            <div key={p._dbId} className={`cupo-celda ${n === 0 ? "cupo-agotado" : n <= 2 ? "cupo-poco" : ""}`}>
              <div className="cupo-nombre">
                <b title={p.nombre}>{p.nombre}</b>
                {nota && <small className="tbl-muted">{nota}</small>}
              </div>
              <CupoControl productoId={p._dbId} nombre={p.nombre} cupos={cupos} />
            </div>
          );
        })}
        {pizzas.length === 0 && <div style={{ color: "var(--a-muted)" }}>No hay pizzas en la carta.</div>}
      </div>
    </section>
  );
}
