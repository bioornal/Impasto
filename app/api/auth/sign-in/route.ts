import { NextRequest, NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

const authConfig = {
  baseUrl: process.env.INSFORGE_API_BASE_URL,
  anonKey: process.env.INSFORGE_API_KEY,
};

export async function POST(request: NextRequest) {
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
