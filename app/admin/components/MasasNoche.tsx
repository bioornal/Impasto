"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./StoreProvider";
import { quedanMasas, type FilaMasas } from "@/lib/masas-noche";
import { etiquetaDia } from "@/lib/resumen-diario";

/** Espera entre el último toque de flechita y el guardado: varios toques seguidos son un solo PUT. */
const ESPERA_GUARDADO_MS = 700;
const POCAS = 3;

/**
 * Masas de esta noche (pedido del dueño, 24/10/2026): cuántas pizzas en total se pueden vender según
 * las masas que hay. El número es "cuántas me quedan AHORA": se carga al abrir o en cualquier momento
 * de la noche, y cada pizza vendida (web o POS) descuenta una. En 0 la web y el POS dejan de vender
 * pizzas. Sin cargar = sin límite. Controla la base; a las 06:00 empieza una noche nueva sin cargar.
 */
export function MasasNoche() {
  const { showToast } = useStore();
  const [fila, setFila] = useState<FilaMasas | null>(null);
  const [noche, setNoche] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Lo que el dueño acaba de tocar y todavía no se guardó (undefined = nada pendiente). */
  const [tocado, setTocado] = useState<number | null | undefined>(undefined);
  const [texto, setTexto] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/masas");
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron leer las masas");
      setFila(json.data);
      setNoche(json.noche);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron leer las masas");
    } finally {
      setCargado(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API, como el resto del panel
    recargar();
    const id = setInterval(recargar, 30_000);
    return () => { clearInterval(id); if (timer.current) clearTimeout(timer.current); };
  }, [recargar]);

  const guardar = useCallback(async (quedan: number | null) => {
    try {
      const res = await fetch("/api/admin/masas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quedan }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar");
      showToast(quedan === null ? "Masas: sin límite esta noche" : quedan === 0 ? "Sin masas: la venta de pizzas quedó cortada" : `Masas: quedan ${quedan} para esta noche`);
      await recargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setTocado(undefined);
    }
  }, [recargar, showToast]);

  const fijar = (quedan: number | null, inmediato = false) => {
    setTocado(quedan);
    if (timer.current) clearTimeout(timer.current);
    if (inmediato) { timer.current = null; void guardar(quedan); return; }
    timer.current = setTimeout(() => { timer.current = null; void guardar(quedan); }, ESPERA_GUARDADO_MS);
  };

  const guardado = quedanMasas(fila);
  const quedan = tocado !== undefined ? tocado : guardado;
  const vendidas = fila?.vendidas ?? 0;
  const sinLimite = quedan === null;
  const estado = sinLimite ? "sin-cargar" : quedan === 0 ? "agotado" : quedan <= POCAS ? "pocas" : "ok";

  const confirmarTexto = () => {
    if (texto === null) return;
    const limpio = texto.trim();
    setTexto(null);
    if (limpio === "") return;
    const n = Number(limpio);
    if (!Number.isInteger(n) || n < 0 || n > 2000) { showToast("Poné un número entero de masas, de 0 a 2000"); return; }
    if (n !== quedan) fijar(n, true);
  };

  return (
    <section className={`panel masas masas-${estado}`} aria-labelledby="masas-titulo">
      <div className="panel-head">
        <h3 id="masas-titulo">Masas de la noche{noche ? ` · ${etiquetaDia(noche)}` : ""}</h3>
        <div className="panel-head-spacer" />
        {!sinLimite && <button className="btn btn-ghost btn-sm" onClick={() => fijar(null, true)} title="La web y el POS vuelven a vender pizzas sin tope">Quitar límite</button>}
      </div>
      <div className="panel-body masas-body">
        <div className="masas-estado">
          {!cargado ? <span className="tbl-muted">Cargando…</span> : sinLimite ? (
            <>
              <b className="masas-titulo">Sin cargar · sin límite</b>
              <span>Cargá cuántas masas tenés: al llegar a 0, la web y el POS dejan de vender pizzas.{vendidas > 0 ? ` Ya se vendieron ${vendidas} esta noche: poné las que te quedan ahora.` : ""}</span>
            </>
          ) : (
            <>
              <b className="masas-titulo">{quedan === 0 ? "Sin masas · pizzas cortadas" : `Quedan ${quedan} ${quedan === 1 ? "pizza" : "pizzas"}`}</b>
              <span>Vendidas {vendidas} · {quedan === 0 ? "la web y el POS no venden más pizzas esta noche" : "cada pizza que se vende descuenta una"}</span>
            </>
          )}
          {error && <span className="masas-error">{error}</span>}
        </div>
        <div className="masas-ctrl">
          <label htmlFor="masas-quedan">Me quedan</label>
          <div className="masas-stepper">
            <button type="button" onClick={() => quedan !== null && fijar(Math.max(0, quedan - 1))} disabled={!cargado || quedan === null || quedan === 0} aria-label="Una masa menos">−</button>
            <input
              id="masas-quedan"
              type="text"
              inputMode="numeric"
              placeholder="—"
              value={texto ?? (quedan === null ? "" : String(quedan))}
              disabled={!cargado}
              onFocus={(e) => { setTexto(quedan === null ? "" : String(quedan)); e.target.select(); }}
              onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))}
              onBlur={confirmarTexto}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setTexto(null); (e.target as HTMLInputElement).blur(); } }}
              aria-describedby="masas-titulo"
            />
            <button type="button" onClick={() => quedan !== null && fijar(Math.min(2000, quedan + 1))} disabled={!cargado || quedan === null} aria-label="Una masa más">+</button>
          </div>
        </div>
      </div>
    </section>
  );
}
