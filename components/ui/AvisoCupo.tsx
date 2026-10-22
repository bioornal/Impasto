import { avisoQuedan } from "@/lib/cupos";

/**
 * Aviso del cupo de la noche (18/10/2026) cuando quedan 2 pizzas o menos.
 * - "franja": dentro de la tarjeta, arriba del botón ("¡Quedan solo 2 esta noche!").
 * - "foto": barra sobre la parte de abajo de la miniatura de las filas ("¡Quedan 2!"), como la de
 *   Agotado: no mueve el texto ni el precio (en la fila, una píldora corría el precio y dejaba un hueco).
 */
export function AvisoCupo({ quedanMitades, formato = "franja" }: { quedanMitades?: number; formato?: "franja" | "foto" }) {
  const texto = avisoQuedan(quedanMitades, formato === "foto");
  if (!texto) return null;
  if (formato === "foto") return <div className="cupo-foto-bar" role="status">{texto}</div>;
  return (
    <p className="cupo-aviso" role="status">
      <span className="cupo-aviso-pulso" aria-hidden="true" />
      {texto}
    </p>
  );
}
