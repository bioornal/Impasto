import { cookies } from "next/headers";

export const CART_SESSION_COOKIE = "impasto_cart_session";

export async function getCartSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(CART_SESSION_COOKIE)?.value || null;
}
