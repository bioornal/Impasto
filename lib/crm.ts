type Rpc = (name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
export const telefonoIdentidad=(value:unknown)=>typeof value==='string'?value.replace(/\D/g,''):'';
export function mismoTelefono(a:unknown,b:unknown){const id=telefonoIdentidad(a);return id!=='' && id===telefonoIdentidad(b);}
export interface ClienteCrm extends Record<string,unknown> {telefono:string;cant_compras:number;total_cobrado:number;compras_sin_importe:number;ultima_compra:string|null}
function validarCliente(value:unknown):ClienteCrm{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Cliente inválido');
 const row=value as ClienteCrm;
 if(typeof row.telefono!=='string'||!row.telefono.trim())throw new Error('Cliente inválido');
 for(const key of ['cant_compras','compras_sin_importe'] as const)if(!Number.isSafeInteger(row[key])||row[key]<0)throw new Error('Compras no disponibles');
 if(typeof row.total_cobrado!=='number'||!Number.isFinite(row.total_cobrado)||row.total_cobrado<0)throw new Error('Cobros no disponibles');
 if(row.ultima_compra!==null && (typeof row.ultima_compra!=='string'||!Number.isFinite(Date.parse(row.ultima_compra))))throw new Error('Fecha no disponible');
 return row;
}
/** No metrics are published until every page has been verified. */
export async function leerClientesCrm(rpc:Rpc,proyecto='impasto',telefono:string|null=null,pageSize=500):Promise<ClienteCrm[]>{
 if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1000)throw new Error('Página inválida');
 const rows:ClienteCrm[]=[],seen=new Set<string>();
 while(true){
  const result=await rpc('leer_clientes_crm',{p_proyecto:proyecto,p_telefono:telefono,p_offset:rows.length,p_limit:pageSize});
  if(result.error||!Array.isArray(result.data)||result.data.length>pageSize)throw new Error('No se pudo cargar el CRM completo');
  if(result.data.length===0)return rows;
  for(const item of result.data){const row=validarCliente(item);const identity=telefonoIdentidad(row.telefono);if(!identity)throw new Error('Teléfono inválido');if(seen.has(identity))throw new Error('Identidad de clientes duplicada; revisá los contactos');seen.add(identity);rows.push(row);}
 }
}
export async function guardarPerfilCliente(rpc:Rpc,perfil:Record<string,unknown>,proyecto='impasto'){
 const result=await rpc('guardar_perfil_cliente',{p_perfil:perfil});
 if(result.error||!result.data||typeof result.data!=='object'||Array.isArray(result.data))throw new Error('No se pudo confirmar el contacto');
 const rows=await leerClientesCrm(rpc,proyecto,String(perfil.telefono));
 if(rows.length!==1)throw new Error('El teléfono tiene perfiles ambiguos. Revisá los contactos.');
 return rows[0];
}
