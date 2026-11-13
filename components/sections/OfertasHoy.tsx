"use client";
import { useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { lineaDeBebida, lineaDePizza } from "@/lib/ficha";
import { fmt } from "@/lib/utils";
import type { Oferta } from "@/lib/promos";
import type { CartItem } from "@/types";

type Vendible = { id: string; nombre: string; precio: number; tipo: "pizza" | "bebida"; foto?: string };

/** Qué incluye, dicho como lo diría el mozo: "2 Muzzarella Impasto", "1 especial a elección". */
function incluye(o: Oferta & { tipo: "combo" }, nombre: (id: string) => string) {
  return o.config.lugares.map(l => `${l.cantidad} ${l.productos.length > 1 ? (l.etiqueta || "a elección") : nombre(l.productos[0])}`).join(" + ");
}

function TarjetaOferta({ oferta, vendibles, onNav, onAdded }: { oferta: Oferta; vendibles: Map<string, Vendible>; onNav: (s: string) => void; onAdded: () => void }) {
  const { addCombo } = useCart();
  const nombre = (id: string) => vendibles.get(id)?.nombre ?? "producto";
  const lugares = oferta.tipo === "combo" ? oferta.config.lugares.map(l => ({ ...l, opciones: l.productos.filter(id => vendibles.has(id)) })) : [];
  const [eleccion, setEleccion] = useState<Record<number, string>>(() => Object.fromEntries(lugares.map((l, i) => [i, l.opciones[0] ?? ""])));
  const completo = oferta.tipo !== "combo" || lugares.every((l, i) => l.opciones.length > 0 && eleccion[i]);
  const lista = oferta.tipo === "combo" ? lugares.reduce((s, l, i) => s + l.cantidad * (vendibles.get(eleccion[i])?.precio ?? 0), 0) : 0;
  // Sin imagen propia, la foto del primer producto de la promo (la pizza del combo o la primera bebida del regalo).
  const primero = oferta.tipo === "combo" ? lugares[0]?.opciones[0] : oferta.tipo === "regalo" ? oferta.config.opciones.find(op => vendibles.has(op.producto))?.producto : undefined;
  const imagen = oferta.imagen || (primero ? vendibles.get(primero)?.foto : undefined);

  const agregar = () => {
    if (oferta.tipo !== "combo" || !completo) return;
    const productos: Omit<CartItem, "cartId">[] = lugares.map((l, i) => {
      const v = vendibles.get(eleccion[i])!;
      return { ...(v.tipo === "pizza" ? lineaDePizza(v) : lineaDeBebida(v)), qty: l.cantidad };
    });
    if (addCombo(productos, oferta.id)) onAdded();
  };

  return (
    <article className="oferta-hoy">
      {imagen && <div className="oferta-hoy-media"><img src={imagen} alt="" loading="lazy" /></div>}
      <div className="oferta-hoy-cuerpo">
        <h3>{oferta.titulo || oferta.nombre}</h3>

        {oferta.tipo === "combo" && (
          <>
            <p className="oferta-hoy-incluye">{incluye(oferta, nombre)}</p>
            <p className="oferta-hoy-precio">
              <b>{fmt(oferta.config.precio)}</b>
              {lista > oferta.config.precio && <s aria-label={`Antes ${fmt(lista)}`}>{fmt(lista)}</s>}
            </p>
          </>
        )}
        {oferta.tipo === "regalo" && (
          <p className="oferta-hoy-precio"><b>Bebida gratis</b><span>la que elijas, al llevar {oferta.config.minimoPizzas} pizzas</span></p>
        )}
        {oferta.tipo === "descuento_cantidad" && (
          <p className="oferta-hoy-precio"><b>{oferta.config.porcentaje} % menos</b><span>en la {oferta.config.cada}ª pizza</span></p>
        )}

        {oferta.descripcion && <p className="oferta-hoy-desc">{oferta.descripcion}</p>}

        {oferta.tipo === "combo" && lugares.map((l, i) => l.opciones.length > 1 && (
          <label className="oferta-hoy-eleccion" key={i}>
            <span>{l.etiqueta || "Elegí"}</span>
            <select value={eleccion[i]} onChange={e => setEleccion({ ...eleccion, [i]: e.target.value })}>
              {l.opciones.map(id => <option key={id} value={id}>{nombre(id)}</option>)}
            </select>
          </label>
        ))}

        {oferta.tipo === "combo"
          ? <button className="btn btn-dark oferta-hoy-cta" disabled={!completo} onClick={agregar}>{completo ? "Agregar al pedido" : "Hoy no disponible"}</button>
          : <button className="btn btn-dark oferta-hoy-cta" onClick={() => onNav("pizzas")}>Elegir pizzas</button>}
        {oferta.tipo !== "combo" && <p className="oferta-hoy-nota">Se aplica sola cuando sumás las pizzas.</p>}
      </div>
    </article>
  );
}

/** Promos aprobadas del día (tabla `ofertas`). Sin promos vigentes no se muestra nada. */
export function OfertasHoy({ onNav, onAdded }: { onNav: (s: string) => void; onAdded: () => void }) {
  const { ofertas, catalogo } = useCart();
  if (!ofertas.length) return null;
  const vendibles = new Map<string, Vendible>([
    ...catalogo.pizzas.filter(p => p.disponible).map(p => [p.id, { id: p.id, nombre: p.nombre, precio: p.precio, tipo: "pizza" as const, foto: p.foto }] as const),
    ...catalogo.bebidas.filter(b => b.disponible && b.stockUnidades !== 0).map(b => [b.id, { id: b.id, nombre: b.nombre, precio: b.precio, tipo: "bebida" as const, foto: b.foto }] as const),
  ]);
  return (
    <section className="ofertas-hoy-wrap" aria-labelledby="ofertas-hoy-titulo">
      <div className="container">
        <div className="ofertas-hoy-head">
          <h2 id="ofertas-hoy-titulo">Promos de hoy</h2>
          <p>Una por pedido. Te la aplicamos en el carrito.</p>
        </div>
        <div className={`ofertas-hoy-grid ${ofertas.length === 1 ? "una" : ""}`}>
          {ofertas.map(o => <TarjetaOferta key={o.id} oferta={o} vendibles={vendibles} onNav={onNav} onAdded={onAdded} />)}
        </div>
      </div>
    </section>
  );
}
