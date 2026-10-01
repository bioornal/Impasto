import type { AdminCustomer } from '../app/admin/components/types';
import { mismoTelefono, telefonoIdentidad } from './crm';
/** Metrics are authoritative server facts; loaded order samples never overwrite them. */
export function adaptCustomer(value:unknown):AdminCustomer {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Contacto CRM inválido');
 const c=value as Record<string,unknown>;
 if(typeof c.telefono!=='string'||!telefonoIdentidad(c.telefono))throw new Error('Teléfono CRM inválido');
 for(const key of ['cant_compras','compras_sin_importe'])if(!Number.isSafeInteger(c[key])||Number(c[key])<0)throw new Error('Compras CRM no disponibles');
 if(typeof c.total_cobrado!=='number'||!Number.isFinite(c.total_cobrado)||c.total_cobrado<0)throw new Error('Cobros CRM no disponibles');
 if(c.ultima_compra!==null && (typeof c.ultima_compra!=='string'||!Number.isFinite(Date.parse(c.ultima_compra))))throw new Error('Última compra CRM no disponible');
 const id=String(c.id||c.telefono);
 return {_dbId:id,id,nombre:String(c.nombre||'Sin nombre'),tel:c.telefono,email:String(c.email||''),dir:String(c.direccion||''),zona:'',pedidos:c.cant_compras as number,total:c.total_cobrado,ultimo:c.ultima_compra as string|null,comprasSinImporte:c.compras_sin_importe as number,notas:String(c.detalles||'')};
}
export async function loadAdminCustomers(read:()=>PromiseLike<{ok:boolean;json:()=>PromiseLike<unknown>}>):Promise<AdminCustomer[]> {
 const response=await read();const payload=await response.json();
 if(!response.ok||!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('No se pudieron verificar las compras del CRM. Reintentá.');
 const body=payload as Record<string,unknown>;
 if(body.ok!==true||!Array.isArray(body.data))throw new Error('CRM incompleto. Reintentá la lectura.');
 const rows=body.data.map(adaptCustomer),seen=new Set<string>(),phones=new Set<string>();
 for(const c of rows){const phone=telefonoIdentidad(c.tel);if(seen.has(c.id)||phones.has(phone))throw new Error('CRM duplicado. Reintentá la lectura.');seen.add(c.id);phones.add(phone);}
 return rows;
}
/** This is a sample of currently loaded orders, not the financial purchase count. */
export function pedidosDelCliente<T extends {tel:string}>(orders:T[],tel:string):T[]{return orders.filter(o=>mismoTelefono(o.tel,tel));}
