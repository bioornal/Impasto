import { avisoQuedan } from "@/lib/cupos";

/**
 * Franja "¡Quedan solo 2 esta noche!" dentro de la tarjeta, arriba del botón (cupo de la noche,
 * 18/10/2026). Antes era un cartelito sobre la foto y no se veía. `compacta` para las filas del celular.
 */
export function AvisoCupo({ quedanMitades, compacta = false }: { quedanMitades?: number; compacta?: boolean }) {
  const texto = avisoQuedan(quedanMitades, compacta);
  if (!texto) return null;
  return (
    <p className={`cupo-aviso ${compacta ? "compacta" : ""}`} role="status">
      <span className="cupo-aviso-pulso" aria-hidden="true" />
      {texto}
    </p>
  );
}
