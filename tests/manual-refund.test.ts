import assert from 'node:assert/strict';
import {test} from 'node:test';
import {manualRefundAmount,validateManualRefund,prepareManualRefund,registerManualRefund,type ManualRefund} from '../lib/manual-refund';
const body:ManualRefund={operacion_id:'00000000-0000-4000-8000-000000000002',monto_centavos:12345,metodo_pago:'transferencia',motivo:'Devuelto comprobante 12'};
test('exact cents and explicit manual receipt reject malformed amounts and bodies',()=>{
 assert.equal(manualRefundAmount('123,45'),12345);assert.equal(manualRefundAmount('0.01'),1);
 for(const v of ['0','-1','1.001','1e2','900719925474099.99'])assert.throws(()=>manualRefundAmount(v));
 assert.deepEqual(validateManualRefund(body),body);assert.throws(()=>validateManualRefund({...body,total:true}));
});
test('pending body survives reload/edits and persistence failure prevents registration',()=>{
 const values=new Map<string,string>();const storage={getItem:(name:string)=>values.get(name)??null,setItem:(name:string,value:string)=>{values.set(name,value);}};
 assert.deepEqual(prepareManualRefund(storage,'attempt',()=>body),body);
 assert.deepEqual(prepareManualRefund(storage,'attempt',()=>({...body,monto_centavos:9})),body);
 assert.throws(()=>prepareManualRefund({getItem:()=>null,setItem:()=>{throw Error('storage');}},'attempt',()=>body));
});
test('only declaration RPC executes; missing confirmation never reports success',async()=>{
 const calls:unknown[]=[];const result=await registerManualRefund(async(name,args)=>{calls.push([name,args]);return {data:{operacion_id:body.operacion_id,movimiento_id:'receipt',estado_pago:'parcialmente_reembolsado'},error:null};},'pedido','iguazu',body);
 assert.equal(result.estado_pago,'parcialmente_reembolsado');assert.equal(calls.length,1);assert.equal((calls[0] as unknown[])[0],'registrar_devolucion_manual');
 for(const value of [{data:null,error:null},{data:{operacion_id:'other'},error:null},{data:null,error:Error('network')}])await assert.rejects(registerManualRefund(async()=>value,'pedido','iguazu',body));
});
