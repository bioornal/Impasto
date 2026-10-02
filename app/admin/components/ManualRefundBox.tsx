"use client";
import {useEffect,useState} from 'react';
import {manualRefundAmount,validateManualRefund,prepareManualRefund,type ManualRefund} from '@/lib/manual-refund';

/** The saved body is immutable across network failures, edits, closure and reload. */
export function ManualRefundBox({pedidoId,onRecord}:{pedidoId:string;onRecord:(body:ManualRefund)=>Promise<string>}){
 const [amount,setAmount]=useState('');const [method,setMethod]=useState<ManualRefund['metodo_pago']>('efectivo');
 const [reason,setReason]=useState('');const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<ManualRefund|null>(null);const [message,setMessage]=useState('');
 const name=`impasto_manual_refund_${pedidoId}`;
 useEffect(()=>{try{const raw=localStorage.getItem(name);if(raw)setPending(validateManualRefund(JSON.parse(raw)));}catch{setMessage('No se pudo recuperar el registro pendiente. No repitas la devolución; revisá el historial.');}},[name]);
 const submit=async()=>{
  setBusy(true);setMessage('');
  try{
   const body=prepareManualRefund(localStorage,name,()=>({operacion_id:crypto.randomUUID(),monto_centavos:manualRefundAmount(amount),metodo_pago:method,motivo:reason.trim()}));
   setPending(body);
   await onRecord(body);
   localStorage.removeItem(name);setPending(null);setAmount('');setReason('');setConfirmed(false);
   setMessage('Devolución ya realizada registrada. Este panel no transfirió dinero ni verificó la liquidación bancaria.');
  }catch(error){setMessage(error instanceof Error?error.message:'Registro no confirmado. Reintentá el registro, sin devolver dinero otra vez.');}
  finally{setBusy(false);}
 };
 return <section style={{padding:14,marginTop:12,background:'var(--a-bg)',borderRadius:12}}>
  <b>Registrar devolución manual ya realizada</b>
  <p className="text-muted">Primero devolvé el dinero por fuera del panel. Este registro no inicia transferencias ni devoluciones en Mercado Pago. La fecha guardada corresponde a esta declaración, no a la liquidación bancaria.</p>
  {pending ? <p>Registro pendiente: ${(pending.monto_centavos/100).toFixed(2)} por {pending.metodo_pago}. Motivo: {pending.motivo}. El reintento conserva los mismos datos; no vuelvas a devolver dinero.</p> : <>
   <label>Importe en pesos <input value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)} disabled={busy}/></label>
   <label>Medio del dinero devuelto <select value={method} onChange={e=>setMethod(e.target.value as ManualRefund['metodo_pago'])} disabled={busy}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago manual</option></select></label>
   <label>Motivo / comprobante <input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} disabled={busy}/></label>
   <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/> Confirmo que ya devolví este importe por el medio elegido.</label>
  </>}
  <button className="btn btn-danger btn-sm" disabled={busy || (!pending && !confirmed)} onClick={submit}>{busy?'Registrando…':pending?'Reintentar el mismo registro':'Registrar devolución ya realizada'}</button>
  {message && <p role="status">{message}</p>}
 </section>;
}
