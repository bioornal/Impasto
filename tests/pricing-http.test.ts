import assert from "node:assert/strict";
import { test } from "node:test";
import { pricingHttpError } from "../lib/pricing-http";
import { PricingUnavailableError } from "../lib/pricing-safety";

test("una fuente crítica devuelve 503 sin detalles internos", () => {
  const response = pricingHttpError(new PricingUnavailableError("ingredientes"));
  assert.deepEqual(response, {
    status: 503,
    error: "Los precios no están disponibles. Reintentá en unos minutos.",
  });
});

test("un error de validación conserva 400", () => {
  assert.deepEqual(pricingHttpError(new Error("Carrito inválido")), { status: 400, error: "Carrito inválido" });
});
