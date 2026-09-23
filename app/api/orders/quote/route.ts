import { NextRequest, NextResponse } from "next/server";
import { quoteOrder } from "@/lib/order-quote";
import { getBusinessConfig } from "@/lib/business-server";
import { limitar } from "@/lib/rate-limit";
import type { CartItem } from "@/types";
import { pricingHttpError } from "@/lib/pricing-http";

export async function POST(req: NextRequest) {
  // Holgado: el checkout recotiza en cada cambio del carrito.
  const limitado = await limitar(req, "cotizacion");
  if (limitado) return limitado;

  try {
    const body = await req.json();
    const business = await getBusinessConfig();
    const quote = await quoteOrder(body.items as CartItem[], body.mode, business);
    return NextResponse.json({ ok: true, ...quote });
  } catch (error: unknown) {
    const failure = pricingHttpError(error);
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
