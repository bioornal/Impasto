import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesManualOrder, restoredManualOrder, confirmManualResponse } from '../lib/manual-order-data';
import { esReferenciaValida } from '../lib/referencia';
const request = { nombre:'Ana', tel:'123', email:'a@b.co', dir:'Casa', mode:'delivery', when:'asap', notas:'Sin sal', ref:'Timbre', cambio:'100', items:[{key:'pizza',type:'pizza',qty:1,price:10}] };
const row = { id:'one', numero_pedido:7, external_reference:'IM-MAN-secret', nombre_cliente:'Ana', telefono_cliente:'123', email_cliente:'a@b.co', direccion:'Casa', modalidad:'delivery', cuando:'asap', notas:'Sin sal', referencia:'Timbre', cambio:'100', metodo_pago:'efectivo', productos:request.items, total:12, subtotal:10, envio:2, cuenta_transferencia:null };
test('same attempt ignores quoted price but detects every meaningful customer/item/payment change', () => {
  assert.equal(matchesManualOrder(row, {...request,items:[{...request.items[0],price:99}]}, 'efectivo'),true);
  for (const [key,value] of Object.entries({nombre:'Otro',tel:'999',email:'otro@b.co',dir:'Otra',mode:'takeaway',when:'20:00',notas:'Otra',ref:'Otro',cambio:'200',items:[{...request.items[0],qty:2}]})) {
    assert.equal(matchesManualOrder(row,{...request,[key]:value},'efectivo'),false,key);
  }
  assert.equal(matchesManualOrder(row,request,'transferencia'),false);
});
test('recovery returns the persisted items and total without recalculating', () => {
  const restored = restoredManualOrder(row);
  assert.equal(restored.total,12); assert.deepEqual(restored.items,row.productos); assert.equal(restored.recovered,true);
});
test('manual UUID references work in public tracking but POS references do not', () => {
  assert.equal(esReferenciaValida('IM-MAN-AF3A5F88-7471-42CB-8C27-F863E9DF0998'),true);
  assert.equal(esReferenciaValida('POS-AF3A5F88-7471-42CB-8C27-F863E9DF0998'),false);
});
test('accepted half/box requests recover after the quote canonicalizes their keys', () => {
  for (const [raw,priced] of [
    [{key:'half-p-q',type:'pizza-half',qty:1},{key:'half-p-q',type:'pizza-half',qty:1,variant:{kind:'half',ids:['p','q']}}],
    [{key:'old-box-key',type:'empanadas',qty:1,variant:{kind:'empanadas-box',size:6,selections:{q:3,p:3}}},{key:'emp-6-p-q',type:'empanadas',qty:1,variant:{kind:'empanadas-box',size:6,selections:{p:3,q:3}}}],
  ]) assert.equal(matchesManualOrder({...row,productos:[priced]},{...request,items:[raw]},'efectivo'),true);
});
test('manual response must confirm exact reference and stored totals before clearing journal', () => {
  const key='af3a5f88-7471-42cb-8c27-f863e9df0998';
  const data={ok:true,numero:`IM-MAN-${key.toUpperCase()}`,subtotal:10,shipping:2,total:12,items:request.items};
  assert.equal(confirmManualResponse(data,key),data);
  for (const bad of [null,{}, {...data,numero:'other'}, {...data,total:NaN}, {...data,items:[]}]) assert.throws(() => confirmManualResponse(bad,key));
});
