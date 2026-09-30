import assert from 'node:assert/strict';
import {test} from 'node:test';
import {classifyPaymentCreateFailure} from '../lib/payment-create-failure';
test('timeout and conflict/in-progress never release a possibly accepted attempt',()=>{
  for(const code of [408,409,423,429])assert.equal(classifyPaymentCreateFailure(code),'pendiente');
});
test('definitive 4xx rejects; network, server and malformed statuses keep pending',()=>{
  for(const code of [400,401,403,404,422])assert.equal(classifyPaymentCreateFailure(code),'rechazado');
  for(const code of [undefined,null,NaN,'offline',0,200,302,500,503])assert.equal(classifyPaymentCreateFailure(code),'pendiente');
});
