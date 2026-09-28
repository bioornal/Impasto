"use client";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { lineaDeBebida, lineaDePizza, type FichaItem } from "@/lib/ficha";

interface FichaAccionProps {
  item: FichaItem;
  /** Pizzas: cierra la ficha y abre la mitad y mitad con esta pizza. */
  onHalf?: () => void;
  /** Empanadas: la caja que se está armando (mismo estado que la grilla y la barra de abajo). */
  caja?: { cantidad: number; elegidas: number; tamanio: number; onPick: (delta: number) => void };
}

/**
 * Pie de la ficha de producto. Usa las mismas funciones que la tarjeta
 * (`add`, `incKey`, `decKey`, `onPick`) y el mismo aviso: la ficha no tiene
 * reglas de venta propias.
 */
export function FichaAccion({ item, onHalf, caja }: FichaAccionProps) {
  const { items, add, incKey, decKey } = useCart();
  const toast = useToast();

  if (item.tipo === "empanada" && caja) {
    const llena = caja.elegidas >= caja.tamanio;
    return (
      <div className="ficha-accion">
        <span className="ficha-caja">{item.agotado ? "Agotado" : `${caja.elegidas} de ${caja.tamanio} elegidas`}</span>
        <div className="ficha-step">
          <button type="button" onClick={() => caja.onPick(-1)} disabled={caja.cantidad === 0} aria-label={`Quitar ${item.nombre}`}>−</button>
          <span>{caja.cantidad}</span>
          <button type="button" onClick={() => caja.onPick(1)} disabled={item.agotado || llena} aria-label={`Sumar ${item.nombre}`}>+</button>
        </div>
      </div>
    );
  }

  const tipoCarrito = item.tipo === "bebida" ? "bebida" : "pizza";
  const qty = items.find((i) => i.key === item.id && i.type === tipoCarrito)?.qty || 0;
  const agregar = () => {
    add(item.tipo === "bebida" ? lineaDeBebida(item) : lineaDePizza(item));
    toast(`${item.nombre} agregada`);
  };

  return (
    <div className="ficha-accion">
      {item.agotado ? (
        <button type="button" className="ficha-agregar" disabled>Agotado</button>
      ) : qty > 0 ? (
        <div className="ficha-step">
          <button type="button" onClick={() => decKey(item.id)} aria-label={`Quitar una ${item.nombre}`}>−</button>
          <span>{qty} en el pedido</span>
          <button type="button" onClick={() => incKey(item.id)} aria-label={`Sumar una ${item.nombre}`}>+</button>
        </div>
      ) : (
        <button type="button" className="ficha-agregar" onClick={agregar}>Agregar · {item.precioTexto}</button>
      )}
      {onHalf && (
        <button type="button" className="ficha-half" onClick={onHalf} disabled={item.agotado} title="Mitad y mitad" aria-label="Mitad y mitad">½½</button>
      )}
    </div>
  );
}
