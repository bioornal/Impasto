import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { limitar } from "@/lib/rate-limit";
import { esReferenciaValida, normalizarReferencia } from "@/lib/referencia";
import { EMPANADAS, productosDelPedido, textoAvisoOpinion, validarOpinion } from "@/lib/opiniones";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const GRACIAS_REPETIDA = "Ya nos dejaste tu opinión sobre este pedido. ¡Gracias!";

/**
 * Opinión de un cliente. Pública a propósito: con `ref` viene del seguimiento
 * de un pedido entregado (verificada); sin `ref`, de la home. Siempre entra
 * como `pendiente`: la publica el dueño desde el panel (Testimonios).
 */
export async function POST(req: NextRequest) {
  const limitado = await limitar(req, "opinion");
  if (limitado) return limitado;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "No pudimos leer tu opinión" }, { status: 400 });
  }

  // Campo trampa: invisible para las personas, lo completan los bots. Se
  // responde como si hubiera salido bien para no enseñarles a esquivarlo.
  if (typeof body.sitio === "string" && body.sitio.trim()) return NextResponse.json({ ok: true });

  let pedidoId: string | null = null;
  let pedidoRef = "";
  let productosPermitidos: string[];

  if (body.ref !== undefined && body.ref !== "") {
    const ref = normalizarReferencia(String(body.ref));
    if (!esReferenciaValida(ref)) {
      return NextResponse.json({ ok: false, error: "Referencia de pedido inválida" }, { status: 400 });
    }
    const { data, error } = await db.database
      .from("pedidos")
      .select("id, status, productos")
      .eq("external_reference", ref)
      .eq("proyecto_id", "impasto")
      .eq("sucursal_id", SUCURSAL_ID)
      .limit(1);
    if (error) return NextResponse.json({ ok: false, error: "No pudimos guardar tu opinión. Probá de nuevo." }, { status: 500 });
    const pedido = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    if (!pedido) return NextResponse.json({ ok: false, error: "No encontramos ese pedido" }, { status: 404 });
    if (pedido.status !== "entregado") {
      return NextResponse.json({ ok: false, error: "Vas a poder opinar cuando el pedido figure como entregado" }, { status: 409 });
    }
    pedidoId = String(pedido.id);
    pedidoRef = ref;
    productosPermitidos = productosDelPedido(pedido.productos);

    const { data: previa } = await db.database.from("testimonios").select("id").eq("pedido_id", pedidoId).limit(1);
    if (Array.isArray(previa) && previa.length > 0) {
      return NextResponse.json({ ok: false, error: GRACIAS_REPETIDA }, { status: 409 });
    }
  } else {
    // Desde la home: solo pizzas de la carta (no archivadas) o las empanadas,
    // para que la línea "Probó la …" de la tarjeta no pueda decir cualquier cosa.
    const { data } = await db.database
      .from("productos")
      .select("nombre")
      .eq("proyecto_id", "impasto")
      .eq("categoria", "pizzas")
      .not("archivado", "is", true);
    const pizzas = Array.isArray(data) ? data.map((fila) => String((fila as { nombre?: unknown }).nombre || "")) : [];
    productosPermitidos = [...pizzas.filter(Boolean), EMPANADAS];
  }

  const validada = validarOpinion(body, productosPermitidos);
  if (!validada.ok) return NextResponse.json({ ok: false, error: validada.error }, { status: 400 });
  const { opinion } = validada;

  const { error: errorInsert } = await db.database.from("testimonios").insert([{
    nombre: opinion.nombre,
    texto: opinion.texto,
    rating: opinion.rating,
    producto: opinion.producto,
    pedido_id: pedidoId,
    pedido_ref: pedidoRef,
    sucursal_id: SUCURSAL_ID,
  }]);
  if (errorInsert) {
    // Dos envíos a la vez del mismo pedido: el índice único deja pasar uno.
    const repetida = pedidoId && /duplicate|unique|23505/i.test(JSON.stringify(errorInsert));
    return repetida
      ? NextResponse.json({ ok: false, error: GRACIAS_REPETIDA }, { status: 409 })
      : NextResponse.json({ ok: false, error: "No pudimos guardar tu opinión. Probá de nuevo." }, { status: 500 });
  }

  // Se espera el aviso: la función serverless puede congelarse apenas responde.
  // Si falla, la opinión igual quedó guardada y aparece en el panel.
  try {
    const resultado = await sendTelegram(textoAvisoOpinion(opinion, { ref: pedidoRef || undefined }));
    if (resultado.estado === "fallido") console.error("[opiniones] aviso", resultado.motivo);
  } catch (error) {
    console.error("[opiniones] aviso", error instanceof Error ? error.message : "error");
  }

  return NextResponse.json({ ok: true });
}
