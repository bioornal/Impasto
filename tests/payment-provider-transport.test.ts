import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getOrder,searchOrders,getPayment} from '../lib/mercadopago';
test('recovery transport sends only GET with exact external reference and required dates',async()=>{
  const oldFetch=globalThis.fetch;const oldToken=process.env.MERCADOPAGO_AUTH_HEADER;
  const calls:{url:string;init:RequestInit}[]=[];
  process.env.MERCADOPAGO_AUTH_HEADER='FAKE-TEST-TOKEN';
  globalThis.fetch=async(input,init)=>{calls.push({url:String(input),init:init ?? {}});return new Response(JSON.stringify({data:[],paging:{total:0,offset:0}}),{status:200,headers:{'content-type':'application/json'}});};
  try {
    const window={begin_date:'2026-09-30T12:00:00Z',end_date:'2026-09-30T13:00:00Z'};
    await searchOrders('IM-test & exact',window);await getOrder('ORD/id');await getPayment('PAY/id');
    const url=new URL(calls[0].url);assert.equal(url.pathname,'/v1/orders');assert.equal(url.searchParams.get('external_reference'),'IM-test & exact');
    assert.equal(url.searchParams.get('begin_date'),window.begin_date);assert.equal(url.searchParams.get('end_date'),window.end_date);
    assert.equal(calls[1].url,'https://api.mercadopago.com/v1/orders/ORD%2Fid');
    assert.equal(calls[2].url,'https://api.mercadopago.com/v1/payments/PAY%2Fid');
    for(const call of calls){assert.equal(call.init.method,'GET');assert.equal(call.init.body,undefined);assert.equal(call.init.redirect,'error');}
  } finally {globalThis.fetch=oldFetch;if(oldToken===undefined)delete process.env.MERCADOPAGO_AUTH_HEADER;else process.env.MERCADOPAGO_AUTH_HEADER=oldToken;}
});
