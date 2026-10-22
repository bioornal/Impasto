"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import type { AdminOrder } from "./types";
import { esPedidoParaCocina } from "@/lib/pedido-visible";
import { adminPrintJobs } from "@/lib/admin-print-job";
import { configurePrinter, getPrinterSelection, imprimirCopias, mensajeCopias, newAttemptId, selectPrinter, type PrintCopy, type PrinterId, type PrinterSelection, type PrintJob } from "@/lib/local-printer";
import { esActivo, numeroCorto } from "@/lib/admin-pedidos";
import { OrdersTable } from "./OrdersTable";
import { OrderDetail } from "./OrderDetail";

const FILTERS: [string, string][] = [["activos","Activos"],["nuevo","Nuevos"],["preparando","Preparando"],["en-camino","En camino"],["entregado","Entregados"],["cancelado","Cancelados"],["todos","Todos"]];

export function Orders({ soloActivos = false, onVerTodos, abrirId = null }: { soloActivos?: boolean; onVerTodos?: () => void; abrirId?: string | null }) {
  const { state, updateOrderStatus, updateOrderPayment, deleteOrders, refundOrder, recordManualRefund, reload } = useStore();
  // Con abrirId (viene del buscador) el pedido se abre al montar y el filtro es "todos": uno viejo tiene que verse.
  const [filter, setFilter] = useState(abrirId ? "todos" : "activos");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(() => (abrirId ? state.orders.find((o) => o._dbId === abrirId) ?? null : null));
  const [printState, setPrintState] = useState<{ orderId: string; message: string; error: boolean } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printerSelection, setPrinterSelection] = useState<PrinterSelection | null>(null);
  const [printerBusy, setPrinterBusy] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [eliminando, setEliminando] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [avanzando, setAvanzando] = useState<Set<string>>(new Set());
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

  /** "→" de la fila: un solo cambio por pedido a la vez, así un doble clic no salta dos estados. */
  async function avanzar(order: AdminOrder, estado: string) {
    if (avanzando.has(order._dbId)) return;
    setAvanzando(prev => new Set(prev).add(order._dbId));
    try {
      await updateOrderStatus(order._dbId, estado);
    } finally {
      setAvanzando(prev => { const sig = new Set(prev); sig.delete(order._dbId); return sig; });
    }
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
    if (soloActivos || filter === "activos") list = list.filter(esActivo);
    else if (filter !== "todos") list = list.filter(o => o.estado === filter);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter(o => (numeroCorto(o) + " " + o.id + " " + o.cliente + " " + o.tel).toLowerCase().includes(t));
    }
    return list;
  }, [state.orders, filter, q, soloActivos]);

  const counts: Record<string, number> = { todos: state.orders.length };
  ["nuevo","preparando","en-camino","entregado","cancelado"].forEach(k => { counts[k] = state.orders.filter(o => o.estado === k).length; });
  counts.activos = state.orders.filter(esActivo).length;

  const contenido = (
      <>
        <div className="panel-head">
          {soloActivos ? (
            <>
              <h3>Pedidos activos</h3>
              <div className="panel-head-spacer" />
              {onVerTodos && <button className="btn btn-ghost btn-sm" onClick={onVerTodos}>Ver todos los pedidos</button>}
            </>
          ) : (
            <>
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
              <div className="search-input">
                <Icon.Search />
                <input placeholder="Buscar N° de orden o cliente…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <div className="menu-mas">
                <button className="btn btn-ghost btn-icon" aria-label="Más opciones" aria-expanded={menu} onClick={() => setMenu(m => !m)}><Icon.More /></button>
                {menu && (
                  <div className="menu-mas-pop" onMouseLeave={() => setMenu(false)}>
                    <button onClick={() => { setSeleccionando(s => !s); setMarcados(new Set()); setMenu(false); }}>{seleccionando ? "Terminar selección" : "Seleccionar pedidos"}</button>
                    <button onClick={() => { setMenu(false); void pairPrinter(); }}>Emparejar impresora</button>
                    <label>Impresora de Impasto
                      <select aria-label="Impresora de Impasto" value={printerSelection?.selected ?? ''}
                        style={{ padding: '7px 9px', borderRadius: 6, border: '1px solid var(--a-line)', background: 'var(--a-bg)', color: 'inherit' }}
                        disabled={!printerSelection || printerBusy}
                        onChange={e => void choosePrinter(e.target.value as PrinterId)}>
                        {!printerSelection && <option value="">Emparejá para elegir</option>}
                        <option value="epson" disabled={printerSelection?.epsonAvailable === false}>Epson TM-T20II</option>
                        <option value="3nstar" disabled={printerSelection?.threeNStarAvailable === false}>3nStar RPT006B</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </>
          )}
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
        {seleccionando && !soloActivos && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--a-warn-soft)' }}>
            <b>{marcados.size} seleccionado{marcados.size === 1 ? '' : 's'}</b>
            <button
              className="btn btn-danger btn-sm"
              disabled={marcados.size === 0 || eliminando}
              title={marcados.size === 0 ? "Marcá pedidos con las casillas de la tabla" : "Eliminar los pedidos marcados"}
              onClick={() => void eliminar([...marcados])}
            >
              <Icon.Trash /> {eliminando ? "Eliminando…" : "Eliminar seleccionados"}
            </button>
            <button className="btn btn-ghost btn-sm" disabled={eliminando} onClick={() => setMarcados(new Set())}>Deseleccionar</button>
          </div>
        )}
        <div className="panel-body no-pad">
          <OrdersTable
            pedidos={filtered}
            onAbrir={setSelected}
            onAvanzar={(o, estado) => void avanzar(o, estado)}
            onImprimir={(o) => void printOrder(o)}
            imprimiendo={printing}
            avanzando={avanzando}
            seleccionando={seleccionando && !soloActivos}
            marcados={marcados}
            onMarcar={(id, marcado) => setMarcados(prev => { const sig = new Set(prev); if (marcado) sig.add(id); else sig.delete(id); return sig; })}
            onMarcarTodos={(marcado) => setMarcados(marcado ? new Set(filtered.map(o => o._dbId)) : new Set())}
          />
          {filtered.length === 0 && <div className="empty"><b>{soloActivos || filter === "activos" ? "No hay pedidos activos" : "Sin pedidos"}</b><div>{soloActivos || filter === "activos" ? "Los pedidos nuevos aparecen acá solos." : "No hay pedidos con ese filtro."}</div></div>}
        </div>
      </>
  );

  return (
    <>
      {/* Con soloActivos el Arranque ya lo envuelve en su propio panel: no anidar paneles. */}
      {soloActivos ? <>{contenido}</> : <div className="panel">{contenido}</div>}

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
