/* global React, AdminCore */
const { useState, useMemo } = React;
const { fmt, timeAgo, fmtDateTime, useStore, Icon } = window.AdminCore;

/* ============ CUSTOMERS ============ */
function Customers() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recientes");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let list = [...state.customers];
    if (q.trim()) list = list.filter(c => (c.nombre + " " + c.tel + " " + c.email).toLowerCase().includes(q.toLowerCase()));
    if (sort === "recientes") list.sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo));
    if (sort === "pedidos") list.sort((a, b) => b.pedidos - a.pedidos);
    if (sort === "total") list.sort((a, b) => b.total - a.total);
    return list;
  }, [state.customers, q, sort]);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="toolbar">
            <select className="select-input" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="recientes">Ordenar: Últimos pedidos</option>
              <option value="pedidos">Ordenar: Más pedidos</option>
              <option value="total">Ordenar: Mayor facturación</option>
            </select>
          </div>
          <div className="panel-head-spacer" />
          <div className="search-input">
            <Icon.Search />
            <input placeholder="Buscar cliente…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>

        <div className="panel-body no-pad">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Zona</th>
                  <th>Favorito</th>
                  <th className="right">Pedidos</th>
                  <th className="right">Total</th>
                  <th>Último</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setSelected(c)}>
                    <td>
                      <div className="flex" style={{ alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ background: "var(--a-bg-2)", color: "var(--a-ink)" }}>{c.nombre[0]}</div>
                        <div className="tbl-strong">{c.nombre}</div>
                      </div>
                    </td>
                    <td>
                      <div className="tbl-mono" style={{ fontSize: 12 }}>{c.tel}</div>
                      <div className="tbl-muted" style={{ fontSize: 12 }}>{c.email}</div>
                    </td>
                    <td className="tbl-muted" style={{ textTransform: "capitalize" }}>{c.zona?.replace(/-/g, " ")}</td>
                    <td className="tbl-muted">{c.fav}</td>
                    <td className="right tbl-strong">{c.pedidos}</td>
                    <td className="right tbl-price">{fmt(c.total)}</td>
                    <td className="tbl-muted text-mono">{timeAgo(c.ultimo)}</td>
                    <td className="right"><button className="btn btn-icon btn-ghost" onClick={e => { e.stopPropagation(); setSelected(c); }}><Icon.Eye /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty"><div className="empty-icon"><Icon.Users /></div><b>Sin resultados</b><div>Ningún cliente coincide con la búsqueda</div></div>
            )}
          </div>
        </div>
      </div>

      {selected && <CustomerDetail customer={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function CustomerDetail({ customer, onClose }) {
  const { state } = useStore();
  const history = state.orders.filter(o => o.cliente === customer.nombre);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-side" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="avatar" style={{ background: "var(--a-accent)", color: "white", width: 44, height: 44, fontSize: 18 }}>{customer.nombre[0]}</div>
          <div className="grow">
            <h3>{customer.nombre}</h3>
            <small>{customer.tel} · {customer.email}</small>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon.X /></button>
        </div>

        <div className="modal-body">
          <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 18 }}>
            <div className="kpi"><div className="kpi-label">Pedidos</div><div className="kpi-value" style={{ fontSize: 26 }}>{customer.pedidos}</div></div>
            <div className="kpi"><div className="kpi-label">Facturado</div><div className="kpi-value" style={{ fontSize: 22 }}>{fmt(customer.total)}</div></div>
            <div className="kpi"><div className="kpi-label">Ticket prom.</div><div className="kpi-value" style={{ fontSize: 22 }}>{fmt(customer.total / customer.pedidos)}</div></div>
          </div>

          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12 }}>Datos</h4>
          <div style={{ padding: 14, background: "var(--a-bg)", borderRadius: 12, fontSize: 13.5, display: "flex", flexDirection: "column", gap: 8 }}>
            <div><b style={{ color: "var(--a-muted)", fontSize: 11, textTransform: "uppercase", fontFamily: "var(--a-font-mono)", letterSpacing: ".1em" }}>Dirección</b><br />{customer.dir} · <span className="text-muted" style={{ textTransform: "capitalize" }}>{customer.zona?.replace(/-/g, " ")}</span></div>
            <div><b style={{ color: "var(--a-muted)", fontSize: 11, textTransform: "uppercase", fontFamily: "var(--a-font-mono)", letterSpacing: ".1em" }}>Producto favorito</b><br />{customer.fav}</div>
          </div>

          <h4 style={{ fontFamily: "var(--a-font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--a-muted)", marginBottom: 12, marginTop: 20 }}>Historial de pedidos</h4>
          {history.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}><div className="text-muted">Sin pedidos registrados</div></div>
          ) : (
            <div className="od-items">
              {history.map(o => (
                <div className="od-row" key={o.id}>
                  <div>
                    <span className="tbl-mono tbl-strong">{o.id}</span>
                    <div className="text-muted" style={{ fontSize: 12 }}>{fmtDateTime(o.fecha)} · {o.items.length} ítem{o.items.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tbl-price">{fmt(o.total)}</div>
                    <span className={`chip chip-${o.estado}`}>{o.estado.replace("-", " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <a className="btn btn-ghost" href={`https://wa.me/54${customer.tel.replace(/\D/g, "")}`} target="_blank">WhatsApp</a>
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ============ TESTIMONIALS ============ */
function Testimonials() {
  const { state, updateTestimonial, deleteTestimonial } = useStore();
  const [filter, setFilter] = useState("todos");

  const filtered = useMemo(() => {
    if (filter === "todos") return state.testimonials;
    return state.testimonials.filter(t => t.estado === filter);
  }, [state.testimonials, filter]);

  const counts = {
    todos: state.testimonials.length,
    pendiente: state.testimonials.filter(t => t.estado === "pendiente").length,
    aprobado: state.testimonials.filter(t => t.estado === "aprobado").length,
    rechazado: state.testimonials.filter(t => t.estado === "rechazado").length,
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="toolbar">
          <div className="seg">
            <button className={filter === "todos" ? "active" : ""} onClick={() => setFilter("todos")}>Todos<span className="count">{counts.todos}</span></button>
            <button className={filter === "pendiente" ? "active" : ""} onClick={() => setFilter("pendiente")}>Pendientes<span className="count">{counts.pendiente}</span></button>
            <button className={filter === "aprobado" ? "active" : ""} onClick={() => setFilter("aprobado")}>Aprobados<span className="count">{counts.aprobado}</span></button>
            <button className={filter === "rechazado" ? "active" : ""} onClick={() => setFilter("rechazado")}>Rechazados<span className="count">{counts.rechazado}</span></button>
          </div>
        </div>
      </div>

      <div className="panel-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map(t => (
            <div key={t.id} style={{ padding: 18, border: "1px solid var(--a-line)", borderRadius: 14, background: "var(--a-surface)" }}>
              <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className={`chip chip-${t.estado}`}>{t.estado}</span>
                <span className="tbl-muted text-mono" style={{ fontSize: 11 }}>{timeAgo(t.fecha)}</span>
              </div>
              <div className="stars" style={{ fontSize: 16, marginBottom: 8 }}>
                {"★".repeat(t.rating)}<span className="stars-empty">{"★".repeat(5 - t.rating)}</span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--a-ink-2)", lineHeight: 1.45 }}>"{t.texto}"</p>
              <div className="tbl-strong" style={{ fontSize: 13 }}>— {t.nombre}</div>

              <div className="flex gap-8 mt-12" style={{ justifyContent: "flex-end" }}>
                {t.estado !== "aprobado" && <button className="btn btn-success btn-sm" onClick={() => updateTestimonial(t.id, "aprobado")}><Icon.Check /> Aprobar</button>}
                {t.estado !== "rechazado" && <button className="btn btn-danger btn-sm" onClick={() => updateTestimonial(t.id, "rechazado")}><Icon.X /> Rechazar</button>}
                <button className="btn btn-icon btn-ghost" onClick={() => { if (confirm("¿Eliminar?")) deleteTestimonial(t.id); }}><Icon.Trash /></button>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="empty"><div className="empty-icon"><Icon.Star /></div><b>Sin testimonios</b><div>No hay testimonios en esta categoría</div></div>
        )}
      </div>
    </div>
  );
}

/* ============ SETTINGS ============ */
function Settings() {
  const { reset } = useStore();
  return (
    <div className="panel">
      <div className="panel-head"><h3>Configuración</h3></div>
      <div className="panel-body">
        <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 6 }}>Datos del local</h4>
            <div className="form-grid">
              <div className="field"><label>Nombre</label><input defaultValue="Impasto" /></div>
              <div className="field"><label>Teléfono</label><input defaultValue="(03757) 42-1840" /></div>
              <div className="field full"><label>Dirección</label><input defaultValue="Santa María esq. Obispo Angelelli, Puerto Iguazú" /></div>
              <div className="field full"><label>Horarios</label><input defaultValue="Martes a Domingo · 19:30 — 00:00" /></div>
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 6 }}>Delivery</h4>
            <div className="form-grid">
              <div className="field"><label>Tarifa única</label><input defaultValue="3000" /></div>
              <div className="field"><label>Área</label><input defaultValue="Puerto Iguazú, Misiones" /></div>
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: "var(--a-font-display)", fontSize: 18, marginBottom: 6 }}>Datos de demo</h4>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>Restaura todos los datos (productos, pedidos, clientes, testimonios) al estado inicial.</div>
            <button className="btn btn-danger" onClick={() => { if (confirm("¿Restaurar datos de demo? Se perderán los cambios.")) reset(); }}>Restaurar datos de demo</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AdminPages2 = { Customers, Testimonials, Settings };
