"use client";
import { useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { lineaDeBebida, lineaDePizza } from "@/lib/ficha";
import { fmt } from "@/lib/utils";
import type { Oferta } from "@/lib/promos";
import type { CartItem } from "@/types";

type Vendible = { id: string; nombre: string; precio: number; tipo: "pizza" | "bebida" };

/** Detalle corto y concreto de cada tipo de promo, para la tarjeta del home. */
function bajada(o: Oferta, nombre: (id: string) => string): string {
  if (o.tipo === "combo") return o.config.lugares.map(l => `${l.cantidad} ${l.productos.length > 1 ? (l.etiqueta || "a elección") : nombre(l.productos[0])}`).join(" + ");
  if (o.tipo === "descuento_cantidad") return `Cada ${o.config.cada} pizzas, la más barata con ${o.config.porcentaje} % de descuento.`;
  return `Llevando ${o.config.minimoPizzas} pizzas, elegí tu bebida en el carrito.`;
}

function TarjetaOferta({ oferta, vendibles, onNav, onAdded }: { oferta: Oferta; vendibles: Map<string, Vendible>; onNav: (s: string) => void; onAdded: () => void }) {
  const { addCombo } = useCart();
  const nombre = (id: string) => vendibles.get(id)?.nombre ?? "producto";
  const lugares = oferta.tipo === "combo" ? oferta.config.lugares.map(l => ({ ...l, opciones: l.productos.filter(id => vendibles.has(id)) })) : [];
  const [eleccion, setEleccion] = useState<Record<number, string>>(() => Object.fromEntries(lugares.map((l, i) => [i, l.opciones[0] ?? ""])));
  const completo = oferta.tipo !== "combo" || lugares.every((l, i) => l.opciones.length > 0 && eleccion[i]);
  const agregar = () => {
    if (oferta.tipo !== "combo" || !completo) return;
    const productos: Omit<CartItem, "cartId">[] = lugares.map((l, i) => {
      const v = vendibles.get(eleccion[i])!;
      const linea = v.tipo === "pizza" ? lineaDePizza(v) : lineaDeBebida(v);
      return { ...linea, qty: l.cantidad };
    });
    if (addCombo(productos, oferta.id)) onAdded();
  };
  return (
    <article className="oferta-hoy">
      <span className="promo-kicker">{oferta.tipo === "combo" ? "Combo" : oferta.tipo === "regalo" ? "Regalo" : "Promo"}</span>
      <h4>{oferta.titulo || oferta.nombre}</h4>
      {oferta.descripcion && <p>{oferta.descripcion}</p>}
      <p className="oferta-hoy-detalle">{bajada(oferta, nombre)}</p>
      {oferta.tipo === "combo" && lugares.map((l, i) => l.opciones.length > 1 && (
        <label className="oferta-hoy-eleccion" key={i}>
          <span>{l.etiqueta || "Elegí"}</span>
          <select value={eleccion[i]} onChange={e => setEleccion({ ...eleccion, [i]: e.target.value })}>
            {l.opciones.map(id => <option key={id} value={id}>{nombre(id)}</option>)}
          </select>
        </label>
      ))}
      <div className="promo-foot">
        {oferta.tipo === "combo" ? (
          <>
            <b className="oferta-hoy-precio">{fmt(oferta.config.precio)}</b>
            <button className="btn btn-sm btn-dark" disabled={!completo} onClick={agregar}>{completo ? "Agregar combo" : "Hoy no disponible"}</button>
          </>
        ) : (
          <>
            <small>Se aplica sola en el carrito</small>
            <button className="btn btn-sm btn-dark" onClick={() => onNav("pizzas")}>Ver pizzas</button>
          </>
        )}
      </div>
    </article>
  );
}

/** Promos aprobadas del día (tabla `ofertas`). Sin promos vigentes no se muestra nada. */
export function OfertasHoy({ onNav, onAdded }: { onNav: (s: string) => void; onAdded: () => void }) {
  const { ofertas, catalogo } = useCart();
  if (!ofertas.length) return null;
  const vendibles = new Map<string, Vendible>([
    ...catalogo.pizzas.filter(p => p.disponible).map(p => [p.id, { id: p.id, nombre: p.nombre, precio: p.precio, tipo: "pizza" as const }] as const),
    ...catalogo.bebidas.filter(b => b.disponible && b.stockUnidades !== 0).map(b => [b.id, { id: b.id, nombre: b.nombre, precio: b.precio, tipo: "bebida" as const }] as const),
  ]);
  return (
    <section className="ofertas-hoy-wrap" aria-labelledby="ofertas-hoy-titulo">
      <div className="container">
        <h3 id="ofertas-hoy-titulo" className="ofertas-hoy-titulo">Promos de hoy</h3>
        <div className="ofertas-hoy-grid">
          {ofertas.map(o => <TarjetaOferta key={o.id} oferta={o} vendibles={vendibles} onNav={onNav} onAdded={onAdded} />)}
        </div>
        <p className="ofertas-hoy-nota">Una promo por pedido. La elegís o la cambiás en el carrito.</p>
      </div>
    </section>
  );
}
