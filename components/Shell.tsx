"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { CartProvider, useCart } from "@/components/providers/CartProvider";
import { TweakProvider, useTweaks } from "@/components/providers/TweakProvider";
import { ToastProvider, useToast } from "@/components/providers/ToastProvider";
import { StoreStatusProvider, type EstadoTiendaCliente } from "@/components/providers/StoreStatusProvider";
import { Header, Ticker } from "@/components/layout/Header";
import { precioDesde } from "@/lib/reglas-carta";
import { fmt } from "@/lib/utils";
import { Footer } from "@/components/layout/Footer";
import { Hero, Features } from "@/components/sections/Hero";
import { Promos } from "@/components/sections/Promos";
import { PizzaList } from "@/components/sections/PizzaList";
import { EmpanadasSection } from "@/components/sections/EmpanadasSection";
import { Bebidas } from "@/components/sections/Bebidas";
import { PedidoWhatsapp } from "@/components/sections/PedidoWhatsapp";
import { Story } from "@/components/sections/Story";
import { Reviews } from "@/components/sections/Reviews";
import { Faq } from "@/components/sections/Faq";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { HalfModal } from "@/components/cart/HalfModal";
import { Checkout } from "@/components/checkout/Checkout";
import { Confirmation } from "@/components/checkout/Confirmation";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ActiveOrderBanner } from "@/components/layout/ActiveOrderBanner";
import type { BusinessConfig } from "@/lib/business";
import type { CheckoutOrder } from "@/components/checkout/Checkout";
import type { CardFormData } from "@/components/checkout/CardPayment";
import type { CatalogData, Pizza, CartItem } from "@/types";
import { STOCK_IMAGES } from "@/lib/stock-images";
import {
  clearCardAttemptReference,
  createCardAttemptReference,
  getOrCreateCardAttemptReference,
  shouldConfirmPendingCardAttempt,
} from "@/lib/card-attempt";

/** Mismo corte que `@media (max-width:760px)` en impasto.css. */
const esMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;

interface ConfirmedOrder {
  numero: string; nombre: string; mode: string; dir?: string;
  tel: string; total: number; pago: string; estadoPago?: string;
  items: CartItem[]; subtotal: number; shipping: number; fecha: Date;
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

function SiteContent({ data, business, chatDisponible, destacadaId }: { data: CatalogData; business: BusinessConfig; chatDisponible: boolean; destacadaId?: string }) {
  const { paletteClass, typeClass } = useTweaks();
  const { add, clear, subtotal, count } = useCart();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [halfOpen, setHalfOpen] = useState(false);
  const [halfStart, setHalfStart] = useState<Pizza | null>(null);
  const [screen, setScreen] = useState<"home" | "checkout" | "confirm">("home");
  const [nav, setNav] = useState("home");
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);
  const lastCardRef = useRef<string>("");

  const cardReference = () => {
    try {
      const reference = getOrCreateCardAttemptReference(sessionStorage);
      lastCardRef.current = reference;
      return reference;
    } catch {
      if (!lastCardRef.current) lastCardRef.current = createCardAttemptReference();
      return lastCardRef.current;
    }
  };

  const clearCardReference = (expected: string) => {
    try { clearCardAttemptReference(sessionStorage, expected); } catch {}
    if (lastCardRef.current === expected) lastCardRef.current = "";
  };

  // Mobile: búsqueda, sección activa, colapso del header y caja de empanadas.
  // La búsqueda mobile tiene su propio texto: no filtra la carta, lleva a la pizza.
  const [qBusqueda, setQBusqueda] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [focoPizza, setFocoPizza] = useState<{ id: string; vez: number } | null>(null);
  const navegando = useRef(false);
  const plazoNavegacion = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focoVez = useRef(0);
  const dockRef = useRef<HTMLElement>(null);
  const [seccionActiva, setSeccionActiva] = useState("");
  const [headerOculto, setHeaderOculto] = useState(false);
  const [empSelection, setEmpSelection] = useState<Record<string, number>>({});
  const [empTier, setEmpTier] = useState<6 | 12 | 24>(12);
  const [cajaExpandida, setCajaExpandida] = useState(false);

  const desde = precioDesde(data.pizzas);
  const featured = data.pizzas.find((p) => p.disponible !== false && p.id === STOCK_IMAGES.hero.productoId)
    || data.pizzas.find((p) => p.disponible !== false && p.popular && p.categoria === "gourmet")
    || data.pizzas.find((p) => p.disponible !== false && p.popular)
    || data.pizzas.find((p) => p.disponible !== false)
    || data.pizzas[0];

  // Mientras dura un scroll programado el header mobile se queda visible: si se
  // escondiera por bajar, dejaría un hueco de 56px arriba del destino. `scrollend`
  // libera antes; el plazo cubre a los navegadores que no lo tienen.
  const scrollMobile = (top: number) => {
    navegando.current = true;
    clearTimeout(plazoNavegacion.current);
    plazoNavegacion.current = setTimeout(() => { navegando.current = false; }, 1500);
    setHeaderOculto(false);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const goSection = (section: string) => {
    setNav(section);
    setDrawerOpen(false);
    setTimeout(() => {
      if (section === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      const el = document.getElementById(section);
      if (!el) return;
      if (esMobile()) scrollMobile(el.getBoundingClientRect().top + window.scrollY - 56);
      else window.scrollTo({ top: el.offsetTop - 130, behavior: "smooth" });
    }, 50);
  };

  // Sección activa derivada por IntersectionObserver (nunca scrollIntoView).
  useEffect(() => {
    const ids = ["pizzas", "empanadas", "bebidas"];
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        if (visible.size === 0) { setSeccionActiva(""); return; }
        // Activa = la sección con el borde superior más alto dentro de la banda.
        let best = "";
        let bestTop = Infinity;
        for (const id of visible) {
          const el = document.getElementById(id);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top < bestTop) { bestTop = top; best = id; }
        }
        setSeccionActiva(best);
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  // Dirección del scroll (solo mobile): colapsa el header al bajar, vuelve al subir.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (navegando.current) { lastY = y; return; }
      const delta = y - lastY;
      if (Math.abs(delta) < 6) return;
      setHeaderOculto(esMobile() && delta > 0 && y > 120);
      lastY = y;
    };
    const onScrollEnd = () => { navegando.current = false; lastY = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", onScrollEnd);
    };
  }, []);

  // Alto real de la barra de abajo, para que el FAB del chat y el aviso queden
  // siempre por encima: cambia con «Ver mi pedido» y con «Tu caja».
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty("--dock-h", `${Math.round(dock.getBoundingClientRect().height)}px`);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(dock);
    return () => { observer.disconnect(); raiz.style.removeProperty("--dock-h"); };
  }, []);

  // Caja de empanadas (estado único compartido por grilla, aside y dock).
  const hasUnitPrices = data.empanadas.some((e) => Number(e.precio) > 0);
  const empPriceFor = (size: 6 | 12 | 24, current: Record<string, number>) => {
    if (!hasUnitPrices) return data.empanadaBoxPrices[size];
    return Object.entries(current).reduce((sum, [id, amount]) => {
      const empanada = data.empanadas.find((e) => e.id === id);
      return sum + Number(empanada?.precio || 0) * amount;
    }, 0);
  };
  const empSelected = Object.values(empSelection).reduce((a, b) => a + b, 0);
  const empComplete = empSelected === empTier;
  const empLines = Object.entries(empSelection).filter(([, n]) => n > 0);
  const empanadaName = (id: string) => data.empanadas.find((e) => e.id === id)?.nombre || id;

  const empPick = (id: string, delta: number) =>
    setEmpSelection((prev) => {
      if (delta > 0 && Object.values(prev).reduce((a, b) => a + b, 0) >= empTier) return prev;
      const next = { ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });

  const empChangeTier = (next: 6 | 12 | 24) => { setEmpTier(next); setEmpSelection({}); };

  const empAddBox = () => {
    if (!empComplete) return;
    const detail = Object.entries(empSelection)
      .map(([id, n]) => `${n}× ${empanadaName(id)}`)
      .join(", ");
    add({
      key: `emp-${empTier}-${Object.keys(empSelection).sort().join("-")}`,
      unique: true,
      type: "empanadas",
      name: `Caja de ${empTier} empanadas`,
      detail,
      price: empPriceFor(empTier, empSelection),
      qty: 1,
      variant: { kind: "empanadas-box", size: empTier, selections: empSelection },
    });
    setEmpSelection({});
    setCajaExpandida(false);
    toast(`Caja de ${empTier} agregada`);
    // En mobile se vuelve a la carta; en escritorio se queda donde está, como siempre.
    if (esMobile()) goSection("pizzas");
  };

  const searchResults = useMemo(() => {
    if (!qBusqueda.trim()) return data.pizzas;
    const needle = qBusqueda.toLowerCase();
    return data.pizzas.filter((p) => `${p.nombre} ${p.desc}`.toLowerCase().includes(needle));
  }, [qBusqueda, data.pizzas]);

  const cerrarBusqueda = () => { setSearchOpen(false); setQBusqueda(""); };

  // Elegir un resultado lleva a esa pizza en la carta (sin filtros) y la resalta.
  const irAPizza = (id: string) => {
    cerrarBusqueda();
    const vez = ++focoVez.current;
    setFocoPizza({ id, vez });
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-pizza="${CSS.escape(id)}"]`);
      if (!el) return;
      const rail = document.querySelector(".menubar")?.getBoundingClientRect().height ?? 0;
      scrollMobile(el.getBoundingClientRect().top + window.scrollY - 56 - rail - 12);
    }, 80);
    setTimeout(() => setFocoPizza((actual) => (actual?.vez === vez ? null : actual)), 2400);
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

  const dockTabs = [
    { key: "pizzas", label: "Pizzas", conteo: String(data.pizzas.length) },
    { key: "empanadas", label: "Empanadas", conteo: String(data.empanadas.length) },
    { key: "bebidas", label: "Bebidas", conteo: String(data.bebidas.length) },
  ];

  return (
    <div className={`app ${paletteClass} ${typeClass} ${headerOculto ? "header-collapsed" : ""}`}>
      <ActiveOrderBanner />
      <Header
        onCartClick={() => setDrawerOpen(true)}
        onNav={goSection}
        onSearch={() => (esMobile() ? setSearchOpen(true) : goSection("pizzas"))}
        current={nav}
        business={business}
        sections={sections}
        oculto={headerOculto}
      />
      <Ticker desde={desde} />
      {(data.preciosNoDisponibles?.length ?? 0) > 0 && (
        <p role="status" style={{ textAlign: "center", padding: "10px 16px", background: "#fff3db", color: "#60420a" }}>
          Algunos productos no están disponibles temporalmente por su precio. Podés pedir los demás.
        </p>
      )}

      <main>
        <Hero onCta={goSection} onHalf={() => openHalf()} featured={featured} varieties={data.pizzas.length} />
        <Features freeShippingFrom={business.freeShippingFrom} desde={desde} />
        <Promos promos={data.promos} onNav={goSection} />
        <PizzaList pizzas={data.pizzas} onHalf={openHalf} destacadaId={destacadaId} foco={focoPizza} />
        <EmpanadasSection
          empanadas={data.empanadas}
          boxPrices={data.empanadaBoxPrices}
          selection={empSelection}
          tier={empTier}
          onPick={empPick}
          onChangeTier={empChangeTier}
          onAddBox={empAddBox}
          priceFor={empPriceFor}
        />
        <Bebidas bebidas={data.bebidas} />
        <PedidoWhatsapp business={business} />
        <Story onCta={goSection} />
        <Reviews reviews={data.reviews} business={business} />
        <Faq business={business} />
      </main>

      <Footer business={business} />

      {/* Barra inferior fija: secciones + barra de pedido / «Tu caja». */}
      <nav className="dock" aria-label="Navegación de secciones" ref={dockRef}>
        {count > 0 && seccionActiva !== "empanadas" && (
          <button className="dock-order" onClick={() => setDrawerOpen(true)}>
            <span className="dock-order-count">{count}</span>
            <span className="dock-order-main">
              <b>Ver mi pedido</b>
              <small>Entrega {business.deliveryEstimate}</small>
            </span>
            <span className="dock-order-total">{fmt(subtotal)}</span>
          </button>
        )}

        {seccionActiva === "empanadas" && (
          <div className="dock-box">
            <button className="dock-box-top" onClick={() => setCajaExpandida((v) => !v)} aria-expanded={cajaExpandida}>
              <span>{empSelected} de {empTier} elegidas</span>
              <span className={`missing ${empComplete ? "done" : ""}`}>
                {empComplete ? "Caja completa" : `Faltan ${empTier - empSelected}`}
              </span>
            </button>
            <div className="dock-box-track">
              <div className="dock-box-bar" style={{ width: `${Math.min(100, (empSelected / empTier) * 100)}%` }} />
            </div>
            {cajaExpandida && (
              <div className="dock-box-lines">
                {empLines.length === 0 ? (
                  <div className="dock-box-line"><span>Todavía no elegiste gustos</span></div>
                ) : empLines.map(([id, n]) => (
                  <div className="dock-box-line" key={id}><span>{empanadaName(id)}</span><span>×{n}</span></div>
                ))}
              </div>
            )}
            <div className="dock-box-bottom">
              <div className="dock-box-total">
                <div className="dock-box-label">Total caja</div>
                <b>{fmt(empPriceFor(empTier, empSelection))}</b>
              </div>
              <button className={`dock-box-cta ${empComplete ? "ready" : ""}`} disabled={!empComplete} onClick={empAddBox}>
                {empComplete ? "Agregar caja" : `Elegí ${empTier - empSelected} más`}
              </button>
            </div>
          </div>
        )}

        <div className="dock-tabs">
          {dockTabs.map((t) => (
            <button
              key={t.key}
              className={`dock-tab ${seccionActiva === t.key ? "on" : ""}`}
              onClick={() => goSection(t.key)}
            >
              <span>{t.label}</span>
              <span className="count">{t.conteo}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Capa de búsqueda a pantalla completa (mobile). */}
      {searchOpen && (
        <div className="search-overlay" role="dialog" aria-label="Buscar en la carta">
          <div className="search-overlay-top">
            <button className="search-overlay-back" onClick={cerrarBusqueda} aria-label="Cerrar búsqueda">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <div className="search-overlay-field">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input autoFocus placeholder="Buscar ingrediente…" value={qBusqueda} onChange={(e) => setQBusqueda(e.target.value)} aria-label="Buscar ingrediente" />
            </div>
          </div>
          <div className="search-overlay-list">
            {searchResults.length === 0 ? (
              <p className="search-overlay-empty">Sin resultados — probá con otro ingrediente.</p>
            ) : searchResults.map((p) => (
              <button key={p.id} className="search-overlay-item" onClick={() => irAPizza(p.id)}>
                <span className="search-overlay-name">{p.nombre}</span>
                <span className="search-overlay-price">{fmt(p.precio)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCheckout={() => { setDrawerOpen(false); setScreen("checkout"); }}
        onBrowse={() => goSection("pizzas")}
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
          onBack={() => { setScreen("home"); setDrawerOpen(true); }}
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
            try {
              localStorage.setItem("impasto_active_order", JSON.stringify({ ref: result.numero, at: Date.now() }));
            } catch {}
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
            // Se genera y persiste antes del request. Si la respuesta se pierde,
            // el próximo intento recupera el mismo pedido en vez de cobrar otro.
            const externalReference = cardReference();
            const response = await fetch("/api/payments/card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...submitted, ...card, externalReference }),
            });
            const result = await response.json();
            if (shouldConfirmPendingCardAttempt(response.status, result)) {
              clearCardReference(externalReference);
              clear();
              try {
                localStorage.setItem("impasto_active_order", JSON.stringify({ ref: result.numero, at: Date.now() }));
              } catch {}
              setOrder({
                ...submitted,
                numero: result.numero,
                estadoPago: "pendiente",
                items: result.items,
                subtotal: result.subtotal,
                shipping: result.shipping,
                total: result.total,
                fecha: new Date(),
              });
              setScreen("confirm");
              return;
            }
            // Solo un rechazo definitivo habilita un intento nuevo. Los 202,
            // 409 y 5xx conservan la referencia: el cobro anterior podría seguir
            // procesándose y no hay que abrir una segunda operación.
            if (!response.ok || !result.ok) {
              if (response.status === 402) clearCardReference(externalReference);
              throw new Error(result.error || "No se pudo procesar el pago");
            }
            clearCardReference(externalReference);
            clear();
            try {
              localStorage.setItem("impasto_active_order", JSON.stringify({ ref: result.numero, at: Date.now() }));
            } catch {}
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

      <ChatWidget business={business} disponible={chatDisponible} oculto={headerOculto} />
      <TweaksPanel />
    </div>
  );
}

export function Shell({ data, business, estadoInicial, chatDisponible, destacadaId }: { data: CatalogData; business: BusinessConfig; estadoInicial: EstadoTiendaCliente; chatDisponible: boolean; destacadaId?: string }) {
  return (
    <TweakProvider>
      <StoreStatusProvider inicial={estadoInicial}>
        <ToastProvider>
          <CartProvider>
            <SiteContent data={data} business={business} chatDisponible={chatDisponible} destacadaId={destacadaId} />
          </CartProvider>
        </ToastProvider>
      </StoreStatusProvider>
    </TweakProvider>
  );
}
