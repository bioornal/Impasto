import { db } from "@/lib/insforge";
import { STATIC_DATA } from "@/lib/data";
import { Shell } from "@/components/Shell";
import type { CatalogData } from "@/types";

export const revalidate = 60; // ISR: refresca datos cada 60 segundos

export default async function Page() {
  let data: CatalogData = STATIC_DATA;

  try {
    const { data: dbProducts } = await db.database
      .from("productos")
      .select("*")
      .eq("disponible", true);

    if (Array.isArray(dbProducts) && dbProducts.length > 0) {
      const priceMap = Object.fromEntries(
        dbProducts.map((p: { nombre: string; precio: number; disponible: boolean }) => [p.nombre, p])
      );

      data = {
        ...STATIC_DATA,
        pizzas: STATIC_DATA.pizzas
          .filter((p) => !priceMap[p.nombre] || priceMap[p.nombre].disponible !== false)
          .map((p) => priceMap[p.nombre] ? { ...p, precio: priceMap[p.nombre].precio } : p),
        bebidas: STATIC_DATA.bebidas
          .filter((b) => !priceMap[b.nombre] || priceMap[b.nombre].disponible !== false)
          .map((b) => priceMap[b.nombre] ? { ...b, precio: priceMap[b.nombre].precio } : b),
      };
    }
  } catch {
    // Si InsForge falla, usa datos estáticos de fallback
  }

  return <Shell data={data} />;
}
