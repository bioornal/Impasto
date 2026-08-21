import { getCatalogData } from "@/lib/catalog";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { Shell } from "@/components/Shell";

// Los precios se administran en la base y deben reflejarse en cada visita.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, business] = await Promise.all([getCatalogData(), getBusinessConfig()]);
  const estado = estadoTienda(business);
  return <Shell data={data} business={business} estadoInicial={estado} />;
}
