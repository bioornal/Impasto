export interface CosteoVenta {costo_produccion_centavos:number|null;comision_pct:number}
type Rpc=(name:string,body:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
/** The only persistence operation creates both facts in one database transaction. */
export async function createCostedPedido(rpc:Rpc,pedido:Record<string,unknown>,costeo:CosteoVenta){
 const {data,error}=await rpc('crear_pedido_costeado',{p_pedido:pedido,p_costeo:costeo});
 return {data:data&&typeof data==='object'&&!Array.isArray(data)&&typeof (data as Record<string,unknown>).id==='string'?[data as Record<string,unknown>]:null,error};
}
