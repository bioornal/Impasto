import type {EstadoPago} from './mercadopago';
/** Shared pure mapping; partial-refund accounting remains unchanged. */
export function mapOrderStatus(status:string,statusDetail=''):EstadoPago {
  switch(status) {
    case 'processed': return statusDetail==='partially_refunded' ? 'reembolsado' : 'aprobado';
    case 'refunded': case 'charged_back': return 'reembolsado';
    case 'canceled': case 'expired': case 'failed': return 'rechazado';
    default: return 'pendiente';
  }
}
