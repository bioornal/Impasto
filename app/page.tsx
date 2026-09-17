import { getCatalogData } from "@/lib/catalog";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { jsonLdSitio } from "@/lib/seo";
import { hayChat } from "@/lib/deepseek";
import { Shell } from "@/components/Shell";
import { JsonLd } from "@/components/JsonLd";
import type { CatalogData } from "@/types";

// Los precios se administran en la base y deben reflejarse en cada visita.
export const dynamic = "force-dynamic";

// Por request a propósito: cada visita ve otra pizza en la tarjeta ancha.
function elegirDestacada(pizzas: CatalogData["pizzas"]) {
  const disponibles = pizzas.filter((p) => p.disponible !== false);
  return disponibles[Math.floor(Math.random() * disponibles.length)]?.id;
}

export default async function Page() {
  const [data, business] = await Promise.all([getCatalogData(), getBusinessConfig()]);
  const estado = estadoTienda(business);
  const destacadaId = elegirDestacada(data.pizzas);
  return (
    <>
      {/* Horario, teléfono, dirección y carta con precios, para Google. */}
      <JsonLd data={jsonLdSitio(business, data)} />
      <Shell data={data} business={business} estadoInicial={estado} chatDisponible={hayChat()} destacadaId={destacadaId} />
    </>
  );
}
