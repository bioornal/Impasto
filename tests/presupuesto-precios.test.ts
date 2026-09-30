import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {presupuestoMensual} from '../lib/presupuesto-precios';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/presupuesto-precios.json',import.meta.url),'utf8'));
test('shared fixtures preserve monthly budget and rounded operating cost',()=>{
  for(const row of fixture){const total=presupuestoMensual(row.fijos,row.variables);assert.equal(total,row.total,row.nombre);assert.equal(Math.round(total/row.objetivo),row.porUnidad,row.nombre);}
});
test('invalid planned costs fail instead of becoming zero',()=>{
  for(const bad of [null,undefined,'',true,'bad','0xFF','0b10',-1,Infinity,NaN]){
    assert.throws(()=>presupuestoMensual([{activo:true,monto:bad}],[]),/presupuesto/i);
    assert.throws(()=>presupuestoMensual([],[{monto_referencia:bad}]),/presupuesto/i);
  }
  assert.equal(presupuestoMensual([{activo:false,monto:null}],[]),0);
  assert.throws(()=>presupuestoMensual([{activo:true,monto:Number.MAX_VALUE}],[{monto_referencia:Number.MAX_VALUE}]),/presupuesto/i);
});
