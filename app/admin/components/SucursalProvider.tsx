"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useStore } from "./StoreProvider";
import type { CuentaTransferencia } from "@/lib/cuentas-transferencia";

export interface Sucursal {
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  email: string;
  whatsapp: string;
  horarios: string;
  dias_apertura: string;
  hora_apertura: string;
  hora_cierre: string;
  delivery_fee: number;
  envio_gratis_desde: number;
  ventas_activas: boolean;
  mensaje_cierre: string;
  delivery_activo?: boolean;
  mensaje_delivery?: string;
  masa_napoletana_activa?: boolean;
  masa_molde_activa?: boolean;
  cuentas_transferencia?: CuentaTransferencia[];
}

interface SucursalCtx {
  sucursal: Sucursal | null;
  cargando: boolean;
  error: string;
  recargar: () => Promise<void>;
  /** Interruptores y motivos del Arranque: se ve al instante y vuelve atrás si el servidor dice que no. */
  cambiar: <K extends keyof Sucursal>(campo: K, valor: Sucursal[K], aviso?: string) => Promise<boolean>;
  /** Pestañas de Configuración: guarda varios campos juntos. */
  guardar: (parcial: Partial<Sucursal>) => Promise<boolean>;
}

const Ctx = createContext<SucursalCtx | null>(null);

export const useSucursal = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSucursal must be inside SucursalProvider");
  return ctx;
};

async function enviar(parcial: Partial<Sucursal>): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/sucursal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parcial),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok && json.ok ? null : json.error || "No se pudo guardar";
  } catch {
    return "No se pudo guardar: revisá la conexión";
  }
}

/** La fila de `sucursales`, compartida por la barra superior, el Arranque y Configuración. */
export function SucursalProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useStore();
  const [sucursal, setSucursal] = useState<Sucursal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sucursal", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data) throw new Error(json.error || "No se pudo cargar el estado del local");
      setSucursal(json.data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el estado del local");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API, como el resto del panel
    void recargar();
    const alVolver = () => { if (document.visibilityState === "visible") void recargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);

  const cambiar = useCallback(async <K extends keyof Sucursal>(campo: K, valor: Sucursal[K], aviso?: string) => {
    if (!sucursal) return false;
    const antes = sucursal[campo];
    setSucursal((s) => (s ? { ...s, [campo]: valor } : s));
    const fallo = await enviar({ [campo]: valor } as Partial<Sucursal>);
    if (fallo) {
      setSucursal((s) => (s ? { ...s, [campo]: antes } : s));
      showToast(fallo);
      return false;
    }
    if (aviso) showToast(aviso);
    return true;
  }, [sucursal, showToast]);

  const guardar = useCallback(async (parcial: Partial<Sucursal>) => {
    const fallo = await enviar(parcial);
    if (fallo) { showToast(fallo); return false; }
    setSucursal((s) => (s ? { ...s, ...parcial } : s));
    showToast("Cambios guardados");
    return true;
  }, [showToast]);

  return <Ctx.Provider value={{ sucursal, cargando, error, recargar, cambiar, guardar }}>{children}</Ctx.Provider>;
}
