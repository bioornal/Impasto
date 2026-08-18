import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

export const { POST } = createRefreshAuthRouter({
  baseUrl: process.env.INSFORGE_API_BASE_URL,
  anonKey: process.env.INSFORGE_API_KEY,
});
