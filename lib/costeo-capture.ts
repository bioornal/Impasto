import {cajasDeEmpanadas} from './effective-prices';
/** Private server calculations. Never reads a cost supplied by the buyer. Each empanada box adds its cardboard boxes at cost. */
export function costeoCarrito(items: Array<{type:string;key?:string;qty:number;variant?:{kind:string;ids?:string[];size?:number;selections?:Record<string,number>}}>, costs:Map<string,number>, cajaEmpanadas=0):number|null {
 let total=0;
 for(const item of items){
  let cost:number|undefined;
  if(item.type==='pizza-half' && item.variant?.kind==='half'){
   const [a,b]=item.variant.ids??[];
   const left=costs.get(a),right=costs.get(b);
   if(left!==undefined && right!==undefined)cost=(left+right)/2;
  }else if(item.type==='empanadas' && item.variant?.kind==='empanadas-box'){
   cost=cajasDeEmpanadas(Number(item.variant.size)||0)*cajaEmpanadas;
   for(const [id,quantity] of Object.entries(item.variant.selections??{})){
    const value=costs.get(id);
    if(value===undefined){cost=undefined;break;}
    cost+=value*quantity;
   }
  }else cost=costs.get(item.key??'');
  if(cost===undefined||!Number.isFinite(cost)||cost<0)return null;
  total+=cost*item.qty;
 }
 const cents=Math.round(total*100);
 return Number.isSafeInteger(cents)&&cents>=0?cents:null;
}
/** POS lines are sold loose; the cardboard box rides inside one empanada line and is costed at its charge. */
export function costeoPos(items:Array<{nombre:string;cantidad:number;extra?:number;importe_cajas?:number}>,costs:Map<string,number>):number|null{
 if(items.some(item=>(item.extra??0)!==0))return null;
 const cents=costeoCarrito(items.map(item=>({type:'pizza',key:item.nombre,qty:item.cantidad})),costs);
 const cajas=items.reduce((sum,item)=>sum+(item.importe_cajas??0),0);
 if(cents===null||!Number.isFinite(cajas)||cajas<0)return null;
 const total=cents+Math.round(cajas*100);
 return Number.isSafeInteger(total)?total:null;
}
