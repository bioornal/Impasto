/**
 * Banco de imágenes gastronómicas de alta calidad (Unsplash)
 * Utilizado como placeholder realista hasta que el local cargue sus propias fotografías.
 */

export const STOCK_IMAGES = {
  hero: {
    main: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=85",
    chip: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=300&q=80",
  },
  story: {
    dough: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=85",
    kneading: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1000&q=85",
    oven: "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=1000&q=85",
  },
  promo: {
    hero: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
  },
  pizzas: {
    default: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    muzzarella: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80",
    margherita: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80",
    fugazzeta: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=800&q=80",
    napolitana: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    calabresa: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80",
    rucula: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=800&q=80",
    cuatroQuesos: "https://images.unsplash.com/photo-1573821663912-569905455b1c?auto=format&fit=crop&w=800&q=80",
    champinones: "https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?auto=format&fit=crop&w=800&q=80",
    panceta: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=800&q=80",
    vegetariana: "https://images.unsplash.com/photo-1576458088443-04a19bb13da6?auto=format&fit=crop&w=800&q=80",
    especial: "https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=800&q=80",
  },
  empanadas: {
    default: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=800&q=80",
    carne: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=800&q=80",
    jamonQueso: "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=800&q=80",
    pollo: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
    verdura: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
  },
  bebidas: {
    default: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
    cola: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
    cerveza: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80",
    agua: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80",
    limonada: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
  },
};

/**
 * Obtiene una foto gastronómica adecuada para una pizza según su nombre o tags.
 */
export function getPizzaImage(nombre = "", id = "", tags: string[] = []): string {
  const norm = (nombre + " " + tags.join(" ")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (norm.includes("rucula") || norm.includes("crudo") || norm.includes("prosciutto") || norm.includes("gourmet")) {
    return STOCK_IMAGES.pizzas.rucula;
  }
  if (norm.includes("fugazz") || norm.includes("cebolla") || norm.includes("fugaza")) {
    return STOCK_IMAGES.pizzas.fugazzeta;
  }
  if (norm.includes("napo") || norm.includes("tomate") || norm.includes("ajo")) {
    return STOCK_IMAGES.pizzas.napolitana;
  }
  if (norm.includes("calabre") || norm.includes("pepperoni") || norm.includes("salame") || norm.includes("picante")) {
    return STOCK_IMAGES.pizzas.calabresa;
  }
  if (norm.includes("cuatro") || norm.includes("4") || norm.includes("queso") || norm.includes("roquefort") || norm.includes("azul")) {
    return STOCK_IMAGES.pizzas.cuatroQuesos;
  }
  if (norm.includes("champi") || norm.includes("hongo") || norm.includes("funghi")) {
    return STOCK_IMAGES.pizzas.champinones;
  }
  if (norm.includes("panceta") || norm.includes("bacon") || norm.includes("provolone")) {
    return STOCK_IMAGES.pizzas.panceta;
  }
  if (norm.includes("veggie") || norm.includes("vegetariana") || norm.includes("verdura") || norm.includes("primavera")) {
    return STOCK_IMAGES.pizzas.vegetariana;
  }
  if (norm.includes("margherita") || norm.includes("margarita")) {
    return STOCK_IMAGES.pizzas.margherita;
  }
  if (norm.includes("muzza") || norm.includes("mozza") || norm.includes("clasica")) {
    return STOCK_IMAGES.pizzas.muzzarella;
  }

  // Lista rotativa como fallback por id
  const pool = [
    STOCK_IMAGES.pizzas.muzzarella,
    STOCK_IMAGES.pizzas.margherita,
    STOCK_IMAGES.pizzas.especial,
    STOCK_IMAGES.pizzas.calabresa,
    STOCK_IMAGES.pizzas.rucula,
    STOCK_IMAGES.pizzas.napolitana,
    STOCK_IMAGES.pizzas.fugazzeta,
  ];
  const seed = [...(id || nombre)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[seed % pool.length];
}

/**
 * Obtiene una foto gastronómica para una empanada.
 */
export function getEmpanadaImage(nombre = "", id = ""): string {
  const norm = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (norm.includes("jamon") || norm.includes("queso")) {
    return STOCK_IMAGES.empanadas.jamonQueso;
  }
  if (norm.includes("pollo")) {
    return STOCK_IMAGES.empanadas.pollo;
  }
  if (norm.includes("verdura") || norm.includes("espinaca") || norm.includes("acelga")) {
    return STOCK_IMAGES.empanadas.verdura;
  }
  if (norm.includes("carne") || norm.includes("cuchillo") || norm.includes("suave") || norm.includes("picante")) {
    return STOCK_IMAGES.empanadas.carne;
  }

  const pool = [
    STOCK_IMAGES.empanadas.carne,
    STOCK_IMAGES.empanadas.jamonQueso,
    STOCK_IMAGES.empanadas.pollo,
    STOCK_IMAGES.empanadas.verdura,
  ];
  const seed = [...(id || nombre)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[seed % pool.length];
}

/**
 * Obtiene una foto para una bebida.
 */
export function getDrinkImage(nombre = "", id = ""): string {
  const norm = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (norm.includes("coca") || norm.includes("cola") || norm.includes("pepsi") || norm.includes("gaseosa")) {
    return STOCK_IMAGES.bebidas.cola;
  }
  if (norm.includes("cerveza") || norm.includes("stella") || norm.includes("ipa") || norm.includes("beer") || norm.includes("rubia") || norm.includes("artesanal")) {
    return STOCK_IMAGES.bebidas.cerveza;
  }
  if (norm.includes("agua") || norm.includes("mineral") || norm.includes("soda")) {
    return STOCK_IMAGES.bebidas.agua;
  }
  if (norm.includes("limonada") || norm.includes("jugo") || norm.includes("sprite") || norm.includes("pomelo")) {
    return STOCK_IMAGES.bebidas.limonada;
  }

  const pool = [
    STOCK_IMAGES.bebidas.cola,
    STOCK_IMAGES.bebidas.cerveza,
    STOCK_IMAGES.bebidas.limonada,
    STOCK_IMAGES.bebidas.agua,
  ];
  const seed = [...(id || nombre)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[seed % pool.length];
}
