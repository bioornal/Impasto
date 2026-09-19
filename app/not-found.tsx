import Link from "next/link";
import { BUSINESS } from "@/lib/business";

/**
 * 404 con marca. Next ya devuelve el estado HTTP correcto cuando el segmento no
 * existe; lo que faltaba era una salida clara para el visitante (y para el
 * rastreador, que entiende que la URL no es una página válida).
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "40px 20px",
        background: "#f6f1e7",
        color: "#1f1a15",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div>
        <div style={{ fontFamily: "monospace", letterSpacing: ".3em", fontSize: 12, color: "#b2472a" }}>
          404
        </div>
        <h1 style={{ fontSize: 40, margin: "12px 0 8px" }}>Esa página no existe</h1>
        <p style={{ color: "#4a3f33", maxWidth: 420, margin: "0 auto 22px" }}>
          Puede que el enlace haya cambiado. Volvé a la carta de {BUSINESS.name} y armá tu pedido.
        </p>
        <Link href="/" style={{ color: "#b2472a", fontWeight: 600 }}>
          ← Volver a {BUSINESS.name}
        </Link>
      </div>
    </main>
  );
}
