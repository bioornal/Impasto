import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { CATEGORIAS_IMPASTO } from "@/lib/categorias";
import { claveDeFoto, idValido, validarFoto } from "@/lib/foto-subida";
import { subirFoto } from "@/lib/fotos-bucket";

const error = (mensaje: string, status: number) => NextResponse.json({ ok: false, error: mensaje }, { status });

/** Sube una foto nueva del producto. Nunca reemplaza: la carta y /cocina toman la más nueva. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!idValido(id)) return error("Producto inválido.", 400);

  const { data: productos, error: errorLectura } = await db.database.from("productos").select("id")
    .eq("id", id).eq("proyecto_id", "impasto").in("categoria", [...CATEGORIAS_IMPASTO]).limit(1);
  if (errorLectura) return error("No se pudo verificar el producto.", 500);
  if (!productos?.length) return error("El producto no existe.", 404);

  let archivo: FormDataEntryValue | null;
  try { archivo = (await req.formData()).get("foto"); } catch { return error("Elegí una foto.", 400); }
  if (!(archivo instanceof Blob)) return error("Elegí una foto.", 400);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const validacion = validarFoto(bytes, archivo.size);
  if (!validacion.ok) return error(validacion.error, validacion.error.includes("4 MB") ? 413 : 415);

  const clave = claveDeFoto(id, new Date(), validacion.tipo.ext);
  let url: string;
  try {
    url = await subirFoto(clave, bytes, validacion.tipo.mime);
  } catch (errorSubida) {
    console.error("[foto] No se pudo subir:", errorSubida);
    return error("No se pudo subir la foto. Probá de nuevo.", 502);
  }
  // Que la carta, /cocina y el admin la vean ya, sin esperar el minuto de caché.
  revalidateTag("fotos", { expire: 0 });
  revalidatePath("/cocina");
  return NextResponse.json({ ok: true, foto: url, clave });
}
