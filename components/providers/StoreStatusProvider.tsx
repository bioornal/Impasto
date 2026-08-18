"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface EstadoTiendaCliente {
  abierto: boolean;
  motivo: string;
  cierreManual: boolean;
}

const StoreStatusContext = createContext<EstadoTiendaCliente>({ abierto: true, motivo: "", cierreManual: false });

export const useStoreStatus = () => useContext(StoreStatusContext);

/**
 * La home se sirve con ISR, así que el estado inicial puede llegar hasta un
 * minuto viejo. Se refresca en el cliente para que el local pueda cortar las
 * ventas y verse reflejado sin esperar a que revalide la página.
 */
export function StoreStatusProvider({ inicial, children }: { inicial: EstadoTiendaCliente; children: ReactNode }) {
  const [estado, setEstado] = useState(inicial);

  useEffect(() => {
    let activo = true;

    const consultar = async () => {
      try {
        const respuesta = await fetch("/api/store-status", { cache: "no-store" });
        const datos = await respuesta.json();
        if (activo && datos?.ok) {
          setEstado({ abierto: datos.abierto, motivo: datos.motivo, cierreManual: datos.cierreManual });
        }
      } catch { /* si falla la consulta se conserva el último estado conocido */ }
    };

    consultar();
    const timer = setInterval(consultar, 60000);
    // Al volver a la pestaña conviene revisar antes de dejar pedir.
    const alVolver = () => { if (document.visibilityState === "visible") consultar(); };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      activo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return <StoreStatusContext.Provider value={estado}>{children}</StoreStatusContext.Provider>;
}

/** Franja fija arriba del sitio cuando no se está tomando pedidos. */
export function ClosedBanner() {
  const estado = useStoreStatus();
  if (estado.abierto) return null;

  return (
    <div className="closed-banner" role="status">
      <span className="closed-dot" />
      <span>
        <b>{estado.cierreManual ? "No estamos tomando pedidos" : "Local cerrado"}</b>
        <small>{estado.motivo}</small>
      </span>
    </div>
  );
}
