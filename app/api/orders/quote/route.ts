import { NextRequest, NextResponse } from "next/server";
import { quoteOrder } from "@/lib/order-quote";
import { getBusinessConfig } from "@/lib/business-server";
import type { CartItem } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const business = await getBusinessConfig();
    const quote = await quoteOrder(body.items as CartItem[], body.mode, business.deliveryFee);
    return NextResponse.json({ ok: true, ...quote });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo calcular el pedido";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
