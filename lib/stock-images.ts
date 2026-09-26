/**
 * Banco de imágenes gastronómicas de alta calidad (Unsplash)
 * Utilizado como placeholder realista hasta que el local cargue sus propias fotografías.
 */

export const STOCK_IMAGES = {
  hero: {
    main: "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/hero1.jpg",
    // La pizza que aparece en `main`: la etiqueta del hero tiene que nombrar esa. Cambiar juntos.
    productoId: "c0ab17be-8cde-47fd-8be5-576abe4ccf3d", // Quattro Formaggi e Noci
    chip: "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/hero-quattro-formaggi.jpg",
  },
  story: {
    dough: "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/nosotros.jpg",
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
 * Fotos reales subidas al storage de InsForge, por id de producto. Tienen
 * prioridad sobre el banco de stock de abajo.
 */
export const REAL_PRODUCT_PHOTOS: Record<string, string> = {
  "f9305fe1-8eea-465d-90b3-4c81f4656455": // Muzzarella Impasto
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Muzzarella%20Impasto.jpg",
  "9ee7b500-a31a-4e42-acbe-2b694cf67eb4": // Napoletana all'Aglio
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/napoletana-aglio-v2.jpg",
  "1ab8b31f-c5ef-443d-b024-0e3f7328d481": // Fugazzetta al Provolone
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/fugazzetta-provolone-v2.jpg",
  "d36e95b3-243c-4dce-a2cc-4c3f0a52531c": // Americana Agridulce
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Americana%20Agridulce.png",
  "3a4abc9d-caa0-458e-aef3-d906fb2f7f2b": // Bondiola al Pangrattato
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Bondiola%20al%20Pangrattato.jpg",
  "4c2c7501-b7ff-4bee-8887-162fbb50b403": // Carbonara Impasto
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Carbonara%20Impasto.jpg",
  "d312b6ed-209f-4cff-8a37-36b515a12553": // Diavola al Miele Piccante
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Diavola%20al%20Miele%20Piccante.jpg",
  "bfca7fb7-d9b4-4812-b1df-f4ba0378b8e0": // Mortazza al Pistacchio
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Mortazza%20al%20Pistacchio.jpg",
  "b4bc6819-1616-441b-8718-879744b8ffec": // Palmitos y Salsa Golf
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Palmitos%20y%20Salsa%20Golf.jpg",
  "83371dfd-08ec-41d5-a1b1-be09b475d7db": // Patate e Rosmarino
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Patate%20e%20Rosmarino.jpg",
  "e5a169af-104f-4f5e-a938-d02a0e02dd89": // Pepperoni e Panceta
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Pepperoni%20e%20Panceta.jpg",
  "3e987e20-d7ca-4166-9679-7559d7603d69": // Porro e Panceta Croccante
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Porro%20e%20Panceta%20Croccante.jpg",
  "8bfedca8-8bd9-4cb4-a677-491c3be4c667": // Porteña de Jamón y Morrones
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Porte%C3%B1a%20de%20Jam%C3%B3n%20y%20Morrones.jpg",
  "c0ab17be-8cde-47fd-8be5-576abe4ccf3d": // Quattro Formaggi e Noci
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Quattro%20Formaggi%20e%20Noci.jpg",
  "bffd02f2-b069-45fa-9324-316a204f5447": // Choclo, Panceta y Salsa Criolla
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Choclo,%20Panceta%20y%20Salsa%20Criolla.jpg",
  "a8659b32-fb98-4a8c-a0f6-cf3e6546a575": // Cinque Formaggi
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Cinque%20Formaggi%20%281%29.jpg",
  "7a52594e-ac5e-4d6d-b505-23bce62eea75": // Filetto Impasto
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Filetto%20Impasto.jpg",
  "0d871df5-0e5c-4fe3-8450-5e63261de27a": // Bianca ai Funghi
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/bianca-ai-funghi.jpg",
  "9ccd6a44-f962-43cc-bc99-d8a8ef7290a7": // Bianca all'Aglio Confit
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/bianca-aglio-confit.jpg",
  "548ea0b6-ef4c-4f0c-93ee-265f8a7baf83": // La Provoleta Impasto
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/La%20Provoleta%20Impasto.jpg",
  "6d9ee913-270d-4c56-98eb-9e0b30a663ad": // Prosciutto, Rucola e Parmigiano
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/Prosciutto,%20Rucola%20e%20Parmigiano.jpg",
  "e21c2dea-c487-4094-b54f-32da320986cf": // Empanadas Arabe
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20arabe.jpg",
  "6d9a8570-9bfd-435d-9aa1-413792e2bd47": // Empanadas Caprese
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20caprese.jpg",
  "7bf77e9d-1e36-471a-bfdb-362df3e7298d": // Empanadas Carne Dulce
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20carne%20dulce.jpg",
  "702e0f9c-25ed-4444-990f-de56fc7a8194": // Empanadas Carne Relleno
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20carne.jpg",
  "a06602f2-984e-46da-aa90-bb3496a38ca0": // Empanadas de Palmito
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20palmito.jpg",
  "48804913-5f31-4188-99df-c594ed75f457": // Empanadas de Pollo
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20pollo.jpg",
  "3d96d200-647e-4719-9fa5-0a3022f44d72": // Empanadas de Roquefort
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20roquefort.jpg",
  "3ef2a602-17eb-483c-bf9f-ed985a44d4ee": // Empanadas Espinaca y Muzza
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20espinaca.jpg",
  "bf4ef7e1-400f-417a-be6a-03734e330909": // Empanadas Jamon y Muzza
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/empanada%20jamon%20y%20muzza.jpg",
  "a3bb5e88-2433-49e1-bc8b-9935c8cad0e5": // Agua Mineral con gas 500 ml
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/agua%20gas.webp",
  "6b52d73e-c482-4a64-a910-abaa95ecb2eb": // Agua Mineral sin gas 500 ml
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/agua.jpg",
  "c03c9b94-ae21-45bf-ad04-36c732b4805a": // Cerveza Brahma 1 L
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/brahma.jpg",
  "f62cfa81-9573-43db-9ac0-2f0ceb77d19c": // Cerveza Quilmes 1 L
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/quilmes.jpg",
  "4953e9dd-86c3-410e-a708-5aa9bff868b4": // Coca-Cola 1.5 L
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/coca.jpg",
  "5ac93efd-25cd-429a-a69f-bd9aa60e5973": // Coca-Cola Zero 1.5 L
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/coca%20zero.jpg",
  "742c2588-de49-4516-b8e2-456e2718d4ab": // Sprite 1.5 L
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/sprite.jpg",
  "ae0da614-592f-45ff-96c3-2fe277701b6f": // Vino Malbec 750 ml — OJO: la etiqueta subida es un Cabernet Sauvignon, no Malbec
    "https://3agqcygs.us-east.insforge.app/api/storage/buckets/DB/objects/vino.webp",
};

/**
 * Obtiene una foto gastronómica adecuada para una pizza según su nombre o tags.
 */
export function getPizzaImage(nombre = "", id = "", tags: string[] = []): string {
  if (REAL_PRODUCT_PHOTOS[id]) {
    return REAL_PRODUCT_PHOTOS[id];
  }

  const norm = (nombre + " " + tags.join(" ")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (norm.includes("rucula") || norm.includes("crudo") || norm.includes("prosciutto")) {
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
  // "gourmet" va ultimo a proposito: es una etiqueta de estilo, no un ingrediente,
  // y matchea muchisimas pizzas. Arriba de todo tapaba ramas mas especificas --
  // una pizza de hongos etiquetada gourmet terminaba mostrando la foto de rucula.
  if (norm.includes("gourmet")) {
    return STOCK_IMAGES.pizzas.rucula;
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
  if (REAL_PRODUCT_PHOTOS[id]) {
    return REAL_PRODUCT_PHOTOS[id];
  }

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
  if (REAL_PRODUCT_PHOTOS[id]) {
    return REAL_PRODUCT_PHOTOS[id];
  }

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
