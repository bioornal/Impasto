import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: "Reembolsos y Cancelaciones",
  description: `Política de reembolso y cancelación de ${BUSINESS.name}.`,
};

export default function ReembolsoPage() {
  return (
    <LegalPage title="Política de Reembolso y Cancelación" updated="25 de agosto de 2026">
      <h2>1. Pedidos pagados con tarjeta</h2>
      <p>
        Si {BUSINESS.name} no puede cumplir con tu pedido (producto agotado, imposibilidad de
        entrega u otro motivo), te devolvemos el importe por la misma vía: Mercado Pago. La
        devolución puede demorar hasta 10 días hábiles según tu banco o tu tarjeta.
      </p>

      <h2>2. Pedido incorrecto o en mal estado</h2>
      <p>
        Si recibís algo distinto a lo pedido o en mal estado, contactanos lo antes posible a{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> o por WhatsApp. Según el caso,
        reponemos el producto o devolvemos el importe.
      </p>

      <h2>3. Cancelaciones</h2>
      <p>
        Podés cancelar sin costo antes de que el pedido entre en preparación. Una vez en preparación
        o en camino, la cancelación queda sujeta al estado del pedido; contactanos y lo resolvemos.
      </p>

      <h2>4. Pagos en efectivo o transferencia</h2>
      <p>
        Los pedidos abonados al recibir se cobran contra entrega. Si los cancelás antes de la
        entrega, no se genera ningún cargo.
      </p>

      <h2>5. Contacto</h2>
      <p>
        Para cualquier reclamo: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> ·{" "}
        {BUSINESS.phone}.
      </p>
    </LegalPage>
  );
}
