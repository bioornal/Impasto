"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { quedanMasas, type FilaMasas, type QuedanMasas } from "@/lib/masas-noche";

interface MasasNocheCtx {
  filas: FilaMasas[];
  /** Las masas que quedan por tipo; null = sin ningún número cargado (sin límite). */
  quedan: QuedanMasas | null;
  noche: string | null;
  cargado: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

const Ctx = createContext<MasasNocheCtx | null>(null);

export const useMasasNoche = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMasasNoche must be inside MasasNocheProvider");
  return ctx;
};

/** Los números de la noche, compartidos por la barra superior y el Arranque. Se refrescan cada 30 s. */
export function MasasNocheProvider({ children }: { children: React.ReactNode }) {
  const [filas, setFilas] = useState<FilaMasas[]>([]);
  const [noche, setNoche] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/masas");
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron leer las masas");
      setFilas(json.data);
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
    return () => clearInterval(id);
  }, [recargar]);

  const quedan = useMemo(() => quedanMasas(filas), [filas]);
  return <Ctx.Provider value={{ filas, quedan, noche, cargado, error, recargar }}>{children}</Ctx.Provider>;
}
