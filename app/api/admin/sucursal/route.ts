import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";
import { SUCURSAL_ID } from "@/lib/business";
import { requireAdmin } from "@/lib/admin-auth";

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, error } = await db.database.from("sucursales").select("*").eq("id", SUCURSAL_ID).limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: Array.isArray(data) ? data[0] : null });
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  for (const campo of ["nombre", "ciudad", "direccion", "telefono", "email", "whatsapp", "horarios", "mensaje_cierre"]) {
    if (typeof body[campo] === "string") updates[campo] = body[campo].trim();
  }

  for (const campo of ["hora_apertura", "hora_cierre"]) {
    if (body[campo] === undefined) continue;
    if (!HORA.test(String(body[campo]))) {
      return NextResponse.json({ ok: false, error: `${campo} debe tener formato HH:MM` }, { status: 400 });
    }
    updates[campo] = body[campo];
  }

  if (body.dias_apertura !== undefined) {
    const dias = String(body.dias_apertura)
      .split(",")
      .map((dia) => Number(dia.trim()))
      .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6);
    // Sin días válidos el local quedaría cerrado para siempre.
    if (dias.length === 0) {
      return NextResponse.json({ ok: false, error: "Elegí al menos un día de apertura" }, { status: 400 });
    }
    updates.dias_apertura = [...new Set(dias)].sort().join(",");
  }

  for (const campo of ["delivery_fee", "envio_gratis_desde"]) {
    if (body[campo] === undefined) continue;
    const valor = Number(body[campo]);
    if (!Number.isInteger(valor) || valor < 0) {
      return NextResponse.json({ ok: false, error: `${campo} debe ser un número entero` }, { status: 400 });
    }
    updates[campo] = valor;
  }

  if (body.ventas_activas !== undefined) updates.ventas_activas = Boolean(body.ventas_activas);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "No hay cambios para guardar" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();
  const { error } = await db.database.from("sucursales").update(updates).eq("id", SUCURSAL_ID);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
