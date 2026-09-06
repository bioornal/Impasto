import type { Metadata } from "next";

/**
 * El seguimiento muestra nombre, dirección e ítems del cliente. `robots.ts` ya
 * lo excluye del rastreo, pero eso no alcanza si alguien enlaza la URL desde
 * afuera: sin este `noindex`, Google indexa la dirección igual aunque no la
 * rastree. Es la misma defensa doble que tiene el panel en
 * `app/admin/layout.tsx`.
 */
export const metadata: Metadata = {
  title: "Seguimiento de tu pedido",
  robots: { index: false, follow: false },
};

export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
