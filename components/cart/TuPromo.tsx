"use client";
import { useId } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { bebidasParaRegalo } from "@/lib/promos-web";
import { fmt } from "@/lib/utils";

/** Comparte elección con el carrito, el checkout y el borrador. */
export function TuPromo() {
  const id = useId();
  const { items, catalogo, promoOpciones, promo, promoAplicada, promoError, setPromo } = useCart();
  if (!promoOpciones.length && !promo) return null;
  const seleccionada = promoOpciones.find(p => p.oferta.id === promo?.ofertaId)?.oferta;
  const bebidas = seleccionada?.tipo === "regalo" ? bebidasParaRegalo(catalogo, items, seleccionada.config.cantidad) : [];
  return (
    <fieldset className="tu-promo">
      <legend>Tu promo</legend>
      <p className="tu-promo-ayuda">Elegí una. Las promos no se acumulan.</p>
      <div className="tu-promo-opciones">
        {promoOpciones.map(({ oferta, resultado }) => (
          <label className={`tu-promo-opcion ${promo?.ofertaId === oferta.id ? "on" : ""}`} key={oferta.id}>
            <input type="radio" name={`promo-${id}`} checked={promo?.ofertaId === oferta.id}
              onChange={() => setPromo({ ofertaId: oferta.id, ...(resultado.regalo ? { regaloProductoId: resultado.regalo.bebida.id } : {}) })} />
            <span><b>{oferta.titulo || oferta.nombre}</b><small>Ahorrás {fmt(resultado.ahorro)}</small></span>
          </label>
        ))}
        <label className={`tu-promo-opcion ${promo === null ? "on" : ""}`}>
          <input type="radio" name={`promo-${id}`} checked={promo === null} onChange={() => setPromo(null)} />
          <span>Sin promo</span>
        </label>
      </div>
      {seleccionada?.tipo === "regalo" && (
        <label className="tu-promo-bebida" htmlFor={`regalo-${id}`}>
          <span>Elegí tu bebida de regalo</span>
          <select id={`regalo-${id}`} value={promo?.regaloProductoId ?? ""}
            onChange={e => setPromo({ ofertaId: seleccionada.id, regaloProductoId: e.target.value })}>
            <option value="" disabled>Elegí una bebida</option>
            {seleccionada.config.opciones.flatMap(op => {
              const bebida = bebidas.find(b => b.id === op.producto);
              return bebida ? [<option value={bebida.id} key={bebida.id}>{bebida.nombre}{op.suplemento ? ` (+ ${fmt(Math.min(op.suplemento, bebida.precio))})` : " · sin cargo"}</option>] : [];
            })}
          </select>
        </label>
      )}
      {promoAplicada && <p className="tu-promo-ahorro" role="status">{promoAplicada.nombre}: ahorrás {fmt(promoAplicada.ahorro)}</p>}
      {promoError && <p className="tu-promo-error" role="alert">{promoError} Elegí otra promo o seguí sin promo.</p>}
    </fieldset>
  );
}
