import assert from "node:assert/strict";
import { test } from "node:test";
import { cookiesTolerantes } from "../lib/admin-sesion";

test("cookiesTolerantes: lee igual y, si escribir no se puede (Server Component), no rompe", () => {
  const escritas: string[] = [];
  const ok = cookiesTolerantes({
    get: (n: string) => (n === "a" ? { value: "1" } : undefined),
    set: (...a: unknown[]) => { escritas.push(String(a[0])); },
    delete: (...a: unknown[]) => { escritas.push(`-${String(a[0])}`); },
  });
  assert.deepEqual(ok.get("a"), { value: "1" });
  ok.set?.("insforge_access_token", "x");
  ok.delete?.("viejo");
  assert.deepEqual(escritas, ["insforge_access_token", "-viejo"]);

  const soloLectura = cookiesTolerantes({
    get: () => undefined,
    set: (...a: unknown[]) => { void a; throw new Error("Cookies can only be modified in a Server Action or Route Handler"); },
    delete: (...a: unknown[]) => { void a; throw new Error("Cookies can only be modified in a Server Action or Route Handler"); },
  });
  assert.doesNotThrow(() => soloLectura.set?.("insforge_access_token", "x"));
  assert.doesNotThrow(() => soloLectura.delete?.("insforge_access_token"));
});
