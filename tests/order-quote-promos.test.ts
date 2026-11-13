import assert from "node:assert/strict";
import { test } from "node:test";
import * as quotes from "../lib/order-quote";
import { rememberCatalogCosteo } from "../lib/catalog-costeo";
import { pricingHttpError } from "../lib/pricing-http";
import type { CatalogData, CartItem } from "../types";
import type { Oferta } from "../lib/promos";

const ahora = new Date("2026-11-13T23:00:00Z");
const base = { descripcion: "", dias: [5,6,0], desde: null, hasta: null, orden: 0, estado: "aprobada" as const, aprobada_en: null, creada_en: "", actualizada_en: "" };
const duo: Oferta = { ...base, id:"duo", nombre:"Dúo Muzza", titulo:"Dúo Muzza", tipo:"combo", config:{precio:26900,lugares:[{cantidad:2,productos:["muzza"]}]} };
const descuento: Oferta = { ...base,id:"mitad",nombre:"2ª al 50 %",titulo:"2ª al 50 %",tipo:"descuento_cantidad",config:{cada:2,porcentaje:50,productos:null} };
const regalo: Oferta = { ...base,id:"regalo",nombre:"Bebida de regalo",titulo:"Bebida de regalo",tipo:"regalo",config:{minimoPizzas:2,cantidad:1,opciones:[{producto:"pepsi",suplemento:0}]} };
function catalog(ofertas:Oferta[] = [duo,descuento,regalo]):CatalogData {
  const data:CatalogData = { pizzas:[{id:"muzza",nombre:"Muzzarella",precio:15500,categoria:"clasica",desc:"",tags:[],disponible:true}], bebidas:[{id:"pepsi",nombre:"Pepsi 1.5 L",precio:4500,disponible:true,stockUnidades:3}],empanadas:[],empanadaBoxPrices:{6:1,12:1,24:1},promos:[],reviews:[],ofertas };
  rememberCatalogCosteo(data,{costs:new Map([["muzza",3500],["pepsi",2000]]),commissionPct:7.99});
  return data;
}
const pizza = (qty:number):CartItem => ({key:"muzza",cartId:"m",type:"pizza",name:"inventado",price:1,qty});
const quote = (items:CartItem[],data:CatalogData,promo: {ofertaId:string;regaloProductoId?:string}|null = null,freeShippingFrom=30000) =>
  quotes.quoteOrderWithCatalog(items,data,"delivery",{deliveryFee:2000,freeShippingFrom},{promo,ahora});
function conflict(run:()=>unknown, message:RegExp) {
  assert.throws(run,error=>{ const failure=pricingHttpError(error); assert.equal(failure.status,409); assert.match(failure.error,message); return true; });
}
test("cotización Dúo con 3 Muzzarellas parte 2 de combo y 1 a lista",()=>{
  const r=quote([pizza(3)],catalog(),{ofertaId:"duo"});
  assert.equal(r.subtotal,42400); assert.equal(r.total,42400);
  assert.deepEqual(r.items.map(i=>[i.qty,i.price,i.promo?.precioLista]),[[2,13450,15500],[1,15500,undefined]]);
  assert.deepEqual(r.promo,{id:"duo",nombre:"Dúo Muzza",tipo:"combo",ahorro:4100});
  assert.equal(new Set(r.items.map(i=>i.cartId)).size,2);
});
test("cotización regalo con bebida agotada devuelve 409",()=>{
  const data=catalog(); data.bebidas[0].stockUnidades=0;
  conflict(()=>quote([pizza(2)],data,{ofertaId:"regalo",regaloProductoId:"pepsi"}),/bebida/i);
});
test("2ª al 50 % calcula envío gratis sobre subtotal descontado",()=>{
  const r=quote([pizza(4)],catalog(),{ofertaId:"mitad"});
  assert.equal(r.subtotal,46500); assert.equal(r.freeShipping,true); assert.equal(r.shipping,0);
  const below=quote([pizza(2)],catalog(),{ofertaId:"mitad"});
  assert.equal(below.subtotal,23250); assert.equal(below.freeShipping,false); assert.equal(below.total,25250);
});
test("cotización promo vencida devuelve 409",()=>{
  conflict(()=>quote([pizza(2)],catalog([{...duo,hasta:"2026-11-12"}]),{ofertaId:"duo"}),/promo/i);
});
test("sin promo cotiza como antes y descarta marcas enviadas por el cliente",()=>{
  const r=quote([{...pizza(2),promo:{id:"duo",nombre:"Falsa",tipo:"combo",precioLista:99999}}],catalog());
  assert.equal(r.subtotal,31000); assert.equal(r.shipping,0); assert.equal(r.promo,null);
  assert.equal(r.items[0].promo,undefined); assert.equal(r.items[0].price,15500);
});
test("regalo cero conserva costo, stock y validación de precio de lista",()=>{
  const r=quote([pizza(2)],catalog(),{ofertaId:"regalo",regaloProductoId:"pepsi"});
  const bebida=r.items.find(i=>i.type==="bebida")!;
  assert.equal(bebida.price,0); assert.equal(bebida.qty,1); assert.equal(bebida.promo?.tipo,"regalo");
  assert.equal(quotes.quoteCosteo(r).costo_produccion_centavos,900000);
  const data=catalog(); data.bebidas[0].precio=0;
  assert.throws(()=>quote([pizza(2)],data,{ofertaId:"regalo",regaloProductoId:"pepsi"}));
});
test("regalo suma su cantidad a bebidas compradas antes de validar stock",()=>{
  const data=catalog(); data.bebidas[0].stockUnidades=1;
  conflict(()=>quote([pizza(2),{key:"pepsi",cartId:"b",type:"bebida",name:"Pepsi",price:4500,qty:1}],data,{ofertaId:"regalo",regaloProductoId:"pepsi"}),/no quedan bebidas|Pepsi/i);
});
