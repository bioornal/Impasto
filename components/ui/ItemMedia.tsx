"use client";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { EmpanadaIllus, DrinkIllus } from "@/components/ui/Illus";
import type { CartItem } from "@/types";

/** Ilustración adecuada al tipo de ítem del carrito. */
export function ItemMedia({ item }: { item: CartItem }) {
  if (item.type === "bebida") return <DrinkIllus id={item.key} label={item.name} name={item.name} />;
  if (item.type === "empanadas") return <EmpanadaIllus id={item.key} name={item.name} />;
  return <PizzaIllus id={item.illus || item.key} name={item.name} />;
}
