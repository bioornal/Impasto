import type { CreatedOrder } from './orders';
const text = (value: unknown) => String(value ?? '').trim();
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,stable(v)]));
  return value;
}
function items(value: unknown) {
  return Array.isArray(value) ? value.map(i => {
    let key = i.key; let variant = i.variant ?? null;
    if (i.type === 'pizza-half') {
      const ids = variant?.kind === 'half' ? variant.ids : String(key).split('-').slice(1,3);
      key = `half-${ids[0]}-${ids[1]}`; variant = {kind:'half',ids};
    }
    if (i.type === 'empanadas' && variant?.kind === 'empanadas-box') key = `emp-${variant.size}-${Object.keys(variant.selections).sort().join('-')}`;
    return {key,type:i.type,qty:i.qty,variant:stable(variant)};
  }) : null;
}
export function matchesManualOrder(row: Record<string, unknown>, request: Record<string, unknown>, metodo: string): boolean {
  const fields = { nombre_cliente:request.nombre, telefono_cliente:request.tel, email_cliente:request.email,
    direccion:request.dir || 'Retiro en local', modalidad:request.mode, cuando:request.when || 'asap',
    notas:request.notas, referencia:request.ref, cambio:request.cambio, metodo_pago:metodo };
  return Object.entries(fields).every(([k,v]) => text(row[k]) === text(v)) && JSON.stringify(items(row.productos)) === JSON.stringify(items(request.items));
}
export function restoredManualOrder(row: Record<string, unknown>): CreatedOrder {
  return { id:String(row.id),numero:Number(row.numero_pedido),referencia:String(row.external_reference),
    items:row.productos as CreatedOrder['items'], subtotal:Number(row.subtotal),shipping:Number(row.envio),total:Number(row.total),
    freeShipping:row.modalidad === 'delivery' && Number(row.envio) === 0,
    cuentaTransferencia:row.cuenta_transferencia as CreatedOrder['cuentaTransferencia'],recovered:true };
}
export function confirmManualResponse<T>(value: T, key: string): T {
  const row = value as Record<string,unknown> | null;
  if (!row || row.ok !== true || row.numero !== `IM-MAN-${key.toUpperCase()}`
      || ![row.total,row.subtotal,row.shipping].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
      || !Array.isArray(row.items) || !row.items.length) {
    throw new Error('La respuesta no confirmó este pedido. Recuperá el mismo intento antes de enviar otro.');
  }
  return value;
}
