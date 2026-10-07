import { cache } from "react";
import type { Metadata } from "next";
import { descripcionSitio, tituloSitio, PALABRAS_CLAVE } from "@/lib/seo";
import { negocioDeCarta, mencionaEmpanadas } from "@/lib/carta-visible";
import { getCatalogData } from "@/lib/catalog";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { jsonLdSitio } from "@/lib/seo";
import { hayChat } from "@/lib/deepseek";
import { Shell } from "@/components/Shell";
import { JsonLd } from "@/components/JsonLd";
import type { CatalogData } from "@/types";

const catalogoActual = cache(getCatalogData);
const negocioActual = cache(getBusinessConfig);

export async function generateMetadata(): Promise<Metadata> {
  const [data, config] = await Promise.all([catalogoActual(), negocioActual()]);
  const hayEmpanadas = data.empanadas.length > 0;
  const business = negocioDeCarta(config, hayEmpanadas);
  const title = tituloSitio(business);
  const description = descripcionSitio(business, hayEmpanadas);
  return {
    title: { absolute: title }, description,
    keywords: PALABRAS_CLAVE.filter(p => hayEmpanadas || !mencionaEmpanadas(p)),
    openGraph: { type: "website", siteName: business.name, locale: "es_AR", url: "/", title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

// Los precios se administran en la base y deben reflejarse en cada visita.
export const dynamic = "force-dynamic";

// Por request a propósito: cada visita ve otra pizza en la tarjeta ancha.
function elegirDestacada(pizzas: CatalogData["pizzas"]) {
  const disponibles = pizzas.filter((p) => p.disponible !== false);
  return disponibles[Math.floor(Math.random() * disponibles.length)]?.id;
}

export default async function Page() {
  const [data, business] = await Promise.all([catalogoActual(), negocioActual()]);
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
