export const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
export const uid = () => Math.random().toString(36).slice(2, 9);
