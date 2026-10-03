/**
 * Orden de la tabla de Productos del admin.
 *
 * Arriba, fijas: las 20 pizzas de la carta (en el orden de
 * docs/prompts-imagenes-carta.md), las 2 blancas que se sumaron el 26/09
 * (Bianca ai Funghi y Bianca all'Aglio Confit, con foto propia) y todas las
 * empanadas. Debajo, las bebidas y,
 * al final, el resto (bajas, pruebas, cartas viejas). Es solo la vista del admin:
 * no toca `archivado` ni `disponible`, asi que no cambia lo que ve el cliente.
 *
 * Los nombres son los de la base (ojo: "Quattro Formaggi" y "Puerro e Panceta
 * Croccante" se llaman distinto que en el documento de fotos).
 */
export const PIZZAS_DE_LA_CARTA = [
  "Muzzarella Impasto",
  "Napoletana all'Aglio",
  "Fugazzetta",
  "Porteña de Jamón y Morrones",
  "Quattro Formaggi",
  "Palmitos y Salsa Golf",
  "Diavola al Miele Piccante",
  "Mortazza al Pistacchio",
  "Bondiola al Pangrattato",
  "Pepperoni e Panceta",
  "Americana Agridulce",
  "Patate e Rosmarino",
  "Carbonara Impasto",
  "Puerro e Panceta Croccante",
  "Cinque Formaggi",
  "La Provoleta Impasto",
  "Choclo, Panceta y Salsa Criolla",
  "Filetto Impasto",
  "Prosciutto, Rucola e Parmigiano",
  "Carbonada Criolla",
  // Sumadas despues del documento de fotos.
  "Bianca ai Funghi",
  "Bianca all'Aglio Confit",
] as const;

const clave = (nombre: string) => nombre.trim().toLowerCase();
const POSICION_PIZZA = new Map(PIZZAS_DE_LA_CARTA.map((n, i) => [clave(n), i]));

interface Ordenable {
  nombre: string;
  type: string;
  archivado?: boolean;
}

/** Grupo 0: pizza de la carta; 1: empanada; 2: bebida; 3: activo suelto; 4: archivado suelto. */
function grupo(p: Ordenable): number {
  if (p.type === "pizza" && POSICION_PIZZA.has(clave(p.nombre))) return 0;
  if (p.type === "empanada") return 1;
  if (p.type === "bebida") return 2;
  return p.archivado ? 4 : 3;
}

export function ordenarProductosAdmin<T extends Ordenable>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => {
    const ga = grupo(a);
    const gb = grupo(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return POSICION_PIZZA.get(clave(a.nombre))! - POSICION_PIZZA.get(clave(b.nombre))!;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}
