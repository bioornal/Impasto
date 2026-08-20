import type { CatalogData } from "@/types";

/**
 * Lo único que queda del catálogo estático: los precios de caja, que siguen
 * siendo el fallback de lib/order-quote.ts cuando alguna empanada no tiene
 * precio unitario. Los catálogos ficticios que había acá no coincidían con
 * ningún producto real y solo aportaban strings vacíos.
 */
export const STATIC_DATA: Pick<CatalogData, "empanadaBoxPrices"> = {
  empanadaBoxPrices: { 6: 8400, 12: 15900, 24: 30500 },
};
