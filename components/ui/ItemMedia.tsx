"use client";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { EmpanadaIllus, DrinkIllus } from "@/components/ui/Illus";
import { useFotos } from "@/components/providers/FotosProvider";
import type { CartItem } from "@/types";

/** Ilustración adecuada al tipo de ítem del carrito, con la foto vigente del catálogo. */
export function ItemMedia({ item }: { item: CartItem }) {
  const fotos = useFotos();
  if (item.type === "bebida") return <DrinkIllus id={item.key} label={item.name} name={item.name} src={fotos[item.key]} />;
  if (item.type === "empanadas") return <EmpanadaIllus id={item.key} name={item.name} />;
  const id = item.illus || item.key;
  return <PizzaIllus id={id} name={item.name} src={fotos[id]} />;
}
