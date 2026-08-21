"use client";
import { useState } from "react";
import { useStore } from "./StoreProvider";
import { COLORES_ETIQUETA, MOSTRAR_BADGE } from "@/lib/etiquetas";
import type { AdminEtiqueta } from "./types";

const DONDE: Record<string, string> = {
  ambos: "Pizzas y empanadas",
  pizzas: "Solo pizzas",
  empanadas: "Solo empanadas",
  ninguno: "No se muestra",
};

/** Las pestañas del sitio filtran por estos slugs: borrarlos las vacía. */
const PESTANAS: Record<string, string> = {
  gourmet: "Gourmet",
  vegetariana: "Veggie",
  picante: "Picantes",
};

export function Etiquetas() {
  const { state, createEtiqueta, updateEtiqueta, deleteEtiqueta } = useStore();
  const [nuevo, setNuevo] = useState("");
  const [color, setColor] = useState<string>("gris");
  const [donde, setDonde] = useState<string>("ambos");

  const ordenadas = [...state.etiquetas].sort((a, b) => a.orden - b.orden);

  // Las dos actualizaciones van secuenciales y esperadas: `updateEtiqueta`
  // recarga el store al terminar, así que dispararlas en paralelo hace que la
  // segunda respuesta pise a la primera y la tabla muestre el orden viejo.
  const mover = async (eti: AdminEtiqueta, dir: -1 | 1) => {
    const i = ordenadas.findIndex(e => e._dbId === eti._dbId);
    const otro = ordenadas[i + dir];
    if (!otro) return;
    await updateEtiqueta(eti._dbId, { orden: otro.orden });
    await updateEtiqueta(otro._dbId, { orden: eti.orden });
  };

  const borrar = (eti: AdminEtiqueta) => {
    const avisos: string[] = [];
    if (PESTANAS[eti.slug]) avisos.push(`La pestaña "${PESTANAS[eti.slug]}" del sitio va a quedar vacía.`);
    if (eti.usos > 0) avisos.push(`Se va a quitar de ${eti.usos} producto(s).`);
    const texto = [`¿Borrar la etiqueta "${eti.label}"?`, ...avisos].join("\n\n");
    if (confirm(texto)) deleteEtiqueta(eti._dbId);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Etiquetas</h3>
        <span className="text-muted" style={{ fontSize: 12.5 }}>
          El orden define qué cartelito gana cuando un producto tiene varias etiquetas.
        </span>
      </div>

      <div className="panel-body">
        <div className="toolbar" style={{ gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            placeholder="Nombre de la etiqueta nueva"
            style={{ minWidth: 220 }}
          />
          <select value={color} onChange={e => setColor(e.target.value)}>
            {COLORES_ETIQUETA.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={donde} onChange={e => setDonde(e.target.value)}>
            {MOSTRAR_BADGE.map(m => <option key={m} value={m}>{DONDE[m]}</option>)}
          </select>
          <button
            className="btn btn-primary"
            disabled={!nuevo.trim()}
            onClick={() => { createEtiqueta(nuevo.trim(), color, donde); setNuevo(""); }}
          >
            Crear
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Orden</th><th>Etiqueta</th><th>Color</th><th>Dónde se ve</th><th>Usos</th><th></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((eti, i) => (
              <tr key={eti._dbId}>
                <td>
                  <button className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => mover(eti, -1)}>↑</button>
                  <button className="btn btn-sm btn-ghost" disabled={i === ordenadas.length - 1} onClick={() => mover(eti, 1)}>↓</button>
                </td>
                <td>
                  <input
                    defaultValue={eti.label}
                    onBlur={e => { if (e.target.value.trim() && e.target.value !== eti.label) updateEtiqueta(eti._dbId, { label: e.target.value.trim() }); }}
                  />
                  <div className="text-muted" style={{ fontSize: 11 }}>{eti.slug}</div>
                </td>
                <td>
                  <select value={eti.color} onChange={e => updateEtiqueta(eti._dbId, { color: e.target.value })}>
                    {COLORES_ETIQUETA.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <select value={eti.mostrar_badge} onChange={e => updateEtiqueta(eti._dbId, { mostrar_badge: e.target.value })}>
                    {MOSTRAR_BADGE.map(m => <option key={m} value={m}>{DONDE[m]}</option>)}
                  </select>
                </td>
                <td>{eti.usos}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => borrar(eti)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
