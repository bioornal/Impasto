import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assembleCatalogFromResults} from '../lib/catalog-source';
import {catalogCosteo} from '../lib/catalog-costeo';
import {quoteItemsWithCatalog} from '../lib/order-quote';
import {costeoCarrito} from '../lib/costeo-capture';

const rows = (data: unknown[] = []) => ({data, error:null});
const fixture = () => ({
  recipes: [
    {id:'small',nombre:'Chica',precio_prepizza:0,precio_salsa:0},
    {id:'large',nombre:'Grande',precio_prepizza:0,precio_salsa:0},
    {id:'white',nombre:'Blanca',precio_prepizza:0,precio_salsa:0},
    {id:'old',nombre:'Anterior',precio_prepizza:600,precio_salsa:200},
    {id:'prep',nombre:'Prepizza',precio_prepizza:0,precio_salsa:0},
    {id:'sauce',nombre:'Salsa para pizza',precio_prepizza:0,precio_salsa:0},
  ],
  recipeIngredients: [
    {receta_id:'small',ingrediente_id:'dough',cantidad_kg:.25},
    {receta_id:'small',ingrediente_id:'sauce',cantidad_kg:.08},
    {receta_id:'large',ingrediente_id:'dough',cantidad_kg:.35},
    {receta_id:'large',ingrediente_id:'sauce',cantidad_kg:.12},
    {receta_id:'white',ingrediente_id:'dough',cantidad_kg:.3},
    {receta_id:'old',ingrediente_id:'cheese',cantidad_kg:.1},
  ],
  ingredients: [
    {id:'dough',nombre:'Prepizza',unidad:'kg',precio_kg:4000,multiplo_rendimiento:1},
    {id:'sauce',nombre:'Salsa para pizza',unidad:'kg',precio_kg:2000,multiplo_rendimiento:1},
    {id:'cheese',nombre:'Muzzarella',unidad:'kg',precio_kg:10000,multiplo_rendimiento:1},
  ],
  rules:['Chica','Grande','Blanca','Anterior'].map((nombre,i)=>({nombre,receta_id:['small','large','white','old'][i],markup:2,subcategoria:'Pizzas'})),
  defaults:{pizzas_objetivo_mes:100,precio_prepizza_default:9999,precio_salsa_default:9999},
  totalOperativo:10000,
});

function catalog(input=fixture()){
  return assembleCatalogFromResults({
    productos:rows(input.rules.map((r,i)=>({id:String(i),nombre:r.nombre,categoria:'pizzas',precio:99999,disponible:true}))),
    recetas:rows(input.recipes),receta_ingredientes:rows(input.recipeIngredients),ingredientes:rows(input.ingredients),
    precios_venta:rows(input.rules),config_negocio:rows([input.defaults]),costos_fijos:rows([{activo:true,monto:input.totalOperativo}]),
    costos_variables:rows(),promociones:rows(),testimonios:rows(),etiquetas:rows(),
  });
}
test('catalogue and order quoting use portions, white pizza and legacy fixed costs together',()=>{
  const c=catalog();
  assert.deepEqual(c.pizzas.map(p=>[p.nombre,p.precio]),[['Chica',3000],['Grande',3500],['Blanca',3000],['Anterior',4000]]);
  assert.equal(c.pizzas.length,4,'preparations with no product are never sold');
  assert.deepEqual([...catalogCosteo(c).costs],[['0',1160],['1',1640],['2',1200],['3',1800]]);
  const quote=quoteItemsWithCatalog([{key:'0',cartId:'x',type:'pizza',name:'Chica',qty:2,price:99999}],c);
  assert.equal(quote[0].price * quote[0].qty,6000);
  assert.equal(costeoCarrito([{type:'pizza',key:'0',qty:2}],catalogCosteo(c).costs),232000);
  assert.equal(JSON.stringify(c).includes('precio_kg'),false);
  assert.equal(JSON.stringify(c).includes('productionCosts'),false);
});
test('refreshing derived prices and grams updates list prices and new snapshots without changing an earlier capture',()=>{
  const original=catalog();
  const captured=costeoCarrito([{type:'pizza-half',qty:2,variant:{kind:'half',ids:['0','1']}}],catalogCosteo(original).costs);
  assert.equal(captured,280000);
  const changed=fixture();changed.ingredients[0].precio_kg=6000;
  const current=catalog(changed);
  assert.deepEqual(current.pizzas.map(p=>p.precio),[4000,5000,4000,4000]);
  assert.deepEqual([...catalogCosteo(current).costs],[['0',1660],['1',2340],['2',1800],['3',1800]]);
  changed.recipeIngredients[0].cantidad_kg=.3;
  changed.ingredients[1].precio_kg=3000;
  const portions=catalog(changed);
  assert.deepEqual(portions.pizzas.map(p=>p.precio),[4500,5500,4000,4000]);
  assert.equal(catalogCosteo(portions).costs.get('0'),2040);
  assert.equal(catalogCosteo(portions).costs.get('1'),2460);
  assert.equal(costeoCarrito([{type:'pizza-half',qty:2,variant:{kind:'half',ids:['0','1']}}],catalogCosteo(portions).costs),450000);
  assert.equal(captured,280000);
  assert.equal(catalogCosteo(original).costs.get('0'),1160);
});
test('invalid base portions or missing derived ingredients omit only affected pizzas',()=>{
  const changed=fixture();changed.recipeIngredients[0].cantidad_kg=0;
  const c=catalog(changed);
  assert.deepEqual(c.preciosNoDisponibles,['0']);
  assert.equal(catalogCosteo(c).costs.has('0'),false);
  const missing=fixture();missing.ingredients=missing.ingredients.filter(i=>i.id!=='sauce');
  assert.deepEqual(catalog(missing).preciosNoDisponibles,['0','1']);
});
