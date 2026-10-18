"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./StoreProvider";
import { SIN_LIMITE_PIZZAS, mitadesDesdePizzas, pasoCupo, quedanPizzas, type FilaCupo } from "@/lib/cupos";

const enPizzas = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
/** Espera entre el último toque de flechita y el guardado: tres toques seguidos son un solo PUT. */
const ESPERA_GUARDADO_MS = 700;

export interface CuposNoche {
  noche: string | null;
  error: string | null;
  fila: (productoId: string) => FilaCupo | undefined;
  /** Lo que queda (en pizzas), con lo que el dueño acaba de tocar y todavía no se guardó. */
  quedan: (productoId: string) => number;
  fijar: (productoId: string, nombre: string, pizzas: number) => void;
  recargar: () => Promise<void>;
}

/**
 * Cupos de esta noche para el panel (18/10/2026). Cada pizza arranca en 100 (sin límite) y el dueño
 * baja las que no tiene: el número es "cuántas me quedan para vender". Se refresca cada 30 s.
 */
export function useCuposNoche(): CuposNoche {
  const { showToast } = useStore();
  const [filas, setFilas] = useState<Map<string, FilaCupo>>(new Map());
  const [noche, setNoche] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tocados, setTocados] = useState<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cupos");
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron leer los cupos");
      setFilas(new Map((json.data as FilaCupo[]).map((f) => [f.producto_id, f])));
      setNoche(json.noche);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron leer los cupos");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API, como el resto del panel
    recargar();
    const id = setInterval(recargar, 30_000);
    const pendientes = timers.current;
    return () => { clearInterval(id); pendientes.forEach(clearTimeout); };
  }, [recargar]);

  const guardar = useCallback(async (productoId: string, nombre: string, pizzas: number) => {
    try {
      const res = await fetch("/api/admin/cupos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto_id: productoId, quedan: pizzas }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar");
      showToast(pizzas >= SIN_LIMITE_PIZZAS ? `${nombre}: sin límite esta noche` : pizzas === 0 ? `${nombre}: agotada esta noche` : `${nombre}: quedan ${enPizzas(pizzas)} esta noche`);
      await recargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setTocados((t) => { const resto = { ...t }; delete resto[productoId]; return resto; });
    }
  }, [recargar, showToast]);

  const fijar = useCallback((productoId: string, nombre: string, pizzas: number) => {
    setTocados((t) => ({ ...t, [productoId]: pizzas }));
    const previo = timers.current.get(productoId);
    if (previo) clearTimeout(previo);
    timers.current.set(productoId, setTimeout(() => {
      timers.current.delete(productoId);
      guardar(productoId, nombre, pizzas);
    }, ESPERA_GUARDADO_MS));
  }, [guardar]);

  return {
    noche,
    error,
    fila: (id) => filas.get(id),
    quedan: (id) => tocados[id] ?? quedanPizzas(filas.get(id)),
    fijar,
    recargar,
  };
}

/** − [número] + para una pizza: el número es cuántas quedan para vender esta noche. */
export function CupoControl({ productoId, nombre, cupos }: { productoId: string; nombre: string; cupos: CuposNoche }) {
  const valor = cupos.quedan(productoId);
  const fila = cupos.fila(productoId);
  const [texto, setTexto] = useState<string | null>(null);

  const confirmar = () => {
    if (texto === null) return;
    const mitades = mitadesDesdePizzas(texto);
    setTexto(null);
    if (mitades === null || mitades / 2 === valor) return;
    cupos.fijar(productoId, nombre, Math.min(SIN_LIMITE_PIZZAS, mitades / 2));
  };

  return (
    <div className={`cupo-ctrl ${valor === 0 ? "agotado" : valor < SIN_LIMITE_PIZZAS ? "limitado" : ""}`}>
      <button type="button" onClick={() => cupos.fijar(productoId, nombre, pasoCupo(valor, -1))} disabled={valor <= 0} aria-label={`Una media menos de ${nombre}`}>−</button>
      <input
        type="text"
        inputMode="decimal"
        value={texto ?? enPizzas(valor)}
        onFocus={(e) => { setTexto(enPizzas(valor)); e.target.select(); }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setTexto(null); }}
        aria-label={`Cuántas ${nombre} quedan para vender esta noche`}
      />
      <button type="button" onClick={() => cupos.fijar(productoId, nombre, pasoCupo(valor, 1))} disabled={valor >= SIN_LIMITE_PIZZAS} aria-label={`Una media más de ${nombre}`}>+</button>
      {valor === 0 ? <small>Agotada</small> : fila && fila.vendidas_mitades > 0 ? <small>vendidas {enPizzas(fila.vendidas_mitades / 2)}</small> : null}
    </div>
  );
}
