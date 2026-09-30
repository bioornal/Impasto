import assert from 'node:assert/strict';
import {test} from 'node:test';
import {paymentRecoveryStore} from '../lib/payment-recovery-store';
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
