"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { loadProviderRefundIntent, prepareProviderRefundIntent, completeProviderRefundIntent } from "@/lib/provider-refund-intent";
import { ManualRefundBox } from "./ManualRefundBox";
import type { ManualRefund } from "@/lib/manual-refund";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import type { AdminOrder } from "./types";
import { esPedidoParaCocina } from "@/lib/pedido-visible";
import { adminPrintJobs } from "@/lib/admin-print-job";
import { configurePrinter, getPrinterSelection, imprimirCopias, mensajeCopias, newAttemptId, selectPrinter, type PrintCopy, type PrinterId, type PrinterSelection, type PrintJob } from "@/lib/local-printer";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};
const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const FILTERS: [string, string][] = [["todos","Todos"],["nuevo","Nuevos"],["preparando","Preparando"],["en-camino","En camino"],["entregado","Entregados"],["cancelado","Cancelados"]];

export function Orders() {
  const { state, updateOrderStatus, updateOrderPayment, deleteOrders, refundOrder, recordManualRefund, reload } = useStore();
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [printState, setPrintState] = useState<{ orderId: string; message: string; error: boolean } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printerSelection, setPrinterSelection] = useState<PrinterSelection | null>(null);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [eliminando, setEliminando] = useState(false);
  const printingRef = useRef(false);
  // Copias que no salieron, por pedido, con sus claves: reintentar no duplica lo que ya salió.
  const failedAttempts = useRef(new Map<string, PrintJob[]>());
  const sentOrders = useRef(new Set<string>());
  useEffect(() => { void getPrinterSelection().then(setPrinterSelection).catch(() => setPrinterSelection(null)); }, []);

  async function printOrder(order: AdminOrder, copias: readonly PrintCopy[] = ['cocina', 'cliente']) {
    if (printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    try {
      const previas = failedAttempts.current.get(order._dbId) ?? [];
      const reintento = previas.filter(job => copias.includes(job.copy ?? 'cocina'));
      const jobs = reintento.length ? reintento : adminPrintJobs(order, newAttemptId(), sentOrders.current.has(order._dbId), copias);
      const resultado = await imprimirCopias(jobs);
      const quedan = [...previas.filter(job => !jobs.includes(job)), ...resultado.pendientes];
      if (quedan.length) failedAttempts.current.set(order._dbId, quedan);
      else failedAttempts.current.delete(order._dbId);
      if (resultado.pendientes.length < jobs.length) sentOrders.current.add(order._dbId);
      const mensaje = mensajeCopias(jobs, resultado);
      setPrintState({ orderId: order._dbId, message: mensaje.ok ? `${mensaje.texto} Revisá el papel para confirmar la impresión.` : mensaje.texto, error: !mensaje.ok });
    } catch (error) {
      setPrintState({ orderId: order._dbId, message: error instanceof Error ? error.message : 'No se pudo enviar la comanda.', error: true });
    } finally {
      printingRef.current = false;
      setPrinting(false);
    }
  }

  async function pairPrinter() {
    const token = window.prompt('Pegá el secreto de la impresora local:');
    if (token === null) return;
    try {
      await configurePrinter(token);
      setPrinterSelection(await getPrinterSelection());
      setPrintState({ orderId: '', message: 'Impresora local emparejada.', error: false });
    } catch (error) {
      setPrintState({ orderId: '', message: error instanceof Error ? error.message : 'No se pudo emparejar.', error: true });
    }
  }

  async function choosePrinter(printer: PrinterId) {
    setPrinterBusy(true);
    try {
      await selectPrinter(printer);
      setPrinterSelection(await getPrinterSelection());
      setPrintState({ orderId: '', message: `Impasto usará ${printer === 'epson' ? 'Epson TM-T20II' : '3nStar RPT006B'} en las próximas comandas.`, error: false });
    } catch (error) {
      try { setPrinterSelection(await getPrinterSelection()); } catch { /* Keep the last confirmed choice. */ }
      setPrintState({ orderId: '', message: error instanceof Error ? error.message : 'No se pudo guardar la impresora.', error: true });
    } finally { setPrinterBusy(false); }
  }

  /** Irreversible: pide confirmación con la cantidad y avisa cuáles no se pudieron eliminar. */
  async function eliminar(ids: string[]) {
    if (ids.length === 0 || eliminando) return;
    const ordenes = state.orders.filter(o => ids.includes(o._dbId));
    const detalle = ordenes.length === 1 ? `el pedido ${ordenes[0].id} de ${ordenes[0].cliente}` : `${ordenes.length} pedidos`;
    if (!window.confirm(`¿Eliminar ${detalle} para siempre?

Se borra de la base de datos y de las ventas y ganancias. No se puede deshacer.`)) return;
    setEliminando(true);
    try {
      const { eliminados, bloqueados } = await deleteOrders(ids);
      setMarcados(prev => new Set([...prev].filter(id => !eliminados.includes(id))));
      setSelected(prev => (prev && eliminados.includes(prev._dbId) ? null : prev));
      if (bloqueados.length > 0) {
        setPrintState({ orderId: '', error: true, message: `No se pudo eliminar ${bloqueados.length}: ${bloqueados.map(b => `${b.pedido} (${b.motivo})`).join(' · ')}` });
      }
    } finally { setEliminando(false); }
  }

  const filtered = useMemo(() => {
    let list = state.orders;
    if (filter !== "todos") list = list.filter(o => o.estado === filter);
    if (q.trim()) list = list.filter(o => (o.id + " " + o.cliente + " " + o.tel).toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [state.orders, filter, q]);

  const counts: Record<string, number> = { todos: state.orders.length };
  ["nuevo","preparando","en-camino","entregado","cancelado"].forEach(k => { counts[k] = state.orders.filter(o => o.estado === k).length; });

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <div className="seg">
              {FILTERS.map(([k, l]) => (
                <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>
                  {l}<span className="count">{counts[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="panel-head-spacer" />
          <button
            className="btn btn-danger btn-sm"
            disabled={marcados.size === 0 || eliminando}
            title={marcados.size === 0 ? "Marcá pedidos con las casillas de la tabla" : "Eliminar los pedidos marcados"}
            onClick={() => void eliminar([...marcados])}
          >
            <Icon.Trash /> {eliminando ? "Eliminando…" : `Eliminar seleccionados (${marcados.size})`}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={pairPrinter}>Emparejar impresora</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Impresora de Impasto
            <select aria-label="Impresora de Impasto" value={printerSelection?.selected ?? ''}
              style={{ padding: '7px 9px', borderRadius: 6, border: '1px solid var(--a-line)', background: 'var(--a-bg)', color: 'inherit' }}
              disabled={!printerSelection || printerBusy}
              onChange={e => void choosePrinter(e.target.value as PrinterId)}>
              {!printerSelection && <option value="">Emparejá para elegir</option>}
              <option value="epson" disabled={printerSelection?.epsonAvailable === false}>Epson TM-T20II</option>
              <option value="3nstar" disabled={printerSelection?.threeNStarAvailable === false}>3nStar RPT006B</option>
            </select>
          </label>
          <div className="search-input">
            <Icon.Search />
            <input placeholder="Buscar N° de orden o cliente…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        {printState && (
          <div role="status" style={{ padding: '10px 16px', color: printState.error ? 'var(--a-warn)' : 'inherit' }}>
            {printState.message}{printState.error && printState.orderId && (() => {
              const retryOrder = state.orders.find(o => o._dbId === printState.orderId);
              return retryOrder && esPedidoParaCocina(retryOrder)
                ? <button className="btn btn-ghost btn-sm" disabled={printing} onClick={() => printOrder(retryOrder)}>Reintentar envío</button>
                : null;
            })()}
          </div>
        )}
        {marcados.size > 0 && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--a-warn-soft)' }}>
            <b>{marcados.size} seleccionado{marcados.size === 1 ? '' : 's'}</b>
            <button className="btn btn-ghost btn-sm" disabled={eliminando} onClick={() => setMarcados(new Set())}>Deseleccionar</button>
          </div>
        )}
        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th style={{ width: 32 }}><input type="checkbox" aria-label="Seleccionar todos los pedidos de la lista" checked={filtered.length > 0 && filtered.every(o => marcados.has(o._dbId))} onChange={e => setMarcados(e.target.checked ? new Set(filtered.map(o => o._dbId)) : new Set())} /></th><th>Orden</th><th>Cliente</th><th>Items</th><th>Modalidad</th><th>Pago</th><th className="right">Total</th><th>Estado</th><th>Hace</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o._dbId} style={{ cursor: "pointer" }} onClick={() => setSelected(o)}>
                    <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar el pedido ${o.id}`} checked={marcados.has(o._dbId)} onChange={e => setMarcados(prev => { const sig = new Set(prev); if (e.target.checked) sig.add(o._dbId); else sig.delete(o._dbId); return sig; })} /></td>
                    <td className="tbl-mono tbl-strong">{o.id}</td>
                    <td><div className="tbl-strong">{o.cliente}</div><div className="tbl-muted">{o.tel}</div></td>
                    <td className="tbl-muted">{o.items.map(i => `${i.qty}× ${i.name}`).join(", ").slice(0, 40)}…</td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{o.mode === "delivery" ? <Icon.Truck /> : <Icon.Shop />}{o.mode === "delivery" ? "Delivery" : "Retiro"}</span></td>
                    <td className="tbl-muted" style={{ textTransform: "capitalize" }}>{o.pago === "mercadopago" ? "MercadoPago" : o.pago}{o.pago === "transferencia" && o.pagoEstado === "pendiente" && (o.comprobanteSubidoAt ? <div style={{ color: "var(--a-ok, #2e7d32)", fontWeight: 600, textTransform: "none" }}>📎 Comprobante</div> : <div style={{ textTransform: "none" }}>Sin comprobante</div>)}</td>
                    <td className="right tbl-price">{fmt(o.total)}</td>
                    <td><span className={`chip chip-${o.estado}`}>{o.estado.replace("-", " ")}</span></td>
                    <td className="tbl-muted text-mono">{timeAgo(o.fecha)}</td>
                    <td className="right" style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-icon btn-ghost"
                        title={esPedidoParaCocina(o) ? "Imprimir comanda térmica" : "Pago sin acreditar: la comanda está bloqueada"}
                        disabled={!esPedidoParaCocina(o) || printing}
                        onClick={e => {
                          e.stopPropagation();
                          void printOrder(o);
                        }}
                      >
                        <Icon.Printer />
                      </button>
                      <button
                        className="btn btn-icon btn-ghost"
                        title="Ver detalle"
                        onClick={e => { e.stopPropagation(); setSelected(o); }}
                      >
                        <Icon.Eye />
                      </button>
                      <button
                        className="btn btn-icon btn-ghost"
                        title="Eliminar pedido"
                        aria-label={`Eliminar el pedido ${o.id}`}
                        disabled={eliminando}
                        onClick={e => { e.stopPropagation(); void eliminar([o._dbId]); }}
                      >
                        <Icon.Trash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty"><div className="empty-icon"><Icon.Orders /></div><b>Sin pedidos</b><div>No hay pedidos con ese filtro</div></div>}
          </div>
        </div>
      </div>

      {selected && (
        <OrderDetail
          order={selected}
          onPrint={() => printOrder(selected)}
          onPrintCliente={() => printOrder(selected, ['cliente'])}
          printing={printing}
          printMessage={printState?.orderId === selected._dbId ? printState.message : null}
          onClose={() => setSelected(null)}
          onDelete={() => void eliminar([selected._dbId])}
          onUpdate={async (estado) => {
            if (await updateOrderStatus(selected._dbId, estado)) setSelected({ ...selected, estado });
          }}
          onPayment={async (estado) => {
            if (await updateOrderPayment(selected._dbId, estado)) setSelected({ ...selected, pagoEstado: estado });
          }}
          onManualRefund={async body => { const pagoEstado=await recordManualRefund(selected._dbId,body);setSelected({...selected,pagoEstado});return pagoEstado; }}
          onRefund={async (monto, operationId) => { const ok=await refundOrder(selected._dbId,monto,operationId);if(ok){await reload();setSelected(null);}return ok; }}
          onReconcile={async () => {
            const response=await fetch(`/api/admin/pedidos/${selected._dbId}/reconciliar`,{method:'POST'});
            const result=await response.json();
            if(!response.ok || !result.ok || !result.order) throw new Error(result.error || 'No se pudo consultar el pago');
            setSelected(result.order);
            await reload();
            return result.order.pagoEstado==='pendiente' ? 'El pago sigue pendiente. No se realizó otro cobro.' : `Estado e importes conciliados: ${result.order.pagoEstado}. Esta consulta no inició un cobro ni una devolución.`;
          }}
        />
      )}
    </>
  );
}

/** Devoluciones de Mercado Pago. Pide confirmación porque mueve plata real. */
function RefundBox({ total, pedidoId, onRefund }: { total: number; pedidoId: string; onRefund: (monto?: number, operationId?: string) => Promise<boolean> }) {
  const [monto, setMonto] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [pending,setPending]=useState<ReturnType<typeof loadProviderRefundIntent>>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const intentName=`impasto_provider_refund_${pedidoId}`;
  useEffect(()=>{try{setPending(loadProviderRefundIntent(localStorage,intentName));}catch(e){setError(e instanceof Error?e.message:'No se pudo recuperar el intento');}},[intentName]);
  const submit=async()=>{setBusy(true);setError('');try{const intent=prepareProviderRefundIntent(localStorage,intentName,parcial?importe:undefined,()=>crypto.randomUUID());setPending(intent);if(await onRefund(intent.amount,intent.operationId)){completeProviderRefundIntent(localStorage,intentName,intent.operationId);setPending(null);setConfirmando(false);setMonto('');}else setError('Intento no confirmado. Reintentá la misma operación; no inicies otra devolución.');}catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar');}finally{setBusy(false);}};

  const parcial = Number(monto) > 0 && Number(monto) < total;
  const importe = parcial ? Number(monto) : total;
  const invalido = monto !== "" && (!Number.isFinite(Number(monto)) || Number(monto) <= 0 || Number(monto) > total);

  if(total<=0 && !pending && !error)return null;
  return (
    <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, marginTop: 12 }}>
      <b>Devolver dinero</b>
      <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Dejá el monto vacío para devolver el total ({fmt(total)}).
      </div>

      {pending ? <div><p>Devolución pendiente de confirmación: {pending.amount===undefined?'saldo restante':fmt(pending.amount)}. Conservamos la misma operación.</p><button className="btn btn-danger btn-sm" disabled={busy} onClick={submit}>Reintentar la misma devolución</button></div> : !confirmando ? (
        <div className="flex gap-8" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ maxWidth: 140 }}
            placeholder={`Parcial (máx ${total})`}
            inputMode="decimal"
            value={monto}
            onChange={e => setMonto(e.target.value)}
          />
          <button className="btn btn-danger btn-sm" disabled={invalido || total<=0 || busy} onClick={() => setConfirmando(true)}>
            Devolver {invalido ? "" : fmt(importe)}
          </button>
        </div>
      ) : (
        <div className="flex gap-8" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <span>¿Confirmás devolver <b>{fmt(importe)}</b>? Esto no se puede deshacer.</span>
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={submit}>
            Sí, iniciar nueva devolución
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmando(false)}>Cancelar</button>
        </div>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}

function OrderDetail({ order, onClose, onUpdate, onPayment, onRefund, onPrint, onPrintCliente, printing, printMessage, onReconcile, onManualRefund, onDelete }: { order: AdminOrder; onClose: () => void; onDelete: () => void; onUpdate: (estado: string) => void; onPayment: (estado: string) => void; onRefund?: (monto?: number, operationId?: string) => Promise<boolean>; onPrint: () => void; onPrintCliente: () => void; printing: boolean; printMessage: string | null; onReconcile:()=>Promise<string>; onManualRefund:(body:ManualRefund)=>Promise<string> }) {
  const [now] = useState(() => Date.now());
  const [consulting,setConsulting]=useState(false);
  const [consultMessage,setConsultMessage]=useState('');
  const [ledger,setLedger]=useState<{cobros:number;devoluciones:number;neto:number;cantidad:number;sinFecha:number}|null>(null);
  const [ledgerError,setLedgerError]=useState('');
  useEffect(()=>{
    let active=true;setLedger(null);setLedgerError('');
    fetch(`/api/admin/pedidos/${order._dbId}/movimientos`,{cache:'no-store'})
      .then(async response=>{const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || 'Movimientos no disponibles');if(active)setLedger(result.totales);})
      .catch(error=>{if(active)setLedgerError(error instanceof Error?error.message:'Movimientos no disponibles');});
    return ()=>{active=false;};
  },[order._dbId,order.pagoEstado,consultMessage]);
  const money=(cents:number)=>'$'+(cents/100).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const steps = ["nuevo", "preparando", "en-camino", "entregado"];
  const currentIdx = steps.indexOf(order.estado);
  const habilitadoCocina = esPedidoParaCocina(order);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="grow"><h3>Orden {order.id}</h3><small>{fmtDateTime(order.fecha)} · {timeAgo(order.fecha)}</small></div>
          <span className={`chip chip-${order.estado}`}>{order.estado.replace("-", " ")}</span>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12 }}>Seguimiento</h4>
          <div className="timeline">
            {[["nuevo","Pedido recibido"],["preparando","En preparación"],["en-camino", order.mode === "delivery" ? "En camino" : "Listo para retirar"],["entregado","Entregado"]].map(([k, l], i) => (
              <div key={k} className={`tl-item ${i < currentIdx ? "done" : i === currentIdx ? "active" : ""}`}>
                <b>{l}</b>
                <small>{i <= currentIdx ? timeAgo(new Date(now - (currentIdx - i) * 600000).toISOString()) : "pendiente"}</small>
              </div>
            ))}
          </div>

          {!habilitadoCocina && order.pago === "mercadopago" && (
            <div style={{ padding: 14, background: "var(--a-warn-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--a-warn)", marginTop: 12 }}>
              <b>Pedido bloqueado para cocina.</b>{" "}
              {order.pagoEstado === "pendiente"
                ? order.pagoMpManual
                  ? "Verificá el ingreso en la app de Mercado Pago y confirmalo desde Carro Fogón."
                  : "Esperando la acreditación automática de Mercado Pago."
                : `El pago figura como ${order.pagoEstado}; no preparar ni imprimir.`}
            </div>
          )}

          {order.estado !== "entregado" && order.estado !== "cancelado" && (
            <div className="flex gap-8 mt-12" style={{ flexWrap: "wrap" }}>
              {habilitadoCocina && currentIdx < 3 && (
                <button className="btn btn-primary" onClick={() => onUpdate(steps[currentIdx + 1])}>
                  <Icon.Arrow /> Marcar como &ldquo;{steps[currentIdx + 1].replace("-", " ")}&rdquo;
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => onUpdate("cancelado")}>Cancelar pedido</button>
            </div>
          )}

          <div className="od-customer">
            <div className="avatar" style={{ background: "var(--a-accent)", color: "white" }}>{order.cliente[0]}</div>
            <div className="grow"><b>{order.cliente}</b><div className="text-muted text-mono" style={{ fontSize: 12 }}>{order.tel}</div></div>
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/54${order.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>

          <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div><b>Pago: </b><span style={{ textTransform: "capitalize" }}>{order.pago}</span>{order.cuentaTransferencia ? <span> · {order.cuentaTransferencia}</span> : null}<div className="text-muted" style={{ fontSize: 12 }}>Estado: {order.pagoEstado}</div>{order.pago === "transferencia" && (order.comprobanteSubidoAt ? <div style={{ fontSize: 12.5, marginTop: 4 }}><a href={`/api/admin/pedidos/${order._dbId}/comprobante`} target="_blank" rel="noreferrer"><b>📎 Ver comprobante</b></a> <span className="text-muted">· subido {timeAgo(order.comprobanteSubidoAt)}</span></div> : <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>El cliente todavía no subió el comprobante</div>)}</div>
            {order.pagoEstado === "pendiente" && order.pago !== "mercadopago" && <button className="btn btn-success btn-sm" onClick={() => onPayment("aprobado")}>Marcar pago recibido</button>}
            {order.pagoEstado === "pendiente" && order.pago === "mercadopago" && <span className="text-muted" style={{ fontSize: 12 }}>{order.pagoMpManual ? "Verificar en MP y confirmar en Carro Fogón" : "Se actualiza automáticamente"}</span>}
            {order.puedeConsultarMP && <button className="btn btn-ghost btn-sm" disabled={consulting} onClick={async()=>{
              setConsulting(true);setConsultMessage('');
              try{setConsultMessage(await onReconcile());}catch(error){setConsultMessage(error instanceof Error ? error.message : 'No se pudo consultar el pago');}finally{setConsulting(false);}
            }}>{consulting ? 'Consultando…' : 'Consultar Mercado Pago'}</button>}
            {consultMessage && <div role="status" className="text-muted" style={{fontSize:12}}>{consultMessage}</div>}
          </div>

          <div role="status" className="text-muted" style={{padding:14,fontSize:12}}>
            {ledgerError || (!ledger ? 'Cargando movimientos documentados…' : ledger.cantidad===0
              ? 'Sin movimientos documentados: importes históricos no conciliados.'
              : `Cobrado bruto ${money(ledger.cobros)} · Devuelto ${money(ledger.devoluciones)} · Neto ${money(ledger.neto)}. ${ledger.sinFecha} movimientos sin fecha; no se atribuyen a hoy.`)}
            {order.puedeConsultarMP && ['parcialmente_reembolsado','reembolsado'].includes(order.pagoEstado) && <p>Ya hay una devolución. Consultar Mercado Pago concilia importes; no inicia otra devolución.</p>}
          </div>
          {order.pago === "mercadopago" && ["aprobado","parcialmente_reembolsado","reembolsado"].includes(order.pagoEstado) && order.puedeDevolverMP && onRefund && ledger && (
            <RefundBox total={ledger!.neto/100} pedidoId={order._dbId} onRefund={onRefund} />
          )}

          {order.puedeRegistrarDevolucionManual && <ManualRefundBox pedidoId={order._dbId} onRecord={onManualRefund} />}

          <div className="od-items">
            {order.items.map((i, idx) => (
              <div className="od-row" key={idx} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <span>{i.qty}× {i.name}</span>
                  <span className="tbl-price">{fmt(i.price * i.qty)}</span>
                </div>
                {i.detail ? (
                  <div style={{ fontSize: 12, color: "var(--a-muted)", paddingLeft: 12 }}>
                    ↳ {i.detail}
                  </div>
                ) : null}
              </div>
            ))}
            <div className="od-row"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {order.shipping > 0 && <div className="od-row"><span>Envío</span><span>{fmt(order.shipping)}</span></div>}
            <div className="od-row tot"><span>Total</span><span>{fmt(order.total)}</span></div>
          </div>

          {order.mode === "delivery" && (
            <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, marginTop: 16 }}>
              {order.dir}
            </div>
          )}
          {order.notas && (
            <div style={{ padding: 14, background: "var(--a-warn-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--a-warn)", marginTop: 12 }}>{order.notas}</div>
          )}
          {order.referencia && (
            <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, marginTop: 12 }}><b>Referencia:</b> {order.referencia}</div>
          )}
        </div>
        <div className="modal-foot">
          {printMessage && <span role="status" style={{ fontSize: 12 }}>{printMessage}</span>}
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Eliminar pedido</button>
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-ghost btn-sm" disabled={!habilitadoCocina} onClick={() => window.print()}>
            Imprimir con navegador
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!habilitadoCocina || printing}
            title={habilitadoCocina ? "Imprimir la copia para pegar en la caja" : "Pago sin acreditar: la comanda está bloqueada"}
            onClick={onPrintCliente}
          >
            Copia cliente
          </button>
          <button
            className="btn btn-primary"
            disabled={!habilitadoCocina || printing}
            title={habilitadoCocina ? "Enviar comanda a la cola térmica" : "Pago sin acreditar: la comanda está bloqueada"}
            onClick={onPrint}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon.Printer /> {printing ? 'Enviando…' : 'Enviar a impresora térmica'}
          </button>
        </div>
      </div>

      {/* Comanda térmica lista para impresión (80mm / 58mm) */}
      {habilitadoCocina && <ComandaTicket order={order} />}
    </div>
  );
}

export function ComandaTicket({ order }: { order: AdminOrder }) {
  const isPaid = order.pagoEstado === "aprobado";
  const isDelivery = order.mode === "delivery";

  return (
    <div className="comanda-print-ticket" aria-hidden="true">
      <div className="c-center c-brand">IMPASTO</div>
      <div className="c-center c-tagline">PIZZA NAPOLETANA</div>
      <div className="c-divider" />

      <div className="c-center c-order-num">{order.id}</div>
      <div className="c-center c-date">{fmtDateTime(order.fecha)}</div>

      <div className="c-divider" />

      <div className="c-mode-badge">
        {isDelivery ? "★ ENVÍO A DOMICILIO ★" : "★ RETIRO EN LOCAL ★"}
      </div>

      <div className="c-meta">
        <div className="c-row"><span>CLIENTE:</span> <b>{order.cliente}</b></div>
        <div className="c-row"><span>TELÉFONO:</span> <b>{order.tel}</b></div>
        {isDelivery && (
          <>
            <div className="c-row-block">
              <span>DIRECCIÓN:</span> <b>{order.dir || "A coordinar"}</b>
            </div>
            {order.referencia && (
              <div className="c-row-block c-muted-ref">
                <span>REF:</span> {order.referencia}
              </div>
            )}
          </>
        )}
        <div className="c-row">
          <span>HORARIO:</span>
          <b>{order.cuando === "asap" ? "LO ANTES POSIBLE" : order.cuando.toUpperCase()}</b>
        </div>
      </div>

      <div className="c-divider-thick" />
      <div className="c-center c-section-title">COMANDA DE COCINA</div>
      <div className="c-divider-thick" />

      <div className="c-items-list">
        {order.items.map((item, idx) => (
          <div key={idx} className="c-item">
            <div className="c-item-qty">{item.qty}×</div>
            <div className="c-item-info">
              <div className="c-item-name">{item.name}</div>
              {item.detail ? <div className="c-item-detail">{item.detail}</div> : null}
            </div>
            <div className="c-item-price">{fmt(item.price * item.qty)}</div>
          </div>
        ))}
      </div>

      {order.notas && (
        <div className="c-notes-box">
          <div className="c-notes-label">⚠️ OBSERVACIONES / NOTAS:</div>
          <div className="c-notes-text">{order.notas}</div>
        </div>
      )}

      <div className="c-divider" />

      <div className="c-summary">
        <div className="c-row"><span>Subtotal:</span> <span>{fmt(order.subtotal)}</span></div>
        {order.shipping > 0 && (
          <div className="c-row"><span>Costo de envío:</span> <span>{fmt(order.shipping)}</span></div>
        )}
        <div className="c-row c-total-row">
          <span>TOTAL:</span>
          <span>{fmt(order.total)}</span>
        </div>
      </div>

      <div className="c-divider" />

      <div className="c-payment-status">
        <div className="c-payment-title">ESTADO DE COBRO:</div>
        {isPaid ? (
          <div className="c-payment-paid">
            [✓] PAGADO ONLINE ({order.pago.toUpperCase()})
          </div>
        ) : order.pago === "efectivo" ? (
          <div className="c-payment-due">
            [!] COBRAR EFECTIVO: {fmt(order.total)}
            {order.cambio ? `\n(Abona con ${order.cambio})` : ""}
          </div>
        ) : order.pago === "transferencia" ? (
          <div className="c-payment-due">
            [!] COBRAR TRANSFERENCIA: {fmt(order.total)}
            {"\n"}(Verificar comprobante{order.cuentaTransferencia ? ` en ${order.cuentaTransferencia}` : ""})
          </div>
        ) : order.pago === "mercadopago" ? (
          <div className="c-payment-due">
            [!] PAGO TARJETA {order.pagoEstado.toUpperCase()}: {fmt(order.total)}
            {"\n"}(NO ENTREGAR SIN CONFIRMAR PAGO)
          </div>
        ) : (
          <div className="c-payment-due">
            [!] COBRAR AL ENTREGAR: {fmt(order.total)}
          </div>
        )}
      </div>

      <div className="c-divider" />
      <div className="c-center c-footer-note">
        impasto.com.ar · Puerto Iguazú
      </div>
    </div>
  );
}
