import "server-only";
import { db } from "./insforge";
import { readPages } from "./read-pages";
import { requirePricingRows, resolveValidatedPrices, sellablePrice } from "./pricing-safety";
import { presupuestoMensual } from "./presupuesto-precios";
import type { PricingDefaults, PricingIngredient, PricingRecipe, RecipeIngredient, SalePriceRule } from "./effective-prices";
import type { ContextoNegocioLeido, OfertaInput, ProductoOferta } from "./promos";
import { SUCURSAL_ID } from "./business";
import { diaDeNegocio } from "./resumen-diario";

export const COLUMNAS_OFERTAS = "id,tipo,nombre,titulo,descripcion,estado,config,dias,desde,hasta,orden,aprobada_en,creada_en,actualizada_en,imagen";

/** Contexto informativo: cada lectura falla de forma independiente, sin bloquear las ofertas. */
export async function contextoNegocio(ahora = new Date()): Promise<ContextoNegocioLeido> {
  const c: ContextoNegocioLeido = { gastoFijoNoche: null, envio: null, envioGratisDesde: null, comisionPct: null, pedidosPorNoche: null, ticketPromedio: null };
  const numero = (v: unknown): number | null => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
  const inicioNoche = new Date(`${diaDeNegocio(ahora.toISOString())}T09:00:00Z`).getTime();
  await Promise.allSettled([
    (async () => {
      const { data, error } = await readPages((start, end) => db.database.from("costos_fijos").select("id,monto,monto_por_noche").eq("activo", true).order("id").range(start, end));
      if (error || !data?.length) return;
      const filas = data as { monto: unknown; monto_por_noche: unknown }[];
      const referencia = filas.find(f => (numero(f.monto_por_noche) ?? 0) > 0 && (numero(f.monto) ?? 0) > 0);
      if (!referencia || filas.some(f => numero(f.monto) === null)) return;
      const noches = Number(referencia.monto) / Number(referencia.monto_por_noche);
      const gasto = filas.reduce((s, f) => s + Number(f.monto), 0) / noches;
      if (Number.isFinite(gasto)) c.gastoFijoNoche = gasto;
    })(),
    (async () => {
      // Mismos campos y sucursal que business-server, sin sus defaults que ocultan errores de lectura.
      const { data, error } = await db.database.from("sucursales").select("delivery_fee,envio_gratis_desde").eq("id", SUCURSAL_ID).limit(1);
      if (error || !data?.[0]) return;
      c.envio = numero(data[0].delivery_fee); c.envioGratisDesde = numero(data[0].envio_gratis_desde);
    })(),
    (async () => {
      const { data, error } = await db.database.from("config_negocio").select("comision_tarjeta_pct").limit(1);
      if (error || !data?.[0]) return;
      const pct = numero(data[0].comision_tarjeta_pct);
      c.comisionPct = pct !== null && pct < 100 ? pct : null;
    })(),
    (async () => {
      // 28 noches, incluida la actual. El corte 06:00 argentino equivale a 09:00 UTC.
      const { data, error } = await readPages((start, end) => db.database.from("pedidos").select("id,created_at,total")
        .eq("proyecto_id", "impasto").neq("status", "cancelado")
        .gte("created_at", new Date(inicioNoche - 27 * 86400000).toISOString()).lt("created_at", ahora.toISOString())
        .order("created_at").order("id").range(start, end));
      if (error || !data?.length) return;
      const filas = data as { created_at: string; total: unknown }[];
      if (filas.some(f => numero(f.total) === null || !Number.isFinite(Date.parse(f.created_at)))) return;
      c.pedidosPorNoche = filas.length / new Set(filas.map(f => diaDeNegocio(f.created_at))).size;
      c.ticketPromedio = filas.reduce((s, f) => s + Number(f.total), 0) / filas.length;
    })(),
  ]);
  return c;
}

/** Lectura exclusiva del panel. Reutiliza precios efectivos y receta + caja, sin costos operativos en el margen. */
export async function productosParaOfertas(): Promise<{ productos: ProductoOferta[]; comisionPct: number }> {
  const pagina = (tabla: string, columnas: string) => readPages((start, end) => db.database.from(tabla).select(columnas).order("id", { ascending: true }).range(start, end).returns<{ id: string }[]>());
  const [ps, rs, ris, ins, vs, cs, fs, variables] = await Promise.all([
    readPages((start, end) => db.database.from("productos").select("id,nombre,categoria,precio,disponible")
      .eq("proyecto_id", "impasto").not("archivado", "is", true).in("categoria", ["pizzas", "bebidas"]).order("id", { ascending: true }).range(start, end)),
    pagina("recetas", "id,nombre,precio_prepizza,precio_salsa,rend_tipo,rend_valor"),
    pagina("receta_ingredientes", "id,receta_id,ingrediente_id,cantidad_kg"),
    pagina("ingredientes", "id,nombre,unidad,precio_kg,multiplo_rendimiento,gramos_por_unidad"),
    pagina("precios_venta", "id,receta_id,nombre,markup,subcategoria"),
    db.database.from("config_negocio").select("pizzas_objetivo_mes,precio_prepizza_default,precio_salsa_default,comision_tarjeta_pct,comision_en_precio").limit(1),
    pagina("costos_fijos", "id,monto,activo"), pagina("costos_variables", "id,monto_referencia"),
  ]);
  const resolution = resolveValidatedPrices({
    recipes: requirePricingRows<PricingRecipe>("recetas", rs), recipeIngredients: requirePricingRows<RecipeIngredient>("receta_ingredientes", ris),
    ingredients: requirePricingRows<PricingIngredient>("ingredientes", ins), rules: requirePricingRows<SalePriceRule>("precios_venta", vs),
    defaults: requirePricingRows<PricingDefaults>("config_negocio", cs)[0],
    totalOperativo: presupuestoMensual(requirePricingRows<Record<string, unknown>>("costos_fijos", fs).filter(f => f.activo === true), requirePricingRows<Record<string, unknown>>("costos_variables", variables)),
  });
  const filas = requirePricingRows<{ id: string; nombre: string; categoria: "pizzas" | "bebidas"; precio: number; disponible: boolean }>("productos", ps);
  const productos = filas.flatMap(p => {
    const precio = sellablePrice(p, resolution), calculado = resolution.productionCosts?.get(p.nombre);
    const costo = calculado !== undefined && Number.isFinite(calculado) && calculado >= 0 ? calculado : null;
    if (p.disponible === false || precio === null) return [];
    return [{ id: String(p.id), nombre: p.nombre, categoria: p.categoria, precio, costo }];
  });
  return { productos, comisionPct: resolution.commissionPct! };
}

/** Lista blanca: el cliente nunca puede escribir estado, pertenencia ni fechas de auditoría. */
export function camposOferta(o: OfertaInput) {
  return { tipo: o.tipo, nombre: o.nombre.trim(), titulo: o.titulo.trim(), descripcion: o.descripcion.trim(), config: o.config, dias: o.dias, desde: o.desde, hasta: o.hasta, orden: o.orden };
}
