import { superaLimite } from "@/lib/rate-limit";
import { sendTelegram } from "@/lib/telegram";
import { alertaPorFallo } from "@/lib/chat-fallas";

/**
 * Avisos que no son de un pedido sino del sistema: algo se rompió y necesita
 * que el dueño haga algo. Vive aparte de `lib/notifications.ts` porque ese
 * módulo gira alrededor de `pedido_id`, y esto no tiene pedido.
 *
 * La plantilla y la decisión de qué merece aviso están en `lib/chat-fallas.ts`,
 * que no importa nada y por eso se testea con `tsx`.
 */

/**
 * Una hora entre avisos iguales. Sin esto, una cuenta sin saldo mandaría un
 * mensaje por cada cliente que escriba: el dueño silencia el bot y después no
 * ve el aviso que sí importa.
 *
 * Se apoya en `rate_limit_intentos`, que ya es exactamente esto —contar hechos
 * por clave dentro de una ventana— y evita una tabla nueva. **La ventana tiene
 * que seguir siendo igual o menor que la de `limpiarIntentosViejos()`** (que
 * borra lo anterior a una hora): si se alarga acá sin alargarla allá, la
 * limpieza borraría el registro del último aviso y volvería a avisar.
 */
const VENTANA_AVISO = 3600;

/**
 * Avisa por Telegram si la falla del chat pide una acción del dueño.
 *
 * No lanza nunca: se la llama desde el camino de error de `/api/chat`, y que
 * falle el aviso no puede convertir un 502 informativo en un 500.
 */
export async function avisarFalloDelChat(motivo: string): Promise<void> {
  try {
    const alerta = alertaPorFallo(motivo);
    if (!alerta) return;

    // `superaLimite` cuenta y registra en la misma llamada: si ya hubo un aviso
    // con esta clave en la última hora devuelve `true` y no mandamos otro.
    // Ante un fallo de base devuelve `false`, así que el aviso sale igual:
    // para una alerta, el riesgo de repetirla es menor que el de perderla.
    const yaAvisado = await superaLimite(`aviso:${alerta.clave}`, { max: 1, ventana: VENTANA_AVISO });
    if (yaAvisado) return;

    const resultado = await sendTelegram(alerta.texto);
    if (resultado.estado !== "enviado") {
      console.error("[aviso-sistema]", alerta.clave, resultado.estado, resultado.motivo);
    }
  } catch (error) {
    console.error("[aviso-sistema]", error instanceof Error ? error.message : "error");
  }
}
