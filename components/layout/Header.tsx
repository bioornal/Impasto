"use client";
import { useCart } from "@/components/providers/CartProvider";
import { useStoreStatus } from "@/components/providers/StoreStatusProvider";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";

const NAV: [string, string][] = [
  ["home", "Inicio"],
  ["pizzas", "Pizzas"],
  ["empanadas", "Empanadas"],
  ["bebidas", "Bebidas"],
  ["nosotros", "Nosotros"],
];

function Topbar({ business }: { business: BusinessConfig }) {
  const tienda = useStoreStatus();

  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <div className="topbar-status">
          <span className={`dot ${tienda.abierto ? "" : "off"}`} />
          {tienda.etiqueta || business.hours}
        </div>
        <div className="topbar-links">
          <span>{business.address} · {business.city}</span>
          <span>{business.phone}</span>
          <span className="gold">Envío gratis desde {fmt(business.freeShippingFrom)}</span>
        </div>
      </div>
    </div>
  );
}

const TICKER = [
  "Fermentación 48 hs",
  "Masa híbrida crocante",
  "Martes y miércoles 2×1",
  "Delivery 30 min",
  "Mozzarella abundante",
];

export function Ticker() {
  const run = (key: string) => (
    <span key={key}>
      {TICKER.map((text) => (
        <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: 34 }}>
          <i>✦</i>{text}
        </span>
      ))}
    </span>
  );
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">{run("a")}{run("b")}</div>
    </div>
  );
}

interface HeaderProps {
  onCartClick: () => void;
  onNav: (section: string) => void;
  current: string;
  business: BusinessConfig;
  /** Secciones que efectivamente se renderizan; el resto no se ofrece en el nav. */
  sections: string[];
}

export function Header({ onCartClick, onNav, current, business, sections }: HeaderProps) {
  const { count, subtotal } = useCart();
  const navItems = NAV.filter(([key]) => sections.includes(key));
  return (
    <>
      <Topbar business={business} />
      <header className="header">
        <div className="container header-inner">
          <button className="logo" onClick={() => onNav("home")} aria-label="Ir al inicio">
            <div className="logo-mark">I</div>
            <div className="logo-word">
              {business.name}
              <small>pizza híbrida · iguazú</small>
            </div>
          </button>

          <nav className="nav">
            {navItems.map(([key, label]) => (
              <button
                key={key}
                className={current === key ? "active" : ""}
                onClick={() => onNav(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button className="icon-btn" aria-label="Buscar en la carta" onClick={() => onNav("pizzas")}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </button>
            <button className="cart-btn" onClick={onCartClick} aria-label="Abrir carrito">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              <span className="cart-btn-label">{subtotal > 0 ? fmt(subtotal) : "Carrito"}</span>
              <span className={`cart-badge ${count > 0 ? "filled" : ""}`}>{count}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
