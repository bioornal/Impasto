import type { AdminOrder } from '../app/admin/components/types';
import { esPedidoParaCocina } from './pedido-visible';
import type { PrintCopy, PrintJob } from './local-printer';

export function adminPrintJob(order: AdminOrder, attemptId: string, reprint = true, copy: PrintCopy = 'cocina'): PrintJob {
  const cliente = copy === 'cliente';
  const address = order.mode === 'delivery'
    ? [order.dir, order.referencia].filter(Boolean).join(' · ')
    : '';
  const notes = [order.notas, order.cuando === 'asap' ? '' : `Horario: ${order.cuando}`]
    .filter(Boolean).join(' · ');
  return {
    attemptId: cliente ? `${attemptId}:cliente` : attemptId,
    source: 'impasto',
    orderId: order._dbId,
    reprint,
    ...(cliente ? { copy } : {}),
    receipt: {
      kind: order.mode === 'delivery' ? 'delivery' : 'retiro',
      date: new Date(order.fecha).toLocaleString('es-AR'),
      // El número corto, como el POS: la referencia (IM-MAN-…, POS-…) tiene más de 40 caracteres.
      number: order.numero || order.id,
      customer: order.cliente,
      phone: order.tel,
      address,
      notes,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.qty,
        detail: item.detail || '',
        unitPrice: item.price,
        ...(cliente ? { lineTotal: item.price * item.qty + (item.extra ?? 0) } : {}),
      })),
      total: order.total,
      ...(cliente ? { subtotal: order.subtotal, shipping: order.shipping } : {}),
      paymentMethod: order.pago,
      paymentStatus: order.pagoEstado,
    },
  };
}

/** Las copias pedidas, en orden (cocina y después cliente), con la misma regla de bloqueo de cocina. */
export function adminPrintJobs(
  order: AdminOrder,
  attemptId: string,
  reprint: boolean,
  copias: readonly PrintCopy[] = ['cocina', 'cliente'],
): PrintJob[] {
  if (!esPedidoParaCocina(order)) throw new Error('Pedido bloqueado para cocina.');
  if (!order._dbId || !order.items.length) throw new Error('Pedido sin productos válidos.');
  return copias.map(copy => adminPrintJob(order, attemptId, reprint, copy));
}
