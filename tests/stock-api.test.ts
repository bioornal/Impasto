import assert from 'node:assert/strict';
import { test } from 'node:test';
import Module, { createRequire } from 'node:module';
import { NextRequest, NextResponse } from 'next/server';

let autorizado = true, lecturas = 0, falla = false;
const llamadas: unknown[] = [];
const loader = Module as unknown as { _load:(id:string,...args:unknown[])=>unknown };
const original = loader._load;
loader._load = (id,...args) => {
  if(id === '@/lib/admin-auth') return {requireAdmin:async()=>autorizado ? null : NextResponse.json({ok:false},{status:401})};
  if(id === '@/lib/stock-bebidas-server') return {leerStockBebidas:async()=>{lecturas++;return falla ? null : [{producto_id:'00000000-0000-4000-8000-000000000001',unidades:2}];}};
  if(id === '@/lib/insforge') return {db:{database:{rpc:async(...params:unknown[])=>{llamadas.push(params);return {data:{unidades:2},error:null};}}}};
  if(id === '@/lib/catalog-cache') return {invalidarCatalogo:()=>{llamadas.push('invalidar');}};
  return original(id,...args);
};
const ruta = createRequire(import.meta.url)('../app/api/admin/stock/route') as typeof import('../app/api/admin/stock/route');
loader._load = original;
const req=(body:unknown)=>new NextRequest('http://localhost/api/admin/stock',{method:'PUT',body:JSON.stringify(body)});
const producto_id='00000000-0000-4000-8000-000000000001';
test('stock API: auth antes de leer/escribir; fijar, compra aditiva, NULL y validación',async()=>{
  autorizado=false;
  assert.equal((await ruta.GET()).status,401);
  assert.equal((await ruta.PUT(req({producto_id,unidades:3}))).status,401);
  assert.equal(lecturas,0);assert.equal(llamadas.length,0);
  autorizado=true;
  assert.equal((await (await ruta.GET()).json()).data[0].unidades,2);
  falla=true;assert.equal((await ruta.GET()).status,500);falla=false;
  for(const body of [{},{producto_id},{producto_id,unidades:''},{producto_id,unidades:-1},{producto_id,unidades:1.2},{producto_id,compra:0},{producto_id,compra:null},{producto_id,compra:2,unidades:3},{producto_id:'pizza',unidades:1}]) assert.equal((await ruta.PUT(req(body))).status,400);
  assert.equal(llamadas.length,0);
  for(const unidades of [0,12,null]) assert.equal((await ruta.PUT(req({producto_id,unidades}))).status,200);
  assert.equal((await ruta.PUT(req({producto_id,compra:5}))).status,200);
  assert.equal((await ruta.PUT(req({producto_id,ajuste:-2}))).status,200);
  assert.deepEqual(llamadas.filter(l=>l!=='invalidar'),[
    ['fijar_stock_bebida',{p_producto:producto_id,p_unidades:0}],['fijar_stock_bebida',{p_producto:producto_id,p_unidades:12}],['fijar_stock_bebida',{p_producto:producto_id,p_unidades:null}],['cargar_stock_bebida',{p_producto:producto_id,p_delta:5,p_motivo:'carga'}],['cargar_stock_bebida',{p_producto:producto_id,p_delta:-2,p_motivo:'ajuste'}],
  ]);
});
