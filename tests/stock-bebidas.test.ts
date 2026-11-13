import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aplicarStockBebidas, avisoStock, bebidasConsumidas, errorDeStockDeLaBase, esBebida, excesoDeBebidas, stockDesdeTexto, topeDeBebidas, validarStockBebidas, StockAgotadoError } from '../lib/stock-bebidas';
import { pricingHttpError } from '../lib/pricing-http';
import { fichaDeBebida } from '../lib/ficha';
import type { CartItem, CatalogData } from '../types';

const linea = (extra: Partial<CartItem> = {}): CartItem => ({ key:'coca', cartId:'a', type:'bebida', name:'Coca-Cola 1.5 L', price:3000, qty:1, ...extra });
const catalogo: CatalogData = { pizzas:[], empanadas:[], bebidas:[{ id:'coca', nombre:'Coca-Cola 1.5 L', precio:3000, disponible:true }], empanadaBoxPrices:{6:1,12:2,24:3}, promos:[], reviews:[] };

test('reconocimiento del POS; stock persistente, NULL y ausencia sin control', () => {
  assert.equal(esBebida({tipo:'bebida'}), true);
  assert.equal(esBebida({categoria:'Bebidas sin alcohol'}), true);
  assert.equal(esBebida({tipo:'pizza'}), false);
  const con = aplicarStockBebidas(catalogo, [{producto_id:'coca',unidades:2}]);
  assert.equal(con.bebidas[0].stockUnidades, 2);
  assert.equal(catalogo.bebidas[0].stockUnidades, undefined);
  assert.equal(aplicarStockBebidas(catalogo, []).bebidas[0].stockUnidades, null);
  assert.equal(aplicarStockBebidas(catalogo, [{producto_id:'coca',unidades:null}]).bebidas[0].stockUnidades, null);
  assert.equal(fichaDeBebida(con.bebidas[0]).stockUnidades, 2);
  assert.equal(fichaDeBebida(aplicarStockBebidas(catalogo, [{producto_id:'coca',unidades:0}]).bebidas[0]).agotado, true);
});
test('consumo y tope agregan líneas repetidas y regalos; pizzas/cajas/mitades no consumen', () => {
  const items = [linea(),linea({cartId:'b',qty:2,price:0}),linea({type:'pizza',qty:20}),linea({type:'pizza-half'}),linea({type:'empanadas'})];
  assert.deepEqual(bebidasConsumidas(items), {coca:3});
  assert.equal(topeDeBebidas(items,linea(),1,{coca:4}), null);
  assert.match(topeDeBebidas(items,linea(),2,{coca:4})!, /Nos quedan 4/);
  assert.equal(topeDeBebidas(items,linea(),50,{coca:null}), null);
  assert.equal(topeDeBebidas(items,linea({type:'pizza'}),50,{coca:0}), null);
  assert.match(excesoDeBebidas(items,{coca:2})!, /ajustá la cantidad/);
  assert.equal(excesoDeBebidas(items,{coca:3}), null);
});
test('cotización rechaza con 409, también stock cero, antes de la disponibilidad', () => {
  const data = aplicarStockBebidas(catalogo,[{producto_id:'coca',unidades:2}]);
  assert.doesNotThrow(() => validarStockBebidas([linea({qty:2})],data));
  assert.throws(() => validarStockBebidas([linea(),linea({qty:2})],data),StockAgotadoError);
  assert.throws(() => validarStockBebidas([linea()],aplicarStockBebidas(catalogo,[{producto_id:'coca',unidades:0}])),/Se agotó/);
  const error = errorDeStockDeLaBase({message:'error: STOCK_AGOTADO|Coca-Cola 1.5 L|2'});
  assert.deepEqual(pricingHttpError(error), {status:409,error:'Nos quedan 2 Coca-Cola 1.5 L: ajustá la cantidad.'});
  assert.equal(errorDeStockDeLaBase('otro error'),null);
  assert.equal(errorDeStockDeLaBase('STOCK_AGOTADO|Coca|1')?.message,'Nos queda 1 Coca: ajustá la cantidad.');
  assert.equal(errorDeStockDeLaBase('STOCK_AGOTADO|Coca|0')?.message,'Se agotó Coca. Sacala del pedido para guardarlo.');
});
test('avisos y carga del panel aceptan solo enteros no negativos o NULL explícito', () => {
  assert.equal(avisoStock(0),'Agotado');
  assert.equal(avisoStock(2),'¡Quedan 2!');
  assert.equal(avisoStock(3),'¡Quedan 3!');
  for(const n of [null,undefined,4]) assert.equal(avisoStock(n),null);
  assert.equal(stockDesdeTexto('12'),12);
  assert.equal(stockDesdeTexto(null),null);
  for(const n of ['',undefined,true,1.5,-1,'no',Infinity,2147483648]) assert.equal(stockDesdeTexto(n),undefined);
});
