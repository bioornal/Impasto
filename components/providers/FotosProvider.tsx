"use client";
import { createContext, useContext, useMemo } from "react";
import type { CatalogData } from "@/types";

/** id de producto → foto vigente (la misma que muestran las tarjetas). */
const FotosCtx = createContext<Record<string, string>>({});

/**
 * El carrito guarda solo `key`/`illus`, no la foto: así un borrador viejo (cookie o
 * localStorage) seguiría mostrando la foto de cuando se agregó. Se resuelve al
 * dibujar, contra el catálogo actual.
 */
export function FotosProvider({ data, children }: { data: CatalogData; children: React.ReactNode }) {
  const fotos = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const producto of [...data.pizzas, ...data.empanadas, ...data.bebidas]) {
      if (producto.foto) mapa[producto.id] = producto.foto;
    }
    return mapa;
  }, [data]);
  return <FotosCtx.Provider value={fotos}>{children}</FotosCtx.Provider>;
}

export const useFotos = () => useContext(FotosCtx);
