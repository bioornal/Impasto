import assert from 'node:assert/strict';
import {test} from 'node:test';
import {paymentRecoveryStore,refundOperationResult} from '../lib/payment-recovery-store';
const before={id:'p',external_reference:'ref',total:100,estado_pago:'pendiente',mp_order_id:'ORD',id_pago:'PAY'};
function fake(result:{data:unknown;error:unknown}){
  const filters:unknown[]=[];const query={update:(value:unknown)=>{filters.push(['update',value]);return query;},eq:(key:string,value:unknown)=>{filters.push(['eq',key,value]);return query;},is:(key:string,value:unknown)=>{filters.push(['is',key,value]);return query;},select:()=>query,limit:()=>query,then:(resolve:(v:unknown)=>void)=>resolve(result)};
  return {client:{database:{from:()=>query}} as unknown as Parameters<typeof paymentRecoveryStore>[0],filters};
}
test('CAS includes previous state and BOTH previous identifiers; zero rows means race',async()=>{
  const f=fake({data:[],error:null});const store=paymentRecoveryStore(f.client,'p');
  assert.equal(await store.cas(before,{estado_pago:'aprobado'}),null);
  for(const filter of [['eq','id','p'],['eq','proyecto_id','impasto'],['eq','estado_pago','pendiente'],['eq','mp_order_id','ORD'],['eq','id_pago','PAY']])assert.ok(f.filters.some(v=>JSON.stringify(v)===JSON.stringify(filter)));
});
test('nullable previous identifiers use IS NULL instead of equality',async()=>{
  const f=fake({data:[],error:null});await paymentRecoveryStore(f.client,'p').cas({...before,id_pago:null,mp_order_id:null},{});
  assert.ok(f.filters.some(v=>JSON.stringify(v)===JSON.stringify(['is','id_pago',null])));assert.ok(f.filters.some(v=>JSON.stringify(v)===JSON.stringify(['is','mp_order_id',null])));
});
test('failed persistence and missing reread never become success',async()=>{
  for(const result of [{data:null,error:new Error('db')},{data:null,error:null}]){
    const store=paymentRecoveryStore(fake(result).client,'p');await assert.rejects(store.cas(before,{}));await assert.rejects(store.reread());
  }
  await assert.rejects(paymentRecoveryStore(fake({data:[],error:null}).client,'p').reread());
});

test('RPC write uses stable proof and rejects failed or unconfirmed rows',async()=>{
 const proof={clave:'mp-cobro:ORD',tipo:'cobro' as const,monto_centavos:10000,metodo_pago:'mercadopago' as const,ocurrido_en:null,fecha_fuente:'desconocida' as const};
 const saved={...proof,id:'movement',pedido_id:'p'};let params:any;
 const client=(result:any)=>({database:{rpc:async(name:string,args:any)=>{assert.equal(name,'registrar_movimientos_pago');params=args;return result;}}}) as unknown as Parameters<typeof paymentRecoveryStore>[0];
 const order={id:'ORD',status:'processed',status_detail:'accredited'};
 await paymentRecoveryStore(client({data:[saved],error:null}),'p').persistMovimientos(order,[proof]);
 assert.deepEqual(params,{p_pedido_id:'p',p_mp_order_id:'ORD',p_movimientos:[proof]});
 for(const result of [{data:null,error:'denied'},{data:[],error:null},{data:[{...saved,monto_centavos:1}],error:null},{data:[{...saved,pedido_id:'other'}],error:null}])await assert.rejects(paymentRecoveryStore(client(result),'p').persistMovimientos(order,[proof]));
});

test('refund reservation is server RPC with canonical request and fails closed for legacy or invalid return',async()=>{
 let args:any;
 const client=(result:any)=>({database:{rpc:async(name:string,request:any)=>{assert.equal(name,'reservar_devolucion_pago');args=request;return result;}}}) as unknown as Parameters<typeof paymentRecoveryStore>[0];
 const request={transaction_id:'PAY',amount_centavos:3000};
 assert.equal(await paymentRecoveryStore(client({data:'refund-ORD-30',error:null}),'p').reservarDevolucion('ORD',request),'refund-ORD-30');
 assert.deepEqual(args,{p_pedido_id:'p',p_mp_order_id:'ORD',p_solicitud:request});
 for(const result of [{data:null,error:'legacy'},{data:[],error:null},{data:'refund-OTHER-30',error:null}])await assert.rejects(paymentRecoveryStore(client(result),'p').reservarDevolucion('ORD',request),/revisión manual/);
});
test('new operation RPC freezes request, requires matching UUID and confirmed GET proof',async()=>{
 const operationId='00000000-0000-4000-8000-000000000011';
 const intent={operationId,key:`refund-operation-${operationId}`,request:{transaction_id:'PAY',amount_centavos:3000},gross:10000,baseline:[],confirmedRefund:null};
 let args:any,name='';
 const client=(result:any)=>({database:{rpc:async(n:string,a:any)=>{name=n;args=a;return result;}}}) as unknown as Parameters<typeof paymentRecoveryStore>[0];
 const store=paymentRecoveryStore(client({data:intent,error:null}),'p');
 assert.deepEqual(await store.reservarOperacion('ORD',operationId,{total:true}),intent);
 assert.equal(name,'reservar_devolucion_operacion');assert.deepEqual(args,{p_pedido_id:'p',p_mp_order_id:'ORD',p_operacion_id:operationId,p_solicitud:{total:true}});
 for(const data of [null,[],{...intent,operationId:'wrong'},{...intent,key:'old-key'},{...intent,request:{...intent.request,amount_centavos:NaN}},{...intent,baseline:[{clave:'x',monto_centavos:3000}]}])assert.throws(()=>refundOperationResult(data,operationId));
 const order={id:'ORD',external_reference:'ref',total_amount:'100.00',total_paid_amount:'100.00',currency:'ARS',status:'processed',status_detail:'partially_refunded',transactions:{payments:[{id:'PAY',status:'processed',status_detail:'accredited'}],refunds:[{id:'R1',amount:'30.00',status:'processed',transaction_id:'PAY'}]}};
 await assert.rejects(store.confirmarOperacion(before,intent,order));
 assert.equal(name,'confirmar_devolucion_operacion');assert.equal((args as Record<string,any>).p_movimientos[1].monto_centavos,3000);
 await paymentRecoveryStore(client({data:{...intent,confirmedRefund:'mp-devolucion:R1'},error:null}),'p').confirmarOperacion(before,intent,order);
});
