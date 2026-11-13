import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analisisOferta, rankingOfertas, type OfertaInput } from '../lib/promos';
import { geometriaBarra, escalaGrafico, casosGrafico, referenciaPizza } from '../lib/promos-grafico';
const productos = [{ id:'m', nombre:'Muzzarella', categoria:'pizzas' as const, precio:15500, costo:3791 }, { id:'s', nombre:'Prosciutto', categoria:'pizzas' as const, precio:24000, costo:9353 }];
const contexto = { gastoFijoNoche:54231, envio:3000, envioGratisDesde:35000, comisionPct:7.99, pedidosPorNoche:null, ticketPromedio:null };
const oferta: OfertaInput = { tipo:'combo', nombre:'Combo', titulo:'Combo', descripcion:'', dias:[5], desde:null, hasta:null, orden:0, config:{ precio:26900, lugares:[{ cantidad:2, productos:['m','s'] }] } };
const a = analisisOferta(oferta, productos, contexto);
const fila = (id:string, queda:number, resigna:number, pct:number, ahorroPct:number, ahorro:number, rojo=false) => ({id, orden:0, analisis:{...a, margen:{...a.margen, semaforo:rojo ? 'rojo' as const : 'verde' as const}, totales:{...a.totales, teQueda:{min:queda,max:queda+100}, resignas:{min:0,max:resigna}, gananciaPct:{min:pct,max:pct}, ahorroClientePct:{min:ahorroPct,max:90}, ahorroCliente:{min:ahorro,max:99999}}}});
test('ranking usa mínimos garantizados, desempates y rojo al final sin mutar', () => {
 const filas=[fila('a',100,30,40,10,5),fila('b',100,20,40,20,5),fila('c',100,20,50,20,10),fila('rojo',9999,0,99,99,999,true)];
 const r=rankingOfertas(filas);
 assert.deepEqual(r.vos.map(f=>f.id),['c','b','a','rojo']);
 assert.deepEqual(r.cliente.map(f=>f.id),['c','b','a','rojo']);
 assert.deepEqual(filas.map(f=>f.id),['a','b','c','rojo']);
 const error={...filas[3],analisis:{...filas[3].analisis,margen:{...a.margen,errores:['Falta costo']}}};
 assert.equal(rankingOfertas([error,filas[0]]).vos[1].id,'rojo');
 assert.deepEqual(rankingOfertas([]),{vos:[],cliente:[]});
});
test('combo usa pedidos reales correlacionados para peor y mejor gráfico',()=>{
 const casos=casosGrafico(a);
 assert.equal(casos.length,2);
 assert.equal(casos[0].teQueda,8194);
 assert.equal(casos[0].paga+casos[0].resignas,48000);
 assert.equal(casos[1].paga+casos[1].resignas,31000);
});
test('escala común, segmentos conservan total y no producen geometría negativa',()=>{
 assert.equal(escalaGrafico([31000,48000],11709).max,50000);
 const g=geometriaBarra({teQueda:19318,resignas:4100,costo:7582},50000);
 assert.equal(g.total,31000); assert.equal(g.ancho,62);
 assert.equal(g.segmentos.reduce((n,s)=>n+s.ancho,0),62);
 assert.equal(g.segmentos[2].inicio,46.836);
 assert.ok(geometriaBarra({teQueda:-10,resignas:20,costo:30},50).segmentos.every(s=>s.ancho>=0));
 assert.ok(escalaGrafico([]).max>0);
 assert.deepEqual(referenciaPizza(productos),{nombre:'Muzzarella',valor:11709});
 assert.equal(referenciaPizza([{...productos[0],costo:null}]),null);
});

import { productos as reales, contexto as negocio, ofertas } from './promos-grafico-datos';
import { cabeRotulo, pedidosNoche } from '../lib/promos-grafico';
test('las cinco promos reales: ranking, peor pedido y suma de segmentos coherentes', () => {
 const filas=ofertas.map(o=>({...o,analisis:analisisOferta(o,reales,negocio)}));
 const ranking=rankingOfertas(filas);
 assert.deepEqual(ranking.vos.map(o=>o.id),['noche','regalo','duo','segunda','pizza']);
 assert.deepEqual(ranking.cliente.map(o=>o.id),['segunda','duo','regalo','pizza','noche']);
 assert.deepEqual(ranking.vos.map(o=>o.analisis.totales.teQueda.min),[34991,20868,19318,15668,13264]);
 for(const f of filas) {
  const a=f.analisis, peor=a.peorPedido!;
  assert.equal(peor.teQueda,a.totales.teQueda.min);
  for(const p of casosGrafico(a)) {
   assert.equal(p.teQueda+p.costo,p.paga);
   assert.equal(geometriaBarra(p,80000).total,p.paga+p.resignas);
  }
 }
 assert.equal(casosGrafico(filas[0].analisis).length,1);
 assert.equal(casosGrafico(filas[2].analisis).length,2);
 assert.equal(casosGrafico(filas[3].analisis).length,3);
 assert.equal(casosGrafico(filas[4].analisis).length,6);
 assert.deepEqual(ranking.vos.map(o=>o.analisis.combosParaCubrirNoche),[2,3,3,4,5]);
});
test('ranking recalcula posiciones sobre el subconjunto y conserva empates', () => {
 const uno=fila('uno',100,10,50,20,10), dos=fila('dos',100,10,50,20,10);
 assert.deepEqual(rankingOfertas([dos,uno]).vos.map(o=>o.id),['dos','uno']);
 assert.deepEqual(rankingOfertas([uno]).cliente.map(o=>o.id),['uno']);
});
test('rótulos sólo si entran y noche respeta datos ausentes, cero y pérdida', () => {
 assert.equal(cabeRotulo(10,'$10.000',300),false);
 assert.equal(cabeRotulo(50,'$10.000',300),true);
 assert.equal(pedidosNoche(null,1000),null);
 assert.equal(pedidosNoche(54231,0),null);
 assert.equal(pedidosNoche(54231,-1),null);
 assert.equal(pedidosNoche(0,1000),0);
 assert.equal(pedidosNoche(54231,19318),3);
 const invalida=analisisOferta({...oferta,nombre:''},productos,contexto);
 assert.deepEqual(casosGrafico(invalida),[]);
});

test('la escala no deja media barra vacía con el pedido más grande', () => {
  assert.equal(escalaGrafico([60500],11709).max,70000);
});
