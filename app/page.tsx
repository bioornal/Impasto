import { getCatalogData } from "@/lib/catalog";
import { getBusinessConfig } from "@/lib/business-server";
import { Shell } from "@/components/Shell";

export const revalidate = 60; // ISR: refresca datos cada 60 segundos

export default async function Page() {
  const [data, business] = await Promise.all([getCatalogData(), getBusinessConfig()]);
  return <Shell data={data} business={business} />;
}
