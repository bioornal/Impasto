import type { BusinessConfig } from "@/lib/business";

export interface HorarioConfig {
  /** Días abiertos con la numeración de JS: 0 = domingo … 6 = sábado. */
  dias: number[];
  apertura: string;
  cierre: string;
  zonaHoraria: string;
}

const DIAS_NOMBRE = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/**
 * Hora y día en la zona del local, no en la del servidor.
 * Netlify corre en UTC: sin esto, a las 22:00 de Iguazú el servidor cree
 * que es la 01:00 del día siguiente y rechaza pedidos válidos.
 */
function ahoraEnZona(zona: string, referencia: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = Object.fromEntries(fmt.formatToParts(referencia).map((p) => [p.type, p.value]));
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // "24" aparece a medianoche en algunas plataformas.
  const hora = Number(partes.hour) % 24;
  return { dia: dias[partes.weekday] ?? 0, minutos: hora * 60 + Number(partes.minute) };
}

export function estaAbierto(config: HorarioConfig, referencia = new Date()) {
  const { dia, minutos } = ahoraEnZona(config.zonaHoraria, referencia);
  const apertura = aMinutos(config.apertura);
  const cierreCrudo = aMinutos(config.cierre);
  // Un cierre a las 00:00 significa medianoche del día siguiente, no las 0:00 de hoy.
  const cierre = cierreCrudo <= apertura ? cierreCrudo + 24 * 60 : cierreCrudo;

  // Turno que arrancó ayer y sigue abierto pasada la medianoche.
  if (cierre > 24 * 60) {
    const diaAnterior = (dia + 6) % 7;
    if (config.dias.includes(diaAnterior) && minutos < cierre - 24 * 60) return true;
  }

  if (!config.dias.includes(dia)) return false;
  return minutos >= apertura && minutos < cierre;
}

/** Texto mostrable de cuándo vuelve a abrir. */
export function proximaApertura(config: HorarioConfig, referencia = new Date()) {
  const { dia, minutos } = ahoraEnZona(config.zonaHoraria, referencia);
  for (let salto = 0; salto <= 7; salto++) {
    const candidato = (dia + salto) % 7;
    if (!config.dias.includes(candidato)) continue;

    if (salto === 0) {
      if (estaAbierto(config, referencia)) return "ahora";
      // Todavía no abrió: abre más tarde hoy mismo, no mañana.
      if (minutos < aMinutos(config.apertura)) return `hoy a las ${config.apertura}`;
      continue;
    }

    const cuando = salto === 1 ? "mañana" : DIAS_NOMBRE[candidato];
    return `${cuando} a las ${config.apertura}`;
  }
  return `a las ${config.apertura}`;
}

export interface EstadoTienda {
  abierto: boolean;
  /** Frase completa, para el carrito y los mensajes de error. */
  motivo: string;
  /** Versión corta para la barra superior, donde el espacio es escaso. */
  etiqueta: string;
  /** true si lo cortó el interruptor manual y no el horario. */
  cierreManual: boolean;
}

/** "19:30" si abre hoy, "mañana 19:30" o "jue 19:30" si es otro día. */
function aperturaCorta(config: HorarioConfig, referencia: Date) {
  const { dia, minutos } = ahoraEnZona(config.zonaHoraria, referencia);
  for (let salto = 0; salto <= 7; salto++) {
    const candidato = (dia + salto) % 7;
    if (!config.dias.includes(candidato)) continue;
    if (salto === 0) {
      if (minutos < aMinutos(config.apertura)) return config.apertura;
      continue;
    }
    const prefijo = salto === 1 ? "mañana" : DIAS_NOMBRE[candidato].slice(0, 3);
    return `${prefijo} ${config.apertura}`;
  }
  return config.apertura;
}

/**
 * Estado real de venta. El interruptor manual manda por encima del horario:
 * si está apagado, no se vende aunque sea el horario de atención.
 */
export function estadoTienda(business: BusinessConfig, referencia = new Date()): EstadoTienda {
  if (!business.ventasActivas) {
    return {
      abierto: false,
      motivo: business.mensajeCierre || "Estamos sin tomar pedidos por el momento.",
      etiqueta: "Cerrado por ahora",
      cierreManual: true,
    };
  }

  const horario = horarioDe(business);
  if (estaAbierto(horario, referencia)) {
    return { abierto: true, motivo: "", etiqueta: business.hours, cierreManual: false };
  }

  return {
    abierto: false,
    motivo: `Ahora estamos cerrados. Abrimos ${proximaApertura(horario, referencia)}.`,
    etiqueta: `Cerrado · abre ${aperturaCorta(horario, referencia)}`,
    cierreManual: false,
  };
}

export function horarioDe(business: BusinessConfig): HorarioConfig {
  return {
    dias: business.diasApertura,
    apertura: business.horaApertura,
    cierre: business.horaCierre,
    zonaHoraria: business.zonaHoraria,
  };
}
