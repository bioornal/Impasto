import assert from 'node:assert/strict';
import {test} from 'node:test';
import {costeoCarrito,costeoPos} from '../lib/costeo-capture';
import {createCostedPedido} from '../lib/create-costed-pedido';
import {executeManualAttempt} from '../lib/manual-attempt';
import {resolveValidatedPrices} from '../lib/pricing-safety';
test('half and boxes use trusted costs and round once',()=>{
 const costs=new Map([['a',100.015],['b',200.015],['e',30.001]]);
 const items=[{type:'pizza-half',qty:2,variant:{kind:'half',ids:['a','b']},costo:0},{type:'empanadas',qty:1,variant:{kind:'empanadas-box',selections:{e:6}}}];
 assert.equal(costeoCarrito(items,costs),48004);
 assert.equal(costeoCarrito([{type:'bebida',key:'missing',qty:1}],costs),null);
 assert.equal(costeoPos([{nombre:'a',cantidad:2,extra:0}],costs),20003);
 assert.equal(costeoPos([{nombre:'a',cantidad:2,extra:10}],costs),null);
});
test('production shares price recipe calculation and excludes operating budget',()=>{
 const input={recipes:[{id:'r',precio_prepizza:100,precio_salsa:20}],recipeIngredients:[{receta_id:'r',ingrediente_id:'i',cantidad_kg:1}],ingredients:[{id:'i',precio_kg:30,multiplo_rendimiento:2}],rules:[{nombre:'Pizza',receta_id:'r',subcategoria:'Pizzas',markup:2}],defaults:{pizzas_objetivo_mes:10,comision_tarjeta_pct:12},totalOperativo:10000};
 const a=resolveValidatedPrices(input),b=resolveValidatedPrices({...input,totalOperativo:20000});
 assert.equal(a.productionCosts?.get('Pizza'),180);assert.equal(b.productionCosts?.get('Pizza'),180);assert.equal(a.commissionPct,12);assert.notEqual(a.calculated.get('Pizza'),b.calculated.get('Pizza'));
 assert.equal(resolveValidatedPrices({...input,ingredients:[]}).productionCosts?.has('Pizza'),false);
 assert.equal(resolveValidatedPrices({...input,rules:[]}).productionCosts?.size,0);
});
test('scalar RPC normalizes, errors never fall back to a parent-only insert',async()=>{
 let calls=0;
 const rpc=async(name:string,body:Record<string,unknown>)=>{calls++;assert.equal(name,'crear_pedido_costeado');assert.deepEqual(body.p_costeo,{costo_produccion_centavos:null,comision_pct:7.99});return {data:null,error:new Error('costeo failure')};};
 const result=await createCostedPedido(rpc,{productos:[]},{costo_produccion_centavos:null,comision_pct:7.99});
 assert.equal(result.data,null);assert.ok(result.error);assert.equal(calls,1);
 assert.deepEqual((await createCostedPedido(async()=>({data:{id:'stored'},error:null}),{},{costo_produccion_centavos:1,comision_pct:0})).data,[{id:'stored'}]);
});
test('attempt recovery returns original sale and never recaptures catalog costs',async()=>{
 const sale={id:'original'};
 const result=await executeManualAttempt({lookup:async()=>sale,matches:()=>true,create:async()=>{throw new Error('must not recapture');}});
 assert.equal(result.order,sale);assert.equal(result.recovered,true);
});
