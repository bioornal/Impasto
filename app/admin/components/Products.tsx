"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { ProductThumb } from "./ProductThumb";
import type { AdminProduct } from "./types";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

/**
 * Etiquetado desde la propia fila, sin abrir el editor.
 *
 * Guarda al cerrar y no en cada casilla: marcar tres serian tres PUT y tres
 * avisos encimados. Si al cerrar el conjunto no cambio, no manda nada.
 *
 * El panelito va en position:fixed porque .tbl-wrap tiene overflow-x:auto, y eso
 * computa el overflow-y a auto: un absolute quedaria recortado por la tabla.
 */
function CeldaEtiquetas({ producto }: { producto: AdminProduct }) {
  const { state, setProductTags } = useStore();
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ancla = useRef<HTMLDivElement>(null);

  const etiquetas = useMemo(() => [...state.etiquetas].sort((a, b) => a.orden - b.orden), [state.etiquetas]);
  // Un slug sin fila en `etiquetas` (huerfano) se muestra igual, en gris y con el
  // slug crudo: esconderlo lo volveria imposible de rastrear desde el panel.
  const deSlug = (slug: string) => state.etiquetas.find(e => e.slug === slug);

  const tags = producto.tags || [];

  const abrir = () => {
    const r = ancla.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 246)) });
    setSel(tags);
    setAbierto(true);
  };

  // Depende de `sel`, asi que los listeners se re-registran en cada casilla que
  // se toca. Son tres listeners: sale mas barato que un ref escrito en el render.
  const cerrarYGuardar = useCallback(() => {
    setAbierto(false);
    const antes = producto.tags || [];
    const igual = sel.length === antes.length
      && [...sel].sort().join("|") === [...antes].sort().join("|");
    if (!igual) setProductTags(producto.id, sel);
  }, [sel, producto, setProductTags]);

  useEffect(() => {
    if (!abierto) return;
    const alClic = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (ancla.current?.contains(t)) return;
      if (t.closest?.(".eti-pop")) return;
      cerrarYGuardar();
    };
    const alTeclado = (ev: KeyboardEvent) => { if (ev.key === "Escape") cerrarYGuardar(); };
    // El panelito scrollea solo si no entran todas las etiquetas. Sin este filtro,
    // scrollear DENTRO del panelito lo cerraria: el listener va en captura y ve
    // tambien el scroll de sus propios hijos.
    const alScroll = (ev: Event) => {
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.(".eti-pop")) return;
      cerrarYGuardar();
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTeclado);
    window.addEventListener("scroll", alScroll, true);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTeclado);
      window.removeEventListener("scroll", alScroll, true);
    };
  }, [abierto, cerrarYGuardar]);

  const alternar = (slug: string) =>
    setSel(s => s.includes(slug) ? s.filter(x => x !== slug) : [...s, slug]);

  return (
    <>
      <div className="eti-celda" ref={ancla} onClick={() => (abierto ? cerrarYGuardar() : abrir())}>
        {tags.length === 0 && !producto.popular && <span className="eti-vacia">sin etiquetas</span>}
        {tags.map(t => (
          <span key={t} className={`tag c-${deSlug(t)?.color || "gris"}`}>{deSlug(t)?.label || t}</span>
        ))}
        {producto.popular && <span className="tag tag-hot">★ popular</span>}
        <button type="button" className="eti-mas" title="Editar etiquetas">+</button>
      </div>

      {abierto && (
        <div className="eti-pop" style={{ top: pos.top, left: pos.left }}>
          {etiquetas.length === 0 && (
            <div className="eti-pop-vacio">No hay etiquetas todavía. Creá una en la sección Etiquetas.</div>
          )}
          {etiquetas.map(e => (
            <label key={e.slug} className="eti-op">
              <input type="checkbox" checked={sel.includes(e.slug)} onChange={() => alternar(e.slug)} />
              <span className={`tag c-${e.color}`}>{e.label}</span>
              <span className="eti-op-slug">{e.slug}</span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}

export function Products() {
  const { state, updateProduct, createProduct, deleteProduct } = useStore();
  const [type, setType] = useState("todos");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<AdminProduct | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    let list = state.products;
    if (type !== "todos") list = list.filter(p => p.type === type);
    if (q.trim()) list = list.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [state.products, type, q]);

  const counts = {
    todos: state.products.length,
    pizza: state.products.filter(p => p.type === "pizza").length,
    empanada: state.products.filter(p => p.type === "empanada").length,
    bebida: state.products.filter(p => p.type === "bebida").length,
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <div className="seg">
              <button className={type === "todos" ? "active" : ""} onClick={() => setType("todos")}>Todos<span className="count">{counts.todos}</span></button>
              <button className={type === "pizza" ? "active" : ""} onClick={() => setType("pizza")}>Pizzas<span className="count">{counts.pizza}</span></button>
              <button className={type === "empanada" ? "active" : ""} onClick={() => setType("empanada")}>Empanadas<span className="count">{counts.empanada}</span></button>
              <button className={type === "bebida" ? "active" : ""} onClick={() => setType("bebida")}>Bebidas<span className="count">{counts.bebida}</span></button>
            </div>
          </div>
          <div className="panel-head-spacer" />
          <div className="search-input">
            <Icon.Search />
            <input placeholder="Buscar producto…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon.Plus /> Nuevo producto</button>
        </div>
        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Producto</th><th>Tipo</th><th>Etiquetas</th><th className="right">Precio</th><th className="right">Stock</th><th>Disponibilidad</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span className="row-thumb"><ProductThumb item={p} /></span>
                      <span style={{ verticalAlign: "middle" }}>
                        <div className="tbl-strong">{p.nombre}</div>
                        {p.desc && <div className="tbl-muted" style={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>}
                      </span>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{p.type}</td>
                    <td><CeldaEtiquetas producto={p} /></td>
                    <td className="right tbl-price">{fmt(p.precio || 0)}</td>
                    <td className="right tbl-mono">{p.stock}</td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <div
                          className={`switch ${p.active ? "on" : ""}`}
                          onClick={() => updateProduct(p.id, { active: !p.active })}
                          title={p.active ? "Disponible (clic para marcar como Agotado)" : "Agotado (clic para marcar como Disponible)"}
                        />
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: p.active ? "var(--a-accent)" : "var(--a-muted)" }}>
                          {p.active ? "Disponible" : "Agotado"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="tbl-actions">
                        <button className="btn btn-icon btn-ghost" onClick={() => setEdit(p)}><Icon.Edit /></button>
                        <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("¿Eliminar " + p.nombre + "?")) deleteProduct(p.id); }}><Icon.Trash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {edit && <ProductEdit product={edit} onClose={() => setEdit(null)} onSave={(patch) => { updateProduct(edit.id, patch); setEdit(null); }} />}
      {creating && <ProductEdit onClose={() => setCreating(false)} onSave={(p) => { createProduct(p); setCreating(false); }} isNew />}
    </>
  );
}

// El panel solo ofrece estos tres tipos, y coinciden 1 a 1 con CATEGORIAS_IMPASTO:
// `categoria` (la que decide dónde aparece el producto en el sitio) se deriva
// siempre del Tipo elegido, para que nunca queden desincronizados.
const TYPE_TO_CATEGORIA: Record<AdminProduct["type"], string> = {
  pizza: "pizzas",
  empanada: "empanadas",
  bebida: "bebidas",
};

function ProductEdit({ product, onClose, onSave, isNew }: { product?: AdminProduct; onClose: () => void; onSave: (p: Partial<AdminProduct>) => void; isNew?: boolean }) {
  const [data, setData] = useState<Partial<AdminProduct>>(product || { type: "pizza", nombre: "", desc: "", precio: 0, categoria: "pizzas", stock: 0, tags: [], active: true, popular: false });
  const set = <K extends keyof AdminProduct>(k: K, v: AdminProduct[K]) => setData(d => ({ ...d, [k]: v }));
  const setType = (t: AdminProduct["type"]) => setData(d => ({ ...d, type: t, categoria: TYPE_TO_CATEGORIA[t] }));
  const toggleTag = (t: string) => set("tags", (data.tags || []).includes(t) ? (data.tags || []).filter(x => x !== t) : [...(data.tags || []), t]);
  const { state } = useStore();
  const etiquetasOrdenadas = [...state.etiquetas].sort((a, b) => a.orden - b.orden);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="grow">
            <h3>{isNew ? "Nuevo producto" : "Editar producto"}</h3>
            <small>{isNew ? "Agregá un nuevo ítem a tu carta" : `ID: ${data.id}`}</small>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field full"><label>Nombre</label><input value={data.nombre || ""} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Margherita" /></div>
            <div className="field">
              <label>Tipo</label>
              <select value={data.type || "pizza"} onChange={e => setType(e.target.value as AdminProduct["type"])}>
                <option value="pizza">Pizza</option><option value="empanada">Empanada</option><option value="bebida">Bebida</option>
              </select>
            </div>
            <div className="field full"><label>Descripción</label><textarea rows={3} value={data.desc || ""} onChange={e => set("desc", e.target.value)} placeholder="Ingredientes, detalles…" /></div>
            <div className="field"><label>Precio (ARS)</label><input type="number" value={data.precio || 0} onChange={e => set("precio", +e.target.value)} /></div>
            <div className="field"><label>Stock</label><input type="number" value={data.stock || 0} onChange={e => set("stock", +e.target.value)} /></div>
            <div className="field full">
              <label>Etiquetas</label>
              <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                {etiquetasOrdenadas.length === 0 && (
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    No hay etiquetas todavía. Creá una en la sección Etiquetas.
                  </span>
                )}
                {etiquetasOrdenadas.map(e => (
                  <button key={e.slug} className={`btn btn-sm ${(data.tags || []).includes(e.slug) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleTag(e.slug)}>
                    {(data.tags || []).includes(e.slug) && <Icon.Check />} {e.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Disponibilidad</label>
              <div className="field-row"><div className={`switch ${data.active ? "on" : ""}`} onClick={() => set("active", !data.active)} /><span className="text-muted" style={{ fontSize: 12.5 }}>{data.active ? "Disponible para venta" : "Agotado (se muestra con aviso en carta)"}</span></div>
            </div>
            <div className="field">
              <label>Destacado</label>
              <div className="field-row"><div className={`switch ${data.popular ? "on" : ""}`} onClick={() => set("popular", !data.popular)} /><span className="text-muted" style={{ fontSize: 12.5 }}>Marcado como ★ popular</span></div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(data)}>{isNew ? "Crear producto" : "Guardar cambios"}</button>
        </div>
      </div>
    </div>
  );
}
