"use client";
import { useCart } from "@/components/providers/CartProvider";

function Topbar() {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <div><span className="dot" />Abierto hoy · 19:30 a 00:00</div>
        <div className="topbar-links">
          <span>Neuquén Capital</span>
          <span>(0299) 555-0184</span>
          <span>WhatsApp</span>
        </div>
      </div>
    </div>
  );
}

interface HeaderProps {
  onCartClick: () => void;
  onNav: (n: string) => void;
  current: string;
}

export function Header({ onCartClick, onNav, current }: HeaderProps) {
  const { count } = useCart();
  return (
    <>
      <Topbar />
      <header className="header">
        <div className="container header-inner">
          <button className="logo" onClick={() => onNav("home")} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <div className="logo-mark">I</div>
            <div>Impasto<small>pizza híbrida · neuquén</small></div>
          </button>
          <nav className="nav">
            {["home", "pizzas", "empanadas", "bebidas"].map((n) => (
              <button key={n} className={current === n ? "active" : ""} onClick={() => onNav(n)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                {n === "home" ? "Inicio" : n.charAt(0).toUpperCase() + n.slice(1)}
              </button>
            ))}
            <button onClick={() => onNav("home")} style={{ background: "none", border: "none", cursor: "pointer" }}>Nosotros</button>
          </nav>
          <div className="header-actions">
            <button className="icon-btn" aria-label="Buscar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
            <button className="icon-btn" onClick={onCartClick} aria-label="Carrito">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              {count > 0 && <span className="cart-count">{count}</span>}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
