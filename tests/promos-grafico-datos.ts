/** Datos locales: configuraciones de la migración 20261113150000_ofertas.sql. */
import type { Oferta, ProductoOferta } from "../lib/promos";
export const productos: ProductoOferta[] = [
  { id: "m", nombre: "Muzzarella Impasto", categoria: "pizzas", precio: 15500, costo: 3791 },
  { id: "s", nombre: "Prosciutto", categoria: "pizzas", precio: 24000, costo: 9353 },
  { id: "j", nombre: "Muzzarela y Jamon", categoria: "pizzas", precio: 18500, costo: 5686 },
  { id: "f", nombre: "Fugazzetta", categoria: "pizzas", precio:17000, costo:4724 },
  { id: "v", nombre: "Provoleta Impasto", categoria: "pizzas", precio:19500, costo:5850 },
  { id: "d", nombre: "Diavola al Miele Piccante", categoria: "pizzas", precio:19000, costo:5933 },
  { id: "n", nombre: "Napoletana all'Aglio", categoria: "pizzas", precio:20000, costo:6707 },
  { id: "t", nombre: "Palmitos y Salsa Golf", categoria: "pizzas", precio:20000, costo:6865 },
  { id: "u", nombre: "7-Up 1.5 L", categoria: "bebidas", precio:4500, costo:2550 },
  { id: "p", nombre: "Pepsi 1.5 L", categoria: "bebidas", precio: 4500, costo: 2550 },
  { id: "c", nombre: "Coca-Cola 1.5 L", categoria: "bebidas", precio: 6500, costo: 3667 },
];
export const contexto = { gastoFijoNoche: 54231, envio: 3000, envioGratisDesde: 35000, comisionPct: 7.99, pedidosPorNoche: 4.8, ticketPromedio: 28000 };
const comun = { descripcion: "Dos pizzas para compartir", estado: "pendiente" as const, dias: [5, 6, 0], desde: null, hasta: null, orden: 0, aprobada_en: null, creada_en: "2026-11-13T17:00:00Z", actualizada_en: "2026-11-13T17:00:00Z" };
export const ofertas: Oferta[] = [
  { ...comun, id: "duo", nombre: "Dúo Muzza", titulo: "Dúo Muzza", tipo: "combo", config: { precio: 26900, lugares: [{ cantidad: 2, productos: ["m"] }] } },
  { ...comun, orden:1, id: "pizza", nombre: "Pizza + gaseosa", titulo: "Pizza y gaseosa", tipo: "combo", config: { precio:21500, lugares:[{cantidad:1,productos:["j"]},{cantidad:1,productos:["p","u"]}] } },
  { ...comun, orden:2, id: "noche", nombre: "Noche Impasto", titulo: "Noche Impasto", tipo: "combo", config: { precio:55000, lugares:[{cantidad:1,productos:["m"]},{cantidad:1,productos:["j"]},{cantidad:1,productos:["n","d","t","v","f"]},{cantidad:1,productos:["c"]}] } },
  { ...comun, orden:3, id: "segunda", nombre: "2ª pizza al 50%", titulo: "La segunda a mitad de precio", tipo: "descuento_cantidad", config: { cada: 2, porcentaje: 50, productos: null } },
  { ...comun, orden:4, id: "regalo", nombre: "Gaseosa de regalo", titulo: "La gaseosa va de regalo", tipo: "regalo", config: { minimoPizzas: 2, cantidad: 1, opciones: [{ producto: "u", suplemento: 0 }, { producto: "p", suplemento: 0 }, { producto: "c", suplemento: 2000 }] } },
];
