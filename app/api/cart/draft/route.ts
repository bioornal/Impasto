import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/insforge";
import { quoteOrder } from "@/lib/order-quote";
import { CART_SESSION_COOKIE } from "@/lib/cart-session";
import type { CartItem } from "@/types";
import { SUCURSAL_ID } from "@/lib/business";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

async function sessionId(req: NextRequest) {
  return req.cookies.get(CART_SESSION_COOKIE)?.value || randomUUID();
}

export async function GET(req: NextRequest) {
  const session = await sessionId(req);
  const { data, error } = await db.database
    .from("carritos")
    .select("items, subtotal")
    .eq("sucursal_id", SUCURSAL_ID)
    .eq("session_id", session)
    .limit(1);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  const response = NextResponse.json({
    ok: true,
    items: Array.isArray(data?.[0]?.items) ? data[0].items : [],
    subtotal: Number(data?.[0]?.subtotal || 0),
  });
  response.cookies.set(CART_SESSION_COOKIE, session, cookieOptions);
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const quote = await quoteOrder(body.items as CartItem[], "takeaway");
    const session = await sessionId(req);
    const row = {
      session_id: session,
      sucursal_id: SUCURSAL_ID,
      items: quote.items,
      subtotal: quote.subtotal,
      estado: "borrador",
      updated_at: new Date().toISOString(),
    };
    const { data: existing, error: readError } = await db.database
      .from("carritos")
      .select("session_id")
      .eq("session_id", session)
      .eq("sucursal_id", SUCURSAL_ID)
      .limit(1);
    if (readError) throw readError;

    const result = existing?.length
      ? await db.database.from("carritos").update(row).eq("session_id", session).eq("sucursal_id", SUCURSAL_ID)
      : await db.database.from("carritos").insert(row);
    if (result.error) throw result.error;

    const response = NextResponse.json({ ok: true, subtotal: quote.subtotal });
    response.cookies.set(CART_SESSION_COOKIE, session, cookieOptions);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el borrador";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = req.cookies.get(CART_SESSION_COOKIE)?.value;
  if (session) await db.database.from("carritos").delete().eq("session_id", session).eq("sucursal_id", SUCURSAL_ID);
  return NextResponse.json({ ok: true });
}
