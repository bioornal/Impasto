import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

const authConfig = {
  baseUrl: process.env.INSFORGE_API_BASE_URL,
  anonKey: process.env.INSFORGE_API_KEY,
};

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const auth = createAuthActions({ ...authConfig, cookies: response.cookies });
  const { error } = await auth.signOut();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: response.headers });
}
