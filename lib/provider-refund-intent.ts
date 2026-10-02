export interface ProviderRefundIntent {operationId:string;amount?:number}
export function providerRefundConfirmed(value:unknown,operationId?:string):boolean{
 const result=value as Record<string,unknown>|null;
 return Boolean(result && result.ok===true && result.refundCompleted===true && result.persistencePending!==true
  && ['parcialmente_reembolsado','reembolsado'].includes(String(result.estadoPago)) && (!operationId || result.operationId===operationId));
}
type IntentStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function loadProviderRefundIntent(storage:IntentStorage,name:string):ProviderRefundIntent|null{
 const raw=storage.getItem(name);if(!raw)return null;
 const value=JSON.parse(raw) as ProviderRefundIntent;
 if(!value || typeof value.operationId!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.operationId)
  || (value.amount!==undefined && (!Number.isFinite(value.amount)||value.amount<=0)))throw new Error('No se pudo recuperar la devolución pendiente. Revisá Mercado Pago antes de otra operación.');
 return value;
}
export function prepareProviderRefundIntent(storage:IntentStorage,name:string,amount:number|undefined,create:()=>string):ProviderRefundIntent{
 const existing=loadProviderRefundIntent(storage,name);if(existing)return existing;
 const intent={operationId:create(),...(amount===undefined?{}:{amount})};
 storage.setItem(name,JSON.stringify(intent));
 return loadProviderRefundIntent(storage,name)!;
}
export function completeProviderRefundIntent(storage:IntentStorage,name:string,operationId:string){
 if(loadProviderRefundIntent(storage,name)?.operationId===operationId)storage.removeItem(name);
}
