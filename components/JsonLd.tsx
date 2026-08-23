import { serializarJsonLd } from "@/lib/seo";

/** Inserta datos estructurados schema.org en el `<head>` del documento. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializarJsonLd(data) }}
    />
  );
}
