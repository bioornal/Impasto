"use client";
import { useMemo, useState } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { MEDIOS, etiquetaDia, formatoUnidades, resumenPorDia } from "@/lib/resumen-diario";
import { MEDIOS_PAGO, nombreMedio, pedidosDeLaNoche } from "@/lib/medio-pago";
import type { AdminOrder } from "./types";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
/** Hasta 30 noches con ventas en la tabla de abajo. */
const NOCHES_EN_TABLA = 30;

/**
 * Resumen diario (pedido del dueño, 17/10/2026): cada noche de 06:00 a 05:59,
 * unidades (pizza o docena de empanadas), pedidos y plata por medio de pago. Web y POS juntos, misma regla que el Dashboard.
 */
export function ResumenDiario() {
  const { state } = useStore();
  // Por categoría y no por `type`: el panel marca "pizza" a todo lo que no es empanada ni bebida.
  const carta = useMemo(() => ({
    pizzas: new Set(state.products.filter((p) => /pizz/i.test(p.categoria)).map((p) => p.nombre)),
    empanadas: new Set(state.products.filter((p) => /empan/i.test(p.categoria)).map((p) => p.nombre)),
  }), [state.products]);
  const dias = useMemo(() => resumenPorDia(state.orders, carta), [state.orders, carta]);
  const [elegido, setElegido] = useState<string | null>(null);

  if (dias.length === 0) {
    return <div className="panel"><div className="panel-body" style={{ color: "var(--a-muted)", fontSize: 13 }}>Todavía no hay ventas para resumir.</div></div>;
  }

  const indice = Math.max(0, dias.findIndex((d) => d.dia === elegido));
  const dia = dias[indice];
  const medios = MEDIOS.filter((m) => m.id !== "otro" || dia.medios.otro.pedidos > 0);

  return (
    <>
      <div className="resumen-nav">
        <button className="btn btn-ghost" onClick={() => setElegido(dias[indice + 1].dia)} disabled={indice >= dias.length - 1} aria-label="Noche anterior">‹</button>
        <div>
          <b>{etiquetaDia(dia.dia)}</b>
          <small>{indice === 0 ? "Última noche con ventas" : "De 06:00 a 06:00 del día siguiente"}</small>
        </div>
        <button className="btn btn-ghost" onClick={() => setElegido(dias[indice - 1].dia)} disabled={indice === 0} aria-label="Noche siguiente">›</button>
      </div>

      <div className="kpi-grid resumen-kpis">
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon"><Icon.Pizza /></div>Unidades</div>
          <div className="kpi-value">{formatoUnidades(dia.unidades)}</div>
          <span className="kpi-delta" style={{ background: "var(--a-bg-2)", color: "var(--a-muted)" }}>
            {dia.docenas > 0
              ? `${dia.pizzas} ${dia.pizzas === 1 ? "pizza" : "pizzas"} · ${formatoUnidades(dia.docenas)} ${dia.docenas === 1 ? "docena" : "docenas"}`
              : `Pizzas: web ${dia.pizzasWeb} · POS ${dia.pizzasPos}`}
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "var(--a-info-soft)", color: "var(--a-info)" }}><Icon.Orders /></div>Pedidos</div>
          <div className="kpi-value">{dia.pedidos}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><div className="kpi-icon" style={{ background: "var(--a-success-soft)", color: "var(--a-success)" }}><Icon.Revenue /></div>Total vendido</div>
          <div className="kpi-value">{fmt(dia.total)}</div>
          <span className="kpi-delta" style={{ background: "var(--a-bg-2)", color: "var(--a-muted)" }}>Con envíos</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Por medio de pago</h3></div>
        <div className="panel-body no-pad tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Medio</th><th className="right">Pedidos</th><th className="right">Unidades</th><th className="right">Total</th></tr></thead>
            <tbody>
              {medios.map((m) => (
                <tr key={m.id}>
                  <td className="tbl-strong">{m.nombre}</td>
                  <td className="right">{dia.medios[m.id].pedidos}</td>
                  <td className="right">{formatoUnidades(dia.medios[m.id].pizzas + dia.medios[m.id].docenas)}</td>
                  <td className="right tbl-strong">{fmt(dia.medios[m.id].total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PedidosDeLaNoche dia={dia.dia} />

      <div className="panel mt-20">
        <div className="panel-head"><h3>Últimas noches</h3></div>
        <div className="panel-body no-pad tbl-wrap">
          <table className="tbl resumen-dias">
            <thead>
              <tr><th>Noche</th><th className="right">Unidades</th><th className="right">Pedidos</th><th className="right">Efectivo</th><th className="right">Transferencia</th><th className="right">Mercado Pago</th><th className="right">Total</th></tr>
            </thead>
            <tbody>
              {dias.slice(0, NOCHES_EN_TABLA).map((d) => (
                <tr key={d.dia} className={d.dia === dia.dia ? "elegido" : ""} style={{ cursor: "pointer" }} onClick={() => setElegido(d.dia)}>
                  <td className="tbl-strong">{etiquetaDia(d.dia)}</td>
                  <td className="right tbl-strong">{formatoUnidades(d.unidades)}</td>
                  <td className="right">{d.pedidos}</td>
                  <td className="right">{fmt(d.medios.efectivo.total)}</td>
                  <td className="right">{fmt(d.medios.transferencia.total)}</td>
                  <td className="right">{fmt(d.medios.mercadopago.total)}</td>
                  <td className="right tbl-strong">{fmt(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

/**
 * Los pedidos de la noche elegida con su medio de pago, para corregirlo si se cargó mal (sobre todo
 * desde el POS) y que la rendición del efectivo del delivery cierre (18/10/2026). Ver lib/medio-pago.ts.
 */
function PedidosDeLaNoche({ dia }: { dia: string }) {
  const { state, updateOrderMethod } = useStore();
  const [guardando, setGuardando] = useState<string | null>(null);
  const pedidos = useMemo(() => pedidosDeLaNoche(state.orders, dia), [state.orders, dia]);
  if (pedidos.length === 0) return null;

  const cambiar = async (o: AdminOrder, metodo: string) => {
    if (metodo === o.pago) return;
    const pregunta = `¿Cambiar el pedido ${o.numero || o.id} (${fmt(o.total)}) de ${nombreMedio(o.pago)} a ${nombreMedio(metodo)}?`
      + (metodo === "mercadopago" && o.pagoEstado !== "aprobado" ? " Queda como cobrado por Mercado Pago." : "");
    if (!window.confirm(pregunta)) return;
    setGuardando(o._dbId);
    try { await updateOrderMethod(o._dbId, metodo); } finally { setGuardando(null); }
  };

  return (
    <div className="panel mt-20">
      <div className="panel-head">
        <h3>Pedidos de la noche</h3>
        <div className="panel-head-spacer" />
        <span className="tbl-muted" style={{ fontSize: 12 }}>Si un medio quedó mal cargado, cambialo acá: se corrige el resumen, la caja del POS y el recetario.</span>
      </div>
      <div className="panel-body no-pad tbl-wrap">
        <table className="tbl pedidos-noche">
          <thead><tr><th>Hora</th><th>Pedido</th><th>Cliente</th><th>Canal</th><th className="right">Total</th><th>Medio de pago</th></tr></thead>
          <tbody>
            {pedidos.map((o) => {
              const sinConfirmar = o.pago === "mercadopago" && o.pagoEstado !== "aprobado";
              return (
                <tr key={o._dbId}>
                  <td className="tbl-mono">{hora(o.fecha)}</td>
                  <td className="tbl-strong">{o.numero || o.id}</td>
                  <td>{o.cliente}</td>
                  <td>{o.canal === "pos" ? "POS" : "Web"}</td>
                  <td className="right tbl-strong">{fmt(o.total)}</td>
                  <td>
                    {o.medioEditable ? (
                      <select className="medio-select" value={o.pago} disabled={guardando === o._dbId}
                        onChange={(e) => cambiar(o, e.target.value)} aria-label={`Medio de pago del pedido ${o.numero || o.id}`}>
                        {!MEDIOS_PAGO.some((m) => m.id === o.pago) && <option value={o.pago}>{nombreMedio(o.pago)}</option>}
                        {MEDIOS_PAGO.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    ) : (
                      <span title="Pago con tarjeta de la web: lo confirma Mercado Pago">Tarjeta · Mercado Pago</span>
                    )}
                    {sinConfirmar && <small className="medio-aviso">sin confirmar · no suma</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
