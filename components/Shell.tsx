"use client";
import { useState } from "react";
import { CartProvider, useCart } from "@/components/providers/CartProvider";
import { TweakProvider, useTweaks } from "@/components/providers/TweakProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { Header, Ticker } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero, Features } from "@/components/sections/Hero";
import { Promos } from "@/components/sections/Promos";
import { PizzaList } from "@/components/sections/PizzaList";
import { EmpanadasSection } from "@/components/sections/EmpanadasSection";
import { Bebidas } from "@/components/sections/Bebidas";
import { Story } from "@/components/sections/Story";
import { Reviews } from "@/components/sections/Reviews";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { HalfModal } from "@/components/cart/HalfModal";
import { Checkout } from "@/components/checkout/Checkout";
import { Confirmation } from "@/components/checkout/Confirmation";
import type { BusinessConfig } from "@/lib/business";
import type { CheckoutOrder } from "@/components/checkout/Checkout";
import type { CardFormData } from "@/components/checkout/CardPayment";
import type { CatalogData, Pizza, CartItem } from "@/types";

interface ConfirmedOrder {
  numero: string; nombre: string; mode: string; dir?: string;
  tel: string; total: number; pago: string; estadoPago?: string;
  items: CartItem[]; subtotal: number; shipping: number; fecha: Date;
}

function WspFab({ business }: { business: BusinessConfig }) {
  return (
    <a
      className="wsp-fab"
      href={`https://wa.me/${business.whatsappPhone}`}
      target="_blank"
      rel="noreferrer"
      title="Chateá con nosotros"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Zm5.4 14.24c-.23.64-1.34 1.23-1.85 1.27-.47.04-1.08.23-3.62-.76-3.06-1.2-5-4.25-5.15-4.45-.15-.2-1.23-1.64-1.23-3.13 0-1.5.78-2.23 1.06-2.54.28-.3.6-.38.8-.38.2 0 .4 0 .57.01.18 0 .43-.07.67.51.23.58.82 2 .89 2.14.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.38-.46.51-.15.15-.31.32-.13.62.17.3.77 1.27 1.65 2.06 1.13 1 2.08 1.32 2.38 1.47.3.15.47.12.65-.07.17-.2.75-.88.95-1.18.2-.3.4-.25.67-.15.27.1 1.7.8 2 .95.28.15.47.22.54.35.07.12.07.72-.16 1.36Z" /></svg>
    </a>
  );
}

function TweaksPanel() {
  const { tweaks, setKey, tweaksOn } = useTweaks();
  if (!tweaksOn) return null;
  const palettes: [string, string][] = [
    ["impasto", "#b2472a"],
    ["trattoria", "#ff4d1f"],
    ["forno", "#e8371c"],
    ["oliva", "#5f7f34"],
  ];
  const types: [string, string][] = [["classic", "Clásico"], ["modern", "Moderno"], ["editorial", "Editorial"], ["warm", "Cálido"]];
  return (
    <div className="tweaks-panel on">
      <div className="tweaks-head"><h5>⚙ Tweaks</h5></div>
      <div className="tweaks-body">
        <div className="tweak-group">
          <label>Paleta</label>
          <div className="tweak-opts">
            {palettes.map(([key, color]) => (
              <div
                key={key}
                className={`tweak-swatch ${tweaks.palette === key && !tweaks.dark ? "active" : ""}`}
                style={{ background: color }}
                onClick={() => { setKey("palette", key); setKey("dark", false); }}
                title={key}
              />
            ))}
          </div>
        </div>
        <div className="tweak-group">
          <label>Modo</label>
          <div className="tweak-opts">
            <button className={`tweak-opt ${!tweaks.dark ? "active" : ""}`} onClick={() => setKey("dark", false)}>Claro</button>
            <button className={`tweak-opt ${tweaks.dark ? "active" : ""}`} onClick={() => setKey("dark", true)}>Oscuro</button>
          </div>
        </div>
        <div className="tweak-group">
          <label>Tipografía</label>
          <div className="tweak-opts">
            {types.map(([key, label]) => (
              <button key={key} className={`tweak-opt ${tweaks.typography === key ? "active" : ""}`} onClick={() => setKey("typography", key)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteContent({ data, business }: { data: CatalogData; business: BusinessConfig }) {
  const { paletteClass, typeClass } = useTweaks();
  const { clear } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [halfOpen, setHalfOpen] = useState(false);
  const [halfStart, setHalfStart] = useState<Pizza | null>(null);
  const [screen, setScreen] = useState<"home" | "checkout" | "confirm">("home");
  const [nav, setNav] = useState("home");
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);

  const featured = data.pizzas.find((p) => p.popular && p.categoria === "gourmet")
    || data.pizzas.find((p) => p.popular)
    || data.pizzas[0];

  const onNav = (section: string) => {
    setNav(section);
    setDrawerOpen(false);
    setTimeout(() => {
      if (section === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      const el = document.getElementById(section);
      if (el) window.scrollTo({ top: el.offsetTop - 130, behavior: "smooth" });
    }, 50);
  };

  const openHalf = (pizza?: Pizza) => {
    if (data.pizzas.length < 2) return;
    setHalfStart(pizza || null);
    setDrawerOpen(false);
    setHalfOpen(true);
  };

  const sections = [
    "home",
    ...(data.pizzas.length > 0 ? ["pizzas"] : []),
    ...(data.empanadas.length > 0 ? ["empanadas"] : []),
    ...(data.bebidas.length > 0 ? ["bebidas"] : []),
    "nosotros",
  ];

  return (
    <div className={`app ${paletteClass} ${typeClass}`}>
      <Header onCartClick={() => setDrawerOpen(true)} onNav={onNav} current={nav} business={business} sections={sections} />
      <Ticker />

      <main>
        <Hero onCta={onNav} onHalf={() => openHalf()} featured={featured} varieties={data.pizzas.length} />
        <Features freeShippingFrom={business.freeShippingFrom} />
        <Promos promos={data.promos} onNav={onNav} />
        <PizzaList pizzas={data.pizzas} onHalf={openHalf} />
        <EmpanadasSection empanadas={data.empanadas} boxPrices={data.empanadaBoxPrices} />
        <Bebidas bebidas={data.bebidas} />
        <Story />
        <Reviews reviews={data.reviews} business={business} />
      </main>

      <Footer business={business} />

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCheckout={() => { setDrawerOpen(false); setScreen("checkout"); }}
        onBrowse={() => onNav("pizzas")}
        business={business}
        bebidas={data.bebidas}
      />

      {halfOpen && (
        <HalfModal
          startPizza={halfStart}
          pizzas={data.pizzas}
          business={business}
          onClose={() => { setHalfOpen(false); setHalfStart(null); }}
        />
      )}

      {screen === "checkout" && (
        <Checkout
          onClose={() => setScreen("home")}
          business={business}
          onConfirm={async (submitted: CheckoutOrder) => {
            const response = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(submitted),
            });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo registrar el pedido");
            clear();
            setOrder({
              ...submitted,
              numero: result.numero,
              subtotal: result.subtotal,
              shipping: result.shipping,
              total: result.total,
              fecha: new Date(),
            });
            setScreen("confirm");
          }}
          onCardConfirm={async (submitted: CheckoutOrder, card: CardFormData) => {
            const response = await fetch("/api/payments/card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...submitted, ...card }),
            });
            const result = await response.json();
            // 402 es rechazo de la tarjeta: el checkout queda abierto para reintentar.
            if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo procesar el pago");
            clear();
            setOrder({
              ...submitted,
              numero: result.numero,
              estadoPago: result.estadoPago,
              subtotal: result.subtotal,
              shipping: result.shipping,
              total: result.total,
              fecha: new Date(),
            });
            setScreen("confirm");
          }}
        />
      )}

      {screen === "confirm" && order && (
        <Confirmation
          order={order}
          business={business}
          onClose={() => { setScreen("home"); setOrder(null); clear(); }}
        />
      )}

      <WspFab business={business} />
      <TweaksPanel />
    </div>
  );
}

export function Shell({ data, business }: { data: CatalogData; business: BusinessConfig }) {
  return (
    <TweakProvider>
      <ToastProvider>
        <CartProvider>
          <SiteContent data={data} business={business} />
        </CartProvider>
      </ToastProvider>
    </TweakProvider>
  );
}
