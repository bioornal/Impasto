"use client";
import { EmpanadaIllus } from "@/components/ui/Illus";
import { fmt } from "@/lib/utils";
import { argumento } from "@/lib/marca";
import { TAMANIOS_CAJA_EMPANADAS } from "@/lib/reglas-carta";
import type { Empanada } from "@/types";

// Mismos tamaños que lee el prompt del bot (`lib/chat-prompt.ts`) vía
// `lib/reglas-carta.ts`: el componente que de verdad cobra no puede tener su
// propia copia de esta lista.
const TIERS = TAMANIOS_CAJA_EMPANADAS;
const EMPANADA_PESO = argumento("empanadas-peso");
const REPULGUE = argumento("repulgue");

interface EmpanadasSectionProps {
  empanadas: Empanada[];
  boxPrices: Record<6 | 12 | 24, number>;
  selection: Record<string, number>;
  tier: 6 | 12 | 24;
  onPick: (id: string, delta: number) => void;
  onChangeTier: (tier: 6 | 12 | 24) => void;
  onAddBox: () => void;
  priceFor: (size: 6 | 12 | 24, current: Record<string, number>) => number;
}

export function EmpanadasSection({ empanadas, boxPrices, selection, tier, onPick, onChangeTier, onAddBox, priceFor }: EmpanadasSectionProps) {
  if (empanadas.length === 0) return null;

  const selected = Object.values(selection).reduce((a, b) => a + b, 0);
  const complete = selected === tier;
  const hasUnitPrices = empanadas.some((e) => Number(e.precio) > 0);

  const lines = Object.entries(selection).filter(([, amount]) => amount > 0);

  return (
    <section className="emp-section" id="empanadas">
      {/* Selector de tamaño mobile: pegado bajo el header. */}
      <div className="emp-size" role="group" aria-label="Tamaño de la caja">
        {TIERS.map((size) => (
          <button key={size} className={`emp-size-btn ${tier === size ? "on" : ""}`} onClick={() => onChangeTier(size)} aria-pressed={tier === size}>
            {size} unidades
          </button>
        ))}
      </div>

      <div className="container">
        <div className="section-head">
          <div>
            <div className="sec-index">02 — Rellenas y al horno</div>
            <h2>Armá tu caja</h2>
          </div>
          <p>Grandes y abundantes de {EMPANADA_PESO.cifra}, con {REPULGUE.titulo.toLowerCase()} y cocción al horno. Rellenos generosos con ingredientes de primera calidad. Elegí la cantidad para tu caja y combiná los sabores que quieras.</p>
        </div>

        <div className="emp-layout">
          <div className="emp-grid">
            {empanadas.map((empanada) => {
              const count = selection[empanada.id] || 0;
              const agotado = empanada.disponible === false;
              return (
                <article className={`emp-card ${count > 0 ? "on" : ""} ${agotado ? "is-agotado" : ""}`} key={empanada.id}>
                  <div className="emp-media">
                    <EmpanadaIllus id={empanada.id} name={empanada.nombre} />
                    {agotado && <div className="media-agotado-bar">Agotado</div>}
                  </div>
                  <div className="emp-head">
                    <h4>{empanada.nombre}</h4>
                    {empanada.badge && <span className={`p-badge-tag c-${empanada.badge.color}`}>{empanada.badge.label}</span>}
                  </div>
                  <p>{empanada.desc}</p>
                  <div className="emp-foot">
                    <span className="emp-unit">
                      {agotado ? "Agotado" : count > 0 ? "en la caja" : empanada.precio ? fmt(empanada.precio) : EMPANADA_PESO.cifra}
                    </span>
                    <div className="stepper">
                      <button onClick={() => onPick(empanada.id, -1)} disabled={count === 0} aria-label={`Quitar ${empanada.nombre}`}>−</button>
                      <span>{count}</span>
                      <button onClick={() => onPick(empanada.id, 1)} disabled={agotado || selected >= tier} aria-label={`Sumar ${empanada.nombre}`} title={agotado ? "Variedad agotada" : undefined}>+</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="box-aside">
            <div>
              <h4>Tu caja</h4>
              <small className="box-sub">Empanadas de {EMPANADA_PESO.cifra} c/u</small>
            </div>

            <div>
              <span className="box-label" id="box-tiers-label">Unidades</span>
              <div className="box-tiers" role="group" aria-labelledby="box-tiers-label">
                {TIERS.map((size) => (
                  <button key={size} className={`tier ${tier === size ? "on" : ""}`} onClick={() => onChangeTier(size)} aria-pressed={tier === size}>
                    <b>{size}</b>
                    {/* Con precio por unidad el total depende de los gustos: no hay un precio fijo que mostrar. */}
                    {!hasUnitPrices && <small>{fmt(boxPrices[size])}</small>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="box-progress-top">
                <span>{selected} de {tier} elegidas</span>
                <span className={`remain ${complete ? "done" : ""}`}>{complete ? "Caja completa" : `Faltan ${tier - selected}`}</span>
              </div>
              <div className="box-track">
                <div className={`box-bar ${complete ? "done" : ""}`} style={{ width: `${Math.min(100, (selected / tier) * 100)}%` }} />
              </div>
            </div>

            <div className="box-lines">
              {lines.length === 0 ? (
                <small className="hint">Todavía no elegiste gustos. Sumá desde la izquierda y se van listando acá.</small>
              ) : lines.map(([id, amount]) => (
                <div className="box-line" key={id}>
                  <span>{empanadas.find((e) => e.id === id)?.nombre}</span>
                  <span>×{amount}</span>
                </div>
              ))}
            </div>

            <div className="box-total">
              <span className="box-total-label">Total caja</span>
              <b>{fmt(priceFor(tier, selection))}</b>
            </div>

            <button className={`box-cta ${complete ? "ready" : ""}`} onClick={onAddBox} disabled={!complete}>
              {complete ? "Agregar caja al carrito" : `Elegí ${tier - selected} más`}
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}
