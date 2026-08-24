import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: `Términos y condiciones del servicio de ${BUSINESS.name}, pizzería en ${BUSINESS.locationLabel}.`,
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updated="25 de agosto de 2026">
      <h2>1. Quiénes somos</h2>
      <p>
        {BUSINESS.name} es una pizzería artesanal con delivery propio y take away en{" "}
        {BUSINESS.locationLabel} (Argentina). El sitio permite armar pedidos online que se pagan al
        confirmar y se retiran en el local o se envían a domicilio.
      </p>

      <h2>2. Pedidos y precios</h2>
      <p>
        Los precios están expresados en pesos argentinos (ARS) y pueden variar. El precio válido es
        el que se muestra y confirma al momento de cerrar el pedido, no uno anterior guardado en
        caché.
      </p>
      <p>
        Al enviar un pedido declarás que los datos (nombre, teléfono, dirección) son correctos. Un
        error en la dirección puede demorar o impedir la entrega.
      </p>

      <h2>3. Medios de pago</h2>
      <p>
        Aceptamos efectivo, transferencia bancaria y tarjeta de crédito/débito a través de Mercado
        Pago. Los pagos con tarjeta se procesan en la plataforma de Mercado Pago; {BUSINESS.name}{" "}
        no almacena los datos de tu tarjeta.
      </p>

      <h2>4. Entrega y retiro</h2>
      <p>
        El horario de atención es {BUSINESS.hours}. Los tiempos de entrega son estimados (
        {BUSINESS.deliveryEstimate}) y dependen del clima, el tránsito y el volumen de pedidos. No
        garantizamos una hora exacta.
      </p>

      <h2>5. Cancelaciones y reembolsos</h2>
      <p>
        Se rigen por nuestra <a href="/reembolso">Política de reembolso y cancelación</a>.
      </p>

      <h2>6. Alérgenos y calidad</h2>
      <p>
        Nuestros productos pueden contener gluten, lácteos y otros alérgenos. Si tenés alergias o
        restricciones, avisanos antes de pedir. Conservá el producto refrigerado si no lo consumís
        de inmediato.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        El contenido del sitio (textos, imágenes y la marca {BUSINESS.name}) pertenece a{" "}
        {BUSINESS.name} y no puede reproducirse sin autorización.
      </p>

      <h2>8. Legislación aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina, en particular la Ley 24.240
        de Defensa del Consumidor. Ante cualquier reclamo, podés contactarnos a{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>
    </LegalPage>
  );
}
