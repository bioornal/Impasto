"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./StoreProvider";
import { useMasasNoche } from "./MasasNocheProvider";
import { MASAS } from "@/lib/masa";
import { etiquetaDia } from "@/lib/resumen-diario";
import type { Masa } from "@/types";

/** Espera entre el último toque de flechita y el guardado: varios toques seguidos son un solo PUT. */
const ESPERA_GUARDADO_MS = 700;
const POCAS = 3;

/**
 * Masas de esta noche (pedido del dueño, 24/10/2026; por tipo desde el 31/10/2026): cuántas pizzas de
 * cada masa se pueden vender. Cada número es "cuántas me quedan AHORA": se carga al abrir o en cualquier
 * momento de la noche, y cada pizza vendida (web o POS) descuenta una de su masa. Si se carga una sola,
 * la otra no se vende. Sin ninguna cargada = sin límite. Controla la base; a las 06:00 empieza una noche nueva.
 */
export function MasasNoche() {
  const { showToast } = useStore();
  const { quedan, noche, error, recargar } = useMasasNoche();
  const sinCargar = quedan === null;

  const quitarLimite = async () => {
    try {
      const res = await fetch("/api/admin/masas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quedan: null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar");
      showToast("Masas: sin límite esta noche");
      await recargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo guardar");
    }
  };

  return (
    <section className={`panel masas ${sinCargar ? "masas-sin-cargar" : ""}`} aria-labelledby="masas-titulo">
      <div className="panel-head">
        <h3 id="masas-titulo">Masas de la noche{noche ? ` · ${etiquetaDia(noche)}` : ""}</h3>
        <div className="panel-head-spacer" />
        {!sinCargar && <button className="btn btn-ghost btn-sm" onClick={() => void quitarLimite()} title="La web y el POS vuelven a vender pizzas sin tope">Quitar límite</button>}
      </div>
      <div className="panel-body">
        {sinCargar && <p className="masas-aviso">Cargá cuántas tenés de cada masa. Sin números, la web y el POS venden sin límite.</p>}
        <div className="masas-body">
          {MASAS.map((m) => <ContadorMasa key={m.id} masa={m.id} nombre={m.nombre} />)}
        </div>
        {error && <p className="masas-error">{error}</p>}
      </div>
    </section>
  );
}

function ContadorMasa({ masa, nombre }: { masa: Masa; nombre: string }) {
  const { showToast } = useStore();
  const { filas, quedan: numeros, cargado, recargar } = useMasasNoche();
  /** Lo que el dueño acaba de tocar y todavía no se guardó (undefined = nada pendiente). */
  const [tocado, setTocado] = useState<number | undefined>(undefined);
  const [texto, setTexto] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const guardar = useCallback(async (valor: number) => {
    try {
      const res = await fetch("/api/admin/masas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masa, quedan: valor }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar");
      showToast(valor === 0 ? `${nombre}: en 0, no se vende más esta noche` : `${nombre}: quedan ${valor} para esta noche`);
      await recargar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setTocado(undefined);
    }
  }, [masa, nombre, recargar, showToast]);

  const fijar = (valor: number, inmediato = false) => {
    setTocado(valor);
    if (timer.current) clearTimeout(timer.current);
    if (inmediato) { timer.current = null; void guardar(valor); return; }
    timer.current = setTimeout(() => { timer.current = null; void guardar(valor); }, ESPERA_GUARDADO_MS);
  };

  const fila = filas.find((f) => f.masa === masa);
  const cargada = fila?.cupo !== null && fila?.cupo !== undefined;
  const guardado = numeros && cargada ? numeros[masa] : null;
  const quedan = tocado !== undefined ? tocado : guardado;
  const vendidas = fila?.vendidas ?? 0;
  const estado = quedan === null ? "sin-cargar" : quedan === 0 ? "agotado" : quedan <= POCAS ? "pocas" : "ok";
  const titulo = quedan === null
    ? (numeros ? "Sin cargar · no se vende" : "Sin cargar")
    : quedan === 0 ? "Agotada · no se vende" : `Quedan ${quedan}`;

  const confirmarTexto = () => {
    if (texto === null) return;
    const limpio = texto.trim();
    setTexto(null);
    if (limpio === "") return;
    const n = Number(limpio);
    if (!Number.isInteger(n) || n < 0 || n > 2000) { showToast("Poné un número entero de masas, de 0 a 2000"); return; }
    if (n !== quedan) fijar(n, true);
  };

  const id = `masas-quedan-${masa}`;
  return (
    <div className={`masa-contador masas-${estado}`}>
      <div className="masas-estado">
        <span className="masas-nombre">{nombre}</span>
        <b className="masas-titulo">{cargado ? titulo : "Cargando…"}</b>
        <span>Vendidas {vendidas}</span>
      </div>
      <div className="masas-ctrl">
        <label htmlFor={id}>Me quedan</label>
        <div className="masas-stepper">
          <button type="button" onClick={() => quedan !== null && fijar(Math.max(0, quedan - 1))} disabled={!cargado || quedan === null || quedan === 0} aria-label={`Una masa ${nombre.toLowerCase()} menos`}>−</button>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            placeholder="—"
            value={texto ?? (quedan === null ? "" : String(quedan))}
            disabled={!cargado}
            onFocus={(e) => { setTexto(quedan === null ? "" : String(quedan)); e.target.select(); }}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))}
            onBlur={confirmarTexto}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setTexto(null); (e.target as HTMLInputElement).blur(); } }}
          />
          <button type="button" onClick={() => fijar(Math.min(2000, (quedan ?? 0) + 1))} disabled={!cargado} aria-label={`Una masa ${nombre.toLowerCase()} más`}>+</button>
        </div>
      </div>
    </div>
  );
}
