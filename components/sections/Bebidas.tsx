"use client";
import { DrinkIllus } from "@/components/ui/Illus";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { fmt } from "@/lib/utils";
import type { Bebida } from "@/types";

export function Bebidas({ bebidas }: { bebidas: Bebida[] }) {
  const { items, add } = useCart();
  const toast = useToast();
  if (bebidas.length === 0) return null;

  const qtyOf = (id: string) => items.find((i) => i.key === id && i.type === "bebida")?.qty || 0;

  return (
    <section className="section" id="bebidas">
      <div className="container">
        <div className="section-head" style={{ marginBottom: 30 }}>
          <div>
            <div className="sec-index">03 — Para acompañar</div>
            <h2>Bebidas</h2>
          </div>
        </div>

        <div className="drinks-grid">
          {bebidas.map((bebida) => {
            const qty = qtyOf(bebida.id);
            const agotado = bebida.disponible === false;
            return (
              <article className={`drink-card ${agotado ? "is-agotado" : ""}`} key={bebida.id}>
                <div className="drink-media">
                  <DrinkIllus id={bebida.id} label={bebida.nombre} />
                  {agotado && <div className="media-agotado-bar">Agotado</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <h4>{bebida.nombre}</h4>
                  <small>{fmt(bebida.precio)}</small>
                </div>
                {agotado ? (
                  <button className="drink-add drink-add-agotado" disabled aria-disabled="true">
                    Agotado
                  </button>
                ) : (
                  <button
                    className="drink-add"
                    onClick={() => {
                      add({ key: bebida.id, type: "bebida", name: bebida.nombre, price: bebida.precio, qty: 1 });
                      toast(`${bebida.nombre} agregada`);
                    }}
                  >
                    {qty > 0 ? `En el carrito · ${qty}` : "Agregar"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
