/** Reglas de promociones del panel. Sin acceso a datos ni dependencias de UI. */
export type EstadoOferta = "pendiente" | "aprobada" | "pausada";
export interface ProductoOferta { id: string; nombre: string; categoria: "pizzas" | "bebidas"; precio: number; costo: number | null }
export interface LugarCombo { etiqueta?: string; cantidad: number; productos: string[] }
export type ConfigOferta =
  | { tipo: "combo"; config: { precio: number; lugares: LugarCombo[] } }
  | { tipo: "descuento_cantidad"; config: { cada: number; porcentaje: number; productos: string[] | null } }
  | { tipo: "regalo"; config: { minimoPizzas: number; cantidad: number; opciones: { producto: string; suplemento: number }[] } };
export type OfertaInput = ConfigOferta & { nombre: string; titulo: string; descripcion: string; dias: number[]; desde: string | null; hasta: string | null; orden: number };
export type Oferta = OfertaInput & { id: string; estado: EstadoOferta; aprobada_en: string | null; creada_en: string; actualizada_en: string };
export interface MargenOferta {
  peor: number | null; mejor: number | null; ahorroMinimo: number | null; ahorroMaximo: number | null;
  pedidoMinimo: number | null; costoRegalo: number | null; conTarjetaPeor: number | null;
  semaforo: "rojo" | "ambar" | "verde"; errores: string[];
}
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const numero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const cantidad = (v: unknown): v is number => numero(v) && Number.isSafeInteger(v) && v >= 1 && v <= 100;
const fecha = (v: unknown) => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const pesos = (v: number) => `$${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
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
    ids(productosElegibles.filter(p => p.categoria === "pizzas").map(p => p.id), "pizzas");
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
    const c = oferta.config, barata = [...pizzas].sort((a, b) => a.precio - b.precio || b.costo - a.costo)[0];
    const base = c.minimoPizzas * (barata.precio - barata.costo);
    const netos = c.opciones.map(o => c.cantidad * (o.suplemento - p(o.producto).costo));
    peor = c.minimoPizzas * Math.min(...pizzas.map(p => p.precio - p.costo)) + Math.min(...netos);
    mejor = c.minimoPizzas * Math.max(...pizzas.map(p => p.precio - p.costo)) + Math.max(...netos);
    pedidoMinimo = base + Math.min(...netos);
    costoRegalo = c.cantidad * Math.max(...c.opciones.map(o => p(o.producto).costo));
    ahorroMinimo = c.cantidad * Math.min(...c.opciones.map(o => p(o.producto).precio - o.suplemento)); ahorroMaximo = c.cantidad * Math.max(...c.opciones.map(o => p(o.producto).precio - o.suplemento));
    tarjeta = c.minimoPizzas * Math.min(...pizzas.map(p => p.precio * (1 - comision) - p.costo))
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
    return `Con ${o.config.minimoPizzas} pizzas, ${o.config.cantidad} bebida(s) de regalo`;
  } catch { return "Revisá la configuración"; }
}
