import assert from "node:assert/strict";
import { test } from "node:test";
import { analisisOferta, validarOferta, margenOferta, puedeAprobar, resumenOferta, cambioEstadoOferta, type OfertaInput, type ProductoOferta } from "../lib/promos";

const productos: ProductoOferta[] = [
  { id: "m", nombre: "Muzzarella Impasto", categoria: "pizzas", precio: 15500, costo: 3791 },
  { id: "j", nombre: "Muzzarela y Jamon", categoria: "pizzas", precio: 18500, costo: 5686 },
  { id: "s", nombre: "Prosciutto", categoria: "pizzas", precio: 24000, costo: 9353 },
  { id: "p", nombre: "Pepsi", categoria: "bebidas", precio: 4500, costo: 2550 },
  { id: "c", nombre: "Coca", categoria: "bebidas", precio: 6500, costo: 3667 },
];
const duo: OfertaInput = { tipo: "combo", nombre: "Dúo", titulo: "Dúo Muzza", descripcion: "Para compartir", dias: [5, 6, 0], desde: null, hasta: null, orden: 0, config: { precio: 26900, lugares: [{ cantidad: 2, productos: ["m"] }] } };
const descuento: OfertaInput = { ...duo, tipo: "descuento_cantidad", config: { cada: 2, porcentaje: 50, productos: null } };
const regalo: OfertaInput = { ...duo, tipo: "regalo", config: { minimoPizzas: 2, cantidad: 1, opciones: [{ producto: "p", suplemento: 0 }, { producto: "c", suplemento: 2000 }] } };
const negocio = { gastoFijoNoche: 54231, envio: 3000, envioGratisDesde: 35000, comisionPct: 10, pedidosPorNoche: 4, ticketPromedio: 28000 };

test("análisis Dúo: pedido completo, ahorro, tarjeta, envío y cobertura", () => {
  const a = analisisOferta(duo, productos, negocio);
  assert.deepEqual(a.resumen, { ahorroCliente: 4100, ahorroClientePct: 13, teQueda: 19318, resignas: 4100 });
  assert.equal(a.combosParaCubrirNoche, 3);
  assert.equal(a.sobranteNoche, 3723);
  assert.match(a.veredicto, /cubrís la noche con 3 combos y te sobran \$3\.723/);
  assert.equal(a.totales.gananciaNormal.min, 23418);
  assert.equal(a.totales.conTarjeta!.min, 16628);
  assert.equal(a.envio!.pagaCliente.min, 3000);
  assert.equal(a.envio!.resignas.max, 0);
  assert.equal(a.conviertePedidoUnaPizza?.min, 7609);
  assert.match(a.veredicto, /19\.318/);
});
test("análisis descuento: 3 ejemplos y tabla por pizza, no confundir pizza con pedido", () => {
  const a = analisisOferta(descuento, productos, negocio);
  assert.equal(a.productos.length, 3); assert.equal(a.pedidos.length, 3);
  assert.equal(a.pedidos[0].paga, 23250); assert.equal(a.pedidos[0].teQueda, 15668); assert.equal(a.pedidos[0].resignas, 7750);
  assert.equal(a.pedidos[1].paga, 31750); assert.equal(a.pedidos[2].paga, 36000);
  assert.equal(a.pedidos[2].envio!.resignas, 0); assert.equal(a.pedidos[2].envio!.pagaCliente, 3000); // con promo el envío se cobra siempre
  assert.equal(a.resumen.teQueda, 15668);
});
test("análisis regalo: opciones, mínimos baratos/caros y unidades con suplemento", () => {
  const a = analisisOferta(regalo, productos, negocio);
  assert.equal(a.productos[0].costoRegalo, 2550); assert.equal(a.productos[1].costoRegalo, 1667);
  assert.equal(a.productos[1].resignas, 4500);
  assert.equal(a.pedidos.length, 4);
  assert.equal(a.pedidos[0].paga, 31000); assert.equal(a.pedidos[0].teQueda, 20868);
  assert.equal(a.pedidos[0].regaloPct, 2550 / 31000 * 100);
  const doble = analisisOferta({ ...regalo, config: { ...regalo.config, cantidad: 2, opciones: [{ producto: "c", suplemento: 2000 }] } }, productos, negocio);
  assert.equal(doble.productos[0].costoRegalo, 3334); assert.equal(doble.productos[0].resignas, 9000);
});
test("análisis rangos, umbral inclusivo, validación y falta de gasto fijo", () => {
  const a = analisisOferta({ ...duo, config: { precio: 35000, lugares: [{ cantidad: 2, productos: ["m", "s"] }] } }, productos, negocio);
  assert.deepEqual(a.totales.teQueda, { min: 16294, max: 27418 });
  assert.deepEqual(a.totales.gananciaNormal, { min: 23418, max: 29294 });
  assert.equal(a.envio!.resignas.min, 0); assert.equal(a.envio!.pagaCliente.max, 3000);
  assert.equal(analisisOferta(duo, productos, { ...negocio, gastoFijoNoche: null }).combosParaCubrirNoche, null);
  assert.equal(analisisOferta({ ...duo, config: { ...duo.config, precio: 7582 } }, productos, negocio).combosParaCubrirNoche, null);
  const rota = analisisOferta({ ...duo, config: null } as never, productos, negocio);
  assert.equal(rota.resumen.teQueda, null); assert.ok(rota.margen.errores.length);
});
test("con promo el envío se cobra aunque el umbral sea cero; sin contexto no se inventan importes", () => {
  const gratis = analisisOferta(duo, productos, { ...negocio, envioGratisDesde: 0 });
  assert.equal(gratis.envio!.pagaCliente.min, 3000); assert.equal(gratis.envio!.resignas.max, 0);
  const sinDatos = analisisOferta(duo, productos, { ...negocio, envio: null, comisionPct: null });
  assert.equal(sinDatos.envio, null); assert.equal(sinDatos.totales.conTarjeta, null); assert.equal(sinDatos.resumen.teQueda, 19318);
});
test("rangos conservan correlación de precio y costo, y cada N descuenta una sola pizza", () => {
  const ps: ProductoOferta[] = [
    { id: "a", nombre: "A", categoria: "pizzas", precio: 10000, costo: 1000 },
    { id: "b", nombre: "B", categoria: "pizzas", precio: 12000, costo: 11000 },
  ];
  const combo = analisisOferta({ ...duo, config: { precio: 18000, lugares: [{ cantidad: 2, productos: ["a", "b"] }] } }, ps, negocio);
  assert.deepEqual(combo.totales.gananciaNormal, { min: 2000, max: 18000 });
  const cadaTres = analisisOferta({ ...descuento, config: { cada: 3, porcentaje: 50, productos: ["m", "s"] } }, productos, negocio);
  assert.equal(cadaTres.pedidos[0].paga, 38750); assert.equal(cadaTres.pedidos[0].resignas, 7750);
  assert.equal(cadaTres.pedidos[1].paga, 55750); assert.equal(cadaTres.pedidos[2].paga, 60000);
  const otro = analisisOferta({ ...descuento, config: { cada: 3, porcentaje: 50, productos: null } }, ps, negocio);
  assert.equal(otro.resumen.teQueda, -3000);
});

test("Dúo Muzza deja $19.318 y ahorra $4.100", () => {
  assert.deepEqual(validarOferta(duo, productos), []);
  const m = margenOferta(duo, productos);
  assert.equal(m.peor, 19318); assert.equal(m.mejor, 19318);
  assert.equal(m.ahorroMinimo, 4100); assert.equal(m.semaforo, "verde");
  assert.match(resumenOferta(duo, productos), /Muzzarella/);
});
test("lugares a elección calculan extremos independientes", () => {
  const m = margenOferta({ ...duo, config: { precio: 26900, lugares: [{ cantidad: 2, productos: ["m", "s"] }] } }, productos);
  assert.equal(m.peor, 8194); assert.equal(m.mejor, 19318); assert.equal(m.ahorroMaximo, 21100);
});
test("segunda al 50%: Prosciutto deja $2.647; pedido mínimo usa dos muzzas", () => {
  const m = margenOferta(descuento, productos);
  assert.equal(m.peor, 2647); assert.equal(m.mejor, 3959);
  assert.equal(m.pedidoMinimo, 15668); assert.equal(m.semaforo, "verde");
});
test("regalo: Pepsi cuesta $2.550; suplemento de Coca se cobra por unidad", () => {
  const m = margenOferta(regalo, productos);
  assert.equal(m.costoRegalo, 3667); assert.equal(m.peor, 20868);
  assert.equal(margenOferta({ ...regalo, config: { minimoPizzas: 2, cantidad: 1, opciones: [{ producto: "p", suplemento: 0 }] } }, productos).costoRegalo, 2550);
});
test("validación rechaza config malformada, referencias, días, fechas y números", () => {
  for (const input of [null, {}, { ...duo, config: null }, { ...duo, tipo: "otro" }, { ...duo, dias: [] }, { ...duo, dias: [7] }, { ...duo, dias: [5, 5] }, { ...duo, desde: "2026-02-30" }, { ...duo, desde: "2026-12-01", hasta: "2026-11-01" }, { ...duo, orden: 1.5 }, { ...duo, nombre: " " }, { ...duo, config: { precio: Infinity, lugares: [] } }]) {
    assert.ok(validarOferta(input, productos).length > 0);
  }
  assert.ok(validarOferta(duo, productos.filter(p => p.id !== "m")).some(e => /disponible/.test(e)));
  assert.ok(validarOferta({ ...descuento, config: { cada: 1, porcentaje: 101, productos: ["p"] } }, productos).length);
  assert.ok(validarOferta({ ...regalo, config: { minimoPizzas: 0, cantidad: -1, opciones: [{ producto: "m", suplemento: -2 }] } }, productos).length);
});
test("sin costos, NaN, configuración rota o pizza no disponible: Revisar y no aprobar", () => {
  for (const ps of [[], productos.map(p => p.id === "m" ? { ...p, costo: NaN } : p)]) {
    assert.equal(margenOferta(duo, ps).semaforo, "rojo"); assert.equal(puedeAprobar(duo, ps), false);
  }
  assert.equal(margenOferta({ ...duo, config: null } as never, productos).semaforo, "rojo");
});
test("semáforo: cero rojo, menor a 2000 ámbar, 2000 verde; tarjeta aparte", () => {
  for (const [precio, semaforo] of [[7582, "rojo"], [9581, "ambar"], [9582, "verde"]] as const) {
    const o = { ...duo, config: { precio, lugares: [{ cantidad: 2, productos: ["m"] }] } } as OfertaInput;
    assert.equal(margenOferta(o, productos, 10).semaforo, semaforo);
    assert.equal(puedeAprobar(o, productos), semaforo !== "rojo");
    assert.equal(margenOferta(o, productos, 10).conTarjetaPeor, Math.round((precio * .9 - 7582) * 100) / 100);
  }
});

test("las transiciones no permiten aprobar pausadas ni reanudar pendientes", () => {
  assert.equal(cambioEstadoOferta("pendiente", "aprobar"), "aprobada");
  assert.equal(cambioEstadoOferta("aprobada", "pausar"), "pausada");
  assert.equal(cambioEstadoOferta("pausada", "reanudar"), "aprobada");
  for (const [estado, accion] of [["pendiente", "reanudar"], ["pausada", "aprobar"], ["aprobada", "aprobar"], ["pendiente", "pausar"], ["aprobada", "inventado"]] as const) assert.equal(cambioEstadoOferta(estado, accion), null);
});

test("regalos múltiples descuentan costo y suman suplemento por unidad", () => {
  const m = margenOferta({ ...regalo, config: { minimoPizzas: 2, cantidad: 2, opciones: [{ producto: "c", suplemento: 2000 }] } }, productos);
  assert.equal(m.peor, 20084); assert.equal(m.costoRegalo, 7334); assert.equal(m.ahorroMinimo, 9000);
});

test("el regalo distingue pedido típico de peor caso: una pizza más cara puede dejar menos", () => {
  const ps: ProductoOferta[] = [
    { id: "a", nombre: "Barata", categoria: "pizzas", precio: 10000, costo: 1000 },
    { id: "b", nombre: "Cara", categoria: "pizzas", precio: 12000, costo: 11900 },
    { id: "p", nombre: "Pepsi", categoria: "bebidas", precio: 4500, costo: 3000 },
  ];
  const o: OfertaInput = { ...regalo, config: { minimoPizzas: 2, cantidad: 1, opciones: [{ producto: "p", suplemento: 0 }] } };
  const m = margenOferta(o, ps);
  assert.equal(m.pedidoMinimo, 15000); assert.equal(m.peor, -2800); assert.equal(m.mejor, 15000);
  assert.equal(m.semaforo, "rojo"); assert.equal(puedeAprobar(o, ps), false);
});

test("rojo también bloquea descuento y regalo; errores no lanzan excepciones", () => {
  assert.equal(puedeAprobar({ ...descuento, config: { cada: 2, porcentaje: 100, productos: null } }, productos), false);
  assert.equal(puedeAprobar({ ...regalo, config: { minimoPizzas: 1, cantidad: 10, opciones: [{ producto: "p", suplemento: 0 }] } }, productos), false);
  for (const o of [{ ...duo, config: { precio: 5, lugares: [null] } }, { ...regalo, config: { opciones: [null] } }, { ...duo, dias: "5" }]) assert.ok(validarOferta(o, productos).length);
  assert.ok(validarOferta({ ...descuento, config: { cada: 2, porcentaje: 50, productos: ["m", "m"] } }, productos).length);
});
