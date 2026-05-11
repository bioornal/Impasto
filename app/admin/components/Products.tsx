"use client";
import { useState, useMemo } from "react";
import { useStore } from "./StoreProvider";
import { Icon } from "./Icons";
import { ProductThumb } from "./ProductThumb";
import type { AdminProduct } from "./types";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

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
                <tr><th>Producto</th><th>Tipo</th><th>Etiquetas</th><th className="right">Precio</th><th className="right">Stock</th><th>Estado</th><th></th></tr>
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
                    <td>
                      {(p.tags || []).map(t => (
                        <span key={t} className={`tag ${t === "picante" ? "tag-hot" : t === "vegetariana" ? "tag-veg" : t === "gourmet" ? "tag-gourmet" : ""}`}>{t}</span>
                      ))}
                      {p.popular && <span className="tag tag-hot">★ popular</span>}
                    </td>
                    <td className="right tbl-price">{fmt(p.precio || 0)}</td>
                    <td className="right tbl-mono">{p.stock}</td>
                    <td><div className={`switch ${p.active ? "on" : ""}`} onClick={() => updateProduct(p.id, { active: !p.active })} /></td>
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

function ProductEdit({ product, onClose, onSave, isNew }: { product?: AdminProduct; onClose: () => void; onSave: (p: Partial<AdminProduct>) => void; isNew?: boolean }) {
  const [data, setData] = useState<Partial<AdminProduct>>(product || { type: "pizza", nombre: "", desc: "", precio: 0, categoria: "clasica", stock: 0, tags: [], active: true, popular: false });
  const set = <K extends keyof AdminProduct>(k: K, v: AdminProduct[K]) => setData(d => ({ ...d, [k]: v }));
  const toggleTag = (t: string) => set("tags", (data.tags || []).includes(t) ? (data.tags || []).filter(x => x !== t) : [...(data.tags || []), t]);

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
              <select value={data.type || "pizza"} onChange={e => set("type", e.target.value as AdminProduct["type"])}>
                <option value="pizza">Pizza</option><option value="empanada">Empanada</option><option value="bebida">Bebida</option>
              </select>
            </div>
            {data.type === "pizza" && (
              <div className="field">
                <label>Categoría</label>
                <select value={data.categoria || "clasica"} onChange={e => set("categoria", e.target.value)}>
                  <option value="clasica">Clásica</option><option value="gourmet">Gourmet</option>
                </select>
              </div>
            )}
            <div className="field full"><label>Descripción</label><textarea rows={3} value={data.desc || ""} onChange={e => set("desc", e.target.value)} placeholder="Ingredientes, detalles…" /></div>
            <div className="field"><label>Precio (ARS)</label><input type="number" value={data.precio || 0} onChange={e => set("precio", +e.target.value)} /></div>
            <div className="field"><label>Stock</label><input type="number" value={data.stock || 0} onChange={e => set("stock", +e.target.value)} /></div>
            <div className="field full">
              <label>Etiquetas</label>
              <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                {["vegetariana","picante","gourmet","dulce"].map(t => (
                  <button key={t} className={`btn btn-sm ${(data.tags || []).includes(t) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleTag(t)}>
                    {(data.tags || []).includes(t) && <Icon.Check />} {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Activo</label>
              <div className="field-row"><div className={`switch ${data.active ? "on" : ""}`} onClick={() => set("active", !data.active)} /><span className="text-muted" style={{ fontSize: 12.5 }}>Visible en el sitio</span></div>
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
