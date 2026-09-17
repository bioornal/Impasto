"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>No pudimos cargar la carta</h1>
        <p style={{ marginTop: 10, opacity: 0.75, lineHeight: 1.5 }}>
          Hubo un problema momentáneo al conectar con la tienda. Probá de nuevo en unos segundos.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 18,
            padding: "11px 20px",
            borderRadius: 12,
            border: "none",
            background: "#d4843e",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
