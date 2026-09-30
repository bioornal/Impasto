import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recoverMatchingCardAttempt} from '../lib/payment-card-recovery';
const request={nombre:'Ana',tel:'123',email:'ana@example.invalid',dir:'Casa',mode:'delivery',items:[]};
const existing={id:'p',external_reference:'IM-123456-AAAA',estado_pago:'pendiente',nombre_cliente:'Ana',telefono_cliente:'123',email_cliente:'ana@example.invalid',direccion:'Casa',modalidad:'delivery',productos:[],total:100};
test('identity mismatch never queries provider or returns financial data',async()=>{
  let queries=0;const result=await recoverMatchingCardAttempt(existing,{...request,email:'other@example.invalid'},async row=>{queries++;return row;});
  assert.deepEqual(result,{decision:'conflict',existing:null});assert.equal(queries,0);
});
test('matching pending attempt recovers approved but failed GET keeps pending',async()=>{
  const recovered=await recoverMatchingCardAttempt(existing,request,async row=>({...row,estado_pago:'aprobado'}));
  assert.equal(recovered.decision,'recover-approved');
  const failed=await recoverMatchingCardAttempt(existing,request,async()=>{throw new Error('provider offline');});
  assert.equal(failed.decision,'wait-pending');assert.equal(failed.existing?.estado_pago,'pendiente');
});
