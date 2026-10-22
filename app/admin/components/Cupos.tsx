"use client";
import { useStore } from "./StoreProvider";
import { CupoControl, useCuposNoche } from "./CupoControl";
import { etiquetaDia } from "@/lib/resumen-diario";

/**
 * Cupos de la noche (pedido del dueño, 18/10/2026): cuántas pizzas de cada sabor quedan para vender
 * esta noche. Todas arrancan en 100 (sin límite) y el dueño baja las que no tiene; cada venta, de la
 * web o del POS, descuenta sola. Controla la base. A las 06:00 todo vuelve a 100.
 * El mismo control está en la tabla de Productos.
 */
export function Cupos() {
  const { state } = useStore();
  const cupos = useCuposNoche();
  // Agotadas primero, después las de 2 o menos, después el resto. `cupos` es un objeto nuevo en cada render
  // (lo arma useCuposNoche), así que un useMemo con `cupos` no ahorraría nada: se ordena en cada render (~15 pizzas).
  const prioridad = (id: string) => { const n = cupos.quedan(id); return n === 0 ? 0 : n <= 2 ? 1 : 2; };
  const pizzas = state.products
    .filter((p) => /pizz/i.test(p.categoria) && !p.archivado)
    .sort((a, b) => prioridad(a._dbId) - prioridad(b._dbId) || a.nombre.localeCompare(b.nombre));

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Cupos {cupos.noche ? `· ${etiquetaDia(cupos.noche)}` : "de esta noche"}</h3>
        <div className="panel-head-spacer" />
        <button className="btn btn-ghost" onClick={cupos.recargar}>Actualizar</button>
      </div>
      <div className="panel-body cupos-ayuda">
        Arrancan en 100 (sin límite). Bajá las que tenés pocas; cada venta descuenta sola y a las 06:00 vuelve todo a 100.
      </div>
      {cupos.error && <div className="panel-body" style={{ color: "var(--a-danger)", fontSize: 13 }}>{cupos.error}</div>}
      <div className="panel-body no-pad tbl-wrap">
        <table className="tbl cupos-tbl">
          <thead><tr><th>Pizza</th><th className="right">Quedan esta noche</th></tr></thead>
          <tbody>
            {pizzas.map((p) => (
              <tr key={p._dbId} className={cupos.quedan(p._dbId) === 0 ? "cupo-agotado" : cupos.quedan(p._dbId) <= 2 ? "cupo-poco" : ""}>
                <td className="tbl-strong">
                  {p.nombre}
                  {!p.active && <span className="tbl-muted" style={{ fontSize: 12 }}> · marcada agotada en Productos</span>}
                </td>
                <td className="right"><CupoControl productoId={p._dbId} nombre={p.nombre} cupos={cupos} /></td>
              </tr>
            ))}
            {pizzas.length === 0 && <tr><td colSpan={2} style={{ color: "var(--a-muted)" }}>No hay pizzas en la carta.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
