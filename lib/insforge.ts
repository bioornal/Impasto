import { createClient } from "@insforge/sdk";

const db = createClient({
  baseUrl: process.env.INSFORGE_API_BASE_URL!,
  anonKey: process.env.INSFORGE_API_KEY!,
});

export { db };
