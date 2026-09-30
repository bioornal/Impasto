import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeManualAttempt, durableManualAttempt, completeManualAttempt, manualAttemptKey } from '../lib/manual-attempt';

const uuid = 'af3a5f88-7471-42cb-8c27-f863e9df0998';
test('committed response lost recovers original total without a second insert', async () => {
  let saved: { id: string; total: number } | null = null; let inserts = 0;
  const result = await executeManualAttempt({
    lookup: async () => saved, matches: () => true,
    create: async () => { inserts++; saved = { id: 'one', total: 20 }; throw new Error('response lost'); },
  });
  assert.deepEqual(result, { order: saved, recovered: true }); assert.equal(inserts, 1);
});
test('concurrent same reference returns one persisted sale to both callers', async () => {
  let saved: { id: string } | null = null; let inserts = 0;
  const options = { lookup: async () => saved, matches: () => true, create: async () => {
    if (saved) throw { code: '23505', message: 'pedidos_external_reference_uidx' };
    inserts++; saved = { id: 'one' }; return saved;
  } };
  const results = await Promise.all([executeManualAttempt(options), executeManualAttempt(options)]);
  assert.equal(inserts, 1); assert.equal(results[0].order.id, results[1].order.id);
});
test('incompatible payload never inserts or exposes the persisted sale', async () => {
  let inserted = false;
  await assert.rejects(executeManualAttempt({ lookup: async () => ({ id: 'private' }), matches: () => false,
    create: async () => { inserted = true; return { id: 'second' }; } }), /intento.*datos/i);
  assert.equal(inserted, false);
});
test('concurrent different payload with one secret rejects the losing request', async () => {
  let row: {id:string;qty:number} | null = null;
  const submit = (qty:number) => executeManualAttempt({lookup:async()=>row,matches:order=>order.qty===qty,create:async()=>{
    if (row) throw {code:'23505',message:'pedidos_external_reference_uidx'};
    row={id:'one',qty};return row;
  }});
  const results = await Promise.allSettled([submit(1),submit(2)]);
  assert.equal(results[0].status,'fulfilled'); assert.equal(results[1].status,'rejected');assert.deepEqual(row,{id:'one',qty:1});
});
test('missing, legacy and malformed attempt keys cannot become new references', () => {
  for (const value of [null,undefined,'','IM-123456-AAAA','123','af3a5f88-7471-12cb-8c27-f863e9df0998']) assert.equal(manualAttemptKey(value),null);
  assert.equal(manualAttemptKey(uuid),uuid.toUpperCase());
});
test('failed lookup blocks creation and ambiguous insert is never retried', async () => {
  let inserts = 0;
  await assert.rejects(executeManualAttempt({ lookup: async () => { throw new Error('lookup offline'); }, matches: () => true,
    create: async () => { inserts++; return { id: 'wrong' }; } }));
  assert.equal(inserts, 0);
  await assert.rejects(executeManualAttempt({ lookup: async () => null, matches: () => true,
    create: async () => { inserts++; throw new Error('unknown'); } }), /unknown/);
  assert.equal(inserts, 1);
});
test('browser retains UUID and original payload across reload and edits until confirmed success', () => {
  const values = new Map<string, string>(); const storage = { getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const first = durableManualAttempt(storage, 'sale', { total: 10 }, () => uuid);
  const retry = durableManualAttempt(storage, 'sale', { total: 99 }, () => { throw new Error('must retain'); });
  assert.deepEqual(retry, first);
  completeManualAttempt(storage, 'sale', 'another'); assert.deepEqual(durableManualAttempt(storage, 'sale', {}, () => uuid), first);
  completeManualAttempt(storage, 'sale', uuid);
  const next = durableManualAttempt(storage, 'sale', { total: 99 }, () => 'bf3a5f88-7471-42cb-8c27-f863e9df0998');
  assert.notEqual(next.key, first.key); assert.deepEqual(next.payload, { total: 99 });
});
