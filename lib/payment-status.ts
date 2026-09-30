import type {EstadoPago} from './mercadopago';
/** Status is a hint; monetary reconciliation additionally requires provider amounts. */
export function mapOrderStatus(status:string,statusDetail=''):EstadoPago {
  switch(status) {
    case 'processed': return statusDetail==='partially_refunded' ? 'parcialmente_reembolsado' : 'aprobado';
    case 'refunded': case 'charged_back': return 'reembolsado';
    case 'canceled': case 'expired': case 'failed': return 'rechazado';
    default: return 'pendiente';
  }
}
