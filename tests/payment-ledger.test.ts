import assert from 'node:assert/strict';
import {test} from 'node:test';
import {providerMovimientos, pesosACentavos, leerMovimientosPedido} from '../lib/payment-ledger';
import {recoverPayment} from '../lib/payment-recovery';
import {completeRefund} from '../lib/refund-completion';
const pedido={id:'p',external_reference:'IM-123456-AAAA',total:100,estado_pago:'aprobado',mp_order_id:'ORD',id_pago:'PAY'};
const approved={id:'ORD',external_reference:pedido.external_reference,total_amount:'100.00',total_paid_amount:'100.00',currency:'ARS',status:'processed',status_detail:'accredited',transactions:{payments:[{id:'PAY',status:'processed',status_detail:'accredited'}]}};
const partial={...approved,status_detail:'partially_refunded',transactions:{...approved.transactions,refunds:[{id:'REF',transaction_id:'PAY',status:'processed',amount:'30.00'}]}};
test('provider records gross and exact partial without invented date',()=>{
 const value=providerMovimientos(pedido,partial);
 assert.equal(value.estadoPago,'parcialmente_reembolsado');assert.deepEqual(value.totales,{cobros:10000,devoluciones:3000,neto:7000});
 assert.deepEqual(value.movimientos,[{clave:'mp-cobro:ORD',tipo:'cobro',monto_centavos:10000,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'},{clave:'mp-devolucion:REF',tipo:'devolucion',monto_centavos:3000,metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'}]);
});
test('unsafe or inconsistent proof fails closed, not a total refund inferred from status',()=>{
 for(const amount of [true,'1e2','0.001','-1',Infinity,'90071992547409.92'])assert.throws(()=>pesosACentavos(amount));
 for(const order of [{...partial,transactions:approved.transactions},{...partial,total_paid_amount:'70.00'},{...partial,currency:'USD'},{...partial,external_reference:'OTHER'},{...partial,status:'refunded'},{...partial,transactions:{...partial.transactions,refunds:[partial.transactions.refunds[0],partial.transactions.refunds[0]]}},{...partial,transactions:{...partial.transactions,refunds:[{...partial.transactions.refunds[0],amount:'101.00'}]}},{...partial,transactions:{...partial.transactions,refunds:[{...partial.transactions.refunds[0],status:'processing'}]}}])assert.throws(()=>providerMovimientos(pedido,order));
});
test('processed refund evidence without partial status is still partial, old wrong full corrects only with amounts',()=>{
 assert.equal(providerMovimientos(pedido,{...partial,status_detail:'accredited'}).estadoPago,'parcialmente_reembolsado');
});
test('unchanged approval repairs ledger and errors remain visible',async()=>{
 let persisted=0;const deps={getOrder:async()=>approved,searchOrders:async()=>{throw Error('no search');},cas:async()=>{throw Error('unchanged');},reread:async()=>pedido,persistMovimientos:async()=>{persisted++;}};
 await recoverPayment(pedido,deps);assert.equal(persisted,1);
 await assert.rejects(recoverPayment(pedido,{...deps,persistMovimientos:async()=>{throw Error('ledger unavailable');}}),/ledger unavailable/);
});
test('refund POST incomplete body must use fresh GET, existing partial never posts again',async()=>{
 let gets=0,posts=0,persisted:any;
 const actions={pedido,current:async()=>{gets++;return gets===1?approved:partial;},reserve:async()=>"refund-ORD-30",refund:async()=>{posts++;return {id:'ORD',status:'processed',status_detail:'partially_refunded'};},persist:async(order:any)=>{persisted=order;}};
 const result=await completeRefund(actions);assert.equal(gets,2);assert.equal(posts,1);assert.equal(persisted,partial);assert.equal(result.estadoPago,'parcialmente_reembolsado');
 posts=0;await completeRefund({...actions,current:async()=>partial});assert.equal(posts,0);
});

test('wrong old full refund corrects to partial only with verified amounts; no refund proof cannot erase it',()=>{
 assert.equal(providerMovimientos({...pedido,estado_pago:'reembolsado'},partial).estadoPago,'parcialmente_reembolsado');
 assert.throws(()=>providerMovimientos({...pedido,estado_pago:'reembolsado'},approved));
 assert.throws(()=>providerMovimientos({...pedido,estado_pago:'parcialmente_reembolsado'},approved));
});

test('refund state is derived in ledger transaction, never a prior state CAS; incomplete journal failure retains old state',async()=>{
 let state={...pedido,mp_order_id:'ORD',id_pago:'PAY',estado_pago:'reembolsado'};let writes=0;
 const deps={getOrder:async()=>partial,searchOrders:async()=>{throw Error('no search');},cas:async()=>{throw Error('must not CAS refund state');},reread:async()=>state,persistMovimientos:async()=>{writes++;state={...state,estado_pago:'parcialmente_reembolsado'};}};
 const result=await recoverPayment(state,deps);assert.equal(writes,1);assert.equal(result.order.estado_pago,'parcialmente_reembolsado');
 state={...state,estado_pago:'reembolsado'};
 await assert.rejects(recoverPayment(state,{...deps,persistMovimientos:async()=>{throw Error('incomplete existing refund proof');}}),/incomplete/);
 assert.equal(state.estado_pago,'reembolsado');
});
test('incomplete post-refund GET cannot claim success or persist an invented total',async()=>{
 let gets=0,writes=0;
 await assert.rejects(completeRefund({pedido,current:async()=>++gets===1?approved:{...partial,transactions:approved.transactions},reserve:async()=>"refund-ORD-30",refund:async()=>partial,persist:async()=>{writes++;}}));
 assert.equal(gets,2);assert.equal(writes,0);
});

test('admin detail reads every ledger page and never returns partial totals on failure',async()=>{
 const rows=[{id:'a',pedido_id:'p',clave:'mp-cobro:ORD',tipo:'cobro',monto_centavos:'10000',metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'},{id:'b',pedido_id:'p',clave:'mp-devolucion:REF',tipo:'devolucion',monto_centavos:'3000',metodo_pago:'mercadopago',ocurrido_en:null,fecha_fuente:'desconocida'}];
 const offsets:number[]=[];
 const result=await leerMovimientosPedido(async offset=>{offsets.push(offset);return {data:rows.slice(offset,offset+1)};});
 assert.deepEqual(offsets,[0,1,2]);assert.equal(result.totales.neto,7000);assert.equal(result.totales.sinFecha,2);
 await assert.rejects(leerMovimientosPedido(async offset=>offset===0?{data:[rows[0]]}:{data:null,error:'denied'}));
 await assert.rejects(leerMovimientosPedido(async()=>({data:[rows[0]]})));
});

test('reservation failure prevents POST; recovered refund skips reservation entirely',async()=>{
 let posts=0,reservations=0;
 const actions={pedido,current:async()=>approved,reserve:async()=>{reservations++;throw Error('legacy order cannot reserve');},refund:async()=>{posts++;return partial;},persist:async()=>{}};
 await assert.rejects(completeRefund(actions),/cannot reserve/);assert.equal(posts,0);assert.equal(reservations,1);
 reservations=0;await completeRefund({...actions,current:async()=>partial});assert.equal(reservations,0);assert.equal(posts,0);
});
test('durable reservation key is passed unchanged to POST and retained on provider uncertainty',async()=>{
 let calls=0;const keys:string[]=[];
 const actions={pedido,current:async()=>approved,reserve:async()=>{calls++;return 'refund-ORD-30';},refund:async(key:string)=>{keys.push(key);throw Error('provider timeout');},persist:async()=>{}};
 await assert.rejects(completeRefund(actions),/timeout/);await assert.rejects(completeRefund(actions),/timeout/);
 assert.deepEqual(keys,['refund-ORD-30','refund-ORD-30']);assert.equal(calls,2);
});
