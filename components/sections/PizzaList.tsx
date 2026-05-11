"use client";
import { useState, useMemo } from "react";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { useCart } from "@/components/providers/CartProvider";
import { useTweaks } from "@/components/providers/TweakProvider";
import { fmt } from "@/lib/utils";
import type { Pizza } from "@/types";

const filters: [string, string][] = [
  ["todas", "Todas"], ["clasica", "Clásicas"], ["gourmet", "Gourmet"],
  ["vegetariana", "Vegetarianas"], ["picante", "Picantes"],
];

interface PizzaListProps {
  pizzas: Pizza[];
  onPick: (pizza: Pizza, mode: "full" | "half") => void;
}

export function PizzaList({ pizzas, onPick }: PizzaListProps) {
  const [cat, setCat] = useState("todas");
  const [q, setQ] = useState("");
  const { tweaks } = useTweaks();
  void useCart();

  const items = useMemo(() => {
    let list = pizzas;
    if (cat !== "todas") list = list.filter((p) => p.categoria === cat || p.tags.includes(cat));
    if (q.trim()) list = list.filter((p) => (p.nombre + " " + p.desc).toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [cat, q, pizzas]);

  const gridClass = tweaks.cardStyle === "compact" ? "grid compact" : tweaks.cardStyle === "list" ? "grid list" : "grid";
  const cardClass = tweaks.cardStyle === "compact" ? "card compact" : tweaks.cardStyle === "list" ? "card list-card" : "card";

  return (
    <section className="section" id="pizzas">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Nuestra carta</div>
            <h2>Nuestras pizzas híbridas</h2>
          </div>
          <p>Fermentación lenta de 48 hs, borde aireado y base crocante. Mucho queso y toppings generosos, al gusto argentino.</p>
        </div>
        <div className="filters">
          {filters.map(([k, l]) => (
            <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k)}>{l}</button>
          ))}
          <div className="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input placeholder="Buscar ingrediente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className={gridClass}>
          {items.map((p) => (
            <div className={cardClass} key={p.id}>
              <div className="card-media">
                <PizzaIllus id={p.id} />
              </div>
              <div className="card-body">
                <div className="card-title">
                  <h3>{p.nombre}</h3>
                  <span className="price">{fmt(p.precio)}</span>
                </div>
                <p className="card-desc">{p.desc}</p>
                <div className="card-tags">
                  {p.popular && <span className="tag hot">★ Popular</span>}
                  {p.tags.includes("gourmet") && <span className="tag gourmet">Gourmet</span>}
                  {p.tags.includes("vegetariana") && <span className="tag veg">Vegetariana</span>}
                  {p.tags.includes("picante") && <span className="tag hot">Picante</span>}
                </div>
                <div className="card-actions">
                  <button className="btn btn-primary btn-sm btn-block" onClick={() => onPick(p, "full")}>Agregar</button>
                  <button className="btn btn-light btn-sm" onClick={() => onPick(p, "half")} title="Mitad y mitad">½ ½</button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", padding: "40px" }}>
              Sin resultados — probá con otro filtro.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
