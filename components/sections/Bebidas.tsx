"use client";
import { DrinkIllus } from "@/components/ui/Illus";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { fmt } from "@/lib/utils";
import { esMobile, lineaDeBebida } from "@/lib/ficha";
import type { Bebida } from "@/types";

export function Bebidas({ bebidas, onVerFicha, indice = "03" }: { indice?: string; bebidas: Bebida[]; onVerFicha: (ids: string[], indice: number) => void }) {
  const { items, add, incKey, decKey } = useCart();
  const toast = useToast();
  if (bebidas.length === 0) return null;

  const qtyOf = (id: string) => items.find((i) => i.key === id && i.type === "bebida")?.qty || 0;
  const agregar = (bebida: Bebida) => {
    add(lineaDeBebida(bebida));
    toast(`${bebida.nombre} agregada`);
  };
  const verFicha = (id: string) => onVerFicha(bebidas.map((b) => b.id), bebidas.findIndex((b) => b.id === id));

  return (
    <section className="section" id="bebidas">
      <div className="container">
        <div className="section-head" style={{ marginBottom: 30 }}>
          <div>
            <div className="sec-index">{indice} — Para acompañar</div>
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
                  <DrinkIllus id={bebida.id} label={bebida.nombre} name={bebida.nombre} src={bebida.foto} />
                  <button type="button" className="media-zoom" onClick={() => verFicha(bebida.id)} aria-label={`Ver ${bebida.nombre} en grande`} />
                  {agotado && <div className="media-agotado-bar">Agotado</div>}
                </div>
                {/* Mobile: la miniatura es chica, así que el nombre también abre la ficha. */}
                <div style={{ flex: 1 }} onClick={() => esMobile() && verFicha(bebida.id)}>
                  <h4>{bebida.nombre}</h4>
                  <small>{fmt(bebida.precio)}</small>
                </div>
                {agotado ? (
                  <button className="drink-add drink-add-agotado" disabled aria-disabled="true">
                    Agotado
                  </button>
                ) : (
                  <button className="drink-add" onClick={() => agregar(bebida)}>
                    {qty > 0 ? `En el carrito · ${qty}` : "Agregar"}
                  </button>
                )}
                {/* Mobile: la fila lleva el mismo + / − n + que las pizzas (estilos .p-row-*). */}
                <div className="drink-side">
                  {agotado ? (
                    <button className="p-row-add" disabled aria-label={`${bebida.nombre} agotada`}>+</button>
                  ) : qty > 0 ? (
                    <div className="p-row-step">
                      <button onClick={() => decKey(bebida.id)} aria-label={`Quitar una ${bebida.nombre}`}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => incKey(bebida.id)} aria-label={`Sumar una ${bebida.nombre}`}>+</button>
                    </div>
                  ) : (
                    <button className="p-row-add" onClick={() => agregar(bebida)} aria-label={`Agregar ${bebida.nombre}`}>+</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
