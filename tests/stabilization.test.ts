import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as safety from '../lib/stabilization';
import { completeRefund } from '../lib/refund-completion';
const refundPedido={external_reference:'IM-test',total:100,estado_pago:'aprobado',mp_order_id:'mp1'};
const refundOrderFixture=(status:string,status_detail:string)=>({id:'mp1',external_reference:'IM-test',total_amount:'100.00',total_paid_amount:'100.00',currency:'ARS',status,status_detail,transactions:{payments:[{id:'PAY',status:'processed',status_detail:'accredited'}],...(['refunded','partially_refunded'].includes(status_detail)?{refunds:[{id:'REF',status:'processed',amount:status_detail==='partially_refunded'?'30.00':'100.00'}]}:{})}});


test('zero delivery rates remain zero and malformed values use the fallback', () => {
  assert.equal(safety.nonNegativeRate(0, 2500), 0);
  assert.equal(safety.nonNegativeRate('0', 35000), 0);
  for (const value of [null, undefined, '', -1, 'oops', Infinity]) {
    assert.equal(safety.nonNegativeRate(value, 2500), 2500);
  }
});

test('a changed or missing accepted total prevents the payment side effect', async () => {
  let payments = 0;
  for (const expected of [undefined, '10000', NaN, Infinity, -1, 0, 10000]) {
    assert.throws(() => { safety.assertExpectedTotal(expected, 12000); payments++; });
  }
  assert.equal(payments, 0);
  safety.assertExpectedTotal(12000, 12000);
});

test('failed admin writes preserve state and surface server errors', async () => {
  let state = 'available';
  await assert.rejects(async () => {
    await safety.confirmAdminMutation(async () => new Response(JSON.stringify({ ok: false, error: 'Sesión vencida' }), { status: 401 }));
    state = 'sold-out';
  }, /Sesión vencida/);
  assert.equal(state, 'available');
  await assert.rejects(safety.confirmAdminMutation(async () => new Response('gateway', {status: 502})), /guardar/);
  await assert.rejects(safety.confirmAdminMutation(async () => { throw new Error('offline'); }), /offline/);
  await safety.confirmAdminMutation(async () => new Response(JSON.stringify({ ok: true })));
  state = 'sold-out';
  assert.equal(state, 'sold-out');
});

test('refund completed at provider with failed DB persistence is explicitly recoverable', async () => {
  let gets=0;
  const result = await completeRefund({
    pedido:refundPedido,
    current: async () => refundOrderFixture(++gets===1?'processed':'refunded',gets===1?'accredited':'refunded'),
    reserve:async()=>"refund-mp1-total",refund: async () => refundOrderFixture('refunded','refunded'),
    persist: async () => { throw new Error('DB down'); },
  });
  assert.equal(result.refundCompleted, true);
  assert.equal(result.persistencePending, true);
  assert.equal(result.estadoPago, 'reembolsado');
});

test('retry after provider refund only reconciles DB and never refunds twice', async () => {
  let refunds = 0;
  const result = await completeRefund({
    pedido:refundPedido,
    current: async () => (refundOrderFixture('refunded','refunded')),
    reserve:async()=>"refund-mp1-total",refund: async () => { refunds++; return { id: 'mp1', status: 'refunded', status_detail: 'refunded' }; },
    persist: async () => {},
  });
  assert.equal(refunds, 0);
  assert.equal(result.recovered, true);
  assert.equal(result.persistencePending, false);
});

test('an existing partial refund never initiates a different requested refund', async () => {
  let refunds = 0;
  const result = await completeRefund({
    pedido:refundPedido,
    current: async () => refundOrderFixture('processed','partially_refunded'),
    reserve:async()=>"refund-mp1-total",refund: async () => { refunds++; throw new Error('must not refund again'); },
    persist: async () => {},
  });
  assert.equal(refunds, 0);
  assert.equal(result.recovered, true);
});

test('a rejected provider payment cannot be refunded based on stale approved DB state', async () => {
  let refunds = 0;
  await assert.rejects(completeRefund({
    pedido:refundPedido,
    current: async () => refundOrderFixture('failed','rejected'),
    reserve:async()=>"refund-mp1-total",refund: async () => { refunds++; throw new Error('must not refund'); },
    persist: async () => {},
  }), /aprobado/);
  assert.equal(refunds, 0);
});
