import { getCatalogData } from "@/lib/catalog";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { jsonLdSitio } from "@/lib/seo";
import { Shell } from "@/components/Shell";
import { JsonLd } from "@/components/JsonLd";

// Los precios se administran en la base y deben reflejarse en cada visita.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, business] = await Promise.all([getCatalogData(), getBusinessConfig()]);
  const estado = estadoTienda(business);
  return (
    <>
      {/* Horario, teléfono, dirección y carta con precios, para Google. */}
      <JsonLd data={jsonLdSitio(business, data)} />
      <Shell data={data} business={business} estadoInicial={estado} />
    </>
  );
}
