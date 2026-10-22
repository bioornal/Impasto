import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@insforge/sdk/ssr";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import { cookiesTolerantes } from "@/lib/admin-sesion";

const authConfig = {
  baseUrl: process.env.INSFORGE_API_BASE_URL,
  anonKey: process.env.INSFORGE_API_KEY,
};

export async function getCurrentAdmin() {
  // El acceso dura 15 min; si venció (o vence en menos de 1 min) y está la renovación de 7 días,
  // pide uno nuevo y lo guarda en la respuesta. Ver lib/admin-sesion.ts.
  const almacen = cookiesTolerantes(await cookies());
  const { accessToken } = await updateSession({ ...authConfig, requestCookies: almacen, responseCookies: almacen });
  if (!accessToken) return null;
  const client = createServerClient({ ...authConfig, accessToken });
  const { data, error } = await client.auth.getCurrentUser();
  if (error || !data?.user) return null;

  const allowedEmails = (process.env.INSFORGE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length === 0 || !allowedEmails.includes(String(data.user.email || "").toLowerCase())) return null;
  return data.user;
}

export async function requireAdmin() {
  const user = await getCurrentAdmin();
  return user ? null : NextResponse.json({ ok: false, error: "Autenticación requerida" }, { status: 401 });
}
