"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PizzaIllus } from "@/components/ui/PizzaIllus";
import { EmpanadaIllus, DrinkIllus } from "@/components/ui/Illus";
import { imagenDeProducto } from "@/lib/stock-images";
import {
  ejeDelGesto,
  esMobile,
  resistencia,
  resolverSoltar,
  sinAnimaciones,
  vecino,
  type Eje,
  type FichaItem,
} from "@/lib/ficha";

/** ms. Igual que la transición de `.ficha-pista` que se pone en línea abajo. */
const DURACION_PASO = 220;

function FotoDeFicha({ item, carga }: { item: FichaItem; carga: "lazy" | "eager" }) {
  if (item.tipo === "bebida") return <DrinkIllus id={item.id} label={item.nombre} name={item.nombre} loading={carga} />;
  if (item.tipo === "empanada") return <EmpanadaIllus id={item.id} name={item.nombre} loading={carga} />;
  return <PizzaIllus id={item.id} name={item.nombre} tags={item.tags} loading={carga} />;
}

interface ProductSheetProps {
  /** La lista que el cliente está viendo en esa sección, en el mismo orden. */
  items: FichaItem[];
  indice: number;
  onIndice: (indice: number) => void;
  onClose: () => void;
  /** El pie (agregar, stepper, ½½): lo arma quien abre la ficha. */
  accion: ReactNode;
}

interface Arrastre { puntero: number; x0: number; y0: number; t0: number; eje: Eje | null }

/**
 * Ficha de producto. Mobile: hoja desde abajo; se cierra arrastrando hacia
 * abajo y pasa de producto deslizando a los costados sobre la foto. Escritorio:
 * ventana centrada con flechas. Spec:
 * docs/superpowers/specs/2026-09-28-ficha-producto-design.md
 */
export function ProductSheet({ items, indice, onIndice, onClose, accion }: ProductSheetProps) {
  const hojaRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const pasando = useRef(false);
  const [pista, setPista] = useState({ x: 0, animada: false });
  const [bajada, setBajada] = useState(0);

  const item = items[indice];
  const anterior = vecino(indice, items.length, -1);
  const siguiente = vecino(indice, items.length, 1);

  // Al abrir: el foco entra a la hoja y el fondo deja de desplazarse (la clase
  // solo bloquea el scroll en mobile, ver impasto.css). Al cerrar, el foco
  // vuelve a quien la abrió.
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    hojaRef.current?.focus({ preventScroll: true });
    document.documentElement.classList.add("ficha-abierta");
    return () => {
      document.documentElement.classList.remove("ficha-abierta");
      previo?.focus({ preventScroll: true });
    };
  }, []);

  // Teclado: Esc cierra, flechas pasan de producto, Tab queda atrapado adentro.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowRight" && siguiente !== null) { e.preventDefault(); onIndice(siguiente); return; }
      if (e.key === "ArrowLeft" && anterior !== null) { e.preventDefault(); onIndice(anterior); return; }
      if (e.key !== "Tab" || !hojaRef.current) return;
      const focusables = hojaRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === hojaRef.current)) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onClose, onIndice, anterior, siguiente]);

  // Las miniaturas cargan en diferido: una fila lejos de la pantalla puede no
  // haber bajado su foto. Se precargan las dos vecinas para que al deslizar no
  // aparezca un hueco.
  useEffect(() => {
    for (const i of [anterior, siguiente]) {
      if (i === null) continue;
      const otro = items[i];
      const img = new Image();
      img.src = imagenDeProducto(otro.tipo, otro.nombre, otro.id, otro.tags);
    }
  }, [items, anterior, siguiente]);

  if (!item) return null;

  const ancho = () => mediaRef.current?.clientWidth || window.innerWidth;

  const pasarA = (destino: number, sentido: 1 | -1) => {
    if (sinAnimaciones()) { setPista({ x: 0, animada: false }); onIndice(destino); return; }
    pasando.current = true;
    setPista({ x: -sentido * ancho(), animada: true });
    window.setTimeout(() => {
      // Mismo cuadro: la vecina ya ocupa el centro. Sin transición, no se ve el cambio.
      pasando.current = false;
      setPista({ x: 0, animada: false });
      onIndice(destino);
    }, DURACION_PASO);
  };

  // Gestos solo en mobile. El puntero queda capturado por la foto, que lleva
  // touch-action:none: sin eso el navegador toma el gesto como scroll.
  const alApoyar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pasando.current || !esMobile()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Un toque en ✕ o en las flechas es un clic, no un arrastre: capturar el
    // puntero acá le robaría el clic al botón.
    if ((e.target as HTMLElement).closest("button")) return;
    arrastre.current = { puntero: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, eje: null };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPista({ x: 0, animada: false });
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.puntero !== e.pointerId) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (a.eje === null) a.eje = ejeDelGesto(dx, dy);
    if (a.eje === "horizontal") setPista({ x: resistencia(dx, (dx < 0 ? siguiente : anterior) !== null), animada: false });
    else if (a.eje === "vertical") setBajada(Math.max(0, dy));
  };

  const alSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.puntero !== e.pointerId) return;
    arrastre.current = null;
    const resultado = resolverSoltar({
      eje: a.eje,
      dx: e.clientX - a.x0,
      dy: e.clientY - a.y0,
      dt: e.timeStamp - a.t0,
      ancho: ancho(),
      hayAnterior: anterior !== null,
      haySiguiente: siguiente !== null,
    });
    setBajada(0);
    if (resultado === "cerrar") { onClose(); return; }
    if (resultado === "siguiente" && siguiente !== null) { pasarA(siguiente, 1); return; }
    if (resultado === "anterior" && anterior !== null) { pasarA(anterior, -1); return; }
    setPista({ x: 0, animada: true });
  };

  const alCancelar = () => {
    arrastre.current = null;
    setBajada(0);
    setPista({ x: 0, animada: true });
  };

  const lugares: Array<[number | null, number]> = [[anterior, -1], [indice, 0], [siguiente, 1]];

  return (
    <div className="ficha-fondo" onClick={onClose}>
      <div
        ref={hojaRef}
        className="ficha-hoja"
        data-tipo={item.tipo}
        role="dialog"
        aria-modal="true"
        aria-label={item.nombre}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={bajada ? { transform: `translateY(${bajada}px)`, transition: "none" } : undefined}
      >
        <div
          ref={mediaRef}
          className="ficha-media"
          onPointerDown={alApoyar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alCancelar}
        >
          <div
            className="ficha-pista"
            style={{
              transform: `translate3d(${pista.x}px,0,0)`,
              transition: pista.animada ? `transform ${DURACION_PASO}ms cubic-bezier(.22,1,.36,1)` : "none",
            }}
          >
            {lugares.map(([i, lugar]) => i === null ? null : (
              <div key={items[i].id} className="ficha-foto" style={{ left: `${lugar * 100}%` }} aria-hidden={lugar !== 0}>
                <FotoDeFicha item={items[i]} carga={lugar === 0 ? "eager" : "lazy"} />
                {items[i].agotado && <div className="media-agotado-bar">Agotado</div>}
              </div>
            ))}
          </div>
          <span className="ficha-manija" aria-hidden="true" />
          {items.length > 1 && <span className="ficha-contador" aria-hidden="true">{indice + 1} / {items.length}</span>}
          {anterior !== null && (
            <button type="button" className="ficha-flecha prev" onClick={() => onIndice(anterior)} aria-label="Producto anterior">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          {siguiente !== null && (
            <button type="button" className="ficha-flecha next" onClick={() => onIndice(siguiente)} aria-label="Producto siguiente">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
        </div>

        <button type="button" className="ficha-cerrar" onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        <div className="ficha-info">
          {item.badges.length > 0 && (
            <div className="ficha-badges">
              {item.badges.map((b) => <span key={b.texto} className={b.clase}>{b.texto}</span>)}
            </div>
          )}
          <h3 className="ficha-titulo">{item.nombre}</h3>
          <b className="ficha-precio">{item.precioTexto}</b>
          {item.desc && <p className="ficha-desc">{item.desc}</p>}
        </div>

        <div className="ficha-pie">{accion}</div>

        {/* Lector de pantalla: anuncia el producto al pasar con flechas o deslizando. */}
        <span className="ficha-anuncio" aria-live="polite">
          {items.length > 1 ? `${item.nombre}, ${indice + 1} de ${items.length}` : item.nombre}
        </span>
      </div>
    </div>
  );
}
