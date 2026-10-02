import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prepareProviderRefundIntent,loadProviderRefundIntent,completeProviderRefundIntent,providerRefundConfirmed} from '../lib/provider-refund-intent';
test('provider receipt without local persistence or matching operation remains pending',()=>{
 const receipt={ok:true,refundCompleted:true,persistencePending:false,estadoPago:'parcialmente_reembolsado',operationId:'operation'};
 assert.equal(providerRefundConfirmed(receipt,'operation'),true);
 for(const result of [{...receipt,persistencePending:true},{...receipt,operationId:'other'},{...receipt,ok:false},{...receipt,refundCompleted:false},{...receipt,estadoPago:'aprobado'}])assert.equal(providerRefundConfirmed(result,'operation'),false);
});
test('uncertain retry freezes amount and UUID across reload; only matching confirmation permits next operation',()=>{
 const values=new Map<string,string>();const storage={getItem:(n:string)=>values.get(n)??null,setItem:(n:string,v:string)=>{values.set(n,v);},removeItem:(n:string)=>{values.delete(n);}};
 const id='00000000-0000-4000-8000-000000000001';const next='00000000-0000-4000-8000-000000000002';
 assert.deepEqual(prepareProviderRefundIntent(storage,'refund',123,()=>id),{operationId:id,amount:123});
 assert.deepEqual(prepareProviderRefundIntent(storage,'refund',456,()=>next),{operationId:id,amount:123});
 completeProviderRefundIntent(storage,'refund',next);assert.ok(loadProviderRefundIntent(storage,'refund'));
 completeProviderRefundIntent(storage,'refund',id);assert.equal(loadProviderRefundIntent(storage,'refund'),null);
 assert.deepEqual(prepareProviderRefundIntent(storage,'refund',undefined,()=>next),{operationId:next});
 storage.setItem('bad','broken');assert.throws(()=>prepareProviderRefundIntent(storage,'bad',1,()=>id));
 assert.throws(()=>prepareProviderRefundIntent({getItem:()=>null,setItem:()=>{throw Error('storage');},removeItem:()=>{}},'x',1,()=>id));
});
