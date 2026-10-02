export interface ManualRefund {
 operacion_id:string; monto_centavos:number; metodo_pago:'efectivo'|'transferencia'|'mercadopago'; motivo:string;
}
export function validateManualRefund(value:unknown):ManualRefund {
 const v=value as Partial<ManualRefund>|null;
 if(!v || typeof v!=='object' || Object.keys(v).sort().join(',')!=='metodo_pago,monto_centavos,motivo,operacion_id'
  || typeof v.operacion_id!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.operacion_id)
  || !Number.isSafeInteger(v.monto_centavos) || Number(v.monto_centavos)<=0
  || !['efectivo','transferencia','mercadopago'].includes(String(v.metodo_pago))
  || typeof v.motivo!=='string' || v.motivo!==v.motivo.trim() || v.motivo.length<3 || v.motivo.length>500)throw new Error('Declaración manual inválida');
 return v as ManualRefund;
}
export function manualRefundAmount(pesos:string):number {
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(pesos))throw new Error('Ingresá un importe con hasta dos decimales');
 const [whole,part='']=pesos.replace(',','.').split('.');
 const cents=BigInt(whole)*BigInt(100)+BigInt(part.padEnd(2,'0'));
 if(cents<=BigInt(0) || cents>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Importe inválido');
 return Number(cents);
}
export function prepareManualRefund(storage:Pick<Storage,'getItem'|'setItem'>,name:string,create:()=>ManualRefund):ManualRefund {
 const saved=storage.getItem(name);
 if(saved)return validateManualRefund(JSON.parse(saved));
 const body=validateManualRefund(create());
 storage.setItem(name,JSON.stringify(body));
 return body;
}
export async function registerManualRefund(rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>,pedidoId:string,sucursalId:string,body:ManualRefund){
 validateManualRefund(body);
 const {data,error}=await rpc('registrar_devolucion_manual',{p_pedido_id:pedidoId,p_sucursal_id:sucursalId,p_operacion_id:body.operacion_id,p_monto_centavos:body.monto_centavos,p_metodo:body.metodo_pago,p_motivo:body.motivo});
 const result=data as {operacion_id?:unknown;movimiento_id?:unknown;estado_pago?:unknown;recovered?:unknown}|null;
 if(error || !result || result.operacion_id!==body.operacion_id || typeof result.movimiento_id!=='string' || !result.movimiento_id
  || !['parcialmente_reembolsado','reembolsado'].includes(String(result.estado_pago)))throw new Error('Registro no confirmado. Conservá y reintentá la misma operación; no devuelvas dinero otra vez.');
 return result;
}
