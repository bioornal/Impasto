"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { margenOferta, resumenOferta, validarOferta, type MargenOferta, type Oferta, type OfertaInput, type ProductoOferta } from "@/lib/promos";

type Fila = Oferta & { margen: MargenOferta };
const Contexto = createContext<ReturnType<typeof useDatos> | null>(null);
function useDatos() {
  const [ofertas, setOfertas] = useState<Fila[]>([]), [productos, setProductos] = useState<ProductoOferta[]>([]);
  const [comisionPct, setComision] = useState(7.99), [cargando, setCargando] = useState(true), [error, setError] = useState("");
  const solicitud = useRef(0);
  const recargar = useCallback(async () => {
    const turno = ++solicitud.current;
    setCargando(true);
    try {
      const res = await fetch("/api/admin/ofertas", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudieron cargar las promociones.");
      if (turno !== solicitud.current) return false;
      setOfertas(data.data); setProductos(data.productos); setComision(data.comisionPct); setError("");
      return true;
    } catch (e) { if (turno === solicitud.current) setError(e instanceof Error ? e.message : "No se pudieron cargar las promociones."); return false; }
    finally { if (turno === solicitud.current) setCargando(false); }
  }, []);
  useEffect(() => {
    // Carga inicial del recurso remoto; el estado de carga también sirve al reintentar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recargar();
  }, [recargar]);
  return { ofertas, productos, comisionPct, cargando, error, recargar };
}
export function PromocionesProvider({ children }: { children: ReactNode }) { const datos = useDatos(); return <Contexto.Provider value={datos}>{children}</Contexto.Provider>; }
export function usePromociones() { const datos = useContext(Contexto); if (!datos) throw new Error("Falta PromocionesProvider"); return datos; }
const dinero = (n: number | null) => n === null ? "Sin calcular" : `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const tipos = { combo: "Combo", descuento_cantidad: "Descuento por cantidad", regalo: "Regalo" };
const dias = [[1, "Lu"], [2, "Ma"], [3, "Mi"], [4, "Ju"], [5, "Vi"], [6, "Sá"], [0, "Do"]] as const;
const estados = { pendiente: "Pendiente", aprobada: "Aprobada", pausada: "Pausada" };
const nueva = (): OfertaInput => ({ tipo: "combo", nombre: "", titulo: "", descripcion: "", config: { precio: 0, lugares: [{ cantidad: 1, productos: [] }] }, dias: [5, 6, 0], desde: null, hasta: null, orden: 0 });

function Margen({ margen: m, detalle = false, tipo }: { margen: MargenOferta; detalle?: boolean; tipo: OfertaInput["tipo"] }) {
  return <div className={`oferta-margen oferta-${m.semaforo}`}>
    <strong>{m.errores.length ? "Revisar" : `${m.semaforo === "rojo" ? "Rojo" : m.semaforo === "ambar" ? "Ámbar" : "Verde"} · ${dinero(m.peor)}`}</strong>
    {m.errores.length ? <span>{m.errores.join(" ")}</span> : <>
      <span>{tipo === "descuento_cantidad" ? "Deja la pizza descontada" : "Peor caso del combo o pedido"}{m.mejor !== m.peor ? ` · mejor caso ${dinero(m.mejor)}` : ""}</span>
      {detalle && <>
        <span>Ahorro del cliente: {dinero(m.ahorroMinimo)}{m.ahorroMaximo !== m.ahorroMinimo ? ` a ${dinero(m.ahorroMaximo)}` : ""}</span>
        {m.pedidoMinimo !== null && <span>Deja el pedido mínimo con las pizzas más baratas: {dinero(m.pedidoMinimo)}</span>}
        {m.costoRegalo !== null && <span>Costo del regalo (opción más cara): {dinero(m.costoRegalo)}</span>}
        <span>Con tarjeta, peor caso: {dinero(m.conTarjetaPeor)}.</span>
        <span>Receta + caja. Sin delivery ni luz. Rojo: deja $0 o pérdida; ámbar: menos de $2.000.</span>
      </>}
    </>}
  </div>;
}

function SelectorProductos({ productos, seleccionados, onChange, categoria }: { productos: ProductoOferta[]; seleccionados: string[]; onChange: (ids: string[]) => void; categoria?: ProductoOferta["categoria"] }) {
  const [busqueda, setBusqueda] = useState(""); const id = useId();
  const opciones = productos.filter(p => (!categoria || p.categoria === categoria) && p.nombre.toLocaleLowerCase("es-AR").includes(busqueda.toLocaleLowerCase("es-AR")));
  return <div className="oferta-selector">
    <label htmlFor={id}>Buscar productos</label><input id={id} type="search" placeholder="Escribí un nombre…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
    <div className="oferta-elegidos">{seleccionados.length} seleccionado(s)
      {seleccionados.map(id => <button type="button" className="btn btn-sm btn-ghost" key={id} onClick={() => onChange(seleccionados.filter(v => v !== id))}>Quitar {productos.find(p => p.id === id)?.nombre ?? "producto no disponible"}</button>)}
    </div>
    <div className="oferta-opciones">{opciones.map(p => <label key={p.id}><input type="checkbox" checked={seleccionados.includes(p.id)} onChange={e => onChange(e.target.checked ? [...seleccionados, p.id] : seleccionados.filter(v => v !== p.id))} /><span>{p.nombre}<small>{dinero(p.precio)}</small></span></label>)}{!opciones.length && <p className="text-muted">No hay productos para esa búsqueda.</p>}</div>
  </div>;
}

function Editor({ inicial, guardar, cerrar, ocupado, error }: { inicial: OfertaInput; guardar: (o: OfertaInput) => void; cerrar: () => void; ocupado: boolean; error: string }) {
  const { productos, comisionPct } = usePromociones(); const [o, set] = useState<OfertaInput>(() => structuredClone(inicial));
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  const errores = validarOferta(o, productos), margen = margenOferta(o, productos, comisionPct);
  const cambiarTipo = (tipo: OfertaInput["tipo"]) => {
    if (tipo === "combo") set({ ...o, tipo, config: { precio: 0, lugares: [{ cantidad: 1, productos: [] }] } });
    if (tipo === "descuento_cantidad") set({ ...o, tipo, config: { cada: 2, porcentaje: 50, productos: null } });
    if (tipo === "regalo") set({ ...o, tipo, config: { minimoPizzas: 2, cantidad: 1, opciones: [] } });
  };
  return <dialog ref={ref} className="oferta-dialog" aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!ocupado) cerrar(); }} onClick={e => { if (e.target === e.currentTarget && !ocupado) cerrar(); }}>
    <form onSubmit={e => { e.preventDefault(); if (!errores.length && !ocupado) guardar(o); }}>
      <div className="oferta-dialog-head"><h3 id={id}>{"id" in inicial ? "Editar promoción" : "Nueva promoción"}</h3><button type="button" className="btn btn-ghost" disabled={ocupado} onClick={cerrar}>Cerrar</button></div>
      <fieldset disabled={ocupado} className="oferta-form">
        <label>Tipo<select value={o.tipo} onChange={e => cambiarTipo(e.target.value as OfertaInput["tipo"])}>{Object.entries(tipos).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label>Nombre interno<input autoFocus required maxLength={200} value={o.nombre} onChange={e => set({ ...o, nombre: e.target.value })} /></label>
        <label>Título para el cliente<input required maxLength={200} value={o.titulo} onChange={e => set({ ...o, titulo: e.target.value })} /></label>
        <label>Descripción para el cliente<textarea maxLength={2000} rows={2} value={o.descripcion} onChange={e => set({ ...o, descripcion: e.target.value })} /></label>
        {o.tipo === "combo" && <>
          <label>Precio del combo ($)<input type="number" min="0.01" step="0.01" value={o.config.precio} onChange={e => set({ ...o, config: { ...o.config, precio: Number(e.target.value) } })} /></label>
          {o.config.lugares.map((l, i) => <fieldset className="oferta-grupo" key={i}><legend>Lugar {i + 1}</legend>
            <label>Etiqueta (opcional)<input maxLength={200} value={l.etiqueta ?? ""} onChange={e => set({ ...o, config: { ...o.config, lugares: o.config.lugares.map((v, n) => n === i ? { ...v, etiqueta: e.target.value } : v) } })} /></label>
            <label>Cantidad<input type="number" min={1} max={100} value={l.cantidad} onChange={e => set({ ...o, config: { ...o.config, lugares: o.config.lugares.map((v, n) => n === i ? { ...v, cantidad: Number(e.target.value) } : v) } })} /></label>
            <SelectorProductos productos={productos} seleccionados={l.productos} onChange={ids => set({ ...o, config: { ...o.config, lugares: o.config.lugares.map((v, n) => n === i ? { ...v, productos: ids } : v) } })} />
            <small>Un producto: fijo. Varios: a elección.</small><button type="button" className="btn btn-sm btn-danger" onClick={() => set({ ...o, config: { ...o.config, lugares: o.config.lugares.filter((_, n) => n !== i) } })}>Quitar lugar</button>
          </fieldset>)}
          <button type="button" className="btn" onClick={() => set({ ...o, config: { ...o.config, lugares: [...o.config.lugares, { cantidad: 1, productos: [] }] } })}>Agregar lugar</button>
        </>}
        {o.tipo === "descuento_cantidad" && <>
          <label>Cada cuántas pizzas<input type="number" min={2} max={100} value={o.config.cada} onChange={e => set({ ...o, config: { ...o.config, cada: Number(e.target.value) } })} /></label>
          <label>Descuento en la más barata (%)<input type="number" min="0.01" max={100} step="0.01" value={o.config.porcentaje} onChange={e => set({ ...o, config: { ...o.config, porcentaje: Number(e.target.value) } })} /></label>
          <label className="oferta-check"><input type="checkbox" checked={o.config.productos === null} onChange={e => set({ ...o, config: { ...o.config, productos: e.target.checked ? null : [] } })} />Todas las pizzas en venta</label>
          {o.config.productos !== null && <SelectorProductos productos={productos} categoria="pizzas" seleccionados={o.config.productos} onChange={ids => set({ ...o, config: { ...o.config, productos: ids } })} />}
        </>}
        {o.tipo === "regalo" && <>
          <label>Mínimo de pizzas<input type="number" min={1} max={100} value={o.config.minimoPizzas} onChange={e => set({ ...o, config: { ...o.config, minimoPizzas: Number(e.target.value) } })} /></label>
          <label>Cantidad de regalos<input type="number" min={1} max={100} value={o.config.cantidad} onChange={e => set({ ...o, config: { ...o.config, cantidad: Number(e.target.value) } })} /></label>
          <SelectorProductos productos={productos} categoria="bebidas" seleccionados={o.config.opciones.map(v => v.producto)} onChange={ids => set({ ...o, config: { ...o.config, opciones: ids.map(producto => o.config.opciones.find(v => v.producto === producto) ?? { producto, suplemento: 0 }) } })} />
          {o.config.opciones.map((v, i) => <label key={v.producto}>Suplemento por unidad · {productos.find(p => p.id === v.producto)?.nombre ?? "No disponible"} ($)<input type="number" min={0} step="0.01" value={v.suplemento} onChange={e => set({ ...o, config: { ...o.config, opciones: o.config.opciones.map((v, n) => n === i ? { ...v, suplemento: Number(e.target.value) } : v) } })} /></label>)}
        </>}
        <fieldset className="oferta-grupo"><legend>Días de la semana</legend><div className="oferta-dias">{dias.map(([dia, nombre]) => <label key={dia}><input type="checkbox" checked={o.dias.includes(dia)} onChange={e => set({ ...o, dias: e.target.checked ? [...o.dias, dia] : o.dias.filter(d => d !== dia) })} />{nombre}</label>)}</div></fieldset>
        <div className="oferta-fechas"><label>Desde (opcional)<input type="date" value={o.desde ?? ""} onChange={e => set({ ...o, desde: e.target.value || null })} /></label><label>Hasta (opcional)<input type="date" value={o.hasta ?? ""} onChange={e => set({ ...o, hasta: e.target.value || null })} /></label></div>
        <label>Orden<input type="number" step={1} value={o.orden} onChange={e => set({ ...o, orden: Number(e.target.value) })} /></label>
      </fieldset>
      <div className="oferta-preview" aria-live="polite"><h4>Margen en vivo</h4><Margen margen={margen} detalle tipo={o.tipo} /><small>Comisión de tarjeta: {comisionPct}%. El semáforo usa el margen sin tarjeta.</small></div>
      {error && <p role="alert" className="oferta-error">{error}</p>}
      <div className="oferta-dialog-foot"><small>{"id" in inicial ? "Al guardar se mantiene el estado actual." : "Se guarda como pendiente. Después la aprobás desde la lista."}</small><button className="btn btn-primary" type="submit" disabled={ocupado || errores.length > 0}>{ocupado ? "Guardando…" : "Guardar promoción"}</button></div>
    </form>
  </dialog>;
}

export function Promociones() {
  const { ofertas, productos, cargando, error, recargar } = usePromociones();
  const [filtro, setFiltro] = useState("pendiente"), [editor, setEditor] = useState<OfertaInput | Oferta | null>(null);
  const [ocupado, setOcupado] = useState(false), [fallo, setFallo] = useState("");
  // Al volver de Productos, refresca disponibilidad y costos antes de mostrar acciones.
  useEffect(() => {
    void recargar();
    const alVolver = () => { void recargar(); };
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, [recargar]);
  const mutar = async (url: string, method: string, body?: unknown) => {
    setOcupado(true); setFallo("");
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo guardar el cambio.");
      setEditor(null); await recargar();
    } catch (e) { setFallo(e instanceof Error ? e.message : "No se pudo guardar el cambio. Reintentá."); }
    finally { setOcupado(false); }
  };
  return <div className="panel ofertas-panel">
    <p className="oferta-aviso">Todavía no se muestran en la web: eso es la próxima etapa.</p>
    <div className="panel-head"><h3>Promociones</h3><div className="oferta-acciones"><button className="btn btn-ghost" disabled={cargando || ocupado} onClick={() => void recargar()}>Actualizar</button><button className="btn btn-primary" disabled={cargando || !!error || ocupado} onClick={() => { setFallo(""); setEditor(nueva()); }}>Nueva promoción</button></div></div>
    <div className="panel-body">
      <div className="oferta-filtros" aria-label="Filtrar promociones">{[["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["pausada", "Pausadas"], ["todas", "Todas"]].map(([v, label]) => <button key={v} className={`btn btn-sm ${filtro === v ? "btn-primary" : "btn-ghost"}`} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{label}</button>)}</div>
      {(error || fallo) && <p className="oferta-error" role="alert">{error || fallo} {error && <button className="btn btn-sm" disabled={cargando} onClick={() => void recargar()}>Reintentar</button>}</p>}
      {cargando && <p role="status">Cargando promociones…</p>}
      {!cargando && !error && <ul className="ofertas-lista">{ofertas.filter(o => filtro === "todas" || o.estado === filtro).map(o => <li key={o.id}>
        <div className="oferta-info"><strong>{o.nombre}</strong><span className="text-muted">{tipos[o.tipo]} · {resumenOferta(o, productos)}</span><small>{dias.filter(([d]) => o.dias.includes(d)).map(([, n]) => n).join(" · ")}{o.desde ? ` · Desde ${o.desde}` : ""}{o.hasta ? ` · Hasta ${o.hasta}` : ""}</small><small>{estados[o.estado]}{o.margen.errores.length ? " · Revisar" : ""} · Última edición: {new Date(o.actualizada_en).toLocaleString("es-AR")}</small></div>
        <Margen margen={o.margen} tipo={o.tipo} />
        <div className="oferta-acciones">
          {o.estado === "pendiente" && <button className="btn btn-sm btn-primary" disabled={ocupado || o.margen.semaforo === "rojo"} onClick={() => void mutar(`/api/admin/ofertas/${o.id}/estado`, "POST", { accion: "aprobar" })}>Aprobar</button>}
          {o.estado === "aprobada" && <button className="btn btn-sm" disabled={ocupado} onClick={() => void mutar(`/api/admin/ofertas/${o.id}/estado`, "POST", { accion: "pausar" })}>Pausar</button>}
          {o.estado === "pausada" && <button className="btn btn-sm" disabled={ocupado || o.margen.semaforo === "rojo"} onClick={() => void mutar(`/api/admin/ofertas/${o.id}/estado`, "POST", { accion: "reanudar" })}>Reanudar</button>}
          <button className="btn btn-sm btn-ghost" disabled={ocupado} onClick={() => { setFallo(""); setEditor(o); }}>Editar</button><button className="btn btn-sm btn-danger" disabled={ocupado} onClick={() => { if (confirm(`¿Eliminar la promoción «${o.nombre}»? No se puede deshacer.`)) void mutar(`/api/admin/ofertas/${o.id}`, "DELETE"); }}>Eliminar</button>
        </div>
      </li>)}{!ofertas.some(o => filtro === "todas" || o.estado === filtro) && <li className="text-muted">No hay promociones en este filtro.</li>}</ul>}
    </div>
    {editor && <Editor inicial={editor} ocupado={ocupado} error={fallo} cerrar={() => setEditor(null)} guardar={o => void mutar("id" in editor ? `/api/admin/ofertas/${editor.id}` : "/api/admin/ofertas", "id" in editor ? "PUT" : "POST", o)} />}
  </div>;
}
