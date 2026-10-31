"use client";
import { useSucursal } from "./SucursalProvider";
import { useMasasNoche } from "./MasasNocheProvider";
import { estadoMasas, masaUnica, nombreMasa } from "@/lib/masa";

/** Venta · Delivery · Masas, siempre a la vista. Tocar una lleva al Arranque, donde se cambia. */
export function EstadoLocal({ onIr }: { onIr: () => void }) {
  const { sucursal, error } = useSucursal();
  const { quedan } = useMasasNoche();
  if (error && !sucursal) return <button className="pill pill-warn" onClick={onIr}>Estado del local sin cargar</button>;
  if (!sucursal) return null;
  const masas = estadoMasas({ masaNapoletanaActiva: sucursal.masa_napoletana_activa, masaMoldeActiva: sucursal.masa_molde_activa });
  const queda = masaUnica(masas);
  const delivery = sucursal.delivery_activo !== false;
  return (
    <div className="estado-local" aria-label="Estado del local">
      <button className={`pill ${sucursal.ventas_activas ? "pill-ok" : "pill-off"}`} onClick={onIr}>
        {sucursal.ventas_activas ? "Tomando pedidos" : "Venta pausada"}
      </button>
      <button className={`pill ${delivery ? "pill-ok" : "pill-off"}`} onClick={onIr}>
        {delivery ? "Delivery" : "Solo retiro"}
      </button>
      {quedan ? (
        <button className={`pill ${quedan.napoletana + quedan.molde === 0 ? "pill-off" : quedan.napoletana <= 3 || quedan.molde <= 3 ? "pill-warn" : "pill-ok"}`} onClick={onIr}>
          {quedan.napoletana + quedan.molde === 0 ? "Sin masas" : `Napoletana ${quedan.napoletana} · Molde ${quedan.molde}`}
        </button>
      ) : (
        <button className={`pill ${queda ? "pill-warn" : "pill-ok"}`} onClick={onIr}>
          {queda ? `Solo masa ${nombreMasa(queda)}` : "Dos masas"}
        </button>
      )}
    </div>
  );
}
