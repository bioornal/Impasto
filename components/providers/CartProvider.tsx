"use client";
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import type { CartItem, Masa } from "@/types";
import { uid } from "@/lib/utils";
import { ajustarMasas, cambiarMasa, esMismaLinea, masaDe, masaUnica } from "@/lib/masa";
import { avisoOtraMasa, masaParaSumar, topeDePizzas } from "@/lib/masas-noche";
import { useToast } from "@/components/providers/ToastProvider";

interface CartCtx {
  items: CartItem[];
  /** false si no entró: no quedan masas para otra pizza (el aviso ya salió). */
  add: (item: Omit<CartItem, "cartId">) => boolean;
  inc: (cartId: string) => boolean;
  dec: (cartId: string) => void;
  incKey: (key: string) => boolean;
  decKey: (key: string) => void;
  setMasa: (cartId: string, masa: Masa) => void;
  remove: (cartId: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
}

const CartCtx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [guardados, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Si se terminó una masa (panel → Configuración → Masas), las pizzas del carrito pasan a la
  // que queda, también las del borrador y las que se agregan después. El cliente lo lee en el
  // aviso del carrito. Se deriva en vez de corregirse en un efecto: nunca hay un render con la
  // masa agotada elegida. Cada cambio parte de lo que el cliente ve, así lo guardado se pone al día.
  const { masas, masasNoche } = useStoreStatus();
  const toast = useToast();
  const items = useMemo(() => ajustarMasas(guardados, masas), [guardados, masas]);
  const cambiar = (cambio: (prev: CartItem[]) => CartItem[]) =>
    setItems((prev) => cambio(ajustarMasas(prev, masas)));

  useEffect(() => {
    fetch("/api/cart/draft")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "Borrador no disponible");
        if (Array.isArray(result.items) && result.items.length > 0) {
          setItems(result.items);
          return;
        }
        const stored = JSON.parse(localStorage.getItem("impasto_cart") || "[]");
        if (Array.isArray(stored) && stored.length > 0) setItems(stored);
      })
      .catch(() => {
        try {
          const stored = JSON.parse(localStorage.getItem("impasto_cart") || "[]");
          if (Array.isArray(stored) && stored.length > 0) setItems(stored);
        } catch {}
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("impasto_cart", JSON.stringify(items));
    if (items.length === 0) {
      fetch("/api/cart/draft", { method: "DELETE" }).catch(() => {});
      return;
    }
    fetch("/api/cart/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }, [items, ready]);

  // Masas de la noche (31/10/2026): el carrito no suma más pizzas de cada masa que las que quedan. La
  // base igual controla al guardar; esto evita que el cliente arme un pedido que no puede confirmar.
  const hayMasas = (item: Pick<CartItem, "type" | "masa">, cantidad: number) => {
    const masa = masaDe(item);
    const aviso = masa ? topeDePizzas(items, masa, cantidad, masasNoche) : null;
    if (aviso) toast(aviso);
    return !aviso;
  };

  const add = (pedido: Omit<CartItem, "cartId">) => {
    let item = pedido;
    const masa = masaDe(pedido);
    if (masa) {
      // Si su masa está llena y la otra tiene lugar, la pizza entra en la otra. Si se terminó una, la que queda.
      const preferida = masaUnica(masas) ?? masa;
      const entra = masaParaSumar(items, preferida, pedido.qty || 1, masasNoche);
      if (!entra) return hayMasas({ ...pedido, masa: preferida }, pedido.qty || 1);
      if (entra !== preferida) {
        item = { ...pedido, masa: entra };
        // Después del toast del que llamó ("agregada"), que si no taparía este aviso.
        setTimeout(() => toast(avisoOtraMasa(entra)), 0);
      }
    }
    cambiar((prev) => {
      if (!item.unique) {
        const idx = prev.findIndex((p) => esMismaLinea(p, item));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: next[idx].qty + (item.qty || 1) };
          return next;
        }
      }
      return [...prev, { ...item, qty: item.qty || 1, cartId: uid() }];
    });
    return true;
  };

  const inc = (cartId: string) => {
    const linea = items.find((i) => i.cartId === cartId);
    if (linea && !hayMasas(linea, 1)) return false;
    cambiar((p) => p.map((i) => i.cartId === cartId ? { ...i, qty: i.qty + 1 } : i));
    return true;
  };
  const dec = (cartId: string) =>
    cambiar((p) => p.flatMap((i) => i.cartId === cartId ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]));
  // Una pizza puede estar en dos líneas (napoletana y al molde): el + de la tarjeta suma en la
  // primera con lugar y el − resta de la última, nunca de las dos a la vez. Sin lugar en ninguna,
  // pasa por `add`, que la lleva a la otra masa si puede.
  const incKey = (key: string) => {
    const lineas = items.filter((i) => i.key === key);
    if (lineas.length === 0) return false;
    const conLugar = lineas.find((i) => {
      const masa = masaDe(i);
      return !masa || !topeDePizzas(items, masa, 1, masasNoche);
    });
    return conLugar ? inc(conLugar.cartId) : add({ ...lineas[0], qty: 1 });
  };
  const decKey = (key: string) => {
    const linea = items.findLast((i) => i.key === key);
    if (linea) dec(linea.cartId);
  };
  const setMasa = (cartId: string, masa: Masa) => {
    const linea = items.find((i) => i.cartId === cartId);
    if (linea && masaDe(linea) !== masa && !hayMasas({ ...linea, masa }, linea.qty)) return;
    cambiar((p) => cambiarMasa(p, cartId, masa));
  };
  const remove = (cartId: string) => cambiar((p) => p.filter((i) => i.cartId !== cartId));
  const clear = () => setItems([]);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartCtx.Provider value={{ items, add, inc, dec, incKey, decKey, setMasa, remove, clear, subtotal, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
