/* global React, AdminCore */
const { useState, useMemo } = React;
const { fmt, timeAgo, fmtDateTime, useStore, Icon, ProductThumb } = window.AdminCore;

/* ============ ORDERS ============ */
function Orders() {
  const { state, updateOrderStatus } = useStore();
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let list = state.orders;
    if (filter !== "todos") list = list.filter(o => o.estado === filter);
    if (q.trim()) list = list.filter(o => (o.id + " " + o.cliente + " " + o.tel).toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [state.orders, filter, q]);

  const counts = {
    todos: state.orders.length,
    nuevo: state.orders.filter(o => o.estado === "nuevo").length,
    preparando: state.orders.filter(o => o.estado === "preparando").length,
    "en-camino": state.orders.filter(o => o.estado === "en-camino").length,
    entregado: state.orders.filter(o => o.estado === "entregado").length,
    cancelado: state.orders.filter(o => o.estado === "cancelado").length,
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <div className="seg">
              {[["todos", "Todos"], ["nuevo", "Nuevos"], ["preparando", "Preparando"], ["en-camino", "En camino"], ["entregado", "Entregados"], ["cancelado", "Cancelados"]].map(([k, l]) => (
                <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>
                  {l}<span className="count">{counts[k]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="panel-head-spacer" />
          <div className="search-input">
            <Icon.Search />
            <input placeholder="Buscar N° de orden o cliente…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Items</th>
                  <th>Modalidad</th>
                  <th>Pago</th>
                  <th className="right">Total</th>
                  <th>Estado</th>
                  <th>Hace</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setSelected(o)}>
                    <td className="tbl-mono tbl-strong">{o.id}</td>
                    <td>
                      <div className="tbl-strong">{o.cliente}</div>
                      <div className="tbl-muted">{o.tel}</div>
                    </td>
                    <td className="tbl-muted">{o.items.map(i => `${i.qty}× ${i.name}`).join(", ").slice(0, 40)}…</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {o.mode === "delivery" ? <Icon.Truck /> : <Icon.Shop />}
                        {o.mode === "delivery" ? "Delivery" : "Retiro"}
                      </span>
                    </td>
                    <td className="tbl-muted" style={{ textTransform: "capitalize" }}>{o.pago === "mercadopago" ? "MercadoPago" : o.pago}</td>
                    <td className="right tbl-price">{fmt(o.total)}</td>
                    <td><span className={`chip chip-${o.estado}`}>{o.estado.replace("-", " ")}</span></td>
                    <td className="tbl-muted text-mono">{timeAgo(o.fecha)}</td>
                    <td className="right">
                      <button className="btn btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setSelected(o); }}><Icon.Eye /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty">
                <div className="empty-icon"><Icon.Orders /></div>
                <b>Sin pedidos</b>
                <div>No hay pedidos con ese filtro</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} onUpdate={(estado) => { updateOrderStatus(selected.id, estado); setSelected({ ...selected, estado }); }} />}
    </>
  );
}

function OrderDetail({ order, onClose, onUpdate }) {
  const steps = ["nuevo", "preparando", "en-camino", "entregado"];
  const currentIdx = steps.indexOf(order.estado);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="grow">
            <h3>Orden {order.id}</h3>
            <small>{fmtDateTime(order.fecha)} · {timeAgo(order.fecha)}</small>
          </div>
          <span className={`chip chip-${order.estado}`}>{order.estado.replace("-", " ")}</span>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon.X /></button>
        </div>

        <div className="modal-body">
          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12 }}>Seguimiento</h4>
          <div className="timeline">
            {[["nuevo", "Pedido recibido"], ["preparando", "En preparación"], ["en-camino", order.mode === "delivery" ? "En camino" : "Listo para retirar"], ["entregado", "Entregado"]].map(([k, l], i) => (
              <div key={k} className={`tl-item ${i < currentIdx ? "done" : i === currentIdx ? "active" : ""}`}>
                <b>{l}</b>
                <small>{i <= currentIdx ? timeAgo(new Date(Date.now() - (currentIdx - i) * 600000).toISOString()) : "pendiente"}</small>
              </div>
            ))}
          </div>

          {order.estado !== "entregado" && order.estado !== "cancelado" && (
            <div className="flex gap-8 mt-12" style={{ flexWrap: "wrap" }}>
              {currentIdx < 3 && (
                <button className="btn btn-primary" onClick={() => onUpdate(steps[currentIdx + 1])}>
                  <Icon.Arrow /> Marcar como "{steps[currentIdx + 1].replace("-", " ")}"
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => onUpdate("cancelado")}>Cancelar pedido</button>
            </div>
          )}

          <div className="od-customer">
            <div className="avatar" style={{ background: "var(--a-accent)", color: "white" }}>{order.cliente[0]}</div>
            <div className="grow">
              <b>{order.cliente}</b>
              <div className="text-muted text-mono" style={{ fontSize: 12 }}>{order.tel}</div>
            </div>
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/54${order.tel.replace(/\D/g, "")}`} target="_blank">WhatsApp</a>
          </div>

          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12, marginTop: 20 }}>Detalle</h4>
          <div className="od-items">
            {order.items.map((i, idx) => (
              <div className="od-row" key={idx}>
                <span>{i.qty}× {i.name}</span>
                <span className="tbl-price">{fmt(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="od-row"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {order.shipping > 0 && <div className="od-row"><span>Envío ({order.zona?.replace(/-/g, " ")})</span><span>{fmt(order.shipping)}</span></div>}
            <div className="od-row tot"><span>Total</span><span>{fmt(order.total)}</span></div>
          </div>

          {order.mode === "delivery" && (
            <>
              <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12, marginTop: 20 }}>Dirección</h4>
              <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5 }}>
                {order.dir}<br />
                <span className="text-muted">Zona: {order.zona?.replace(/-/g, " ")}</span>
              </div>
            </>
          )}

          {order.notas && (
            <>
              <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12, marginTop: 20 }}>Notas</h4>
              <div style={{ padding: 14, background: "var(--a-warn-soft)", borderRadius: 12, fontSize: 13.5, color: "var(--a-warn)" }}>{order.notas}</div>
            </>
          )}

          <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 12.5, color: "var(--a-muted)", marginTop: 20 }}>
            <b style={{ color: "var(--a-ink)", textTransform: "uppercase", fontFamily: "var(--a-font-mono)", fontSize: 10, letterSpacing: ".15em" }}>Método de pago</b>
            <div style={{ marginTop: 4, textTransform: "capitalize", color: "var(--a-ink)" }}>{order.pago === "mercadopago" ? "Mercado Pago" : order.pago}</div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Imprimir comanda</button>
        </div>
      </div>
    </div>
  );
}

/* ============ PRODUCTS ============ */
function Products() {
  const { state, updateProduct, createProduct, deleteProduct } = useStore();
  const [type, setType] = useState("todos");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
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
                <tr>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Etiquetas</th>
                  <th className="right">Precio</th>
                  <th className="right">Stock</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
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
                    <td>
                      <div className={`switch ${p.active ? "on" : ""}`} onClick={() => updateProduct(p.id, { active: !p.active })} />
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

function ProductEdit({ product, onClose, onSave, isNew }) {
  const [data, setData] = useState(product || { type: "pizza", nombre: "", desc: "", precio: 0, categoria: "clasica", stock: 0, tags: [], active: true, popular: false });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const toggleTag = (t) => set("tags", data.tags.includes(t) ? data.tags.filter(x => x !== t) : [...(data.tags || []), t]);

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
            <div className="field full">
              <label>Nombre</label>
              <input value={data.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Margherita" />
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={data.type} onChange={e => set("type", e.target.value)}>
                <option value="pizza">Pizza</option>
                <option value="empanada">Empanada</option>
                <option value="bebida">Bebida</option>
              </select>
            </div>
            {data.type === "pizza" && (
              <div className="field">
                <label>Categoría</label>
                <select value={data.categoria} onChange={e => set("categoria", e.target.value)}>
                  <option value="clasica">Clásica</option>
                  <option value="gourmet">Gourmet</option>
                </select>
              </div>
            )}
            <div className="field full">
              <label>Descripción</label>
              <textarea rows={3} value={data.desc} onChange={e => set("desc", e.target.value)} placeholder="Ingredientes, detalles especiales…" />
            </div>
            <div className="field">
              <label>Precio (ARS)</label>
              <input type="number" value={data.precio} onChange={e => set("precio", +e.target.value)} />
            </div>
            <div className="field">
              <label>Stock</label>
              <input type="number" value={data.stock} onChange={e => set("stock", +e.target.value)} />
            </div>
            <div className="field full">
              <label>Etiquetas</label>
              <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                {["vegetariana", "picante", "gourmet", "dulce"].map(t => (
                  <button key={t} className={`btn btn-sm ${(data.tags || []).includes(t) ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleTag(t)}>
                    {(data.tags || []).includes(t) && <Icon.Check />} {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Activo</label>
              <div className="field-row">
                <div className={`switch ${data.active ? "on" : ""}`} onClick={() => set("active", !data.active)} />
                <span className="text-muted" style={{ fontSize: 12.5 }}>Visible en el sitio</span>
              </div>
            </div>
            <div className="field">
              <label>Destacado</label>
              <div className="field-row">
                <div className={`switch ${data.popular ? "on" : ""}`} onClick={() => set("popular", !data.popular)} />
                <span className="text-muted" style={{ fontSize: 12.5 }}>Marcado como ★ popular</span>
              </div>
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

window.AdminPages1 = { Orders, Products };
