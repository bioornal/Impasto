"use client";
import { useEffect, useId, useRef, useState } from 'react';
import type { AnalisisOferta, PedidoAnalisis, ProductoOferta } from '@/lib/promos';
import { cabeRotulo, casosGrafico, escalaGrafico, geometriaBarra, pedidosNoche, referenciaPizza } from '@/lib/promos-grafico';
const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const series = ['Te queda', 'El cliente ahorra', 'Costo (receta + caja)'];
type FilaGrafico = { nombre: string; pedido?: PedidoAnalisis; noche: number | null; sobrante?: number | null };
function Barras({ filas, referencia }: { filas: FilaGrafico[]; referencia?: {nombre:string;valor:number} | null }) {
  const [activa, setActiva] = useState<number | null>(null), [ancho, setAncho] = useState(0);
  const ref = useRef<HTMLDivElement>(null), id = useId();
  useEffect(() => {
    const observer = new ResizeObserver(() => setAncho(ref.current?.querySelector(".promo-plot")?.getBoundingClientRect().width ?? 0));
    if(ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const escala = escalaGrafico(filas.map(f => f.pedido ? geometriaBarra(f.pedido, 1).total : 0), referencia?.valor);
  const resumen = filas.map(f => `${f.nombre}: ${f.pedido ? `te queda ${dinero(f.pedido.teQueda)}, el cliente ahorra ${dinero(f.pedido.resignas)}, costo ${dinero(f.pedido.costo)}` : 'revisar datos'}`).join('. ');
  return <div className="promo-barras" ref={ref} aria-label={resumen}>
    <ul className="promo-leyenda">{series.map((s,i)=><li key={s}><i className={`promo-serie-${i}`} />{s}</li>)}</ul>
    {referencia && <p className="promo-referencia-texto">Hoy, 1 {referencia.nombre} te deja {dinero(referencia.valor)}</p>}
    <div className="promo-eje"><span aria-hidden="true"></span><div>{escala.marcas.map(m=><span key={m.valor} style={{left:`${m.posicion}%`}}>{dinero(m.valor)}</span>)}</div></div>
    {filas.map((f,i)=>{
      const p=f.pedido, g=p ? geometriaBarra(p,escala.max) : null;
      const representable = p && p.teQueda >= 0 && p.resignas >= 0;
      return <div className="promo-grafico-fila" key={`${f.nombre}-${i}`}>
        <span className="promo-nombre">{f.nombre}</span>
        <div className="promo-plot">
          {escala.marcas.map(m=><i aria-hidden="true" className="promo-grilla" key={m.valor} style={{left:`${m.posicion}%`}} />)}
          {referencia && <i aria-hidden="true" className="promo-referencia" style={{left:`${geometriaBarra({teQueda:referencia.valor,resignas:0,costo:0},escala.max).ancho}%`}} />}
          <button type="button" className="promo-barra-boton" aria-label={`Ver importes de ${f.nombre}`} aria-describedby={activa===i ? id : undefined} onMouseEnter={()=>setActiva(i)} onMouseLeave={()=>setActiva(null)} onFocus={()=>setActiva(i)} onBlur={()=>setActiva(null)} onClick={()=>setActiva(i)} onKeyDown={e=>{if(e.key==='Escape')setActiva(null);}}>
            {representable && g ? <span className="promo-barra" role="img" aria-label={`${f.nombre}: ${series.map((s,j)=>`${s} ${dinero(g.segmentos[j].valor)}`).join(', ')}`} style={{width:`${g.ancho}%`}}>{g.segmentos.map((s,j)=><span className={`promo-segmento promo-serie-${j}`} key={j} style={{width:`${geometriaBarra({teQueda:s.valor,resignas:0,costo:0},g.total).ancho}%`}}>{cabeRotulo(s.ancho,dinero(s.valor),ancho) ? dinero(s.valor) : ''}</span>)}</span> : <span className="promo-sin-barra">{p ? 'Importes negativos: revisá el detalle' : 'Revisá los datos de esta promoción'}</span>}
          </button>
        </div>
        {activa===i && <div id={id} role="tooltip" className="promo-tooltip"><strong>{f.nombre}</strong>{p ? <><span>Paga el cliente: {dinero(p.paga)}</span><span>Te queda: {dinero(p.teQueda)}</span><span>El cliente ahorra: {dinero(p.resignas)}</span><span>Costo: {dinero(p.costo)}</span><span>Pedidos para cubrir la noche: {f.noche ?? 'Sin dato'}{f.sobrante != null ? ` · te sobran ${dinero(f.sobrante)}` : ''}</span></> : <span>Completá o corregí los datos.</span>}</div>}
      </div>;
    })}
  </div>;
}
export function GraficoDetalleOferta({analisis:a}: {analisis:AnalisisOferta}) {
  if(a.margen.errores.length) return null;
  return <section className="promo-grafico-detalle" aria-label="Gráfico del detalle"><h4>Así se reparte cada pedido</h4><Barras filas={casosGrafico(a).map(p=>({nombre:p.nombre,pedido:p,noche:null}))} /></section>;
}
export function GraficoOfertas({filas,productos,gastoFijoNoche}: {filas: {id:string;nombre:string;analisis:AnalisisOferta}[]; productos:ProductoOferta[]; gastoFijoNoche:number|null}) {
  if(!filas.length) return null;
  const datos=filas.map(f=>({nombre:f.nombre,pedido:f.analisis.peorPedido,noche:f.analisis.combosParaCubrirNoche,sobrante:f.analisis.sobranteNoche}));
  const noche=datos.map(f=>({...f,noche:f.pedido ? pedidosNoche(gastoFijoNoche,f.pedido.teQueda) : null}));
  const escala=escalaGrafico(noche.map(f=>f.noche ?? 0));
  return <div className="promo-graficos">
    <section><h4>Comparación de promociones</h4><p className="text-muted">Peor caso: el pedido que menos te deja. Precio normal = te queda + ahorro + costo.</p><Barras filas={datos} referencia={referenciaPizza(productos)} /></section>
    {gastoFijoNoche !== null && Number.isFinite(gastoFijoNoche) && gastoFijoNoche >= 0 && <section className="promo-noche"><h4>Pedidos para cubrir la noche (delivery + luz)</h4><p className="text-muted">Menos es mejor. Al lado, lo que te sobra después de pagar delivery y luz con esos pedidos. Antes de tarjeta, envío y pauta.</p>{noche.map((f,i)=><div className="promo-noche-fila" key={i}><span>{f.nombre}</span><div role="img" aria-label={`${f.nombre}: ${f.noche ?? 'sin dato'} pedidos${f.sobrante != null ? `, sobran ${dinero(f.sobrante)}` : ''}`}><i style={{width:`${geometriaBarra({teQueda:f.noche ?? 0,resignas:0,costo:0},escala.max).ancho}%`}} /><b>{f.noche ?? 'Sin dato'}{f.sobrante != null ? ` · sobran ${dinero(f.sobrante)}` : ''}</b></div></div>)}</section>}
  </div>;
}
