import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as guia from '../lib/guia-cocina';
import {readPages} from '../lib/read-pages';

test('kitchen data loads both old and migrated preparation schemas, and keeps the new base type',async()=>{
  const require=createRequire(import.meta.url);
  const compiled=ts.transpileModule(readFileSync(new URL('../lib/guia-cocina-datos.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  for(const migrated of [false,true]){
    const preparation={receta_id:'prep',ingrediente_id:'ingredient',rinde_kg:1,...(migrated?{tipo_base:'salsa'}:{})};
    const db={database:{from(table:string){
      let columns='*';
      const query={select(c:string){columns=c;return query},eq(){return query},order(){return query},range(){return query},limit(){return query},
        then(resolve:(value:unknown)=>unknown){
          if(table!=='preparaciones')return Promise.resolve({data:[],error:null}).then(resolve);
          if(!migrated && columns.split(',').includes('tipo_base'))return Promise.resolve({data:null,error:{code:'42703',message:'column tipo_base does not exist'}}).then(resolve);
          const projected=columns==='*'?preparation:Object.fromEntries(columns.split(',').map(k=>[k,preparation[k as keyof typeof preparation]]));
          return Promise.resolve({data:[projected],error:null}).then(resolve);
        }};
      return query;
    }}};
    const exported:{leerFilasGuia?:()=>Promise<guia.FilasGuia>}={};
    // Fuera de Next no hay caché: unstable_cache pasa la función tal cual.
    const nextCache={unstable_cache:<T,>(fn:T)=>fn};
    runInNewContext(compiled,{exports:exported,require:(name:string)=>name==='@/lib/insforge'?{db}:name==='@/lib/read-pages'?{readPages}:name==='next/cache'?nextCache:require(name)});
    const loaded=await exported.leerFilasGuia!();
    assert.equal(loaded.preparaciones[0].receta_id,'prep');
    assert.equal(loaded.preparaciones[0].rinde_kg,1);
    assert.equal(loaded.preparaciones[0].tipo_base,migrated?'salsa':undefined);
  }
});

test('the kitchen page renders linked salsa once with actual grams, a white base and legacy salsa together',async()=>{
  const receta=(id:string,precio_salsa:number)=>({id,nombre:id,precio_salsa,en_cocina:null,indicaciones:null,conservacion:null});
  const filas:guia.FilasGuia={
    productos:['Roja','Blanca','Antigua'].map(nombre=>({id:nombre,nombre,categoria:'pizzas',archivado:false})),
    precios:['Roja','Blanca','Antigua'].map(nombre=>({id:nombre,nombre,receta_id:nombre})),
    recetas:[receta('Roja',0),receta('Blanca',0),receta('Antigua',200),receta('masa',0),receta('salsa',0)],
    ingredientes:[{id:'masa',nombre:'Prepizza',unidad:'kg',gramos_por_unidad:null},{id:'salsa',nombre:'Salsa artesanal',unidad:'kg',gramos_por_unidad:null}],
    lineas:[{id:'1',receta_id:'Roja',ingrediente_id:'masa',cantidad_kg:.28,momento:'base'},
      {id:'2',receta_id:'Roja',ingrediente_id:'salsa',cantidad_kg:.08,momento:'base'},
      {id:'3',receta_id:'Blanca',ingrediente_id:'masa',cantidad_kg:.32,momento:'base'}],
    preparaciones:[{receta_id:'masa',ingrediente_id:'masa',rinde_kg:2.8,tipo_base:'prepizza'},
      {receta_id:'salsa',ingrediente_id:'salsa',rinde_kg:1,tipo_base:'salsa'}],
  };
  // Only replace network/photo adapters; compile and render the actual page and recipe assembler.
  const require=createRequire(import.meta.url);
  const source=readFileSync(new URL('../app/cocina/page.tsx',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exported:{default?:()=>Promise<React.ReactNode>}={};
  runInNewContext(compiled,{exports:exported,require:(name:string)=>{
    if(name==='@/lib/guia-cocina')return guia;
    if(name==='@/lib/guia-cocina-datos')return {leerFilasGuia:async()=>filas};
    if(name==='@/lib/fotos')return {elegirFoto:()=>undefined};
    if(name==='@/lib/fotos-bucket')return {listarFotos:async()=>[]};
    if(name==='@/lib/stock-images')return {REAL_PRODUCT_PHOTOS:{}};
    return require(name);
  }});
  const markup=renderToStaticMarkup(await exported.default!());
  const articles=markup.match(/<article class="ck-pizza">.*?<\/article>/g)!;
  const roja=articles.find(a=>a.includes('<h3>Roja</h3>'))!;
  const blanca=articles.find(a=>a.includes('<h3>Blanca</h3>'))!;
  const antigua=articles.find(a=>a.includes('<h3>Antigua</h3>'))!;
  assert.match(roja,/280 g/);assert.match(roja,/80 g/);
  assert.equal((roja.match(/Salsa artesanal/g)||[]).length,1);
  assert.doesNotMatch(roja,/150 g|Sin salsa/);
  assert.match(blanca,/320 g/);assert.match(blanca,/Sin salsa/);
  assert.doesNotMatch(blanca,/150 g|Salsa artesanal/);
  assert.match(antigua,/Salsa de tomate, 150 g/);
  assert.doesNotMatch(markup,/Bollo de unos 300 g/);
  assert.match(markup,/id="prep-salsa-artesanal"/);
});
