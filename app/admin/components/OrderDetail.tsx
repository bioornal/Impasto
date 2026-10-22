"use client";
import { useState, useEffect } from "react";
import { loadProviderRefundIntent, prepareProviderRefundIntent, completeProviderRefundIntent } from "@/lib/provider-refund-intent";
import { ManualRefundBox } from "./ManualRefundBox";
import type { ManualRefund } from "@/lib/manual-refund";
import { Icon } from "./Icons";
import type { AdminOrder } from "./types";
import { esPedidoParaCocina } from "@/lib/pedido-visible";
import { etiquetaEstado, numeroCorto } from "@/lib/admin-pedidos";
import { enlaceWhatsapp, mensajeAlCliente, whatsappDeCliente } from "@/lib/contacto";
import { detalleCocina, masaCocina, nombreCocina } from "@/lib/masa";

/** El chat con el cliente, con el saludo y el pedido ya escritos. Null si el número no se reconoce. */
const whatsappDelPedido = (o: AdminOrder) => {
  const numero = whatsappDeCliente(o.tel);
  return numero ? enlaceWhatsapp(numero, mensajeAlCliente(o.cliente, o.id)) : null;
};

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};
const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

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

export function OrderDetail({ order, onClose, onUpdate, onPayment, onRefund, onPrint, onPrintCliente, printing, printMessage, onReconcile, onManualRefund, onDelete }: { order: AdminOrder; onClose: () => void; onDelete: () => void; onUpdate: (estado: string) => void; onPayment: (estado: string) => void; onRefund?: (monto?: number, operationId?: string) => Promise<boolean>; onPrint: () => void; onPrintCliente: () => void; printing: boolean; printMessage: string | null; onReconcile:()=>Promise<string>; onManualRefund:(body:ManualRefund)=>Promise<string> }) {
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
  const whatsapp = whatsappDelPedido(order);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="grow"><h3>Pedido {numeroCorto(order)}</h3><small>{fmtDateTime(order.fecha)} · {timeAgo(order.fecha)} · {order.id}</small></div>
          <span className={`chip chip-${order.estado}`}>{etiquetaEstado(order.estado, order.mode)}</span>
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
            {whatsapp
              ? <a className="btn btn-ghost btn-sm" href={whatsapp} target="_blank" rel="noreferrer"><Icon.Whatsapp /> WhatsApp</a>
              : <span className="text-muted" style={{ fontSize: 12 }} title="Sin característica o con una forma que no se reconoce: escribile a mano">Número incompleto: sin WhatsApp</span>}
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
                  <span>
                    {i.qty}× {i.name}
                    {masaCocina(i) && (
                      <b style={{ marginLeft: 6, fontSize: 11, padding: "1px 6px", borderRadius: 4, background: i.masa === "molde" ? "var(--a-warn)" : "var(--a-bg-2)", color: i.masa === "molde" ? "white" : "var(--a-ink)" }}>
                        {masaCocina(i)}
                      </b>
                    )}
                  </span>
                  <span className="tbl-price">{fmt(i.price * i.qty)}</span>
                </div>
                {detalleCocina(i) ? (
                  <div style={{ fontSize: 12, color: "var(--a-muted)", paddingLeft: 12 }}>
                    ↳ {detalleCocina(i)}
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
              <div className="c-item-name">{nombreCocina(item)}</div>
              {detalleCocina(item) ? <div className="c-item-detail">{detalleCocina(item)}</div> : null}
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
