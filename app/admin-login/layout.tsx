import type { Metadata } from "next";

/**
 * La pantalla de login no se indexa. `robots.ts` ya la excluye del rastreo,
 * pero el meta cubre el caso de que alguien la enlace desde afuera: sin él,
 * Google puede indexar la URL igual aunque no la haya rastreado.
 */
export const metadata: Metadata = {
  title: "Ingresar al panel",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
