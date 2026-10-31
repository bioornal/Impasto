"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { EstadoDelivery } from "@/lib/hours";
import { TODAS_LAS_MASAS, type EstadoMasas } from "@/lib/masa";
import type { QuedanMasas } from "@/lib/masas-noche";

export interface EstadoTiendaCliente {
  abierto: boolean;
  motivo: string;
  etiqueta: string;
  cierreManual: boolean;
  delivery: EstadoDelivery;
  masas: EstadoMasas;
  /** Pizzas que quedan esta noche por masa (31/10/2026); null = sin límite. */
  masasNoche?: QuedanMasas | null;
}

const DELIVERY_ACTIVO: EstadoDelivery = { activo: true, motivo: "" };

const StoreStatusContext = createContext<EstadoTiendaCliente>({ abierto: true, motivo: "", etiqueta: "", cierreManual: false, delivery: DELIVERY_ACTIVO, masas: TODAS_LAS_MASAS });

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
          setEstado({
            abierto: datos.abierto,
            motivo: datos.motivo,
            etiqueta: datos.etiqueta,
            cierreManual: datos.cierreManual,
            delivery: datos.delivery ?? DELIVERY_ACTIVO,
            masas: datos.masas ?? TODAS_LAS_MASAS,
            masasNoche: datos.masasNoche && typeof datos.masasNoche === "object" ? datos.masasNoche : null,
          });
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

