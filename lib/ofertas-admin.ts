import "server-only";
import { db } from "./insforge";
import { readPages } from "./read-pages";
import { requirePricingRows, resolveValidatedPrices, sellablePrice } from "./pricing-safety";
import { presupuestoMensual } from "./presupuesto-precios";
import type { PricingDefaults, PricingIngredient, PricingRecipe, RecipeIngredient, SalePriceRule } from "./effective-prices";
import type { OfertaInput, ProductoOferta } from "./promos";

export const COLUMNAS_OFERTAS = "id,tipo,nombre,titulo,descripcion,estado,config,dias,desde,hasta,orden,aprobada_en,creada_en,actualizada_en";

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
