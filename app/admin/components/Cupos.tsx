"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "./StoreProvider";
import { etiquetaDia } from "@/lib/resumen-diario";

interface FilaCupo { producto_id: string; cupo_mitades: number; vendidas_mitades: number }

/** 3 mitades → "1,5"; para el dueño, en pizzas. */
const enPizzas = (mitades: number) => (mitades / 2).toLocaleString("es-AR", { maximumFractionDigits: 1 });

/**
 * Cupos de la noche (pedido del dueño, 18/10/2026): cuántas pizzas de cada sabor se pueden
 * vender esta noche, de a media. Controla la base (web y POS); al llegar a 0 sale Agotado.
 * A las 06:00 empieza otra noche y todo vuelve a no tener límite.
 */
export function Cupos() {
  const { state, showToast } = useStore();
  const [filas, setFilas] = useState<FilaCupo[]>([]);
  const [noche, setNoche] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cupos");
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron leer los cupos");
      setFilas(json.data);
      setNoche(json.noche);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron leer los cupos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API, como el resto del panel
    cargar();
    // Lo vendido cambia con cada pedido: se refresca solo mientras la pantalla está abierta.
    const id = setInterval(cargar, 30_000);
    return () => clearInterval(id);
  }, [cargar]);

  const pizzas = useMemo(
    () => state.products
      .filter((p) => /pizz/i.test(p.categoria) && !p.archivado)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [state.products],
  );
  const porId = new Map(filas.map((f) => [f.producto_id, f]));

  const guardar = async (productoId: string, nombre: string) => {
    const valor = borradores[productoId];
    if (valor === undefined || valor.trim() === "") return;
    setGuardando(productoId);
    try {
      const res = await fetch("/api/admin/cupos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto_id: productoId, pizzas: valor }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar");
      setBorradores((b) => { const resto = { ...b }; delete resto[productoId]; return resto; });
      showToast(`Cupo de ${nombre}: ${valor.replace(".", ",")} para esta noche`);
      await cargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(null);
    }
  };

  const quitar = async (productoId: string, nombre: string) => {
    setGuardando(productoId);
    try {
      const res = await fetch(`/api/admin/cupos?producto_id=${encodeURIComponent(productoId)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo quitar");
      showToast(`${nombre}: sin límite esta noche`);
      await cargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo quitar");
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Cupos de {noche ? `la noche del ${etiquetaDia(noche)}` : "esta noche"}</h3>
        <div className="panel-head-spacer" />
        <button className="btn btn-ghost" onClick={cargar}>Actualizar</button>
      </div>
      <div className="panel-body cupos-ayuda">
        Cargá cuántas pizzas de cada sabor se pueden vender esta noche, de a media (por ejemplo 1,5).
        Vale para la web y el POS, y cuenta lo que se venda desde que lo cargás. Al llegar a 0 la pizza
        sale <b>Agotado</b>. A las 06:00 empieza otra noche y todo vuelve a no tener límite.
        Si un pedido se cancela, sus pizzas vuelven al cupo.
      </div>
      {error && <div className="panel-body" style={{ color: "var(--a-danger)", fontSize: 13 }}>{error}</div>}
      <div className="panel-body no-pad tbl-wrap">
        <table className="tbl cupos-tbl">
          <thead>
            <tr><th>Pizza</th><th className="right">Cupo</th><th className="right">Vendidas</th><th className="right">Quedan</th><th></th></tr>
          </thead>
          <tbody>
            {pizzas.map((p) => {
              const fila = porId.get(p._dbId);
              const quedan = fila ? Math.max(0, fila.cupo_mitades - fila.vendidas_mitades) : null;
              const borrador = borradores[p._dbId];
              const ocupado = guardando === p._dbId;
              return (
                <tr key={p._dbId} className={quedan === 0 ? "cupo-agotado" : ""}>
                  <td className="tbl-strong">
                    {p.nombre}
                    {!p.active && <span className="tbl-muted" style={{ fontSize: 12 }}> · marcada agotada en Productos</span>}
                  </td>
                  <td className="right">
                    <input
                      className="cupo-input"
                      type="number"
                      min={0}
                      step={0.5}
                      inputMode="decimal"
                      placeholder={fila ? enPizzas(fila.cupo_mitades) : "Sin límite"}
                      value={borrador ?? ""}
                      onChange={(e) => setBorradores((b) => ({ ...b, [p._dbId]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") guardar(p._dbId, p.nombre); }}
                      aria-label={`Cupo de ${p.nombre} para esta noche`}
                    />
                  </td>
                  <td className="right">{fila ? enPizzas(fila.vendidas_mitades) : "—"}</td>
                  <td className="right tbl-strong">{quedan === null ? "Sin límite" : quedan === 0 ? "Agotado" : enPizzas(quedan)}</td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-primary btn-sm" disabled={ocupado || borrador === undefined || borrador.trim() === ""} onClick={() => guardar(p._dbId, p.nombre)}>Guardar</button>
                    {fila && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} disabled={ocupado} onClick={() => quitar(p._dbId, p.nombre)}>Sin límite</button>}
                  </td>
                </tr>
              );
            })}
            {!cargando && pizzas.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--a-muted)" }}>No hay pizzas en la carta.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
