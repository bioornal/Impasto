import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";

export async function POST(req: NextRequest) {
  const order = await req.json();

  if (!order.nombre || !order.tel || !order.items?.length) {
    return NextResponse.json({ ok: false, error: "Datos de pedido incompletos" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const { data: clienteExistente } = await db.database
      .from("clientes")
      .select("cant_compras")
      .eq("telefono", order.tel)
      .limit(1);

    if (clienteExistente && clienteExistente.length > 0) {
      await db.database.from("clientes").update({
        nombre: order.nombre,
        direccion: order.dir || "",
        cant_compras: (clienteExistente[0].cant_compras || 0) + 1,
      }).eq("telefono", order.tel);
    } else {
      await db.database.from("clientes").insert({
        nombre: order.nombre,
        telefono: order.tel,
        direccion: order.dir || "",
        detalles: "",
        cant_compras: 1,
      });
    }

    const numeroPedido = order.numero
      ? parseInt(order.numero.toString().replace(/\D/g, ""), 10)
      : Date.now() % 100000;

    const { error } = await db.database.from("pedidos").insert({
      numero_pedido: numeroPedido,
      nombre_cliente: order.nombre,
      telefono_cliente: order.tel,
      direccion: order.dir || (order.mode === "takeaway" ? "Retiro en local" : ""),
      productos: order.items,
      total: order.total,
      total_con_descuento: order.total,
      status: "normal",
      fecha: today,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true, numero: order.numero });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
