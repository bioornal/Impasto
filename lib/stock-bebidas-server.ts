import { db } from './insforge';
import { readPages } from './read-pages';
import type { FilaStockBebida } from './stock-bebidas';

/** La base confirma el stock al reservar; una lectura fallida conserva el último estado del cliente. */
export async function leerStockBebidas(): Promise<FilaStockBebida[] | null> {
  try {
    const { data, error } = await readPages((start, end) => db.database.from('stock_bebidas')
      .select('id:producto_id,producto_id,unidades').eq('proyecto_id','impasto').order('producto_id').range(start,end));
    if (error) throw error;
    return data as FilaStockBebida[];
  } catch (error) {
    console.error('[stock] no se pudo leer el inventario:', error);
    return null;
  }
}
