"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { buscar, type ResultadoBusqueda } from "@/lib/busqueda-admin";

const TIPO: Record<ResultadoBusqueda["tipo"], string> = { pedido: "Pedido", cliente: "Cliente", producto: "Producto" };

/** Pedidos, clientes y productos ya cargados. Ctrl+K / ⌘K para enfocar, Esc para cerrar. */
export function BusquedaGlobal({ onElegir }: { onElegir: (r: ResultadoBusqueda) => void }) {
  const { state } = useStore();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const resultados = useMemo(
    () => buscar(texto, { pedidos: state.orders, clientes: state.customers, productos: state.products }),
    [texto, state.orders, state.customers, state.products],
  );

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setAbierto(true); }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  const elegir = (r: ResultadoBusqueda) => { onElegir(r); setTexto(""); setAbierto(false); input.current?.blur(); };

  return (
    <div className="busqueda">
      <div className="search-input">
        <Icon.Search />
        <input
          ref={input}
          placeholder="Buscar pedido, cliente o producto"
          aria-label="Buscar pedido, cliente o producto"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(0); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setAbierto(false); input.current?.blur(); }
            if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.max(0, Math.min(a + 1, resultados.length - 1))); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && resultados[activo]) elegir(resultados[activo]);
          }}
        />
      </div>
      {abierto && texto.trim().length >= 2 && (
        <div className="busqueda-pop" role="listbox">
          {resultados.length === 0 && <div className="tbl-muted" style={{ padding: "8px 10px" }}>Sin resultados</div>}
          {resultados.map((r, i) => (
            <button type="button" key={`${r.tipo}-${r.id}`} role="option" aria-selected={i === activo} className={`busqueda-item ${i === activo ? "on" : ""}`} onMouseDown={(e) => { e.preventDefault(); elegir(r); }}>
              <span className="busqueda-tipo">{TIPO[r.tipo]}</span><b>{r.titulo}</b><span className="tbl-muted">{r.detalle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
