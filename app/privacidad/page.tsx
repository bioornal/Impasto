import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: `Cómo ${BUSINESS.name} trata tus datos personales.`,
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updated="25 de agosto de 2026">
      <h2>1. Responsable</h2>
      <p>
        El responsable del tratamiento de tus datos es {BUSINESS.name}, con domicilio en{" "}
        {BUSINESS.address}, {BUSINESS.locationLabel}. Correo de contacto:{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>

      <h2>2. Qué datos recolectamos</h2>
      <ul>
        <li>Nombre, teléfono, correo electrónico y dirección de entrega.</li>
        <li>Detalle del pedido (productos, montos, modalidad de entrega).</li>
        <li>
          Datos de pago: solo los procesa Mercado Pago; {BUSINESS.name} no ve ni guarda el número de
          tu tarjeta.
        </li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <p>
        Para procesar y entregar tu pedido, confirmártelo por correo o WhatsApp, avisar al local y
        mantener el historial de compras. No los usamos para publicidad sin tu consentimiento.
      </p>

      <h2>4. Con quién los compartimos</h2>
      <p>
        Con los servicios necesarios para que el pedido funcione: Mercado Pago (procesamiento del
        pago), InsForge (base de datos), Resend (correo) y Telegram (aviso interno al local). No
        vendemos ni cedemos tus datos a terceros.
      </p>

      <h2>5. Tus derechos (Ley 25.326)</h2>
      <p>
        Tenés derecho de acceso, rectificación, actualización y supresión de tus datos, y de retirar
        tu consentimiento. Escribinos a <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>{" "}
        con el asunto &ldquo;Datos personales&rdquo;.
      </p>

      <h2>6. Seguridad y conservación</h2>
      <p>
        Guardamos tus datos solo mientras sea necesario para operar y cumplir obligaciones legales, y
        los protegemos con acceso restringido.
      </p>
    </LegalPage>
  );
}
