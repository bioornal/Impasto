import { estaAbierto, proximaApertura, fechaLocal, diasCerrados, type HorarioConfig } from "../lib/hours";

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
];

for (const [nombre, dias, esperado] of cerrados) {
  const real = diasCerrados(dias);
  if (real !== esperado) { fallos++; console.log(`FALLA  diasCerrados · ${nombre}: esperado "${esperado}", obtuvo "${real}"`); }
  else console.log(`PASA   diasCerrados · ${nombre}`);
}

console.log(fallos === 0 ? "\nTodos los casos pasan" : `\n${fallos} casos fallan`);
process.exit(fallos === 0 ? 0 : 1);
