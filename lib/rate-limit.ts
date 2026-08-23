import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/insforge";

export interface LimiteConfig {
  /** Intentos permitidos dentro de la ventana. */
  max: number;
  /** Tamaño de la ventana en segundos. */
  ventana: number;
}

/** Límites por endpoint. El de tarjeta es el más estricto: protege contra
 *  pruebas masivas de tarjetas robadas, que ponen en riesgo la cuenta de MP. */
export const LIMITES = {
  pago: { max: 5, ventana: 600 },
  pedido: { max: 10, ventana: 600 },
  login: { max: 5, ventana: 900 },
  cotizacion: { max: 120, ventana: 60 },
  // Cada mensaje cuesta tokens: sin límite, un curioso funde el saldo de DeepSeek.
  // Puerto Iguazú es una ciudad turística: muchos clientes entran desde el
  // wifi de un hotel u hostel, compartiendo una sola IP. 20 mensajes cada 10
  // minutos repartidos entre un hotel entero se agotan rápido, y el costo por
  // conversación es de menos de un décimo de centavo de dólar.
  chat: { max: 40, ventana: 600 },
} satisfies Record<string, LimiteConfig>;

/** Netlify expone la IP real acá; el resto son respaldos. */
export function ipDe(req: NextRequest) {
  return (
    req.headers.get("x-nf-client-connection-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "desconocida"
  );
}

/**
 * Cuenta intentos recientes y registra el actual.
 * Ante un fallo de base deja pasar: un problema de infraestructura no debe
 * cortar las ventas, y el resto de las validaciones siguen en pie.
 */
export async function superaLimite(clave: string, config: LimiteConfig): Promise<boolean> {
  const desde = new Date(Date.now() - config.ventana * 1000).toISOString();

  try {
    const { data, error } = await db.database
      .from("rate_limit_intentos")
      .select("id")
      .eq("clave", clave)
      .gte("created_at", desde);

    if (error) return false;
    if ((data?.length || 0) >= config.max) return true;

    await db.database.from("rate_limit_intentos").insert({ clave });
    return false;
  } catch {
    return false;
  }
}

/**
 * Devuelve una respuesta 429 si el cliente superó el límite, o `null` si puede
 * seguir. Se usa igual que `requireAdmin`.
 */
export async function limitar(req: NextRequest, nombre: keyof typeof LIMITES) {
  const config = LIMITES[nombre];
  const excedido = await superaLimite(`${nombre}:${ipDe(req)}`, config);
  if (!excedido) return null;

  const minutos = Math.ceil(config.ventana / 60);
  return NextResponse.json(
    { ok: false, error: `Demasiados intentos. Esperá ${minutos} minutos antes de volver a probar.` },
    { status: 429, headers: { "Retry-After": String(config.ventana) } },
  );
}

/** Borra intentos viejos. Se llama de vez en cuando para no acumular filas. */
export async function limpiarIntentosViejos() {
  if (Math.random() > 0.02) return;
  const limite = new Date(Date.now() - 3600 * 1000).toISOString();
  try {
    await db.database.from("rate_limit_intentos").delete().lt("created_at", limite);
  } catch { /* la limpieza no es crítica */ }
}
