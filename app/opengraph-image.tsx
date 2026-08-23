import { ImageResponse } from "next/og";
import { BUSINESS } from "@/lib/business";

/**
 * La miniatura que se ve al compartir el sitio en WhatsApp, Instagram o
 * Facebook. Se genera en el build, no en cada visita, así que usa la
 * configuración del código y no la de la base: un cambio de horario desde el
 * panel no tiene por qué invalidar la imagen.
 */
export const alt = "Impasto · Pizzas y empanadas en Puerto Iguazú";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 92px",
          background: "#f6f1e7",
          // La franja terracota del borde izquierdo, el color de la marca.
          borderLeft: "28px solid #b2472a",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, color: "#b2472a", fontWeight: 700 }}>
          {BUSINESS.locationLabel.toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: 148, color: "#1f1a15", fontWeight: 700, marginTop: 14 }}>
          {BUSINESS.name}
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#4a3f33", marginTop: 20 }}>
          Pizzas de fermentación lenta, empanadas y bebidas
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8a7b69", marginTop: 36 }}>
          {`Delivery y take away · ${BUSINESS.hours}`}
        </div>
      </div>
    ),
    size,
  );
}
