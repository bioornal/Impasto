import { DELIVERY_FEE, FREE_SHIPPING_FROM } from "@/lib/business";
import type { CartItem, CatalogData } from "@/types";

interface QuoteResult {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  freeShipping: boolean;
}

export interface QuoteRates {
  deliveryFee: number;
  freeShippingFrom: number;
}

const DEFAULT_RATES: QuoteRates = {
  deliveryFee: DELIVERY_FEE,
  freeShippingFrom: FREE_SHIPPING_FROM,
};

const PRICE_ERROR = "Precio no disponible. Actualizá el carrito e intentá de nuevo.";
const positivePrice = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
const ensurePrice = (value: unknown) => {
  if (!positivePrice(value)) throw new Error(PRICE_ERROR);
  return value as number;
};
const ensureListed = (data: CatalogData, id: string) => {
  if (data.preciosNoDisponibles?.includes(id)) throw new Error(PRICE_ERROR);
};
const integerQuantity = (value: unknown) => {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 50 ? quantity : null;
};

function findPizza(data: CatalogData, id: string) {
  return data.pizzas.find((product) => product.id === id);
}

function findEmpanada(data: CatalogData, id: string) {
  return data.empanadas.find((product) => product.id === id);
}

function quoteItem(rawItem: CartItem, data: CatalogData): CartItem {
  const qty = integerQuantity(rawItem.qty);
  if (!qty) throw new Error("Cantidad de producto inválida");

  if (rawItem.type === "pizza") {
    ensureListed(data, rawItem.key);
    const product = findPizza(data, rawItem.key);
    if (!product || !product.disponible) throw new Error(`La pizza "${product?.nombre || "seleccionada"}" está agotada`);
    return { ...rawItem, key: product.id, name: product.nombre, price: ensurePrice(product.precio), qty };
  }

  if (rawItem.type === "bebida") {
    ensureListed(data, rawItem.key);
    const product = data.bebidas.find((item) => item.id === rawItem.key);
    if (!product || !product.disponible) throw new Error(`La bebida "${product?.nombre || "seleccionada"}" está agotada`);
    return { ...rawItem, key: product.id, name: product.nombre, price: ensurePrice(product.precio), qty };
  }

  if (rawItem.type === "pizza-half") {
    const ids = rawItem.variant?.kind === "half"
      ? rawItem.variant.ids
      : rawItem.key.split("-").slice(1, 3) as [string, string];
    ensureListed(data, ids[0] || "");
    ensureListed(data, ids[1] || "");
    const left = findPizza(data, ids[0] || "");
    const right = findPizza(data, ids[1] || "");
    if (!left || !right || !left.disponible || !right.disponible) {
      throw new Error("Una variedad de la pizza mitad y mitad está agotada");
    }
    return {
      ...rawItem,
      key: `half-${left.id}-${right.id}`,
      name: `Mitad ${left.nombre} / Mitad ${right.nombre}`,
      detail: "Pizza mitad y mitad",
      price: Math.max(ensurePrice(left.precio), ensurePrice(right.precio)),
      qty,
      variant: { kind: "half", ids: [left.id, right.id] },
    };
  }

  if (rawItem.type === "empanadas") {
    const variant = rawItem.variant;
    if (variant?.kind !== "empanadas-box" || !(variant.size in data.empanadaBoxPrices)) {
      throw new Error("La caja de empanadas necesita volver a armarse");
    }

    const selections = variant.selections;
    const selected = Object.entries(selections).reduce((sum, [id, amount]) => {
      ensureListed(data, id);
      const emp = findEmpanada(data, id);
      if (!emp || !emp.disponible || !Number.isInteger(amount) || amount < 1) {
        throw new Error(`Una variedad de empanada (${emp?.nombre || "seleccionada"}) está agotada`);
      }
      ensurePrice(emp.precio);
      return sum + amount;
    }, 0);

    if (selected !== variant.size) throw new Error(`La caja debe tener exactamente ${variant.size} empanadas`);
    const detail = Object.entries(selections)
      .map(([id, amount]) => `${amount}× ${findEmpanada(data, id)?.nombre}`)
      .join(", ");
    const price = Object.entries(selections).reduce((sum, [id, amount]) =>
      sum + ensurePrice(findEmpanada(data, id)?.precio) * amount, 0);

    return {
      ...rawItem,
      key: `emp-${variant.size}-${Object.keys(selections).sort().join("-")}`,
      name: `Caja x${variant.size}`,
      detail,
      price: ensurePrice(price),
      qty,
    };
  }

  throw new Error("Tipo de producto inválido");
}

export function quoteItemsWithCatalog(rawItems: CartItem[], data: CatalogData): CartItem[] {
  return rawItems.map((item) => quoteItem(item, data));
}

export async function quoteOrder(
  rawItems: CartItem[],
  mode: string,
  rates: Partial<QuoteRates> = {},
): Promise<QuoteResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    throw new Error("El carrito está vacío o es demasiado grande");
  }
  if (mode !== "delivery" && mode !== "takeaway") throw new Error("Modalidad de entrega inválida");

  const applied: QuoteRates = { ...DEFAULT_RATES, ...rates };
  const { getCatalogData } = await import("@/lib/catalog");
  const data = await getCatalogData();
  const items = quoteItemsWithCatalog(rawItems, data);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const freeShipping = subtotal >= applied.freeShippingFrom;
  const shipping = mode === "delivery" && !freeShipping ? applied.deliveryFee : 0;

  return { items, subtotal, shipping, total: subtotal + shipping, freeShipping };
}
