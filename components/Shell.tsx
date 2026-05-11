"use client";
import { useState } from "react";
import { CartProvider, useCart } from "@/components/providers/CartProvider";
import { TweakProvider, useTweaks } from "@/components/providers/TweakProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { PromoBand, PromoCards } from "@/components/sections/PromoBand";
import { PizzaList } from "@/components/sections/PizzaList";
import { EmpanadasSection } from "@/components/sections/EmpanadasSection";
import { Bebidas } from "@/components/sections/Bebidas";
import { Reviews } from "@/components/sections/Reviews";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { HalfModal } from "@/components/cart/HalfModal";
import { Checkout } from "@/components/checkout/Checkout";
import { Confirmation } from "@/components/checkout/Confirmation";
import type { CatalogData, Pizza, CartItem } from "@/types";

interface ConfirmedOrder {
  numero: string; nombre: string; mode: string; dir?: string;
  tel: string; total: number; pago: string;
  items: CartItem[]; subtotal: number; shipping: number; fecha: Date;
}

function WspFab() {
  return (
    <a className="wsp-fab" href="https://wa.me/542995550184" target="_blank" rel="noreferrer" title="Chateá con nosotros">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a10 10 0 0 0-8.56 15.1L2 22l5.05-1.32A10 10 0 1 0 12.04 2Zm5.4 14.24c-.23.64-1.34 1.23-1.85 1.27-.47.04-1.08.23-3.62-.76-3.06-1.2-5-4.25-5.15-4.45-.15-.2-1.23-1.64-1.23-3.13 0-1.5.78-2.23 1.06-2.54.28-.3.6-.38.8-.38.2 0 .4 0 .57.01.18 0 .43-.07.67.51.23.58.82 2 .89 2.14.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.38-.46.51-.15.15-.31.32-.13.62.17.3.77 1.27 1.65 2.06 1.13 1 2.08 1.32 2.38 1.47.3.15.47.12.65-.07.17-.2.75-.88.95-1.18.2-.3.4-.25.67-.15.27.1 1.7.8 2 .95.28.15.47.22.54.35.07.12.07.72-.16 1.36Z"/></svg>
    </a>
  );
}

function TweaksPanel() {
  const { tweaks, setKey, tweaksOn } = useTweaks();
  if (!tweaksOn) return null;
  const palettes: [string, string][] = [["trattoria", "#b2472a"], ["forno", "#d9451f"], ["oliva", "#556b2f"]];
  const types: [string, string][] = [["classic", "Clásico"], ["modern", "Moderno"], ["editorial", "Editorial"], ["warm", "Cálido"]];
  const cards: [string, string][] = [["photo", "Foto"], ["compact", "Compact"], ["list", "Lista"]];
  return (
    <div className="tweaks-panel on">
      <div className="tweaks-head"><h5>⚙ Tweaks</h5></div>
      <div className="tweaks-body">
        <div className="tweak-group">
          <label>Paleta</label>
          <div className="tweak-opts">
            {palettes.map(([k, c]) => (
              <div key={k} className={`tweak-swatch ${tweaks.palette === k && !tweaks.dark ? "active" : ""}`} style={{ background: c }} onClick={() => { setKey("palette", k); setKey("dark", false); }} title={k} />
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
            {types.map(([k, l]) => <button key={k} className={`tweak-opt ${tweaks.typography === k ? "active" : ""}`} onClick={() => setKey("typography", k)}>{l}</button>)}
          </div>
        </div>
        <div className="tweak-group">
          <label>Tarjetas de producto</label>
          <div className="tweak-opts">
            {cards.map(([k, l]) => <button key={k} className={`tweak-opt ${tweaks.cardStyle === k ? "active" : ""}`} onClick={() => setKey("cardStyle", k)}>{l}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteContent({ data }: { data: CatalogData }) {
  const { paletteClass, typeClass } = useTweaks();
  const { add, clear } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [halfModal, setHalfModal] = useState<Pizza | null>(null);
  const [screen, setScreen] = useState<"home" | "checkout" | "confirm">("home");
  const [nav, setNav] = useState("home");
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);

  const scrollToSection = (n: string) => {
    if (n === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const el = document.getElementById(n);
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
  };

  const onNav = (n: string) => { setNav(n); setTimeout(() => scrollToSection(n), 50); };

  const cartAdd = (pizza: Pizza, mode: "full" | "half") => {
    if (mode === "half") { setHalfModal(pizza); return; }
    add({ key: pizza.id, type: "pizza", name: pizza.nombre, price: pizza.precio, illus: pizza.id, qty: 1 });
  };

  return (
    <div className={`app ${paletteClass} ${typeClass}`}>
      <Header onCartClick={() => setDrawerOpen(true)} onNav={onNav} current={nav} />
      <PromoBand />
      <main>
        <Hero onCta={onNav} />
        <PromoCards promos={data.promos} />
        <PizzaList pizzas={data.pizzas} onPick={cartAdd} />
        <EmpanadasSection empanadas={data.empanadas} />
        <Bebidas bebidas={data.bebidas} />
        <Reviews reviews={data.reviews} />
      </main>
      <Footer />
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onCheckout={() => { setDrawerOpen(false); setScreen("checkout"); }} />
      {halfModal && <HalfModal startPizza={halfModal} pizzas={data.pizzas} onClose={() => setHalfModal(null)} />}
      {screen === "checkout" && (
        <Checkout onClose={() => setScreen("home")} onConfirm={(o) => { setOrder(o as ConfirmedOrder); setScreen("confirm"); fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }).catch(() => {}); }} />
      )}
      {screen === "confirm" && order && (
        <Confirmation order={order} onClose={() => { setScreen("home"); setOrder(null); clear(); }} />
      )}
      <WspFab />
      <TweaksPanel />
    </div>
  );
}

export function Shell({ data }: { data: CatalogData }) {
  return (
    <TweakProvider>
      <CartProvider>
        <SiteContent data={data} />
      </CartProvider>
    </TweakProvider>
  );
}
