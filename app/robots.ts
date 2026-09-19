import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * El panel y la API quedan fuera del índice. `/admin` ya redirige a login,
 * pero sin esto Google igual lo rastrea y gasta presupuesto de rastreo en
 * páginas que siempre le van a devolver un redirect.
 *
 * `/pedido/` lleva nombre, dirección e ítems del cliente: no va al índice.
 */
const RUTAS_PRIVADAS = ["/admin", "/admin/", "/admin-login", "/api/", "/pedido/"];

/**
 * Rastreadores de asistentes de IA, listados a propósito.
 *
 * La regla `*` ya los deja pasar; nombrarlos deja explícita la intención de que
 * ChatGPT, Perplexity, Claude, Gemini y Copilot puedan leer y citar la carta.
 * Para una pizzería, aparecer en la respuesta de "¿dónde comer pizza en Iguazú?"
 * vale más que cualquier bloqueo, y los datos privados ya están excluidos.
 */
const CRAWLERS_IA = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "Applebot-Extended",
  "DuckAssistBot",
  "Amazonbot",
  "meta-externalagent",
  "cohere-ai",
  "YouBot",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: RUTAS_PRIVADAS },
      { userAgent: CRAWLERS_IA, allow: "/", disallow: RUTAS_PRIVADAS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
