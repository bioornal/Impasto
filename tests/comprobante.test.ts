import { validarComprobante, claveDeComprobante, puedeSubirComprobante, avisoComprobante, TAMANO_MAXIMO } from "../lib/comprobante";

let fallos = 0;
function chequear(nombre: string, condicion: boolean) {
  if (condicion) console.log(`PASA   ${nombre}`);
  else { console.error(`FALLA  ${nombre}`); fallos++; }
}

const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const texto = new TextEncoder().encode("<script>alert(1)</script>");
const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

/* ── qué archivos se aceptan ── */
const vJpg = validarComprobante(jpg, jpg.length);
chequear("acepta JPG", vJpg.ok && vJpg.tipo.ext === "jpg");
const vPng = validarComprobante(png, png.length);
chequear("acepta PNG", vPng.ok && vPng.tipo.ext === "png");
const vPdf = validarComprobante(pdf, pdf.length);
chequear("acepta PDF", vPdf.ok && vPdf.tipo.mime === "application/pdf");
chequear("rechaza HTML disfrazado", validarComprobante(texto, texto.length).ok === false);
chequear("rechaza un ejecutable", validarComprobante(exe, exe.length).ok === false);
chequear("rechaza vacío", validarComprobante(new Uint8Array(), 0).ok === false);
const grande = validarComprobante(jpg, TAMANO_MAXIMO + 1);
chequear("rechaza más de 4 MB con 413", !grande.ok && grande.status === 413);
const raro = validarComprobante(exe, exe.length);
chequear("rechaza tipo no admitido con 415", !raro.ok && raro.status === 415);

/* ── dónde se guarda ── */
const clave = claveDeComprobante("abc", new Date("2026-10-06T12:30:45.123Z"), "pdf");
chequear("clave: carpeta del pedido y fecha con milésimas", clave === "abc/20261006T123045123Z.pdf");

/* ── cuándo se puede subir ── */
chequear("transferencia pendiente: sí", puedeSubirComprobante({ metodo_pago: "transferencia", estado_pago: "pendiente", status: "nuevo" }));
chequear("transferencia en preparación sin pagar: sí", puedeSubirComprobante({ metodo_pago: "transferencia", estado_pago: "pendiente", status: "preparando" }));
chequear("transferencia ya acreditada: no", !puedeSubirComprobante({ metodo_pago: "transferencia", estado_pago: "aprobado", status: "nuevo" }));
chequear("pedido cancelado: no", !puedeSubirComprobante({ metodo_pago: "transferencia", estado_pago: "pendiente", status: "cancelado" }));
chequear("efectivo: no", !puedeSubirComprobante({ metodo_pago: "efectivo", estado_pago: "pendiente", status: "nuevo" }));
chequear("tarjeta: no", !puedeSubirComprobante({ metodo_pago: "mercadopago", estado_pago: "pendiente", status: "nuevo" }));

/* ── aviso al local ── */
const aviso = avisoComprobante("IM-1", "Ana\nPérez", "$16.000", "ARQ");
chequear("el aviso nombra la referencia y la cuenta", aviso.includes("IM-1") && aviso.includes("revisar en ARQ"));
chequear("un salto de línea en el nombre no falsifica una línea", aviso.split("\n").length === 3);

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
