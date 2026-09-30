import assert from 'node:assert/strict';
import {test} from 'node:test';
import {selectRecoveryOrder,paymentRecoveryValues,recoverySearchWindow,recoverPayment,canReconcilePayment} from '../lib/payment-recovery';
const pedido = {id:'pedido',external_reference:'IM-123456-AAAA',total:100,estado_pago:'pendiente',mp_order_id:'',id_pago:'',created_at:'2026-09-30T12:00:00Z',proveedor_pago:'mercadopago'};
const order = {id:'ORD1',external_reference:pedido.external_reference,total_amount:'100.00',total_paid_amount:'100.00',currency:'ARS',status:'processed',status_detail:'accredited',transactions:{payments:[{id:'PAY1',status:'processed',status_detail:'accredited'}]}};
test('search empty remains pending; duplicates, incomplete or malformed pages are never selected',()=>{
  assert.equal(selectRecoveryOrder({data:[],paging:{total:'0',offset:'0'}},pedido.external_reference),null);
  assert.deepEqual(selectRecoveryOrder({data:[order],paging:{total:'1',offset:'0'}},pedido.external_reference),order);
  for(const page of [{data:[order,order],paging:{total:2,offset:0}},{data:[order],paging:{total:2,offset:0}},{data:[order],paging:{total:1,offset:1}},{data:[order]},{data:[{...order,external_reference:'other'}],paging:{total:1,offset:0}}]) assert.throws(()=>selectRecoveryOrder(page,pedido.external_reference));
});
test('approval strictly verifies order identity, order id, complete total and currency',()=>{
  assert.equal(paymentRecoveryValues(pedido,order).estado_pago,'aprobado');
  assert.equal(paymentRecoveryValues(pedido,{...order,currency:undefined,country_code:'AR'}).estado_pago,'aprobado');
  for(const patch of [{id:''},{external_reference:'other'},{total_amount:'99.00'},{total_paid_amount:'99.00'},{total_paid_amount:undefined},{currency:'USD',country_code:'AR'},{currency:undefined},{currency:undefined,country_code:'BR'}]) assert.throws(()=>paymentRecoveryValues(pedido,{...order,...patch}));
  assert.throws(()=>paymentRecoveryValues({...pedido,mp_order_id:'OTHER'},order));
});
test('pending keeps identifiers; approved/refunded cannot be downgraded',()=>{
  const pending={...order,status:'processing',total_paid_amount:'0.00'};
  assert.deepEqual(paymentRecoveryValues(pedido,pending),{estado_pago:'pendiente',mp_order_id:'ORD1',id_pago:'PAY1'});
  assert.equal(paymentRecoveryValues({...pedido,estado_pago:'aprobado'},pending).estado_pago,'aprobado');
  assert.equal(paymentRecoveryValues({...pedido,estado_pago:'reembolsado'},order).estado_pago,'reembolsado');
  assert.equal(paymentRecoveryValues({...pedido,estado_pago:'rechazado'},order).estado_pago,'aprobado');
  assert.equal(paymentRecoveryValues({...pedido,id_pago:'PAY1'},{...pending,transactions:{payments:[]}}).id_pago,'PAY1');
});
test('search windows require a valid persisted creation timestamp',()=>{
  const window=recoverySearchWindow(pedido.created_at,new Date('2026-09-30T13:00:00Z'));
  assert.ok(Date.parse(window.begin_date)<Date.parse(pedido.created_at));assert.ok(Date.parse(window.end_date)>=Date.parse(pedido.created_at));
  for(const value of ['',null,'invalid']) assert.throws(()=>recoverySearchWindow(value,new Date()));
});
test('recovery uses only GET by saved id and CAS on full previous state',async()=>{
  const old={...pedido,mp_order_id:'ORD1',id_pago:'PAY1'};let searches=0;let expected:any;let updates:any;
  const result=await recoverPayment(old,{getOrder:async(id:string)=>{assert.equal(id,'ORD1');return order;},searchOrders:async()=>{searches++;throw new Error('must not search');},cas:async(before:any,values:any)=>{expected=before;updates=values;return {...before,...values};},reread:async()=>{throw new Error('must not reread');}});
  assert.equal(searches,0);assert.equal(expected,old);assert.equal(updates.estado_pago,'aprobado');assert.equal(result.order.estado_pago,'aprobado');assert.equal(result.changed,true);
});
test('empty search does not write; provider/lookup errors do not invent approval',async()=>{
  let writes=0;
  const deps={getOrder:async()=>order,searchOrders:async()=>({data:[],paging:{total:0,offset:0}}),cas:async()=>{writes++;return pedido;},reread:async()=>pedido};
  assert.equal((await recoverPayment(pedido,deps)).order.estado_pago,'pendiente');assert.equal(writes,0);
  await assert.rejects(recoverPayment(pedido,{...deps,searchOrders:async()=>{throw new Error('network');}}),/network/);assert.equal(writes,0);
});
test('CAS loss rereads confirmed refunded state, not stale provider approval',async()=>{
  let rereads=0;
  const result=await recoverPayment({...pedido,mp_order_id:'ORD1'},{getOrder:async()=>order,searchOrders:async()=>{throw new Error('no');},cas:async()=>null,reread:async()=>{rereads++;return {...pedido,estado_pago:'reembolsado',mp_order_id:'ORD1',id_pago:'PAY1'};}});
  assert.equal(result.order.estado_pago,'reembolsado');assert.equal(result.changed,false);assert.equal(rereads,1);
});
test('unchanged approval rereads current row so refunded race cannot notify approval',async()=>{
  const result=await recoverPayment({...pedido,estado_pago:'aprobado',mp_order_id:'ORD1',id_pago:'PAY1'},{getOrder:async()=>order,searchOrders:async()=>{throw new Error('no');},cas:async()=>{throw new Error('unchanged');},reread:async()=>({...pedido,estado_pago:'reembolsado',mp_order_id:'ORD1',id_pago:'PAY1'})});
  assert.equal(result.order.estado_pago,'reembolsado');assert.equal(result.changed,false);
});
test('admin action is restricted to an online pending card, including cancelled kitchen state',()=>{
  const online={proveedor_pago:'mercadopago',metodo_pago:'mercadopago',estado_pago:'pendiente',status:'cancelado',external_reference:'IM-123456-AAAA'};
  assert.equal(canReconcilePayment(online),true);
  for(const patch of [{proveedor_pago:'manual'},{metodo_pago:'efectivo'},{estado_pago:'aprobado'},{estado_pago:'reembolsado'},{external_reference:'POS-UUID'},{external_reference:''}])assert.equal(canReconcilePayment({...online,...patch}),false);
});
