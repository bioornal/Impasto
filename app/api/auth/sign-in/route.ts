import { NextRequest, NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { limitar, limpiarIntentosViejos } from "@/lib/rate-limit";

const authConfig = {
  baseUrl: process.env.INSFORGE_API_BASE_URL,
  anonKey: process.env.INSFORGE_API_KEY,
};

export async function POST(request: NextRequest) {
  // Frena la fuerza bruta contra el panel.
  const limitado = await limitar(request, "login");
  if (limitado) return limitado;
  await limpiarIntentosViejos();

  const body = await request.json().catch(() => ({}));
  const response = NextResponse.json({ ok: true });
  const auth = createAuthActions({
    ...authConfig,
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });
  const { data, error } = await auth.signInWithPassword({
    email: String(body.email || "").trim(),
    password: String(body.password || ""),
  });

  if (error || !data?.user) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Credenciales inválidas" },
      { status: error?.statusCode || 401 },
    );
  }

  return NextResponse.json({ ok: true, user: data.user }, { headers: response.headers });
}
