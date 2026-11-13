/** Reglas de promociones del panel. Sin acceso a datos ni dependencias de UI. */
export type EstadoOferta = "pendiente" | "aprobada" | "pausada";
export interface ProductoOferta { id: string; nombre: string; categoria: "pizzas" | "bebidas"; precio: number; costo: number | null }
export interface LugarCombo { etiqueta?: string; cantidad: number; productos: string[] }
export type ConfigOferta =
  | { tipo: "combo"; config: { precio: number; lugares: LugarCombo[] } }
  | { tipo: "descuento_cantidad"; config: { cada: number; porcentaje: number; productos: string[] | null } }
  | { tipo: "regalo"; config: { minimoPizzas: number; cantidad: number; opciones: { producto: string; suplemento: number }[]; excluidas?: string[] } };
export type OfertaInput = ConfigOferta & { nombre: string; titulo: string; descripcion: string; dias: number[]; desde: string | null; hasta: string | null; orden: number };
export type Oferta = OfertaInput & { id: string; estado: EstadoOferta; aprobada_en: string | null; creada_en: string; actualizada_en: string; imagen?: string | null };
export interface MargenOferta {
  peor: number | null; mejor: number | null; ahorroMinimo: number | null; ahorroMaximo: number | null;
  pedidoMinimo: number | null; costoRegalo: number | null; conTarjetaPeor: number | null;
  semaforo: "rojo" | "ambar" | "verde"; errores: string[];
}
export interface ContextoNegocio {
  gastoFijoNoche: number | null; envio: number; envioGratisDesde: number; comisionPct: number;
  pedidosPorNoche: number | null; ticketPromedio: number | null;
}
/** Una lectura fallida se informa como dato ausente, nunca como cero. */
export type ContextoNegocioLeido = { [K in keyof ContextoNegocio]: ContextoNegocio[K] | null };
export interface RangoOferta { min: number; max: number }
export interface ProductoAnalisis {
  nombre: string; cantidad: number; precio: number; costo: number; lugar?: string;
  gananciaNormal?: number; precioDescuento?: number; teQueda?: number; resignas?: number;
  suplemento?: number; costoRegalo?: number;
}
export interface PedidoAnalisis {
  nombre: string; paga: number; costo: number; teQueda: number; resignas: number; gananciaNormal: number;
  ahorroPct: number; gananciaPct: number; conTarjeta: number | null;
  envio: { pagaCliente: number; resignas: number } | null; costoRegalo?: number; regaloPct?: number;
}
type TotalesAnalisis = Record<"precioNormal" | "paga" | "ahorroCliente" | "ahorroClientePct" | "costo" | "teQueda" | "gananciaPct" | "gananciaNormal" | "resignas", RangoOferta> & { conTarjeta: RangoOferta | null };
export interface AnalisisOferta {
  casosGrafico?: PedidoAnalisis[]; peorPedido?: PedidoAnalisis;
  margen: MargenOferta;
  resumen: { ahorroCliente: number | null; ahorroClientePct: number | null; teQueda: number | null; resignas: number | null };
  totales: TotalesAnalisis; productos: ProductoAnalisis[]; pedidos: PedidoAnalisis[];
  envio: { pagaCliente: RangoOferta; resignas: RangoOferta } | null;
  conviertePedidoUnaPizza: RangoOferta | null; combosParaCubrirNoche: number | null; sobranteNoche: number | null; veredicto: string;
}

/** Receta + caja. Los rangos abarcan opciones reales, sin enumerar combinaciones de lugares. */
export function analisisOferta(oferta: OfertaInput, productos: readonly ProductoOferta[], contexto: ContextoNegocioLeido): AnalisisOferta {
  const margen = margenOferta(oferta, productos, contexto.comisionPct ?? undefined);
  const rango = (vs: number[]): RangoOferta => ({ min: Math.min(...vs), max: Math.max(...vs) });
  const a: AnalisisOferta = {
    margen, resumen: { ahorroCliente: null, ahorroClientePct: null, teQueda: null, resignas: null },
    totales: {} as TotalesAnalisis, productos: [], pedidos: [], envio: null,
    conviertePedidoUnaPizza: null, combosParaCubrirNoche: null, sobranteNoche: null, veredicto: "Completá los datos y revisá los productos para ver los números.",
  };
  if (margen.errores.length) return a;
  const ps = productos as readonly (ProductoOferta & { costo: number })[];
  const producto = (id: string) => ps.find(p => p.id === id)!;
  const pizzas = ps.filter(p => p.categoria === "pizzas");
  const tasa = numero(contexto.comisionPct) && contexto.comisionPct >= 0 && contexto.comisionPct < 100 ? contexto.comisionPct / 100 : null;
  const envio = (paga: number) => {
    if (contexto.envio === null || contexto.envioGratisDesde === null) return null;
    // Con promo el envío es gratis siempre (decisión del dueño, 13/11/2026): se resigna el envío.
    return { pagaCliente: 0, resignas: contexto.envio };
  };
  const pedido = (nombre: string, normal: number, paga: number, costo: number, costoRegalo?: number): PedidoAnalisis => ({
    nombre, paga, costo, teQueda: paga - costo, resignas: normal - paga, gananciaNormal: normal - costo,
    ahorroPct: (normal - paga) / normal * 100, gananciaPct: (paga - costo) / paga * 100,
    conTarjeta: tasa === null ? null : paga * (1 - tasa) - costo, envio: envio(paga),
    ...(costoRegalo === undefined ? {} : { costoRegalo, regaloPct: costoRegalo / paga * 100 }),
  });
  let casos: PedidoAnalisis[] = [];
  if (oferta.tipo === "combo") {
    let precioMin = 0, precioMax = 0, costoMin = 0, costoMax = 0, normalMin = 0, normalMax = 0;
    const pizzasCombo: typeof pizzas[number][] = [];
    oferta.config.lugares.forEach((l, i) => {
      const opciones = l.productos.map(producto), n = l.cantidad;
      precioMin += n * Math.min(...opciones.map(p => p.precio)); precioMax += n * Math.max(...opciones.map(p => p.precio));
      costoMin += n * Math.min(...opciones.map(p => p.costo)); costoMax += n * Math.max(...opciones.map(p => p.costo));
      normalMin += n * Math.min(...opciones.map(p => p.precio - p.costo)); normalMax += n * Math.max(...opciones.map(p => p.precio - p.costo));
      opciones.forEach(p => { a.productos.push({ nombre: p.nombre, cantidad: n, precio: p.precio, costo: p.costo, lugar: l.etiqueta || `Lugar ${i + 1}` }); if (p.categoria === "pizzas") pizzasCombo.push(p); });
    });
    // Con precio fijo, costo y ahorro tienen extremos independientes; ganancia normal conserva la correlación precio/costo.
    casos = [pedido("Combo", precioMin, oferta.config.precio, costoMax), pedido("Combo", precioMax, oferta.config.precio, costoMin)];
    a.totales.gananciaNormal = { min: normalMin, max: normalMax };
    // Cada barra debe conservar precio y costo de las mismas opciones reales.
    a.casosGrafico = [true, false].map(peor => {
      let normal = 0, costo = 0;
      oferta.config.lugares.forEach(l => {
        const opciones = l.productos.map(producto).sort((x, y) => peor ? y.costo - x.costo || y.precio - x.precio : x.costo - y.costo || x.precio - y.precio);
        normal += l.cantidad * opciones[0].precio; costo += l.cantidad * opciones[0].costo;
      });
      return pedido(peor ? "Peor caso" : "Mejor caso", normal, oferta.config.precio, costo);
    });
    if (pizzasCombo.length) {
      const barata = [...pizzasCombo].sort((x, y) => x.precio - y.precio || y.costo - x.costo)[0];
      a.conviertePedidoUnaPizza = { min: casos[0].teQueda - (barata.precio - barata.costo), max: casos[1].teQueda - (barata.precio - barata.costo) };
    }
  } else if (oferta.tipo === "descuento_cantidad") {
    const c = oferta.config, elegibles = [...(c.productos === null ? pizzas : c.productos.map(producto))].sort((x, y) => x.precio - y.precio || y.costo - x.costo);
    elegibles.forEach(p => {
      const descontado = p.precio * (1 - c.porcentaje / 100);
      a.productos.push({ nombre: p.nombre, cantidad: 1, precio: p.precio, costo: p.costo, gananciaNormal: p.precio - p.costo, precioDescuento: descontado, teQueda: descontado - p.costo, resignas: p.precio - descontado });
      // La descontada debe ser la más barata del grupo. Extremos lineales y de cocientes ocurren en estos vértices.
      elegibles.filter(q => q.precio >= p.precio).forEach(q => casos.push(pedido("", p.precio + (c.cada - 1) * q.precio, descontado + (c.cada - 1) * q.precio, p.costo + (c.cada - 1) * q.costo)));
    });
    const barata = elegibles[0], cara = elegibles[elegibles.length - 1];
    a.pedidos = [[barata, barata], [barata, cara], [cara, cara]].map(([p, q]) => pedido(`${p.nombre} + ${c.cada - 1} × ${q.nombre}`, p.precio + (c.cada - 1) * q.precio, p.precio * (1 - c.porcentaje / 100) + (c.cada - 1) * q.precio, p.costo + (c.cada - 1) * q.costo));
  } else {
    const c = oferta.config, cuentan = pizzas.filter(p => !(c.excluidas ?? []).includes(p.id));
    const ordenadas = [...cuentan].sort((x, y) => x.precio - y.precio || y.costo - x.costo);
    const regaloPedido = (p: typeof pizzas[number], o: typeof c.opciones[number]) => {
      const bebida = producto(o.producto), neto = c.cantidad * (bebida.costo - o.suplemento);
      return pedido(`${c.minimoPizzas} × ${p.nombre} + ${c.cantidad} × ${bebida.nombre}`, c.minimoPizzas * p.precio + c.cantidad * bebida.precio, c.minimoPizzas * p.precio + c.cantidad * o.suplemento, c.minimoPizzas * p.costo + c.cantidad * bebida.costo, neto);
    };
    c.opciones.forEach(o => {
      const p = producto(o.producto);
      a.productos.push({ nombre: p.nombre, cantidad: c.cantidad, precio: p.precio, costo: p.costo, suplemento: o.suplemento, costoRegalo: c.cantidad * (p.costo - o.suplemento), resignas: c.cantidad * (p.precio - o.suplemento) });
      cuentan.forEach(p => casos.push(regaloPedido(p, o)));
    });
    a.pedidos = [ordenadas[0], ordenadas[ordenadas.length - 1]].flatMap(p => c.opciones.map(o => regaloPedido(p, o)));
  }
  const reales = a.casosGrafico ?? casos;
  a.peorPedido = reales.reduce((peor, p) => p.teQueda < peor.teQueda || (p.teQueda === peor.teQueda && p.resignas > peor.resignas) ? p : peor);
  a.casosGrafico ??= a.pedidos.length ? a.pedidos : reales;
  const campos = {
    precioNormal: (p: PedidoAnalisis) => p.paga + p.resignas, paga: (p: PedidoAnalisis) => p.paga,
    ahorroCliente: (p: PedidoAnalisis) => p.resignas, ahorroClientePct: (p: PedidoAnalisis) => p.ahorroPct,
    costo: (p: PedidoAnalisis) => p.costo, teQueda: (p: PedidoAnalisis) => p.teQueda, gananciaPct: (p: PedidoAnalisis) => p.gananciaPct,
    resignas: (p: PedidoAnalisis) => p.resignas,
  };
  for (const [k, fn] of Object.entries(campos)) a.totales[k as keyof typeof campos] = rango(casos.map(fn));
  if (oferta.tipo !== "combo") a.totales.gananciaNormal = rango(casos.map(p => p.gananciaNormal));
  a.totales.conTarjeta = tasa === null ? null : rango(casos.map(p => p.conTarjeta!));
  if (casos.every(p => p.envio !== null)) a.envio = { pagaCliente: rango(casos.map(p => p.envio!.pagaCliente)), resignas: rango(casos.map(p => p.envio!.resignas)) };
  a.resumen = { ahorroCliente: a.totales.ahorroCliente.min, ahorroClientePct: Math.round(a.totales.ahorroClientePct.min), teQueda: a.totales.teQueda.min, resignas: a.totales.resignas.max };
  const teQueda = a.totales.teQueda.min, resignas = a.totales.resignas.max;
  if (contexto.gastoFijoNoche !== null && Number.isFinite(contexto.gastoFijoNoche) && contexto.gastoFijoNoche >= 0 && teQueda > 0) { a.combosParaCubrirNoche = Math.ceil(contexto.gastoFijoNoche / teQueda); a.sobranteNoche = Math.round(a.combosParaCubrirNoche * teQueda - contexto.gastoFijoNoche); }
  const monto = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
  a.veredicto = `Te queda al menos ${monto(teQueda)} por pedido${a.combosParaCubrirNoche === null ? "; falta un gasto fijo válido o una ganancia positiva para calcular cuántos cubren la noche" : `; cubrís la noche con ${a.combosParaCubrirNoche} ${oferta.tipo === "combo" ? "combos" : "pedidos"} y te sobran ${monto(a.sobranteNoche ?? 0)}`}. Si el cliente ya iba a comprar lo mismo, resignás hasta ${monto(resignas)}${a.envio && a.envio.resignas.max > 0 ? `, más ${monto(a.envio.resignas.max)} de envío cuando llega al envío gratis` : ""}.`;
  return a;
}
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const cantidad = (v: unknown): v is number => numero(v) && Number.isSafeInteger(v) && v >= 1 && v <= 100;
const fecha = (v: unknown) => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const pesos = (v: number) => `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const redondear = (v: number) => Math.round(v * 100) / 100;

export function validarOferta(input: unknown, productosElegibles: readonly ProductoOferta[]): string[] {
  const o = obj(input), c = obj(o.config), errores: string[] = [];
  for (const [campo, etiqueta] of [["nombre", "nombre interno"], ["titulo", "título"]]) {
    if (typeof o[campo] !== "string" || !(o[campo] as string).trim() || (o[campo] as string).length > 200) errores.push(`Completá el ${etiqueta} (hasta 200 caracteres).`);
  }
  if (typeof o.descripcion !== "string" || o.descripcion.length > 2000) errores.push("La descripción debe tener hasta 2.000 caracteres.");
  if (!Array.isArray(o.dias) || !o.dias.length || o.dias.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(o.dias).size !== o.dias.length) errores.push("Elegí días válidos, sin repetir.");
  if (!fecha(o.desde) || !fecha(o.hasta)) errores.push("Revisá las fechas de inicio y fin.");
  else if (o.desde && o.hasta && String(o.desde) > String(o.hasta)) errores.push("La fecha de fin debe ser igual o posterior al inicio.");
  if (!numero(o.orden) || !Number.isSafeInteger(o.orden)) errores.push("El orden debe ser un número entero.");
  const ids = (v: unknown, categoria?: ProductoOferta["categoria"]) => {
    if (!Array.isArray(v) || !v.length || v.length > 100 || new Set(v).size !== v.length) { errores.push("Elegí productos sin repetir (hasta 100 opciones)."); return; }
    for (const id of v) {
      const p = productosElegibles.find(p => p.id === id);
      if (!p || (categoria && p.categoria !== categoria)) errores.push("Hay un producto que ya no está disponible o no corresponde a este tipo de promo.");
      else if (!numero(p.precio) || p.precio <= 0 || !numero(p.costo) || p.costo < 0) errores.push(`Revisá el precio y el costo de ${p.nombre}.`);
    }
  };
  if (o.tipo === "combo") {
    if (!numero(c.precio) || c.precio <= 0) errores.push("El precio del combo debe ser mayor a cero.");
    if (!Array.isArray(c.lugares) || !c.lugares.length || c.lugares.length > 100) errores.push("Agregá al menos un lugar al combo (hasta 100).");
    else for (const l of c.lugares) { const lugar = obj(l); if (!cantidad(lugar.cantidad)) errores.push("La cantidad de cada lugar debe ser un entero de 1 a 100."); if (lugar.etiqueta !== undefined && (typeof lugar.etiqueta !== "string" || lugar.etiqueta.length > 200)) errores.push("Revisá la etiqueta del lugar."); ids(lugar.productos); }
  } else if (o.tipo === "descuento_cantidad") {
    if (!cantidad(c.cada) || c.cada < 2) errores.push("El descuento debe aplicarse cada 2 a 100 pizzas.");
    if (!numero(c.porcentaje) || c.porcentaje <= 0 || c.porcentaje > 100) errores.push("El porcentaje debe ser mayor a 0 y hasta 100.");
    if (c.productos !== null) ids(c.productos, "pizzas");
    else ids(productosElegibles.filter(p => p.categoria === "pizzas").map(p => p.id), "pizzas");
  } else if (o.tipo === "regalo") {
    if (!cantidad(c.minimoPizzas) || !cantidad(c.cantidad)) errores.push("Las cantidades de pizzas y regalos deben ser enteros de 1 a 100.");
    if (!Array.isArray(c.opciones) || !c.opciones.length) errores.push("Elegí al menos una bebida de regalo.");
    else { ids(c.opciones.map(v => obj(v).producto), "bebidas"); for (const v of c.opciones) if (!numero(obj(v).suplemento) || Number(obj(v).suplemento) < 0) errores.push("El suplemento no puede ser negativo."); }
    if (c.excluidas !== undefined && (!Array.isArray(c.excluidas) || c.excluidas.some(id => typeof id !== "string"))) errores.push("Revisá las pizzas excluidas.");
    const cuentan = productosElegibles.filter(p => p.categoria === "pizzas" && !(Array.isArray(c.excluidas) && c.excluidas.includes(p.id)));
    if (!cuentan.length) errores.push("Dejá al menos una pizza que cuente para el regalo.");
    else ids(cuentan.map(p => p.id), "pizzas");
  } else errores.push("Elegí un tipo de promoción válido.");
  return [...new Set(errores)];
}

/** Desc: una pizza descontada por grupo; regalo: suplemento por cada unidad elegida. */
export function margenOferta(oferta: OfertaInput, productos: readonly ProductoOferta[], comisionPct = 7.99): MargenOferta {
  const errores = validarOferta(oferta, productos);
  const vacio: MargenOferta = { peor: null, mejor: null, ahorroMinimo: null, ahorroMaximo: null, pedidoMinimo: null, costoRegalo: null, conTarjetaPeor: null, semaforo: "rojo", errores };
  if (errores.length) return vacio;
  // validarOferta ya comprobó los costos de todas las referencias que usa cada tipo.
  const conocidos = productos as readonly (ProductoOferta & { costo: number })[];
  const p = (id: string) => conocidos.find(p => p.id === id)!;
  const pizzas = conocidos.filter(p => p.categoria === "pizzas");
  const comision = numero(comisionPct) && comisionPct >= 0 && comisionPct < 100 ? comisionPct / 100 : .0799;
  let peor: number, mejor: number, ahorroMinimo: number, ahorroMaximo: number, tarjeta: number;
  let pedidoMinimo: number | null = null, costoRegalo: number | null = null;
  if (oferta.tipo === "combo") {
    let costoMax = 0, costoMin = 0, listaMin = 0, listaMax = 0;
    for (const l of oferta.config.lugares) {
      const opciones = l.productos.map(p);
      costoMax += l.cantidad * Math.max(...opciones.map(p => p.costo)); costoMin += l.cantidad * Math.min(...opciones.map(p => p.costo));
      listaMin += l.cantidad * Math.min(...opciones.map(p => p.precio)); listaMax += l.cantidad * Math.max(...opciones.map(p => p.precio));
    }
    peor = oferta.config.precio - costoMax; mejor = oferta.config.precio - costoMin;
    ahorroMinimo = listaMin - oferta.config.precio; ahorroMaximo = listaMax - oferta.config.precio;
    tarjeta = peor - oferta.config.precio * comision;
  } else if (oferta.tipo === "descuento_cantidad") {
    const c = oferta.config, elegibles = c.productos === null ? pizzas : c.productos.map(p);
    const casos = elegibles.map(p => ({ margen: p.precio * (1 - c.porcentaje / 100) - p.costo, cobro: p.precio * (1 - c.porcentaje / 100) }));
    peor = Math.min(...casos.map(c => c.margen)); mejor = Math.max(...casos.map(c => c.margen));
    const barata = [...elegibles].sort((a, b) => a.precio - b.precio || b.costo - a.costo)[0];
    pedidoMinimo = (barata.precio - barata.costo) * c.cada - barata.precio * c.porcentaje / 100;
    ahorroMinimo = Math.min(...elegibles.map(p => p.precio * c.porcentaje / 100)); ahorroMaximo = Math.max(...elegibles.map(p => p.precio * c.porcentaje / 100));
    tarjeta = Math.min(...casos.map(c => c.margen - c.cobro * comision));
  } else {
    const c = oferta.config, cuentan = pizzas.filter(x => !(c.excluidas ?? []).includes(x.id)), barata = [...cuentan].sort((a, b) => a.precio - b.precio || b.costo - a.costo)[0];
    const base = c.minimoPizzas * (barata.precio - barata.costo);
    const netos = c.opciones.map(o => c.cantidad * (o.suplemento - p(o.producto).costo));
    peor = c.minimoPizzas * Math.min(...cuentan.map(p => p.precio - p.costo)) + Math.min(...netos);
    mejor = c.minimoPizzas * Math.max(...cuentan.map(p => p.precio - p.costo)) + Math.max(...netos);
    pedidoMinimo = base + Math.min(...netos);
    costoRegalo = c.cantidad * Math.max(...c.opciones.map(o => p(o.producto).costo));
    ahorroMinimo = c.cantidad * Math.min(...c.opciones.map(o => p(o.producto).precio - o.suplemento)); ahorroMaximo = c.cantidad * Math.max(...c.opciones.map(o => p(o.producto).precio - o.suplemento));
    tarjeta = c.minimoPizzas * Math.min(...cuentan.map(p => p.precio * (1 - comision) - p.costo))
      + Math.min(...c.opciones.map(o => c.cantidad * (o.suplemento * (1 - comision) - p(o.producto).costo)));
  }
  if (![peor, mejor, ahorroMinimo, ahorroMaximo, tarjeta, pedidoMinimo ?? 0, costoRegalo ?? 0].every(Number.isFinite)) return { ...vacio, errores: ["Los importes están fuera de rango."] };
  const limite = Math.min(peor, pedidoMinimo ?? peor);
  return { peor: redondear(peor), mejor: redondear(mejor), ahorroMinimo: redondear(ahorroMinimo), ahorroMaximo: redondear(ahorroMaximo), pedidoMinimo: pedidoMinimo === null ? null : redondear(pedidoMinimo), costoRegalo: costoRegalo === null ? null : redondear(costoRegalo), conTarjetaPeor: redondear(tarjeta), semaforo: limite <= 0 ? "rojo" : limite < 2000 ? "ambar" : "verde", errores: [] };
}
export const puedeAprobar = (o: OfertaInput, p: readonly ProductoOferta[]) => margenOferta(o, p).semaforo !== "rojo";

export function cambioEstadoOferta(estado: EstadoOferta, accion: unknown): EstadoOferta | null {
  if (accion === "aprobar" && estado === "pendiente") return "aprobada";
  if (accion === "pausar" && estado === "aprobada") return "pausada";
  if (accion === "reanudar" && estado === "pausada") return "aprobada";
  return null;
}

export function resumenOferta(o: OfertaInput, productos: readonly ProductoOferta[]): string {
  try {
    if (o.tipo === "combo") return `${o.config.lugares.map(l => `${l.cantidad} × ${l.productos.map(id => productos.find(p => p.id === id)?.nombre ?? "Producto no disponible").join(" / ")}`).join(" + ")} · ${pesos(o.config.precio)}`;
    if (o.tipo === "descuento_cantidad") return `Cada ${o.config.cada} pizzas, la más barata al ${o.config.porcentaje}% de descuento`;
    const fuera = (o.config.excluidas ?? []).map(id => productos.find(p => p.id === id)?.nombre).filter(Boolean);
    return `Con ${o.config.minimoPizzas} pizzas, ${o.config.cantidad} bebida(s) de regalo${fuera.length ? ` · no cuentan: ${fuera.join(", ")}` : ""}`;
  } catch { return "Revisá la configuración"; }
}

/** Rankings sobre las filas visibles. Conserva el orden de entrada en empates exactos. */
export function rankingOfertas<T extends { analisis: AnalisisOferta }>(filas: readonly T[]): { vos: T[]; cliente: T[] } {
  const invalida = (f: T) => f.analisis.margen.errores.length > 0 || f.analisis.margen.semaforo === "rojo";
  const ordenar = (criterio: (x: AnalisisOferta, y: AnalisisOferta) => number) => [...filas].sort((x, y) =>
    Number(invalida(x)) - Number(invalida(y)) || (invalida(x) && invalida(y) ? 0 : criterio(x.analisis, y.analisis)));
  return {
    vos: ordenar((x, y) => y.totales.teQueda.min - x.totales.teQueda.min || x.totales.resignas.max - y.totales.resignas.max || y.totales.gananciaPct.min - x.totales.gananciaPct.min),
    cliente: ordenar((x, y) => y.totales.ahorroClientePct.min - x.totales.ahorroClientePct.min || y.totales.ahorroCliente.min - x.totales.ahorroCliente.min),
  };
}
