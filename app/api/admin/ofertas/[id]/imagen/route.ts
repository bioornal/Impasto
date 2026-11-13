import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { claveDeImagenPromo, idValido, validarFoto } from "@/lib/foto-subida";
import { subirFoto } from "@/lib/fotos-bucket";
import { invalidarCatalogo } from "@/lib/catalog-cache";

const error = (mensaje: string, status: number) => NextResponse.json({ ok: false, error: mensaje }, { status });

/** Sube la imagen de una promo (JPG, PNG o WebP, hasta 4 MB) y la deja como imagen vigente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!idValido(id)) return error("Promoción inválida.", 400);
  const { data, error: lectura } = await db.database.from("ofertas").select("id").eq("id", id).eq("proyecto_id", "impasto").limit(1);
  if (lectura) return error("No se pudo verificar la promoción.", 500);
  if (!data?.length) return error("La promoción no existe.", 404);

  let archivo: FormDataEntryValue | null;
  try { archivo = (await req.formData()).get("imagen"); } catch { return error("Elegí una imagen.", 400); }
  if (!(archivo instanceof Blob)) return error("Elegí una imagen.", 400);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const validacion = validarFoto(bytes, archivo.size);
  if (!validacion.ok) return error(validacion.error, validacion.error.includes("4 MB") ? 413 : 415);

  let url: string;
  try {
    url = await subirFoto(claveDeImagenPromo(id, new Date(), validacion.tipo.ext), bytes, validacion.tipo.mime);
  } catch (e) {
    console.error("[ofertas] imagen:", e);
    return error("No se pudo subir la imagen. Probá de nuevo.", 502);
  }
  const { error: escritura } = await db.database.from("ofertas").update({ imagen: url }).eq("id", id).eq("proyecto_id", "impasto");
  if (escritura) return error("La imagen se subió pero no se pudo guardar en la promo. Probá de nuevo.", 500);
  invalidarCatalogo();
  return NextResponse.json({ ok: true, imagen: url });
}
