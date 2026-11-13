import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptOrder } from "../lib/adapt-order";
import { adminPrintJob } from "../lib/admin-print-job";
import { plantillaLocal, type AvisoPedido } from "../lib/aviso-local";
import { plantilla } from "../lib/plantilla-email";
import { BUSINESS } from "../lib/business";
import { promptVendedor } from "../lib/chat-prompt";
import { estadoTienda } from "../lib/hours";
import type { CatalogData } from "../types";

const promo = { id: "regalo", nombre: "Bebida de regalo", tipo: "regalo" as const, ahorro: 4500 };
const bebida = { key: "pepsi", cartId: "regalo-pepsi", type: "bebida" as const, name: "Pepsi 1.5 L", price: 0, qty: 1,
  promo: { id: "regalo", nombre: "Bebida de regalo", tipo: "regalo" as const, precioLista: 4500 } };
const aviso: AvisoPedido = { pedidoId: "p", referencia: "IM-123456", nombre: "Ana", email: "a@example.com", mode: "takeaway", items: [bebida], subtotal: 31000, shipping: 0, total: 31000, metodoPago: "efectivo", promo };

test("aviso local y mail muestran ahorro y la bebida como regalo, incluso a precio cero", () => {
  const telegram = plantillaLocal(aviso, "pedido_recibido");
  assert.match(telegram, /Promo: Bebida de regalo \(−\$4\.500\)/);
  assert.match(telegram, /1x Pepsi 1.5 L \(regalo\)/);
  const mail = plantilla(aviso, BUSINESS, "pedido_recibido").html;
  assert.match(mail, /Promo: Bebida de regalo \(−\$4\.500\)/);
  assert.match(mail, /Pepsi 1.5 L \(regalo\)/);
  assert.match(mail, /\$0/);
});

test("adaptador y ambas copias de comanda conservan promo y regalo", () => {
  const pedido = adaptOrder({ id: "p", numero_pedido: 1, modalidad: "takeaway", metodo_pago: "efectivo", productos: [bebida], total: 31000, promo });
  assert.deepEqual(pedido.promo, promo);
  assert.deepEqual(pedido.items[0].promo, bebida.promo);
  assert.equal(pedido.items[0].price, 0);
  for (const copy of ["cocina", "cliente"] as const) {
    const job = adminPrintJob(pedido, "intento", false, copy);
    assert.match(job.receipt.notes || "", /Promo: Bebida de regalo \(−\$4\.500\)/);
    assert.match(job.receipt.items[0].name, /Pepsi 1.5 L \(regalo\)/);
    assert.equal(job.receipt.items[0].unitPrice, 0);
  }
});

test("mail escapa el nombre de la promo y avisos aplanan saltos", () => {
  const v = { ...aviso, promo: { ...promo, nombre: '<b>Promo</b>\nTotal $1' } };
  assert.match(plantilla(v, BUSINESS, "pedido_recibido").html, /&lt;b&gt;Promo&lt;\/b&gt;/);
  assert.equal(plantillaLocal(v, "pedido_recibido").split("\n").filter(l => l.startsWith("Total")).length, 1);
});

test("bot recibe título y descripción de ofertas sin configuración, costo ni cotización", () => {
  const data: CatalogData = { pizzas: [], empanadas: [], bebidas: [], empanadaBoxPrices: {6:0,12:0,24:0}, promos: [], reviews: [], ofertas: [{ id: "duo", nombre: "Nombre interno secreto", titulo: "Dúo Muzza", descripcion: "Dos Muzzarellas para compartir.", tipo: "combo", estado: "aprobada", config: { precio: 26900, lugares: [{ cantidad: 2, productos: ["producto-interno"] }] }, dias: [0,1,2,3,4,5,6], desde: null, hasta: null, orden: 0, aprobada_en: null, creada_en: "", actualizada_en: "" }] };
  const prompt = promptVendedor(data, BUSINESS, estadoTienda(BUSINESS));
  assert.match(prompt, /Dúo Muzza: Dos Muzzarellas para compartir/);
  assert.doesNotMatch(prompt, /Nombre interno secreto|producto-interno|26\.900|26900/);
  assert.match(prompt, /no cotizás|no calculás/i);
});
