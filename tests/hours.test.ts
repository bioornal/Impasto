import { estaAbierto, proximaApertura, fechaLocal, diasCerrados, listaDeDias, estadoDelivery, validarModalidad, estadoTienda, MENSAJE_DELIVERY_DEFAULT, type HorarioConfig } from "../lib/hours";
import { BUSINESS, type BusinessConfig } from "../lib/business";

const cfg: HorarioConfig = {
  dias: [2, 3, 4, 5, 6, 0],       // martes a domingo; lunes cerrado
  apertura: "19:30",
  cierre: "00:00",
  zonaHoraria: "America/Argentina/Buenos_Aires",
};

// Las fechas van en UTC. Argentina es UTC-3.
const abierto: [string, string, boolean][] = [
  ["sábado 21:00 ARG, pleno servicio",          "2026-08-22T00:00:00Z", true],
  ["sábado 19:29 ARG, un minuto antes",         "2026-08-22T22:29:00Z", false],
  ["sábado 19:30 ARG, justo abre",              "2026-08-22T22:30:00Z", true],
  ["sábado 23:59 ARG, último minuto",           "2026-08-23T02:59:00Z", true],
  ["domingo 00:30 ARG, ya cerró",               "2026-08-23T03:30:00Z", false],
  ["domingo 04:00 ARG, la madrugada del bug",   "2026-08-23T07:00:00Z", false],
  ["lunes 21:00 ARG, día de descanso",          "2026-08-25T00:00:00Z", false],
  ["martes 21:00 ARG, reapertura",              "2026-08-26T00:00:00Z", true],
  ["domingo 15:00 ARG, mediodía",               "2026-08-23T18:00:00Z", false],
];

const aperturas: [string, string, string][] = [
  ["martes 18:42 ARG abre hoy, no mañana",      "2026-08-18T21:42:00Z", "hoy a las 19:30"],
  ["lunes 21:00 ARG abre mañana",               "2026-08-25T00:00:00Z", "mañana a las 19:30"],
  ["sábado 21:00 ARG ya está abierto",          "2026-08-22T00:00:00Z", "ahora"],
  ["domingo 02:00 ARG cerró, abre más tarde",   "2026-08-23T05:00:00Z", "hoy a las 19:30"],
];

let fallos = 0;
for (const [nombre, iso, esperado] of abierto) {
  const real = estaAbierto(cfg, new Date(iso));
  if (real !== esperado) { fallos++; console.log(`FALLA  estaAbierto · ${nombre}: esperado ${esperado}, obtuvo ${real}`); }
  else console.log(`PASA   estaAbierto · ${nombre}`);
}
for (const [nombre, iso, esperado] of aperturas) {
  const real = proximaApertura(cfg, new Date(iso));
  if (real !== esperado) { fallos++; console.log(`FALLA  proximaApertura · ${nombre}: esperado "${esperado}", obtuvo "${real}"`); }
  else console.log(`PASA   proximaApertura · ${nombre}`);
}

const fechasArg: [string, string, string][] = [
  ["21:30 hs local (00:30 UTC siguiente)", "2026-09-13T00:30:00Z", "2026-09-12"],
  ["23:59 hs local (02:59 UTC siguiente)", "2026-09-13T02:59:00Z", "2026-09-12"],
  ["15:00 hs local (18:00 UTC mismo día)", "2026-09-12T18:00:00Z", "2026-09-12"],
];

for (const [nombre, iso, esperado] of fechasArg) {
  const real = fechaLocal(new Date(iso));
  if (real !== esperado) { fallos++; console.log(`FALLA  fechaLocal · ${nombre}: esperado "${esperado}", obtuvo "${real}"`); }
  else console.log(`PASA   fechaLocal · ${nombre}`);
}

const cerrados: [string, number[], string][] = [
  ["martes a domingo",              [2, 3, 4, 5, 6, 0],    "Lunes cerrado"],
  ["todos los días",                [0, 1, 2, 3, 4, 5, 6], ""],
  ["cierra lunes y martes",         [3, 4, 5, 6, 0],       "Lunes y martes cerrados"],
  ["cierra lunes, martes y domingo", [3, 4, 5, 6],         "Lunes, martes y domingo cerrados"],
  ["viernes a domingo",             [5, 6, 0],             "Lunes a jueves cerrados"],
];

for (const [nombre, dias, esperado] of cerrados) {
  const real = diasCerrados(dias);
  if (real !== esperado) { fallos++; console.log(`FALLA  diasCerrados · ${nombre}: esperado "${esperado}", obtuvo "${real}"`); }
  else console.log(`PASA   diasCerrados · ${nombre}`);
}

/* ── delivery pausado ── */
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { fallos++; console.log(`FALLA  ${nombre}`); }
}

/* ── viernes a domingo (decisión del dueño, 14/10/2026) ── */
const listas: [string, number[], string][] = [
  ["viernes a domingo",             [5, 6, 0],             "viernes a domingo"],
  ["tramo y enumerados",            [0, 1, 2, 3, 5, 6],    "lunes a miércoles y viernes a domingo"],
  ["dos seguidos no hacen tramo",   [6, 0],                "sábado y domingo"],
  ["un solo día",                   [5],                   "viernes"],
];
for (const [nombre, dias, esperado] of listas) {
  const real = listaDeDias(dias);
  chequear(`listaDeDias · ${nombre}: "${real}"`, real === esperado);
}

const finde: HorarioConfig = { ...cfg, dias: [5, 6, 0], cierre: "23:45" };
chequear("finde · miércoles 21:00 cerrado", !estaAbierto(finde, new Date("2026-10-15T00:00:00Z")));
chequear("finde · jueves 21:00 cerrado", !estaAbierto(finde, new Date("2026-10-16T00:00:00Z")));
chequear("finde · viernes 21:00 abierto", estaAbierto(finde, new Date("2026-10-17T00:00:00Z")));
chequear("finde · domingo 23:44 abierto", estaAbierto(finde, new Date("2026-10-19T02:44:00Z")));
chequear("finde · domingo 23:45 ya no toma pedidos", !estaAbierto(finde, new Date("2026-10-19T02:45:00Z")));
chequear("finde · lunes 21:00 cerrado", !estaAbierto(finde, new Date("2026-10-20T00:00:00Z")));
chequear("finde · el miércoles abre el viernes", proximaApertura(finde, new Date("2026-10-15T00:00:00Z")) === "viernes a las 19:30");
chequear("finde · el jueves abre mañana", proximaApertura(finde, new Date("2026-10-16T00:00:00Z")) === "mañana a las 19:30");
const miercoles = estadoTienda(BUSINESS, new Date("2026-10-15T00:00:00Z"));
chequear(
  `finde · la barra del miércoles dice "${miercoles.etiqueta}"`,
  !miercoles.abierto && miercoles.etiqueta === "Cerrado · abre vie 19:30",
);
const errorDe = (fn: () => void) => {
  try { fn(); return ""; } catch (e) { return e instanceof Error ? e.message : String(e); }
};

const conDelivery: BusinessConfig = { ...BUSINESS };
const sinDelivery: BusinessConfig = { ...BUSINESS, deliveryActivo: false, mensajeDelivery: "Por la lluvia pausamos el delivery." };
const sinDeliverySinPunto: BusinessConfig = { ...BUSINESS, deliveryActivo: false, mensajeDelivery: "Sin repartidores esta noche" };
const sinDeliveryNiMotivo: BusinessConfig = { ...BUSINESS, deliveryActivo: false, mensajeDelivery: "   " };

const activo = estadoDelivery(conDelivery);
chequear("estadoDelivery · activo, sin motivo", activo.activo === true && activo.motivo === "");
const pausado = estadoDelivery(sinDelivery);
chequear("estadoDelivery · pausado con el motivo del panel", pausado.activo === false && pausado.motivo === "Por la lluvia pausamos el delivery.");
chequear("estadoDelivery · pausado sin motivo usa el texto por defecto", estadoDelivery(sinDeliveryNiMotivo).motivo === MENSAJE_DELIVERY_DEFAULT);

chequear("validarModalidad · delivery activo acepta delivery", errorDe(() => validarModalidad(conDelivery, "delivery")) === "");
chequear("validarModalidad · pausado acepta retiro", errorDe(() => validarModalidad(sinDelivery, "takeaway")) === "");
chequear(
  "validarModalidad · pausado rechaza delivery con el motivo",
  errorDe(() => validarModalidad(sinDelivery, "delivery")) === "Por la lluvia pausamos el delivery. Elegí retiro en nuestra cocina para completar tu pedido.",
);
chequear(
  "validarModalidad · agrega el punto si el motivo no lo tiene",
  errorDe(() => validarModalidad(sinDeliverySinPunto, "delivery")) === "Sin repartidores esta noche. Elegí retiro en nuestra cocina para completar tu pedido.",
);
// No hay local a la calle: el cliente retira en la cocina (pedido del dueño, 05/10/2026).
chequear("el aviso por defecto no habla de un local", !/\blocal\b/i.test(MENSAJE_DELIVERY_DEFAULT) && /nuestra cocina/.test(MENSAJE_DELIVERY_DEFAULT));

// Sábado 21:00 en Iguazú: abierto por horario.
const sabado = new Date("2026-08-22T00:00:00Z");
const tiendaSinDelivery = estadoTienda(sinDelivery, sabado);
chequear("estadoTienda · abierto y sin delivery conviven", tiendaSinDelivery.abierto && !tiendaSinDelivery.delivery.activo);
chequear("estadoTienda · la venta pausada también lleva el delivery", estadoTienda({ ...sinDelivery, ventasActivas: false }, sabado).delivery.activo === false);
chequear("estadoTienda · cerrado por horario también lo lleva", estadoTienda(conDelivery, new Date("2026-08-25T00:00:00Z")).delivery.activo === true);

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
