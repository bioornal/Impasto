"use client";
import { useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { fmt } from "@/lib/utils";
import type { Pizza } from "@/types";

interface HalfModalProps {
  startPizza: Pizza;
  pizzas: Pizza[];
  onClose: () => void;
}

export function HalfModal({ startPizza, pizzas, onClose }: HalfModalProps) {
  const [leftId, setLeftId] = useState(startPizza.id);
  const [rightId, setRightId] = useState(pizzas[1]?.id || pizzas[0].id);
  const { add } = useCart();
  const left = pizzas.find((p) => p.id === leftId)!;
  const right = pizzas.find((p) => p.id === rightId)!;
  const price = Math.max(left.precio, right.precio);

  const confirm = () => {
    add({ key: `half-${leftId}-${rightId}-${Date.now()}`, unique: true, type: "pizza-half", name: `Mitad ${left.nombre} / Mitad ${right.nombre}`, detail: "Pizza mitad y mitad", price, qty: 1, illus: leftId });
    onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Pizza mitad y mitad</h3>
            <p>Elegí dos variedades. Se cobra el precio de la más cara.</p>
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="half-visual">
            <div className="side"><div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.6 }}>MITAD A</div><b>{left.nombre}</b></div></div>
            <div className="side"><div><div style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.6 }}>MITAD B</div><b>{right.nombre}</b></div></div>
          </div>
          <div className="select-half">
            <label>Mitad A</label>
            <select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
              {pizzas.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {fmt(p.precio)}</option>)}
            </select>
          </div>
          <div className="select-half">
            <label>Mitad B</label>
            <select value={rightId} onChange={(e) => setRightId(e.target.value)}>
              {pizzas.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {fmt(p.precio)}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-foot">
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".15em", color: "var(--muted)", textTransform: "uppercase" }}>Total</div>
            <div className="price-final">{fmt(price)}</div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={confirm}>Agregar al carrito</button>
        </div>
      </div>
    </div>
  );
}
