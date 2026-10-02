/**
 * Guía de armado para la cocina (`/cocina`).
 *
 * Los datos viven acá, en el código, y no en la base: la ruta no pide login, así
 * que guardarlos en otro lado no los protegía, y de esta forma la página
 * funciona aunque se caiga la base. Cada cambio de receta es un deploy.
 *
 * Solo entra lo confirmado por el dueño. Nada de costos, precios ni notas
 * internas: `tests/guia-cocina.test.ts` lo comprueba. Este módulo no importa la
 * base ni React, para poder testearse con `tsx`.
 *
 * El nombre de cada pizza es el de la carta. `productoId` es el id del producto
 * en `productos` y es la clave de su foto en `REAL_PRODUCT_PHOTOS`.
 */

export type EstadoPizza = "venta" | "proximamente";

export interface Ingrediente {
  nombre: string;
  cantidad: string;
}

export interface PizzaGuia {
  nombre: string;
  productoId: string;
  estado: EstadoPizza;
  /** Lo que va sobre la masa: salsa de tomate, crema de hongos, manteca de ajo o nada. */
  base: string;
  ingredientes: Ingrediente[];
  /** Lo que se agrega al salir del horno. */
  despues?: string;
  /** Solo si es una instrucción de armado. */
  nota?: string;
  /** Nombres de `PREPARACIONES` que usa esta pizza. */
  preparaciones: string[];
}

export interface PreparacionGuia {
  nombre: string;
  para: string;
  receta: string;
  conservacion: string;
  /** Verdadero cuando solo la usan pizzas que todavía no están en la carta. */
  proximamente: boolean;
}

const TOMATE = "Salsa de tomate, 150 g";
const BLANCA = "Sin salsa, base blanca";

export const BASE_DE_TODAS: string[] = [
  "Bollo de unos 300 g.",
  "Salsa de tomate: 150 g de tomate triturado por pizza, en las que la llevan. Las que van en blanco no la llevan.",
];

export const PIZZAS: PizzaGuia[] = [
  /* ── En venta ── */
  {
    nombre: "Muzzarella Impasto",
    productoId: "f9305fe1-8eea-465d-90b3-4c81f4656455",
    estado: "venta",
    base: TOMATE,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Orégano", cantidad: "5 g" },
    ],
    preparaciones: [],
  },
  {
    nombre: "Napoletana all'Aglio",
    productoId: "9ee7b500-a31a-4e42-acbe-2b694cf67eb4",
    estado: "venta",
    base: TOMATE,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Ajo confitado", cantidad: "20 g" },
      { nombre: "Oliva", cantidad: "10 ml" },
      { nombre: "Parmesano", cantidad: "30 g" },
    ],
    despues: "Puntos de pesto (20 g), como acento y sin cubrir la pizza.",
    preparaciones: ["Ajo confitado", "Pesto de albahaca"],
  },
  {
    nombre: "Fugazzetta al Provolone",
    productoId: "1ab8b31f-c5ef-443d-b024-0e3f7328d481",
    estado: "venta",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Cebolla (cruda, se dora)", cantidad: "200 g" },
      { nombre: "Provolone", cantidad: "65 g" },
      { nombre: "Oliva", cantidad: "15 ml" },
      { nombre: "Pimentón ahumado", cantidad: "5 g" },
      { nombre: "Pimienta", cantidad: "3 g" },
    ],
    preparaciones: ["Cebolla dorada"],
  },
  {
    nombre: "Quattro Formaggi",
    productoId: "c0ab17be-8cde-47fd-8be5-576abe4ccf3d",
    estado: "venta",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "195 g" },
      { nombre: "Provolone", cantidad: "40 g" },
      { nombre: "Roquefort", cantidad: "25 g" },
      { nombre: "Parmesano", cantidad: "20 g" },
      { nombre: "Almendras tostadas", cantidad: "30 g" },
    ],
    despues: "Hilo de miel de ajo.",
    preparaciones: ["Miel de ajo", "Almendras tostadas y panceta crocante"],
  },
  {
    nombre: "Diavola al Miele Piccante",
    productoId: "d312b6ed-209f-4cff-8a37-36b515a12553",
    estado: "venta",
    base: TOMATE,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Salame calabrés", cantidad: "150 g" },
    ],
    despues: "Hilo de miel picante y puntos de pesto (20 g).",
    preparaciones: ["Miel picante", "Pesto de albahaca"],
  },
  {
    nombre: "Prosciutto, Rucola e Parmigiano",
    productoId: "6d9ee913-270d-4c56-98eb-9e0b30a663ad",
    estado: "venta",
    base: TOMATE,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Jamón crudo", cantidad: "100 g" },
      { nombre: "Parmesano en lascas", cantidad: "30 g" },
      { nombre: "Rúcula", cantidad: "⅓ de atado" },
    ],
    despues: "Rúcula, jamón crudo, lascas de parmesano y aceto reducido (20 ml).",
    preparaciones: ["Aceto reducido"],
  },
  {
    nombre: "Porteña de Jamón y Morrones",
    productoId: "8bfedca8-8bd9-4cb4-a677-491c3be4c667",
    estado: "venta",
    base: TOMATE,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Jamón cocido", cantidad: "150 g" },
      { nombre: "Morrón asado en tiras", cantidad: "120 g" },
      { nombre: "Oliva", cantidad: "10 ml" },
    ],
    despues: "Provenzal en hilos (20 g) y un hilo de pesto de morrón asado (unos 25 g).",
    preparaciones: ["Morrones asados", "Pesto de morrón asado", "Provenzal"],
  },
  {
    nombre: "Palmitos y Salsa Golf",
    productoId: "b4bc6819-1616-441b-8718-879744b8ffec",
    estado: "venta",
    base: TOMATE,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Palmito", cantidad: "200 g" },
    ],
    despues: "Salsa golf en zigzag (30 g) y puntos de provenzal (5 g) con ralladura de limón.",
    preparaciones: ["Golf de la casa", "Provenzal"],
  },
  {
    nombre: "Pepperoni e Panceta",
    productoId: "e5a169af-104f-4f5e-a938-d02a0e02dd89",
    estado: "venta",
    base: TOMATE,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Pepperoni", cantidad: "150 g" },
      { nombre: "Panceta", cantidad: "100 g" },
      { nombre: "Orégano", cantidad: "5 g" },
      { nombre: "Ají molido", cantidad: "5 g" },
    ],
    nota: "Dorar la panceta antes de armar, para que llegue crocante.",
    preparaciones: ["Almendras tostadas y panceta crocante"],
  },
  {
    nombre: "Bianca ai Funghi",
    productoId: "0d871df5-0e5c-4fe3-8450-5e63261de27a",
    estado: "venta",
    base: "Crema de hongos secos",
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Bondiola", cantidad: "120 g" },
      { nombre: "Ricota en bochas", cantidad: "60 g" },
      { nombre: "Champiñones en conserva", cantidad: "50 g" },
    ],
    preparaciones: ["Crema de hongos secos"],
  },

  /* ── Próximamente ── */
  {
    nombre: "Mortazza al Pistacchio",
    productoId: "bfca7fb7-d9b4-4812-b1df-f4ba0378b8e0",
    estado: "proximamente",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Mortadela", cantidad: "150 g" },
      { nombre: "Ricota", cantidad: "60 g" },
      { nombre: "Pistacho", cantidad: "30 g" },
    ],
    despues: "Pesto de pistacho, unos 20 g.",
    preparaciones: ["Pesto de pistacho"],
  },
  {
    nombre: "Bondiola al Pangrattato",
    productoId: "3a4abc9d-caa0-458e-aef3-d906fb2f7f2b",
    estado: "proximamente",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Bondiola en láminas", cantidad: "150 g" },
      { nombre: "Ricota", cantidad: "60 g" },
      { nombre: "Pangrattato", cantidad: "20 g" },
    ],
    despues: "Láminas finas de bondiola, pangrattato dorado y crocante, cucharadas de ricota batida y unos hilos de miel y mostaza.",
    nota: "En el horno va solo la muzzarella.",
    preparaciones: ["Miel y mostaza"],
  },
  {
    nombre: "Patate e Rosmarino",
    productoId: "83371dfd-08ec-41d5-a1b1-be09b475d7db",
    estado: "proximamente",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "220 g" },
      { nombre: "Papa en escamas", cantidad: "200 g" },
      { nombre: "Panceta", cantidad: "100 g" },
      { nombre: "Provolone", cantidad: "60 g" },
      { nombre: "Oliva", cantidad: "15 ml" },
      { nombre: "Ajo", cantidad: "10 g" },
      { nombre: "Romero", cantidad: "4 g" },
    ],
    despues: "Puntos de provenzal con ralladura de limón.",
    preparaciones: ["Provenzal", "Almendras tostadas y panceta crocante"],
  },
  {
    nombre: "Carbonara Impasto",
    productoId: "4c2c7501-b7ff-4bee-8887-162fbb50b403",
    estado: "proximamente",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Panceta", cantidad: "150 g" },
      { nombre: "Huevo al centro", cantidad: "1 unidad" },
      { nombre: "Parmesano", cantidad: "25 g" },
      { nombre: "Pimienta", cantidad: "3 g" },
    ],
    despues: "Pesto de verdeo en puntitos alrededor de la yema (unos 20 g).",
    preparaciones: ["Pesto de verdeo", "Almendras tostadas y panceta crocante"],
  },
  {
    nombre: "Puerro e Panceta Croccante",
    productoId: "3e987e20-d7ca-4166-9679-7559d7603d69",
    estado: "proximamente",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "250 g" },
      { nombre: "Puerro", cantidad: "150 g" },
      { nombre: "Panceta", cantidad: "120 g" },
      { nombre: "Oliva", cantidad: "10 ml" },
      { nombre: "Pimienta", cantidad: "3 g" },
    ],
    preparaciones: ["Almendras tostadas y panceta crocante"],
  },
  {
    nombre: "La Provoleta Impasto",
    productoId: "548ea0b6-ef4c-4f0c-93ee-265f8a7baf83",
    estado: "proximamente",
    base: BLANCA,
    ingredientes: [
      { nombre: "Provolone", cantidad: "180 g" },
      { nombre: "Muzzarella", cantidad: "100 g" },
      { nombre: "Oliva", cantidad: "20 ml" },
    ],
    despues: "Cucharadas de chimichurri (45 g) y cherry asados en mitades (80 g).",
    preparaciones: ["Cherry asados"],
  },
  {
    nombre: "Filetto Impasto",
    productoId: "7a52594e-ac5e-4d6d-b505-23bce62eea75",
    estado: "proximamente",
    base: BLANCA,
    ingredientes: [
      { nombre: "Muzzarella", cantidad: "230 g" },
      { nombre: "Lomo", cantidad: "150 g" },
      { nombre: "Cebolla morada", cantidad: "100 g" },
      { nombre: "Cheddar", cantidad: "50 g" },
      { nombre: "Verdeo", cantidad: "20 g" },
      { nombre: "Oliva", cantidad: "10 ml" },
    ],
    despues: "Chimichurri.",
    preparaciones: [],
  },
  {
    nombre: "Bianca all'Aglio Confit",
    productoId: "9ccd6a44-f962-43cc-bc99-d8a8ef7290a7",
    estado: "proximamente",
    base: "Manteca de ajo confitado, unos 55 g",
    ingredientes: [{ nombre: "Muzzarella", cantidad: "250 g" }],
    despues: "Hilo de oliva (3 ml) y puntos de provenzal (5 g).",
    nota: "La manteca de ajo confitado va como base sobre la masa, sin llegar al borde, y encima la muzzarella.",
    preparaciones: ["Manteca de ajo confitado", "Provenzal"],
  },
];

export const PREPARACIONES: PreparacionGuia[] = [
  {
    nombre: "Miel picante",
    para: "Diavola al Miele Piccante",
    receta:
      "125 g de miel y 5 g de ají molido. Baño María unos 5 minutos, sin hervir. Dejar reposar entre 30 y 60 minutos, probar y colar cuando el picor sea el justo: ya colada, el picor no sube más. Pasar a un pomo. Sobre la pizza, un hilo fino de unos 8 g.",
    conservacion: "Tapada, a temperatura ambiente, varias semanas.",
    proximamente: false,
  },
  {
    nombre: "Miel de ajo",
    para: "Quattro Formaggi",
    receta:
      "125 g de miel y 30 g de ajo fresco aplastado. Baño María unos 10 minutos, sin hervir. Dejar reposar 30 minutos y colar sacando todo el ajo. Antes del servicio, entibiar el pomo en agua tibia para que corra. Sobre la pizza, un hilo de unos 20 g.",
    conservacion: "Heladera. Hacer tandas que se usen en 4 días.",
    proximamente: false,
  },
  {
    nombre: "Miel y mostaza",
    para: "Bondiola al Pangrattato",
    receta:
      "60 g de miel, 40 g de mostaza antigua o de Dijon y 1 cucharadita de limón. Mezclar hasta que quede una salsa pareja. Sobre la pizza, unos hilos finos al salir del horno.",
    conservacion: "Heladera, hasta una semana.",
    proximamente: true,
  },
  {
    nombre: "Crema de hongos secos",
    para: "Bianca ai Funghi (base en lugar de la salsa de tomate)",
    receta:
      "Por pizza: 15 g de hongos de pino secos y 40 ml de crema de leche. Tanda para 6: 90 g de hongos y 240 ml de crema. Hidratar los hongos 20 minutos en agua tibia, escurrirlos y colar el agua para guardarla. Picarlos fino, saltearlos un momento, agregar la crema y reducir hasta que cubra una cuchara. Ajustar con un poco del agua de hidratación colada y salpimentar. Procesar si se quiere lisa.",
    conservacion: "Heladera, 3 días.",
    proximamente: false,
  },
  {
    nombre: "Golf de la casa",
    para: "Palmitos y Salsa Golf",
    receta:
      "100 g de mayonesa comprada, 50 g de kétchup, 1 cucharadita de limón, una pizca de pimentón dulce y unas gotas de salsa inglesa. Mezclar. Sobre la pizza, 30 g en zigzag después del horno.",
    conservacion: "Heladera. Hacer tandas para 3 o 4 días.",
    proximamente: false,
  },
  {
    nombre: "Pesto de albahaca",
    para: "Napoletana all'Aglio y Diavola al Miele Piccante",
    receta:
      "Tanda de unos 250 g: 3 atados de albahaca, 110 ml de aceite, 15 ml de oliva, 1 cabeza de ajo, 30 g de parmesano, sal y pimienta. Procesar. Sobre la pizza, puntos de unos 20 g en total.",
    conservacion: "Heladera 4 días, o cubos congelados.",
    proximamente: false,
  },
  {
    nombre: "Provenzal",
    para: "Porteña, Palmitos, Patate e Rosmarino y Bianca all'Aglio Confit",
    receta:
      "Tanda de unos 300 g: 2 atados de perejil, 1 cabeza de ajo, 150 ml de aceite, sal y pimienta, todo picado fino y mezclado. Porteña: 20 g en hilos. Palmitos y Bianca all'Aglio Confit: 5 g en puntos. En Palmitos y Patate va con ralladura de limón.",
    conservacion: "Heladera 4 días.",
    proximamente: false,
  },
  {
    nombre: "Ajo confitado",
    para: "Napoletana all'Aglio y manteca de la Bianca all'Aglio Confit",
    receta:
      "Dientes pelados cubiertos de aceite de oliva, tapados y a fuego mínimo (60 a 90 °C) unos 40 minutos, hasta que estén tiernos. Napoletana: 20 g de ajo y 10 ml de oliva por pizza. El aceite queda perfumado: usarlo en el hilo de oliva de la Bianca y para aflojar la manteca de ajo.",
    conservacion: "Cubierto de aceite, en la heladera, 4 días como máximo.",
    proximamente: false,
  },
  {
    nombre: "Cebolla dorada",
    para: "Fugazzetta al Provolone",
    receta:
      "200 g de cebolla cruda por pizza, con oliva. Se reduce mucho al dorarse: hacerla en tanda y porcionar.",
    conservacion: "Heladera, del día o del día siguiente.",
    proximamente: false,
  },
  {
    nombre: "Morrones asados",
    para: "Porteña de Jamón y Morrones",
    receta: "Asar, pelar y cortar en tiras. Porteña: 120 g por pizza.",
    conservacion: "Heladera, tapados.",
    proximamente: false,
  },
  {
    nombre: "Pesto de morrón asado",
    para: "Porteña de Jamón y Morrones",
    receta:
      "Tanda para unas 6 pizzas: 1 morrón asado y pelado (120 g), 20 g de almendras tostadas, 1 cucharadita de limón o de vinagre, 20 ml de oliva, sal y pimentón ahumado. Procesar hasta que quede una pasta cremosa. Sobre la pizza, un hilo de unos 25 g después del horno.",
    conservacion: "Heladera 4 días, o cubos congelados.",
    proximamente: false,
  },
  {
    nombre: "Aceto reducido",
    para: "Prosciutto, Rucola e Parmigiano",
    receta: "20 ml de aceto balsámico por pizza, reducido hasta que quede como almíbar.",
    conservacion: "Tapado, a temperatura ambiente.",
    proximamente: false,
  },
  {
    nombre: "Almendras tostadas y panceta crocante",
    para: "Quattro Formaggi, Pepperoni e Panceta y las pizzas con panceta",
    receta:
      "Almendras tostadas y picadas o fileteadas (Quattro: 30 g por pizza). La panceta se dora antes de armar, para que llegue crocante.",
    conservacion: "Almendras en frasco seco. Panceta del día.",
    proximamente: false,
  },
  {
    nombre: "Cherry asados",
    para: "La Provoleta Impasto",
    receta:
      "Cherry cortados al medio, con el corte hacia arriba en una placa. Por cada 250 g: 15 ml de oliva, 5 g de ajo granulado (o un diente en láminas), tomillo o hierbas provenzales y una pizca de sal. Horno a 180 °C, calor arriba y abajo, 30 minutos (o 200 °C durante 20), hasta que los bordes se caramelicen y el jugo espese. La Provoleta: 80 g cocidos por pizza. Se achican: calcular unos 110 a 120 g crudos y pesar la primera tanda para ajustar.",
    conservacion: "Tapados en la heladera, sin cubrir de aceite, 3 días.",
    proximamente: true,
  },
  {
    nombre: "Manteca de ajo confitado",
    para: "Bianca all'Aglio Confit",
    receta:
      "Tanda para 6 pizzas: 240 g de manteca pomada (blanda, a temperatura ambiente), 90 g de ajo confitado, 5 ml (1 cucharadita) del aceite del confit y 6 g de sal. Procesar junto 20 a 30 segundos, hasta una pasta lisa, sin que la manteca se derrita. Por pizza, una capa de unos 55 g sobre la masa, sin llegar al borde (1 a 2 cm limpios, para que no se queme el cornicione), y encima la muzzarella.",
    conservacion:
      "Heladera 4 días, o congelada en porciones de 55 g. Para el servicio, sacar solo lo de una hora: con calor, no más de 2 horas fuera de la heladera.",
    proximamente: true,
  },
  {
    nombre: "Pesto de pistacho",
    para: "Mortazza al Pistacchio",
    receta:
      "40 g de pistacho pelado, 20 g de albahaca o perejil, 20 g de parmesano, ½ diente de ajo, 60 ml de oliva y 1 cucharadita de limón. Procesar. Sobre la pizza, unos 20 g.",
    conservacion: "Heladera 4 días, o cubos congelados.",
    proximamente: true,
  },
  {
    nombre: "Pesto de verdeo",
    para: "Carbonara Impasto",
    receta:
      "50 g de verdeo blanqueado 15 segundos y enfriado en agua con hielo, 20 g de almendras, 15 g de provolone rallado, 10 g de perejil, 60 ml de oliva, 1 cucharadita de limón y pimienta. Sin sal: la panceta y el parmesano ya aportan. Procesar. Sobre la pizza, unos 20 g en puntos.",
    conservacion: "Heladera 4 días, o cubos congelados.",
    proximamente: true,
  },
];

/** Id para el ancla de cada preparación: minúsculas, sin tildes ni espacios. */
export function idDePreparacion(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
