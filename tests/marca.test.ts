import { argumento, argumentoConCifra } from "../lib/marca";

let fallos = 0;

function chequear(nombre: string, condicion: boolean) {
  if (condicion) {
    console.log(`PASA   ${nombre}`);
  } else {
    console.error(`FALLA  ${nombre}`);
    fallos++;
  }
}

function tira(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

/**
 * `cifra` es opcional en `ArgumentoMarca` (lib/marca.ts), y TypeScript no
 * marca `undefined` dentro de un template literal: `Header.tsx` y `lib/seo.ts`
 * interpolan `.cifra` de "fermentacion", "horno" y "empanadas-peso" sin
 * chequeo. Si alguien le saca la `cifra` a uno de esos tres en
 * `ARGUMENTOS_MARCA` -una edición de una línea que compila y pasa `tsc`
 * igual- este test tiene que fallar antes de que el sitio publique
 * "undefined" en el `<meta description>` o en el JSON-LD.
 */
const IDS_QUE_ALGO_INTERPOLA = ["fermentacion", "horno", "empanadas-peso"];

for (const id of IDS_QUE_ALGO_INTERPOLA) {
  chequear(
    `"${id}" tiene cifra: lo interpola Header.tsx o lib/seo.ts`,
    !tira(() => argumentoConCifra(id)) && typeof argumento(id).cifra === "string",
  );
}

/* ── el helper tiene que fallar ruidosamente, no devolver undefined ── */
chequear(
  '"estirado" no tiene cifra, y argumentoConCifra tiene que tirar en vez de devolverla undefined',
  argumento("estirado").cifra === undefined && tira(() => argumentoConCifra("estirado")),
);

chequear("argumento() sigue tirando con un id que no existe", tira(() => argumento("no-existe")));
chequear("argumentoConCifra() también tira con un id que no existe", tira(() => argumentoConCifra("no-existe")));

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
