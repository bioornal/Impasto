import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeRefundOperation, reconcileRefundOnly, refundAuditAmount } from '../lib/refund-completion';
import type { MpOrder } from '../lib/mercadopago';
const pedido={external_reference:'IM-test',total:100,mp_order_id:'ORD',estado_pago:'aprobado'};
const approved:MpOrder={id:'ORD',external_reference:'IM-test',total_amount:'100.00',total_paid_amount:'100.00',currency:'ARS',status:'processed',status_detail:'accredited',transactions:{payments:[{id:'PAY',status:'processed',status_detail:'accredited'}],refunds:[]}};
const partial=(id:string,amount:string):MpOrder=>({...approved,transactions:{...approved.transactions,refunds:[{id,amount,status:'processed',transaction_id:'PAY'}]}});
test('uncertain POST response is recovered through GET delta without a second POST',async()=>{
 let order=approved,posts=0,confirmed=0;
 const intent={operationId:'00000000-0000-4000-8000-000000000001',key:'refund-operation-1',request:{transaction_id:'PAY',amount_centavos:3000},gross:10000,baseline:[],confirmedRefund:null};
 const actions={pedido,current:async()=>order,persist:async()=>{},reserve:async()=>intent,refund:async()=>{posts++;order=partial('R1','30.00');throw Error('lost response');},confirm:async()=>{confirmed++;}};
 await assert.rejects(completeRefundOperation(actions),/lost response/);
 const result=await completeRefundOperation(actions);
 assert.equal(posts,1);assert.equal(confirmed,1);assert.equal(result.recovered,true);
});
test('old refunds alone never confirm or suppress a new legitimate equal amount refund',async()=>{
 const first=partial('R1','30.00');let order=first,posts=0;
 const intent={operationId:'00000000-0000-4000-8000-000000000002',key:'refund-operation-2',request:{transaction_id:'PAY',amount_centavos:3000},gross:10000,baseline:[{clave:'mp-devolucion:R1',monto_centavos:3000}],confirmedRefund:null};
 const result=await completeRefundOperation({pedido,current:async()=>order,persist:async()=>{},reserve:async()=>intent,refund:async()=>{posts++;order={...first,transactions:{...first.transactions,refunds:[...first.transactions!.refunds!,{id:'R2',amount:'30.00',status:'processed',transaction_id:'PAY'}]}};},confirm:async()=>{}});
 assert.equal(posts,1);assert.equal(result.totales.devoluciones,6000);
});
test('unexpected external refund delta fails closed and never posts',async()=>{
 let posts=0;
 const intent={operationId:'00000000-0000-4000-8000-000000000001',key:'refund-operation-1',request:{transaction_id:'PAY',amount_centavos:3000},gross:10000,baseline:[],confirmedRefund:null};
 await assert.rejects(completeRefundOperation({pedido,current:async()=>partial('OTHER','20.00'),persist:async()=>{},reserve:async()=>intent,refund:async()=>{posts++;},confirm:async()=>{}}),/coincide|concili/i);
 assert.equal(posts,0);
});
test('full remaining refund confirms only a fresh GET; lost confirmation retries never POST again',async()=>{
 const old=partial('R1','30.00');let order=old,posts=0,fail=true;
 const intent={operationId:'00000000-0000-4000-8000-000000000002',key:'refund-operation-2',request:{transaction_id:'PAY',amount_centavos:7000},gross:10000,baseline:[{clave:'mp-devolucion:R1',monto_centavos:3000}],confirmedRefund:null};
 const actions={pedido,current:async()=>order,persist:async()=>{},reserve:async()=>intent,refund:async()=>{posts++;order={...old,status:'refunded',transactions:{...old.transactions,refunds:[...old.transactions!.refunds!,{id:'R2',amount:'70.00',status:'processed',transaction_id:'PAY'}]}};return {id:'ORD'};},confirm:async()=>{if(fail)throw Error('lost database confirmation');}};
 const result=await completeRefundOperation(actions);assert.equal(result.persistencePending,true);assert.equal(result.estadoPago,'reembolsado');assert.equal(result.amountCentavos,7000);
 fail=false;const retry=await completeRefundOperation(actions);assert.equal(retry.persistencePending,false);assert.equal(retry.recovered,true);assert.equal(posts,1);
});
test('missing operation UUID only reconciles documented old refunds and never initiates one',async()=>{
 let writes=0;
 await assert.rejects(reconcileRefundOnly({pedido,current:async()=>approved,persist:async()=>{writes++;}}),/operación identificada/);
 assert.equal(writes,0);
 const result=await reconcileRefundOnly({pedido,current:async()=>partial('R1','30.00'),persist:async()=>{writes++;}});
 assert.equal(result.recovered,true);assert.equal(writes,1);
});
test('failed baseline persistence or reservation prevents money mutation',async()=>{
 let posts=0,reserves=0;
 const actions={pedido,current:async()=>approved,persist:async()=>{throw Error('baseline fail');},reserve:async()=>{reserves++;throw Error('reserve fail');},refund:async()=>{posts++;},confirm:async()=>{}};
 await assert.rejects(completeRefundOperation(actions),/baseline fail/);assert.equal(reserves,0);
 await assert.rejects(completeRefundOperation({...actions,persist:async()=>{}}),/reserve fail/);assert.equal(posts,0);
});
test('full remaining refund audit records 400 after prior 600 on a 1000 gross receipt',async()=>{
 const large={...pedido,total:1000};
 const before={...approved,total_amount:'1000.00',total_paid_amount:'1000.00',transactions:{...approved.transactions,refunds:[{id:'R1',amount:'600.00',status:'processed',transaction_id:'PAY'}]}};
 let current:MpOrder=before;
 const intent={operationId:'00000000-0000-4000-8000-000000000002',key:'refund-operation-2',request:{transaction_id:'PAY',amount_centavos:40000},gross:100000,baseline:[{clave:'mp-devolucion:R1',monto_centavos:60000}],confirmedRefund:null};
 const result=await completeRefundOperation({pedido:large,current:async()=>current,persist:async()=>{},reserve:async()=>intent,refund:async()=>{current={...before,status:'refunded',transactions:{...before.transactions,refunds:[...before.transactions.refunds,{id:'R2',amount:'400.00',status:'processed',transaction_id:'PAY'}]}};},confirm:async()=>{}});
 assert.deepEqual(refundAuditAmount(result),{monto:400,monto_centavos:40000});
 assert.deepEqual(refundAuditAmount({...result,recovered:true}),{});
});
