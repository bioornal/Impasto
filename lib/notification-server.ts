import { db } from './insforge';
import { getBusinessConfig } from './business-server';
import { plantilla, avisoDesdePedido } from './notifications';
import { plantillaLocal, type AvisoPedido, type TipoAviso } from './aviso-local';
import { deliverEmail, deliverTelegram, type FrozenEmail, type FrozenTelegram, type DeliveryResult } from './notification-delivery';
import { processNotification, type NotificationJob, type OutboxPort } from './notification-outbox';

export const NOTIFICATION_COLUMNS = 'id,pedido_id,tipo,canal,destino,estado,payload,mensaje,claim_id,claimed_at,detalle,intentos,created_at,updated_at';
function confirmedRpc(data: unknown, error: unknown): NotificationJob | null {
  if (error) throw new Error('No se pudo registrar la operación del aviso');
  if (data === null) return null;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof (data as NotificationJob).id !== 'string') throw new Error('Respuesta inválida de la cola de avisos');
  return data as NotificationJob;
}
async function rpc(name: string, args: Record<string,unknown>) {
  const {data,error} = await db.database.rpc(name,args);
  return confirmedRpc(data,error);
}
function receipts(detail: Record<string,unknown>): Record<string,string> {
  const value = detail?.recibos;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([,id]) => typeof id === 'string' && !!id));
}
async function deliver(job: NotificationJob): Promise<DeliveryResult> {
  if (job.canal === 'telegram') return deliverTelegram(job.mensaje as FrozenTelegram, receipts(job.detalle), process.env.TELEGRAM_BOT_TOKEN || '');
  const message = job.mensaje as FrozenEmail;
  if (message.provider !== 'insforge') return deliverEmail(message, job.id, process.env.RESEND_API_KEY || '');
  if (!message.to || !message.from) return { estado:'omitido',motivo:'Email sin configurar o destinatario vacío' };
  try {
    const {data,error} = await db.emails.send({ to:message.to,from:message.from,subject:message.subject,html:message.html });
    // El SDK nativo no garantiza idempotencia ni distingue una respuesta perdida.
    if (error || !data || typeof (data as {id?:unknown}).id !== 'string' || !(data as {id:string}).id) return {estado:'incierto',motivo:'No se pudo confirmar la entrega del email nativo'};
    return {estado:'enviado',id:(data as {id:string}).id};
  } catch { return {estado:'incierto',motivo:'No se pudo confirmar la entrega del email nativo'}; }
}
const port: OutboxPort = {
  claim: (job,message,retry,confirmDuplicate) => rpc('reclamar_notificacion',{p_id:job.id,p_mensaje:message,p_reintentar:retry,p_confirmar_duplicado:confirmDuplicate}),
  deliver,
  finish: (job,result) => rpc('finalizar_notificacion',{p_id:job.id,p_claim_id:job.claim_id,p_estado:result.estado,p_detalle:result}),
};
export async function recoverNotification(job: NotificationJob, retry = false, confirmDuplicate = false) {
  // Para legacy sólo se lee el pedido actual cuando un operador confirma posible duplicado.
  let payload = job.payload;
  if (!payload && confirmDuplicate) {
    const {data,error} = await db.database.from('pedidos').select('*').eq('id',job.pedido_id).eq('proyecto_id','impasto').limit(1);
    if(error || !Array.isArray(data) || data.length !== 1) throw new Error('No se pudo cargar el pedido del aviso');
    payload = data[0];
  }
  const aviso = avisoDesdePedido(payload || {});
  const type = job.tipo as TipoAviso;
  let message: FrozenEmail | FrozenTelegram;
  if (job.mensaje && job.estado !== 'omitido') message = job.mensaje;
  else if (job.canal === 'telegram') message = { text:plantillaLocal(aviso,type),chatIds:(process.env.TELEGRAM_CHAT_IDS || '').split(',').map(id=>id.trim()).filter(Boolean) };
  else {
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    message = { ...plantilla(aviso,await getBusinessConfig(),type),to:aviso.email,provider:provider === 'resend' || provider === 'insforge' ? provider : '',from:provider === 'insforge' ? process.env.EMAIL_FROM_NAME || 'Impasto' : process.env.EMAIL_FROM || '',...(process.env.EMAIL_REPLY_TO?.trim() ? {replyTo:process.env.EMAIL_REPLY_TO.trim()} : {}) };
  }
  return processNotification(job,message,port,retry,confirmDuplicate);
}
/** El trigger ya guardó ambos avisos con el pedido. No se reserva mediante un insert separado. */
export async function notificarPedido(aviso: AvisoPedido, type: TipoAviso) {
  const {data,error} = await db.database.from('notificaciones').select(NOTIFICATION_COLUMNS).eq('pedido_id',aviso.pedidoId).eq('tipo',type);
  if(error || !Array.isArray(data)) throw new Error('No se pudo leer la cola de avisos');
  const results = await Promise.allSettled((data as NotificationJob[]).map(job=>recoverNotification(job)));
  if(results.some(result=>result.status === 'rejected')) throw new Error('Uno o más avisos quedaron pendientes de recuperación');
}
