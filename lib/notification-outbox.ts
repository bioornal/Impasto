import type { DeliveryResult, FrozenEmail, FrozenTelegram } from './notification-delivery';
export interface NotificationJob {
  id: string; pedido_id: string; tipo: string; canal: 'email' | 'telegram'; destino: string;
  estado: string; payload: Record<string,unknown> | null; mensaje: FrozenEmail | FrozenTelegram | null;
  claim_id: string | null; claimed_at: string | null; detalle: Record<string,unknown>; intentos: number;
}
export interface OutboxPort {
  claim(job: NotificationJob, message: FrozenEmail | FrozenTelegram, retry: boolean, confirmDuplicate: boolean): Promise<NotificationJob | null>;
  deliver(job: NotificationJob): Promise<DeliveryResult>;
  finish(job: NotificationJob, result: DeliveryResult): Promise<NotificationJob | null>;
}
export async function processNotification(job: NotificationJob, message: FrozenEmail | FrozenTelegram, port: OutboxPort, retry = false, confirmDuplicate = false): Promise<NotificationJob | null> {
  const claimed = await port.claim(job, message, retry, confirmDuplicate);
  if (!claimed) return null;
  if (claimed.id !== job.id || claimed.estado !== 'procesando' || !claimed.claim_id || !claimed.mensaje) throw new Error('Reserva de aviso inválida');
  let result: DeliveryResult;
  try { result = await port.deliver(claimed); }
  catch { result = { estado: 'incierto', motivo: 'No se pudo confirmar la entrega del aviso' }; }
  if(claimed.canal === 'telegram') {
    const previous = claimed.detalle?.recibos;
    const known = previous && typeof previous === 'object' && !Array.isArray(previous)
      ? Object.fromEntries(Object.entries(previous).filter(([,id]) => typeof id === 'string' && !!id)) : {};
    result = {...result,recibos:{...known,...result.recibos}};
  }
  const finished = await port.finish(claimed, result);
  if (!finished || finished.id !== claimed.id || finished.estado !== result.estado) throw new Error('No se pudo confirmar el registro de la entrega');
  return finished;
}
