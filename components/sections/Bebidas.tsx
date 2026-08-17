"use client";
import { useCart } from "@/components/providers/CartProvider";
import { fmt } from "@/lib/utils";
import type { Bebida } from "@/types";

export function Bebidas({ bebidas }: { bebidas: Bebida[] }) {
  const { add } = useCart();
  if (bebidas.length === 0) return null;
  return (
    <section className="section" id="bebidas">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Para acompañar</div>
            <h2>Bebidas</h2>
          </div>
        </div>
        <div className="grid">
          {bebidas.map((b) => (
            <div className="card" key={b.id}>
              <div className="card-media">
                <div className="drink-illus" style={{ position: "absolute", inset: 0 }}>
                  <span>{b.nombre.split(" ")[0]}</span>
                </div>
              </div>
              <div className="card-body">
                <div className="card-title">
                  <h3>{b.nombre}</h3>
                  <span className="price">{fmt(b.precio)}</span>
                </div>
                <div className="card-actions">
                  <button className="btn btn-light btn-sm btn-block" onClick={() => add({ key: b.id, type: "bebida", name: b.nombre, price: b.precio, qty: 1 })}>
                    Agregar al carrito
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
