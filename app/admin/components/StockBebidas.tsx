"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './StoreProvider';
import { stockDesdeTexto, stockPorId, type StockBebidas as Stock, type FilaStockBebida } from '@/lib/stock-bebidas';

const ESPERA_GUARDADO_MS = 700;
type Cambio = {unidades:number|null} | {ajuste:number};

/** Un inventario entre noches. Los borradores tienen prioridad sobre los refrescos. */
export function useStockBebidas() {
  const { showToast } = useStore();
  const [filas, setFilas] = useState<Stock>({});
  const [tocados, setTocados] = useState<Stock>({});
  const [guardando, setGuardando] = useState<Record<string,boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const timers = useRef(new Map<string,ReturnType<typeof setTimeout>>());
  const cambios = useRef(new Map<string,Cambio>());
  const version = useRef(0);
  const pendientes = useRef(new Set<string>());
  const activo = useRef(true);

  const recargar = useCallback(async () => {
    const inicio = version.current;
    try {
      const res = await fetch('/api/admin/stock', {cache:'no-store'});
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo leer el stock.');
      if (!activo.current || inicio !== version.current || pendientes.current.size) return;
      setFilas(stockPorId(json.data as FilaStockBebida[]));
      setError(null); setCargado(true);
    } catch (e) {
      if (activo.current) setError(e instanceof Error ? e.message : 'No se pudo leer el stock.');
    }
  }, []);

  useEffect(() => {
    activo.current = true;
    const inicial = setTimeout(() => void recargar(),0);
    const poll = setInterval(() => void recargar(),30000);
    const actuales = timers.current;
    return () => { activo.current = false; clearTimeout(inicial); clearInterval(poll); actuales.forEach(clearTimeout); };
  },[recargar]);

  const guardar = async (id: string, nombre: string, cambio: Cambio | {compra:number}) => {
    if (pendientes.current.has(id)) return;
    version.current++;
    pendientes.current.add(id);
    cambios.current.delete(id);
    setGuardando(p => ({...p,[id]:true}));
    try {
      const res = await fetch('/api/admin/stock',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({producto_id:id,...cambio})});
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo guardar el stock.');
      showToast(`${nombre}: stock guardado`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar el stock. Reintentá.');
    } finally {
      pendientes.current.delete(id);
      if (activo.current) {
        setTocados(p => { const siguiente={...p}; delete siguiente[id]; return siguiente; });
        setGuardando(p => ({...p,[id]:false}));
        await recargar();
      }
    }
  };

  const programar = (id:string,nombre:string,unidades:number|null,cambio:Cambio) => {
    if (pendientes.current.has(id)) return;
    version.current++;
    setTocados(p => ({...p,[id]:unidades}));
    cambios.current.set(id,cambio);
    const timer=timers.current.get(id);
    if(timer) clearTimeout(timer);
    timers.current.set(id,setTimeout(() => {
      timers.current.delete(id);
      if ('ajuste' in cambio && cambio.ajuste === 0) {
        cambios.current.delete(id);
        setTocados(p => {const siguiente={...p};delete siguiente[id];return siguiente;});
        void recargar();
      } else void guardar(id,nombre,cambio);
    },ESPERA_GUARDADO_MS));
  };
  return {
    cargado, error, recargar,
    unidades:(id:string) => Object.hasOwn(tocados,id) ? tocados[id] : filas[id] ?? null,
    pendiente:(id:string) => Boolean(guardando[id]),
    tocado:(id:string) => Object.hasOwn(tocados,id),
    fijar:(id:string,nombre:string,unidades:number|null) => programar(id,nombre,unidades,{unidades}),
    paso:(id:string,nombre:string,sentido:1|-1) => {
      const previo=cambios.current.get(id);
      const actual=Object.hasOwn(tocados,id) ? tocados[id] : filas[id] ?? null;
      const unidades=(actual ?? 0)+sentido;
      const cambio:Cambio = previo && 'unidades' in previo ? {unidades} : {ajuste:((previo && 'ajuste' in previo) ? previo.ajuste : 0)+sentido};
      programar(id,nombre,unidades,cambio);
    },
    compra:(id:string,nombre:string,n:number) => guardar(id,nombre,{compra:n}),
    avisar:showToast,
  };
}

export function StockControl({productoId,nombre,stock}:{productoId:string;nombre:string;stock:ReturnType<typeof useStockBebidas>}) {
  const n = stock.unidades(productoId);
  const [texto,setTexto] = useState<string|null>(null);
  const ocupado = stock.pendiente(productoId) || !stock.cargado || Boolean(stock.error);
  const confirmar = () => {
    if(texto === null) return;
    const valor=stockDesdeTexto(texto);
    setTexto(null);
    if(valor === undefined) {stock.avisar('Poné unidades enteras desde cero.');return;}
    if(valor !== n) stock.fijar(productoId,nombre,valor);
  };
  const comprar = () => {
    const entrada=window.prompt(`¿Cuántas ${nombre} entraron?`);
    if(entrada === null) return;
    const cantidad=stockDesdeTexto(entrada);
    if(cantidad == null || cantidad === 0) {stock.avisar('Poné una cantidad entera mayor a cero.');return;}
    void stock.compra(productoId,nombre,cantidad);
  };
  return <div className="stock-acciones">
    <div className={`cupo-ctrl stock-ctrl ${n === 0 ? 'agotado' : n !== null && n <= 3 ? 'limitado' : ''}`}>
      <button type="button" disabled={ocupado || n === null || n <= 0} onClick={() => stock.paso(productoId,nombre,-1)} aria-label={`Una menos de ${nombre}`}>−</button>
      <input type="text" inputMode="numeric" aria-label={`Unidades de ${nombre}`} placeholder="—" value={texto ?? (n === null ? '' : String(n))} disabled={ocupado}
        onFocus={e => {setTexto(n === null ? '' : String(n));e.target.select();}} onChange={e => setTexto(e.target.value)} onBlur={confirmar}
        onKeyDown={e => {if(e.key === 'Enter') e.currentTarget.blur();if(e.key === 'Escape') setTexto(null);}} />
      <button type="button" disabled={ocupado || n === 2147483647} onClick={() => stock.paso(productoId,nombre,1)} aria-label={`Una más de ${nombre}`}>+</button>
    </div>
    <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado || stock.tocado(productoId)} onClick={comprar}>+ Compra</button>
    <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado || n === null} onClick={() => stock.fijar(productoId,nombre,null)}>Sin control</button>
    <small className="tbl-muted" role="status">{stock.pendiente(productoId) ? 'Guardando…' : stock.tocado(productoId) ? 'Por guardar…' : !stock.cargado ? 'Cargando…' : n === null ? 'Sin control' : n === 0 ? 'Agotado' : `${n} unidades`}</small>
  </div>;
}

export function StockBebidas() {
  const {state}=useStore();
  const stock=useStockBebidas();
  const bebidas=state.products.filter(p => p.type === 'bebida' && !p.archivado);
  return <section className="panel stock-bebidas" aria-labelledby="stock-titulo">
    <div className="panel-head"><h3 id="stock-titulo">Stock de bebidas</h3><span className="tbl-muted">Se guarda solo</span></div>
    <div className="panel-body tbl-muted">Cargá cuántas tenés ahora. Cada venta web o POS descuenta; lo que queda se conserva para la próxima noche.</div>
    {stock.error && <div className="panel-body" role="alert">{stock.error} <button className="btn btn-ghost btn-sm" onClick={() => void stock.recargar()}>Reintentar</button></div>}
    <div className="stock-lista">{bebidas.map(p => {
      const n=stock.unidades(p._dbId);
      return <div key={p._dbId} className={`stock-fila ${n === 0 ? 'stock-agotado' : n !== null && n <= 3 ? 'stock-poco' : ''}`}>
        <div className="cupo-nombre"><b>{p.nombre}</b>{!p.active && <small className="tbl-muted">Marcada agotada en Productos</small>}</div>
        <StockControl productoId={p._dbId} nombre={p.nombre} stock={stock}/>
      </div>;
    })}{bebidas.length === 0 && <p className="tbl-muted">No hay bebidas en carta.</p>}</div>
  </section>;
}
