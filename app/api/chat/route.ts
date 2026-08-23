import { NextRequest, NextResponse } from "next/server";
import { limitar } from "@/lib/rate-limit";
import { getCatalogData } from "@/lib/catalog";
import { getBusinessConfig } from "@/lib/business-server";
import { estadoTienda } from "@/lib/hours";
import { promptVendedor } from "@/lib/chat-prompt";
import { sanearHistorial } from "@/lib/chat-mensajes";
import { chatStream, hayChat } from "@/lib/deepseek";
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

  // `getCatalogData()` no distingue "la carta está vacía" de "la base falló": su
  // único `catch` (lib/catalog.ts) devuelve un catálogo sin productos pero
  // perfectamente válido. Si guardáramos esa foto en la caché, un corte de base
  // justo cuando el TTL vence dejaría al bot negándole la carta entera a cada
  // cliente durante los cinco minutos siguientes, sin que nada dispare un
  // reintento antes. Por eso una foto sin ningún producto no se cachea: se sirve
  // igual para este request, pero el próximo mensaje vuelve a consultar la base.
  //
  // Contrapartida asumida a propósito: si la carta llegara a estar legítimamente
  // vacía (hoy no pasa: siempre hay pizzas y empanadas cargadas), cada mensaje
  // repetiría las doce consultas en vez de aprovechar los cinco minutos de
  // caché. Lo acota el rate limit de "chat" (20 mensajes cada 10 minutos por IP),
  // y es preferible a mentirle al cliente que no hay nada para pedir.
  const cartaVacia = catalogo.pizzas.length === 0 && catalogo.empanadas.length === 0
    && catalogo.bebidas.length === 0;
  if (cartaVacia) return { catalogo, business, vence: 0 };

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
  // `sanearHistorial` garantiza roles válidos y largo, no el orden. El widget
  // puede arrancar con un saludo del bot ya escrito ([system, assistant,
  // user] es un primer request válido), pero un historial que TERMINE en
  // `assistant` no tiene nada para responder: llegaría a DeepSeek así y
  // volvería como un 502 opaco.
  if (historial[historial.length - 1].role !== "user") {
    return NextResponse.json(
      { ok: false, error: "El último mensaje del historial tiene que ser del cliente." },
      { status: 400 },
    );
  }

  // Chequeo barato antes de tocar la base: sin key, `chatStream` va a devolver
  // "omitido" igual, pero recién después de pagar hasta doce consultas por nada.
  if (!hayChat()) {
    console.error("[chat]", "omitido", "DEEPSEEK_API_KEY no configurada");
    return NextResponse.json(
      { ok: false, error: "El asistente no está disponible en este momento." },
      { status: 503 },
    );
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
