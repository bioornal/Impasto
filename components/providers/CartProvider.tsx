"use client";
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import type { CartItem, Masa, CatalogData } from "@/types";
import { promosAplicables, ofertasVigentes } from "@/lib/promos-aplicar";
import type { Oferta } from "@/lib/promos";
import { cotizarPromo, lineasPromo, type PedidoPromoSeleccion, type PedidoPromo } from "@/lib/promos-web";
import { bebidasConStock } from "@/lib/stock-bebidas";
import { uid } from "@/lib/utils";
import { ajustarMasas, cambiarMasa, esMismaLinea, masaDe, masaUnica } from "@/lib/masa";
import { avisoOtraMasa, masaParaSumar, topeDePizzas } from "@/lib/masas-noche";
import { topeDeBebidas } from '@/lib/stock-bebidas';
import { useToast } from "@/components/providers/ToastProvider";

interface CartCtx {
  items: CartItem[];
  previewItems: CartItem[];
  catalogo: CatalogData;
  ofertas: Oferta[];
  promo: PedidoPromoSeleccion | null;
  promoAplicada: PedidoPromo | null;
  promoError: string;
  promoOpciones: ReturnType<typeof promosAplicables>;
  setPromo: (promo: PedidoPromoSeleccion | null) => void;
  addCombo: (productos: Omit<CartItem, "cartId">[], ofertaId: string) => boolean;
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

export function CartProvider({ children, data }: { children: React.ReactNode; data: CatalogData }) {
  const [guardados, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [elegida, setPromo] = useState<PedidoPromoSeleccion | null | undefined>(undefined);

  // Si se terminó una masa (panel → Configuración → Masas), las pizzas del carrito pasan a la
  // que queda, también las del borrador y las que se agregan después. El cliente lo lee en el
  // aviso del carrito. Se deriva en vez de corregirse en un efecto: nunca hay un render con la
  // masa agotada elegida. Cada cambio parte de lo que el cliente ve, así lo guardado se pone al día.
  const { masas, masasNoche, stockBebidas, ofertas: vigentes } = useStoreStatus();
  const toast = useToast();
  const items = useMemo(() => ajustarMasas(guardados, masas), [guardados, masas]);
  const catalogo = useMemo(() => ({ ...data, ofertas: ofertasVigentes(vigentes ?? data.ofertas ?? [], new Date()),
    stockBebidas, bebidas: bebidasConStock(data.bebidas, stockBebidas) }), [data, stockBebidas, vigentes]);
  const ofertas = catalogo.ofertas;
  // La promo se aplica sola: la de mayor ahorro para lo que armó el cliente. Si agregó un combo desde
  // "Promos de hoy", se respeta ese combo mientras siga aplicando. El cliente no elige nada en el carrito.
  const promoOpciones = useMemo(() => promosAplicables(ofertas, lineasPromo(items), [], new Date()), [ofertas, items]);
  const combo = elegida ? promoOpciones.find(p => p.oferta.id === elegida.ofertaId) : undefined;
  const mejor = combo ?? promoOpciones[0];
  const promo: PedidoPromoSeleccion | null = mejor ? { ofertaId: mejor.oferta.id } : null;
  const calculo = (() => {
    try { return { ...cotizarPromo(items, catalogo, promo), error: "" }; }
    catch (error) { return { items, promo: null, error: error instanceof Error ? error.message : "Revisá tu promo." }; }
  })();
  const previewItems = calculo.items;
  const promoAplicada = calculo.promo;
  const promoError = calculo.error;
  const cambiar = (cambio: (prev: CartItem[]) => CartItem[]) =>
    setItems((prev) => cambio(ajustarMasas(prev, masas)));

  useEffect(() => {
    fetch("/api/cart/draft")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "Borrador no disponible");
        if (Array.isArray(result.items) && result.items.length > 0) {
          setItems(result.items);
          if ("promo" in result) setPromo(result.promo);
          return;
        }
        const savedPromo = localStorage.getItem("impasto_cart_promo");
        if (savedPromo !== null) setPromo(JSON.parse(savedPromo));
        const stored = JSON.parse(localStorage.getItem("impasto_cart") || "[]");
        if (Array.isArray(stored) && stored.length > 0) setItems(stored);
      })
      .catch(() => {
        try {
          const savedPromo = localStorage.getItem("impasto_cart_promo");
          if (savedPromo !== null) setPromo(JSON.parse(savedPromo));
          const stored = JSON.parse(localStorage.getItem("impasto_cart") || "[]");
          if (Array.isArray(stored) && stored.length > 0) setItems(stored);
        } catch {}
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("impasto_cart", JSON.stringify(items));
    // Solo se recuerda el combo que el cliente agregó a propósito; lo automático se recalcula.
    localStorage.setItem("impasto_cart_promo", JSON.stringify(elegida ?? null));
    if (items.length === 0) {
      fetch("/api/cart/draft", { method: "DELETE" }).catch(() => {});
      return;
    }
    fetch("/api/cart/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, promo }),
    }).catch(() => {});
  }, [items, ready, promo?.ofertaId, promo?.regaloProductoId]);

  // Masas de la noche (31/10/2026): el carrito no suma más pizzas de cada masa que las que quedan. La
  // base igual controla al guardar; esto evita que el cliente arme un pedido que no puede confirmar.
  const hayMasas = (item: Pick<CartItem, "type" | "masa">, cantidad: number) => {
    const masa = masaDe(item);
    const aviso = masa ? topeDePizzas(items, masa, cantidad, masasNoche) : null;
    if (aviso) toast(aviso);
    return !aviso;
  };

  const add = (pedido: Omit<CartItem, "cartId">) => {
    const aviso = topeDeBebidas(items, pedido, pedido.qty || 1, stockBebidas);
    if (aviso) { toast(aviso); return false; }
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
    const aviso = linea ? topeDeBebidas(items, linea, 1, stockBebidas) : null;
    if (aviso) { toast(aviso); return false; }
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
  const addCombo = (productos: Omit<CartItem, "cartId">[], ofertaId: string) => {
    const next = [...items];
    for (const producto of productos) {
      const aviso = topeDeBebidas(next, producto, producto.qty, stockBebidas);
      if (aviso) { toast(aviso); return false; }
      let item = producto;
      const masa = masaDe(item);
      if (masa) {
        const preferida = masaUnica(masas) ?? masa;
        const entra = masaParaSumar(next, preferida, item.qty, masasNoche);
        if (!entra) { toast(topeDePizzas(next, preferida, item.qty, masasNoche) || "No quedan masas para este combo."); return false; }
        item = { ...item, masa: entra };
      }
      const idx = next.findIndex(p => esMismaLinea(p, item));
      if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + item.qty };
      else next.push({ ...item, cartId: uid() });
    }
    setItems(next);
    setPromo({ ofertaId });
    return true;
  };
  const clear = () => { setItems([]); setPromo(undefined); };
  const subtotal = previewItems.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartCtx.Provider value={{ items, previewItems, catalogo, ofertas, promo, promoAplicada, promoError, promoOpciones, setPromo, addCombo, add, inc, dec, incKey, decKey, setMasa, remove, clear, subtotal, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
