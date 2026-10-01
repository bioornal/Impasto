import type {CatalogData} from '../types';
export interface CatalogCosteo { costs:Map<string,number>; commissionPct:number }
// Object identity keeps costs out of JSON responses and client component props.
const contexts=new WeakMap<CatalogData,CatalogCosteo>();
export function rememberCatalogCosteo(catalog:CatalogData,context:CatalogCosteo){contexts.set(catalog,context);}
export function catalogCosteo(catalog:CatalogData):CatalogCosteo{
 const context=contexts.get(catalog);
 if(!context)throw new Error('Costeo de la venta no disponible. Reintentá.');
 return context;
}
