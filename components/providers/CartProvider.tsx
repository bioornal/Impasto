"use client";
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import type { CartItem, Masa } from "@/types";
import { uid } from "@/lib/utils";
import { ajustarMasas, cambiarMasa, esMismaLinea } from "@/lib/masa";
import { pizzasDelCarrito, topeDePizzas } from "@/lib/masas-noche";
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

  // Masas de la noche (25/10/2026): el carrito no suma más pizzas que las que quedan. La base igual
  // controla al guardar; esto evita que el cliente arme un pedido que después no puede confirmar.
  const hayMasas = (item: Pick<CartItem, "type">, cantidad: number) => {
    if (item.type !== "pizza" && item.type !== "pizza-half") return true;
    const aviso = topeDePizzas(pizzasDelCarrito(items), cantidad, masasNoche);
    if (aviso) toast(aviso);
    return !aviso;
  };

  const add = (item: Omit<CartItem, "cartId">) => {
    if (!hayMasas(item, item.qty || 1)) return false;
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
  // Una pizza puede estar en dos líneas (napoletana y al molde): el + de la tarjeta
  // suma en la primera y el − resta de la última, nunca de las dos a la vez.
  const incKey = (key: string) => {
    const linea = items.find((i) => i.key === key);
    return linea ? inc(linea.cartId) : false;
  };
  const decKey = (key: string) => {
    const linea = items.findLast((i) => i.key === key);
    if (linea) dec(linea.cartId);
  };
  const setMasa = (cartId: string, masa: Masa) => cambiar((p) => cambiarMasa(p, cartId, masa));
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
