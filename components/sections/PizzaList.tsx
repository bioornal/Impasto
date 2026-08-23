"use client";
import { useMemo, useState } from "react";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useTweaks } from "@/components/providers/TweakProvider";
import { fmt } from "@/lib/utils";
import type { Pizza } from "@/types";

const FILTERS: [string, string][] = [
  ["todas", "Todas"],
  ["clasica", "Clásicas"],
  ["gourmet", "Gourmet"],
  ["vegetariana", "Veggie"],
  ["picante", "Picantes"],
];

interface PizzaListProps {
  pizzas: Pizza[];
  onHalf: (pizza: Pizza) => void;
}

export function PizzaList({ pizzas, onHalf }: PizzaListProps) {
  const [cat, setCat] = useState("todas");
  const [q, setQ] = useState("");
  const { tweaks } = useTweaks();
  const { items, add, incKey, decKey } = useCart();
  const toast = useToast();
  const [layout, setLayout] = useState<"mosaico" | "lista">(tweaks.cardStyle === "list" ? "lista" : "mosaico");

  const list = useMemo(() => {
    let result = pizzas;
    if (cat !== "todas") result = result.filter((p) => p.categoria === cat || p.tags.includes(cat));
    if (q.trim()) {
      const needle = q.toLowerCase();
      result = result.filter((p) => `${p.nombre} ${p.desc}`.toLowerCase().includes(needle));
    }
    return result;
  }, [pizzas, cat, q]);

  const qtyOf = (id: string) => items.find((i) => i.key === id && i.type === "pizza")?.qty || 0;

  const addPizza = (pizza: Pizza) => {
    add({ key: pizza.id, type: "pizza", name: pizza.nombre, price: pizza.precio, illus: pizza.id, qty: 1 });
    toast(`${pizza.nombre} agregada`);
  };

  const emptyState = (
    <p className="empty-state">Sin resultados — probá con otro filtro o buscá otro ingrediente.</p>
  );

  return (
    <section className="menu" id="pizzas">
      <div className="container">
        <div className="section-head" style={{ marginBottom: 26 }}>
          <div style={{ maxWidth: "56%" }}>
            <div className="sec-index">01 — La carta</div>
            <h2>Pizzas híbridas</h2>
          </div>
          <p>Todas en molde de 32 cm, ocho porciones. Podés pedir cualquiera mitad y mitad sin costo extra.</p>
        </div>
      </div>

      <div className="menubar">
        <div className="container menubar-inner">
          <div className="chips">
            {FILTERS.map(([key, label]) => (
              <button key={key} className={`chip ${cat === key ? "active" : ""}`} onClick={() => setCat(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input placeholder="Buscar ingrediente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ingrediente" />
          </div>

          <div className="menubar-right">
            <span className="result-count">{list.length} de {pizzas.length}</span>
            <div className="segmented">
              <button className={`seg ${layout === "mosaico" ? "active" : ""}`} onClick={() => setLayout("mosaico")}>Mosaico</button>
              <button className={`seg ${layout === "lista" ? "active" : ""}`} onClick={() => setLayout("lista")}>Lista</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container menu-body">
        {list.length === 0 ? emptyState : layout === "mosaico" ? (
          <div className="menu-grid">
            {list.map((pizza, index) => {
              const qty = qtyOf(pizza.id);
              const wide = index === 0 && cat === "todas" && !q.trim();
              const agotado = pizza.disponible === false;
              return (
                <article className={`p-card ${wide ? "wide" : ""} ${agotado ? "is-agotado" : ""}`} key={pizza.id}>
                  <div className="p-media">
                    <PizzaIllus id={pizza.id} />
                    {agotado && <div className="media-agotado-bar">Agotado</div>}
                    <div className="p-badges">
                      {pizza.popular && !agotado && <span className="p-badge top">★ Más pedida</span>}
                      {pizza.tags.includes("vegetariana") && <span className="p-badge veg">Veggie</span>}
                      {pizza.tags.includes("picante") && <span className="p-badge hot">Picante</span>}
                    </div>
                    <span className="p-price">{fmt(pizza.precio)}</span>
                  </div>
                  <div className="p-body">
                    <div className="p-title">
                      <h3>{pizza.nombre}</h3>
                      {pizza.badge && <span className={`p-badge-tag c-${pizza.badge.color}`}>{pizza.badge.label}</span>}
                    </div>
                    <p className="p-desc">{pizza.desc}</p>
                    <div className="p-actions">
                      {agotado ? (
                        <>
                          <button className="p-add p-add-agotado" disabled aria-disabled="true">Agotado</button>
                          <button className="p-half" disabled title="No disponible actualmente" aria-disabled="true">½½</button>
                        </>
                      ) : qty > 0 ? (
                        <>
                          <div className="p-stepper">
                            <button onClick={() => decKey(pizza.id)} aria-label={`Quitar una ${pizza.nombre}`}>−</button>
                            <span>{qty} en el carrito</span>
                            <button onClick={() => incKey(pizza.id)} aria-label={`Sumar una ${pizza.nombre}`}>+</button>
                          </div>
                          <button className="p-half" title="Mitad y mitad" onClick={() => onHalf(pizza)}>½½</button>
                        </>
                      ) : (
                        <>
                          <button className="p-add" onClick={() => addPizza(pizza)}>Agregar</button>
                          <button className="p-half" title="Mitad y mitad" onClick={() => onHalf(pizza)}>½½</button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="menu-list">
            {list.map((pizza) => {
              const qty = qtyOf(pizza.id);
              const agotado = pizza.disponible === false;
              return (
                <div className={`lrow ${agotado ? "is-agotado" : ""}`} key={pizza.id}>
                  <div className="lrow-media">
                    <PizzaIllus id={pizza.id} />
                    {agotado && <div className="media-agotado-bar">Agotado</div>}
                  </div>
                  <div className="lrow-main">
                    <div className="lrow-title">
                      <h3>{pizza.nombre}</h3>
                      {pizza.popular && !agotado && <span className="lrow-flag">Más pedida</span>}
                      <span className="leader" />
                      <b className="lrow-price">{fmt(pizza.precio)}</b>
                    </div>
                    <p>{pizza.desc}</p>
                  </div>
                  <div className="lrow-actions">
                    <button className="btn btn-light btn-sm" disabled={agotado} onClick={() => !agotado && onHalf(pizza)} title={agotado ? "No disponible" : "Mitad y mitad"}>½½</button>
                    <button className={`btn btn-sm ${agotado ? "btn-disabled" : "btn-primary"}`} disabled={agotado} onClick={() => !agotado && addPizza(pizza)}>
                      {agotado ? "Agotado" : qty > 0 ? `Agregada · ${qty}` : "Agregar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
