import type { AnalisisOferta, PedidoAnalisis, ProductoOferta } from './promos';
export function casosGrafico(a: AnalisisOferta): PedidoAnalisis[] {
  const casos = a.casosGrafico ?? a.pedidos;
  const unicos = casos.filter((p, i) => !casos.slice(0, i).some(q => q.paga === p.paga && q.costo === p.costo && q.resignas === p.resignas && q.nombre === p.nombre.replace('Mejor caso', 'Peor caso')));
  return unicos.length === 1 ? [{ ...unicos[0], nombre: 'Pedido' }] : unicos;
}
export function referenciaPizza(productos: readonly ProductoOferta[]) {
  const p = [...productos].filter(p => p.categoria === 'pizzas' && Number.isFinite(p.precio) && p.precio > 0).sort((a,b) => a.precio-b.precio || (b.costo ?? 0)-(a.costo ?? 0))[0];
  return p && p.costo !== null && Number.isFinite(p.costo) && p.precio > p.costo ? { nombre:p.nombre, valor:p.precio-p.costo } : null;
}
export function escalaGrafico(valores: readonly number[], referencia = 0) {
  const mayor = Math.max(1, referencia, ...valores.filter(Number.isFinite));
  const base = 10 ** Math.floor(Math.log10(mayor));
  const paso = base * (mayor/base <= 2 ? .5 : mayor/base <= 8 ? 1 : 2);
  const max = Math.ceil(mayor/paso)*paso;
  return { max, marcas: Array.from({length:Math.round(max/paso)+1}, (_,i)=>({valor:i*paso,posicion:i*paso/max*100})) };
}
export function geometriaBarra(p: Pick<PedidoAnalisis,'teQueda'|'resignas'|'costo'>, max: number) {
  let inicio=0;
  const segmentos = [p.teQueda,p.resignas,p.costo].map(valor => {
    const ancho = Math.max(0,Number.isFinite(valor) ? valor : 0)/Math.max(1,max)*100;
    const segmento={valor,inicio,ancho}; inicio+=ancho; return segmento;
  });
  return {total:p.teQueda+p.resignas+p.costo,ancho:inicio,segmentos};
}
export function pedidosNoche(gasto: number | null, queda: number): number | null {
  return gasto !== null && Number.isFinite(gasto) && gasto >= 0 && queda > 0 ? Math.ceil(gasto/queda) : null;
}
export function cabeRotulo(anchoPct: number, texto: string, anchoDisponible: number) {
  return anchoPct/100*anchoDisponible >= texto.length*7+12;
}
