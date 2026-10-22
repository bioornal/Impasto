"use client";
import { useState } from "react";
import { useSucursal } from "./SucursalProvider";
import { Interruptor } from "./Interruptor";
import { Cupos } from "./Cupos";
import { Orders } from "./Orders";
import { estadoMasas } from "@/lib/masa";
import { MENSAJE_DELIVERY_DEFAULT } from "@/lib/hours";

/** Un motivo para el cliente: se guarda al salir del campo o con Enter, no en cada tecla. */
function Motivo({ valor, placeholder, onGuardar }: { valor: string; placeholder: string; onGuardar: (texto: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const guardar = () => { if (texto.trim() !== valor.trim()) onGuardar(texto.trim()); };
  return (
    <div className="field int-motivo">
      <label>Motivo que ve el cliente</label>
      <input value={texto} placeholder={placeholder} onChange={(e) => setTexto(e.target.value)} onBlur={guardar} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

/**
 * Lo que se toca al empezar la noche (pedido del dueño, 22/10/2026): venta, delivery y masas
 * (se guardan al tocarlos), cupos y los pedidos activos.
 */
export function Arranque({ onVerPedidos }: { onVerPedidos: () => void }) {
  const { sucursal, error, recargar, cambiar } = useSucursal();

  if (!sucursal) {
    return (
      <div className="panel"><div className="panel-body">
        {error ? <>No se pudo cargar el estado del local. <button className="btn btn-ghost btn-sm" onClick={() => void recargar()}>Reintentar</button></> : "Cargando…"}
      </div></div>
    );
  }

  const delivery = sucursal.delivery_activo !== false;
  const napoletana = sucursal.masa_napoletana_activa !== false;
  const molde = sucursal.masa_molde_activa !== false;
  const avisoMasas = estadoMasas({ masaNapoletanaActiva: napoletana, masaMoldeActiva: molde }).aviso;

  return (
    <div className="arranque">
      <section className="panel">
        <div className="panel-head"><h3>Interruptores</h3><span className="tbl-muted">Se guardan al tocarlos</span></div>
        <div className="panel-body int-grid">
          <Interruptor checked={sucursal.ventas_activas} label="Tomando pedidos" detalle={sucursal.ventas_activas ? "La web acepta pedidos en horario" : "La web no toma pedidos"}
            onChange={(v) => void cambiar("ventas_activas", v, v ? "Venta prendida" : "Venta pausada")} />
          <Interruptor checked={delivery} label="Delivery" detalle={delivery ? "Haciendo envíos" : "Solo retiro"}
            onChange={(v) => void cambiar("delivery_activo", v, v ? "Delivery prendido" : "Delivery pausado")} />
          <Interruptor checked={napoletana} label="Masa napoletana" detalle={napoletana ? (molde ? "Disponible" : "Tiene que quedar una masa") : "Agotada"} disabled={napoletana && !molde}
            title={napoletana && !molde ? "La al molde está agotada: tiene que quedar al menos una masa" : undefined}
            onChange={(v) => void cambiar("masa_napoletana_activa", v, v ? "Napoletana disponible" : "Napoletana agotada")} />
          <Interruptor checked={molde} label="Masa al molde" detalle={molde ? (napoletana ? "Disponible" : "Tiene que quedar una masa") : "Agotada"} disabled={molde && !napoletana}
            title={molde && !napoletana ? "La napoletana está agotada: tiene que quedar al menos una masa" : undefined}
            onChange={(v) => void cambiar("masa_molde_activa", v, v ? "Al molde disponible" : "Al molde agotada")} />
          {!sucursal.ventas_activas && (
            <Motivo key={"cierre:" + (sucursal.mensaje_cierre || "")}valor={sucursal.mensaje_cierre || ""} placeholder="Cerramos por vacaciones hasta el 5 de enero"
              onGuardar={(t) => void cambiar("mensaje_cierre", t, "Motivo guardado")} />
          )}
          {!delivery && (
            <Motivo key={"delivery:" + (sucursal.mensaje_delivery || "")}valor={sucursal.mensaje_delivery || ""} placeholder={MENSAJE_DELIVERY_DEFAULT}
              onGuardar={(t) => void cambiar("mensaje_delivery", t, "Motivo guardado")} />
          )}
          {avisoMasas && <div className="int-motivo tbl-muted">El cliente ve: “{avisoMasas}”</div>}
        </div>
      </section>
      <section className="panel"><Orders soloActivos onVerTodos={onVerPedidos} /></section>
      <Cupos />
    </div>
  );
}
