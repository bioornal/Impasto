import { DELIVERY_FEE } from "@/lib/business";
import { getCatalogData } from "@/lib/catalog";
import type { CartItem, CatalogData } from "@/types";

interface QuoteResult {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

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
    const product = findPizza(data, rawItem.key);
    if (!product) throw new Error("Una pizza del carrito ya no está disponible");
    return { ...rawItem, key: product.id, name: product.nombre, price: product.precio, qty };
  }

  if (rawItem.type === "bebida") {
    const product = data.bebidas.find((item) => item.id === rawItem.key);
    if (!product) throw new Error("Una bebida del carrito ya no está disponible");
    return { ...rawItem, key: product.id, name: product.nombre, price: product.precio, qty };
  }

  if (rawItem.type === "pizza-half") {
    const ids = rawItem.variant?.kind === "half"
      ? rawItem.variant.ids
      : rawItem.key.split("-").slice(1, 3) as [string, string];
    const left = findPizza(data, ids[0] || "");
    const right = findPizza(data, ids[1] || "");
    if (!left || !right) throw new Error("Una variedad de la pizza mitad y mitad ya no está disponible");
    return {
      ...rawItem,
      key: `half-${left.id}-${right.id}`,
      name: `Mitad ${left.nombre} / Mitad ${right.nombre}`,
      detail: "Pizza mitad y mitad",
      price: Math.max(left.precio, right.precio),
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
      if (!findEmpanada(data, id) || !Number.isInteger(amount) || amount < 1) {
        throw new Error("Una variedad de empanada ya no está disponible");
      }
      return sum + amount;
    }, 0);

    if (selected !== variant.size) throw new Error(`La caja debe tener exactamente ${variant.size} empanadas`);
    const detail = Object.entries(selections)
      .map(([id, amount]) => `${amount}× ${findEmpanada(data, id)?.nombre}`)
      .join(", ");
    const hasUnitPrices = Object.keys(selections).every((id) => Number(findEmpanada(data, id)?.precio) > 0);
    const price = hasUnitPrices
      ? Object.entries(selections).reduce((sum, [id, amount]) => sum + Number(findEmpanada(data, id)?.precio || 0) * amount, 0)
      : data.empanadaBoxPrices[variant.size];

    return {
      ...rawItem,
      key: `emp-${variant.size}-${Object.keys(selections).sort().join("-")}`,
      name: `Caja x${variant.size}`,
      detail,
      price,
      qty,
    };
  }

  throw new Error("Tipo de producto inválido");
}

export async function quoteOrder(rawItems: CartItem[], mode: string, deliveryFee = DELIVERY_FEE): Promise<QuoteResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    throw new Error("El carrito está vacío o es demasiado grande");
  }
  if (mode !== "delivery" && mode !== "takeaway") throw new Error("Modalidad de entrega inválida");

  const data = await getCatalogData();
  const items = rawItems.map((item) => quoteItem(item, data));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = mode === "delivery" ? deliveryFee : 0;

  return { items, subtotal, shipping, total: subtotal + shipping };
}
