/**
 * Sesión del panel (arreglado el 18/10/2026). En el servidor propio el acceso de InsForge dura
 * 15 minutos y la renovación 7 días; el panel solo leía el acceso, así que a los 15 minutos todo
 * devolvía 401 y el dueño tenía que volver a entrar. `getCurrentAdmin` ahora renueva con
 * `updateSession` del SDK. Las renovaciones son JWT sin estado: dos a la vez no se pisan.
 */

type Leer = (name: string) => unknown;
type Escribir = (...args: never[]) => unknown;

export interface AlmacenCookies {
  get: Leer;
  set?: Escribir;
  delete?: Escribir;
}

/**
 * Next solo deja escribir cookies en Route Handlers y Server Actions: en el layout de /admin
 * (Server Component) `set` tira error. Ahí la renovación igual sirve para ese pedido, aunque no
 * se guarde; la próxima llamada del panel a una ruta la guarda.
 */
export function cookiesTolerantes<T extends AlmacenCookies>(almacen: T): T {
  const intentar = (fn?: Escribir) => (fn ? (...args: never[]) => { try { return fn.apply(almacen, args); } catch { return undefined; } } : undefined);
  return { ...almacen, get: almacen.get.bind(almacen), set: intentar(almacen.set), delete: intentar(almacen.delete) };
}
