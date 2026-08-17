"use client";
import { createContext, useContext, useState, useEffect } from "react";
import type { CartItem } from "@/types";
import { uid } from "@/lib/utils";

interface CartCtx {
  items: CartItem[];
  add: (item: Omit<CartItem, "cartId">) => void;
  inc: (cartId: string) => void;
  dec: (cartId: string) => void;
  remove: (cartId: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
}

const CartCtx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

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

  const add = (item: Omit<CartItem, "cartId">) =>
    setItems((prev) => {
      if (!item.unique) {
        const idx = prev.findIndex((p) => p.key === item.key);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: next[idx].qty + (item.qty || 1) };
          return next;
        }
      }
      return [...prev, { ...item, qty: item.qty || 1, cartId: uid() }];
    });

  const inc = (cartId: string) =>
    setItems((p) => p.map((i) => i.cartId === cartId ? { ...i, qty: i.qty + 1 } : i));
  const dec = (cartId: string) =>
    setItems((p) => p.flatMap((i) => i.cartId === cartId ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]));
  const remove = (cartId: string) => setItems((p) => p.filter((i) => i.cartId !== cartId));
  const clear = () => setItems([]);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartCtx.Provider value={{ items, add, inc, dec, remove, clear, subtotal, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
