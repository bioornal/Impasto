import { readPages } from "@/lib/read-pages";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { CATEGORIAS_IMPASTO, esCategoriaImpasto } from "@/lib/categorias";
import { elegirFoto } from "@/lib/fotos";
import { listarFotos } from "@/lib/fotos-bucket";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const [{ data, error }, objetos] = await Promise.all([
    readPages((start, end) => db.database.from("productos").select("*").eq("proyecto_id", "impasto").in("categoria", [...CATEGORIAS_IMPASTO]).order("id", { ascending: true }).range(start, end)),
    listarFotos(),
  ]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  // La misma foto que ve el cliente (la más nueva del bucket); sin ella, la miniatura usa el respaldo.
  const conFoto = (data ?? []).map((p: Record<string, unknown>) => {
    const foto = elegirFoto({ id: String(p.id), nombre: String(p.nombre ?? "") }, objetos);
    return foto ? { ...p, foto } : p;
  });
  return NextResponse.json({ ok: true, data: conFoto });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const { nombre, precio, disponible, tipo, categoria, desc, tags, popular } = await req.json();
  if (!nombre || precio == null)
    return NextResponse.json({ ok: false, error: "nombre y precio requeridos" }, { status: 400 });
  const categoriaFinal = categoria || "pizzas";
  if (!esCategoriaImpasto(categoriaFinal)) {
    return NextResponse.json(
      { ok: false, error: `categoria inválida: "${categoriaFinal}". Solo se admiten ${CATEGORIAS_IMPASTO.join(", ")}.` },
      { status: 400 },
    );
  }
  const { data, error } = await db.database
    .from("productos")
    .insert({
      nombre,
      precio: parseInt(precio),
      disponible: !!disponible,
      tipo: tipo || "pizza",
      categoria: categoriaFinal,
      desc: desc || "",
      tags: Array.isArray(tags) ? tags : [],
      popular: !!popular,
      proyecto_id: "impasto",
    });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
