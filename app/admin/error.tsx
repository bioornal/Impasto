"use client";

/** Si algo se rompe dentro del panel, un mensaje neutro con salida (en vez de la pantalla de error del sitio). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: "48px auto", padding: "0 16px" }}>
      <div className="panel">
        <div className="panel-head"><h3>Algo falló en el panel</h3></div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="co-error">{error.message || "Error inesperado."}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={reset}>Reintentar</button>
            <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>Volver a cargar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
