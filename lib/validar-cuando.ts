/** Valida que el momento de entrega no sea diferido. Por ahora solo se acepta entrega inmediata ('asap'). */
export function validarCuando(when: unknown): string {
  const v = typeof when === "string" ? when.trim() : "";
  const val = v || "asap";
  if (val !== "asap") {
    throw new Error("Por ahora solo tomamos pedidos para ya");
  }
  return val;
}
