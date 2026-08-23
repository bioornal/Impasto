import { NextRequest, NextResponse } from "next/server";
import { limitar } from "@/lib/rate-limit";
import { getCatalogData } from "@/lib/catalog";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { promptVendedor } from "@/lib/chat-prompt";
import { sanearHistorial } from "@/lib/chat-mensajes";
import { chatStream } from "@/lib/deepseek";
import type { BusinessConfig } from "@/lib/business";
import type { CatalogData } from "@/types";

export const dynamic = "force-dynamic";

const TTL_FOTO = 5 * 60 * 1000;

let foto: { catalogo: CatalogData; business: BusinessConfig; vence: number } | null = null;

/**
 * Foto del catálogo con TTL de 5 minutos.
 *
 * `getCatalogData()` consulta doce tablas: llamarla en cada mensaje del chat
 * sería carísimo. Como las funciones serverless no comparten memoria, cada
 * instancia tiene su propia foto: es best-effort, no una garantía. Alcanza de
 * sobra —la carta cambia una vez por semana— y en el peor caso un precio recién
 * editado tarda cinco minutos en llegarle al bot.
 *
 * **Esto no afecta lo que se cobra:** el carrito y la cotización son
 * server-side y no pasan por acá.
 */
async function fotoDelCatalogo() {
  if (foto && foto.vence > Date.now()) return foto;
  const [catalogo, business] = await Promise.all([getCatalogData(), getBusinessConfig()]);
  foto = { catalogo, business, vence: Date.now() + TTL_FOTO };
  return foto;
}

export async function POST(req: NextRequest) {
  const limitado = await limitar(req, "chat");
  if (limitado) return limitado;

  const body = await req.json().catch(() => null);
  const historial = sanearHistorial((body as { mensajes?: unknown } | null)?.mensajes);
  if (historial.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay ningún mensaje para responder." }, { status: 400 });
  }

  const { catalogo, business } = await fotoDelCatalogo();
  // El estado del local se recalcula en cada request: la foto puede tener cinco
  // minutos y en ese rato el local pudo cerrar.
  const estado = estadoTienda(business);

  // El prompt de sistema se arma acá y nunca viaja desde el cliente.
  const resultado = await chatStream([
    { role: "system", content: promptVendedor(catalogo, business, estado) },
    ...historial,
  ]);

  if (resultado.estado !== "ok") {
    console.error("[chat]", resultado.estado, resultado.motivo);
    return NextResponse.json(
      { ok: false, error: "El asistente no está disponible en este momento." },
      { status: resultado.estado === "omitido" ? 503 : 502 },
    );
  }

  return new Response(resultado.stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Le pide a los proxys que no bufereen, que es lo que mata el streaming.
      "X-Accel-Buffering": "no",
    },
  });
}
