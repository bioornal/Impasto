"use client";
import { useState } from "react";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { fmt } from "@/lib/utils";
import type { BusinessConfig } from "@/lib/business";
import type { Pizza } from "@/types";

interface HalfModalProps {
  startPizza?: Pizza | null;
  pizzas: Pizza[];
  business: BusinessConfig;
  onClose: () => void;
}

export function HalfModal({ startPizza, pizzas, business, onClose }: HalfModalProps) {
  const { add } = useCart();
  const toast = useToast();
  const [leftId, setLeftId] = useState(startPizza?.id || pizzas[0]?.id || "");
  const [rightId, setRightId] = useState(() => {
    const fallback = pizzas.find((p) => p.id !== (startPizza?.id || pizzas[0]?.id));
    return fallback?.id || pizzas[0]?.id || "";
  });
  const [side, setSide] = useState<"a" | "b">("a");
  const [borde, setBorde] = useState(false);

  const left = pizzas.find((p) => p.id === leftId) || pizzas[0];
  const right = pizzas.find((p) => p.id === rightId) || pizzas[1] || pizzas[0];
  if (!left || !right) return null;

  const price = Math.max(left.precio, right.precio) + (borde ? business.bordeFee : 0);

  const choose = (pizza: Pizza) => {
    if (side === "a") { setLeftId(pizza.id); setSide("b"); }
    else setRightId(pizza.id);
  };

  const confirm = () => {
    add({
      key: `half-${left.id}-${right.id}${borde ? "-borde" : ""}`,
      unique: true,
      type: "pizza-half",
      name: `Mitad ${left.nombre} / Mitad ${right.nombre}`,
      detail: borde ? "Mitad y mitad · borde relleno con muzzarella" : "Pizza mitad y mitad",
      price,
      qty: 1,
      illus: left.id,
      variant: { kind: "half", ids: [left.id, right.id], borde },
    });
    toast("Mitad y mitad agregada");
    onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="half-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pizza mitad y mitad">
        <div className="half-left">
          <div>
            <div className="kicker">Mitad y mitad</div>
            <h3>Dos gustos,<br />una pizza</h3>
            <p className="lede">Tocá una mitad y elegí la variedad. Se cobra el precio de la más cara, sin recargo.</p>
          </div>

          <div className="half-wheel">
            <button className={`half-side ${side === "a" ? "on" : ""}`} onClick={() => setSide("a")}>
              <PizzaIllus id={left.id} />
              <span className="half-side-label">
                <small>Mitad A</small>
                <b>{left.nombre}</b>
              </span>
            </button>
            <button className={`half-side ${side === "b" ? "on" : ""}`} onClick={() => setSide("b")}>
              <PizzaIllus id={right.id} />
              <span className="half-side-label">
                <small>Mitad B</small>
                <b>{right.nombre}</b>
              </span>
            </button>
            <span className="half-divider" />
          </div>

          <div className="half-total">
            <span className="mono">Total</span>
            <b>{fmt(price)}</b>
          </div>
        </div>

        <div className="half-right">
          <div className="half-right-head">
            <div>
              <span className="mono">Estás eligiendo</span>
              <b>{side === "a" ? "Mitad A · izquierda" : "Mitad B · derecha"}</b>
            </div>
            <button className="drawer-close" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>

          <div className="half-tabs">
            <button className={`tab ${side === "a" ? "on" : ""}`} onClick={() => setSide("a")}>Mitad A</button>
            <button className={`tab ${side === "b" ? "on" : ""}`} onClick={() => setSide("b")}>Mitad B</button>
          </div>

          <div className="half-options">
            {pizzas.map((pizza) => {
              const active = side === "a" ? leftId === pizza.id : rightId === pizza.id;
              return (
                <button className={`half-opt ${active ? "on" : ""}`} key={pizza.id} onClick={() => choose(pizza)}>
                  <span style={{ minWidth: 0 }}>
                    <b>{pizza.nombre}</b>
                    <small>{pizza.desc.split(",").slice(0, 2).join(", ")}</small>
                  </span>
                  <span className="price">{fmt(pizza.precio)}</span>
                </button>
              );
            })}
          </div>

          <button className={`borde-row ${borde ? "on" : ""}`} onClick={() => setBorde((b) => !b)} aria-pressed={borde}>
            <span className="borde-box">✓</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <b>Borde relleno con muzzarella</b>
              <small>Se rellena el cornicione entero</small>
            </span>
            <span className="price">+{fmt(business.bordeFee)}</span>
          </button>

          <button className="half-cta" onClick={confirm}>Agregar al carrito · {fmt(price)}</button>
        </div>
      </div>
    </div>
  );
}
