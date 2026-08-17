"use client";
import { useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { fmt } from "@/lib/utils";
import type { Empanada } from "@/types";

export function EmpanadasSection({ empanadas, boxPrices }: { empanadas: Empanada[]; boxPrices: Record<6 | 12 | 24, number> }) {
  const { add } = useCart();
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [tier, setTier] = useState(6);
  const totalSelected = Object.values(selection).reduce((a, b) => a + b, 0);
  const hasUnitPrices = empanadas.some((empanada) => Number(empanada.precio) > 0);
  const priceForSelection = (currentSelection: Record<string, number>, size: number) => {
    if (!hasUnitPrices) return boxPrices[size as 6 | 12 | 24];
    return Object.entries(currentSelection).reduce((sum, [id, amount]) => {
      const empanada = empanadas.find((item) => item.id === id);
      return sum + Number(empanada?.precio || 0) * amount;
    }, 0);
  };

  const pick = (id: string, delta: number) =>
    setSelection((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });

  const addDozen = () => {
    if (totalSelected !== tier) {
      alert(`Seleccioná exactamente ${tier} empanadas. Tenés ${totalSelected}.`);
      return;
    }
    const names = Object.entries(selection).map(([id, q]) => {
      const e = empanadas.find((x) => x.id === id);
      return `${q}× ${e?.nombre}`;
    }).join(", ");
    add({
      key: `emp-${tier}-${Object.keys(selection).sort().join("-")}`,
      unique: true,
      type: "empanadas",
      name: `Caja x${tier}`,
      detail: names,
      price: priceForSelection(selection, tier),
      qty: 1,
      variant: { kind: "empanadas-box", size: tier as 6 | 12 | 24, selections: selection },
    });
    setSelection({});
  };

  return (
    <section className="section" id="empanadas" style={{ background: "var(--bg-2)" }}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Recién hechas</div>
            <h2>Empanadas artesanales</h2>
          </div>
          <p>Armá tu caja por 6, 12 o 24. Repulgue a mano y cocción al horno.</p>
        </div>

        <div className="dozen-bar" style={{ marginTop: 0, marginBottom: 24 }}>
          <div>
            <h4>Armá tu caja</h4>
            <small>Elegí cuántas y combiná gustos</small>
          </div>
          <div className="dozen-controls">
            {[6, 12, 24].map((t) => (
              <button key={t} className={`btn btn-sm ${tier === t ? "btn-primary" : "btn-light"}`} onClick={() => { setTier(t); setSelection({}); }}>
                 x{t} · {hasUnitPrices ? "por variedad" : fmt(boxPrices[t as 6 | 12 | 24])}
              </button>
            ))}
          </div>
        </div>

        <div className="emp-grid">
          {empanadas.map((e) => (
            <div className="emp-card" key={e.id}>
              <div className="emp-media">
                <div className="emp-illus" style={{ position: "absolute", inset: 0 }} />
              </div>
              <h4>{e.nombre}</h4>
              <p>{e.desc}</p>
              <div className="card-tags">
                {e.tags.includes("picante") && <span className="tag hot">Picante</span>}
                {e.tags.includes("vegetariana") && <span className="tag veg">Vegetariana</span>}
                {e.tags.includes("dulce") && <span className="tag sweet">Dulce</span>}
              </div>
              <div className="qty" style={{ alignSelf: "flex-start", marginTop: 6 }}>
                <button onClick={() => pick(e.id, -1)}>−</button>
                <span>{selection[e.id] || 0}</span>
                <button onClick={() => pick(e.id, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="dozen-bar">
          <div>
            <h4>Tu caja x{tier}</h4>
            <small>{totalSelected} de {tier} seleccionadas — {fmt(priceForSelection(selection, tier))}</small>
          </div>
          <button className="btn btn-primary" onClick={addDozen} disabled={totalSelected !== tier} style={{ opacity: totalSelected === tier ? 1 : 0.5 }}>
            Agregar al carrito
          </button>
        </div>
      </div>
    </section>
  );
}
