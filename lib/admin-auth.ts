import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@insforge/sdk/ssr";

const authConfig = {
  baseUrl: process.env.INSFORGE_API_BASE_URL,
  anonKey: process.env.INSFORGE_API_KEY,
};

export async function getCurrentAdmin() {
  const client = createServerClient({ ...authConfig, cookies: await cookies() });
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
