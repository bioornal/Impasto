import type { ReactNode } from "react";

/**
 * Layout de lectura para las páginas legales: una columna angosta y aireada,
 * con estilos propios para no depender de clases de `impasto.css`.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="legal">
      <style>{`
        .legal { max-width: 760px; margin: 0 auto; padding: 48px 20px 96px; line-height: 1.7; color: #2a2118; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        .legal h1 { font-size: 34px; margin: 16px 0 4px; line-height: 1.2; }
        .legal h2 { font-size: 20px; margin: 28px 0 8px; }
        .legal p, .legal li { font-size: 15px; color: #4a3f33; }
        .legal ul { padding-left: 20px; margin: 8px 0; }
        .legal .upd { color: #8a7a66; font-size: 13px; margin-bottom: 28px; }
        .legal a { color: #b2472a; }
      `}</style>
      <a href="/">← Volver a Impasto</a>
      <h1>{title}</h1>
      <p className="upd">Última actualización: {updated}</p>
      {children}
    </main>
  );
}
