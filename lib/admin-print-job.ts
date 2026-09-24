import type { AdminOrder } from '../app/admin/components/types';
import { esPedidoParaCocina } from './pedido-visible';
import type { PrintJob } from './local-printer';

export function adminPrintJob(order: AdminOrder, attemptId: string, reprint = true): PrintJob {
  const address = order.mode === 'delivery'
    ? [order.dir, order.referencia].filter(Boolean).join(' · ')
    : '';
  const notes = [order.notas, order.cuando === 'asap' ? '' : `Horario: ${order.cuando}`]
    .filter(Boolean).join(' · ');
  return {
    attemptId,
    source: 'impasto',
    orderId: order._dbId,
    reprint,
    receipt: {
      kind: order.mode === 'delivery' ? 'delivery' : 'retiro',
      date: new Date(order.fecha).toLocaleString('es-AR'),
      number: order.id,
      customer: order.cliente,
      phone: order.tel,
      address,
      notes,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.qty,
        detail: item.detail || '',
        unitPrice: item.price,
      })),
      total: order.total,
      paymentMethod: order.pago,
      paymentStatus: order.pagoEstado,
    },
  };
}

export async function sendAdminPrint(
  order: AdminOrder,
  attemptId: string,
  send: (job: PrintJob) => Promise<'queued' | 'duplicate'>,
  reprint = false,
): Promise<'queued' | 'duplicate'> {
  if (!esPedidoParaCocina(order)) throw new Error('Pedido bloqueado para cocina.');
  if (!order._dbId || !order.items.length) throw new Error('Pedido sin productos válidos.');
  return send(adminPrintJob(order, attemptId, reprint));
}
