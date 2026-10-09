export const PRINTER_URL = "http://127.0.0.1:8765";
const STORAGE_KEY = "impasto-printer-token";
export type PrinterId = "epson" | "3nstar";
export interface PrinterSelection { selected: PrinterId; epsonAvailable: boolean; threeNStarAvailable: boolean }

export type PrintCopy = "cocina" | "cliente";

export interface PrintJob {
  readonly attemptId: string;
  readonly source: "impasto" | "carro-fogon";
  readonly orderId: string;
  readonly reprint: boolean;
  /** Ausente = comanda de cocina. "cliente" = copia para pegar en la caja (agente versión 3+). */
  readonly copy?: PrintCopy;
  readonly receipt: {
    readonly kind: "delivery" | "retiro";
    readonly date: string;
    readonly number: string;
    readonly customer?: string;
    readonly phone?: string;
    readonly address?: string;
    readonly notes?: string;
    readonly items: ReadonlyArray<{
      readonly name: string;
      readonly quantity: number;
      readonly detail?: string;
      readonly unitPrice: number;
      readonly lineTotal?: number;
    }>;
    readonly total: number;
    readonly subtotal?: number;
    readonly shipping?: number;
    readonly paymentMethod: string;
    readonly paymentStatus: string;
  };
}

function storedToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

async function request(
  path: string,
  token: string,
  fetcher: typeof fetch,
  body?: unknown,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    return await fetcher(PRINTER_URL + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Printer-Token": token,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
  } catch {
    throw new Error("Agente no disponible; el pedido sigue guardado.");
  } finally {
    clearTimeout(timer);
  }
}

export async function configurePrinter(token: string, fetcher: typeof fetch = fetch): Promise<void> {
  const candidate = token.trim();
  if (candidate.length < 32) throw new Error("Secreto de emparejamiento inválido.");
  const response = await request("/health", candidate, fetcher);
  if (response.status === 403) throw new Error("No se pudo emparejar la impresora.");
  if (!response.ok) throw new Error("Agente no disponible; revisá la impresora local.");
  const result = await response.json() as { paired?: boolean };
  if (result.paired !== true) throw new Error("No se pudo emparejar la impresora.");
  window.localStorage.setItem(STORAGE_KEY, candidate);
}

export async function printerHealth(fetcher: typeof fetch = fetch): Promise<boolean> {
  const token = storedToken();
  if (!token) return false;
  try {
    const response = await request("/health", token, fetcher);
    if (!response.ok) return false;
    const result = await response.json() as { paired?: boolean };
    return result.paired === true;
  } catch {
    return false;
  }
}

export async function getPrinterSelection(fetcher: typeof fetch = fetch): Promise<PrinterSelection> {
  const token = storedToken();
  if (!token) throw new Error("Emparejá la impresora local para configurar la selección.");
  const response = await request("/printers", token, fetcher);
  if (response.status === 403) throw new Error("Se perdió el emparejamiento de la impresora local.");
  if (!response.ok) throw new Error("No se pudo consultar la impresora de esta PC.");
  const result = await response.json() as PrinterSelection;
  if ((result.selected !== "epson" && result.selected !== "3nstar") || typeof result.epsonAvailable !== "boolean" || typeof result.threeNStarAvailable !== "boolean")
    throw new Error("Respuesta inválida del agente local.");
  return result;
}

export async function selectPrinter(printer: PrinterId, fetcher: typeof fetch = fetch): Promise<{ selected: PrinterId }> {
  const token = storedToken();
  if (!token) throw new Error("Emparejá la impresora local para configurar la selección.");
  const response = await request("/printers", token, fetcher, { printer });
  if (response.status === 403) throw new Error("Se perdió el emparejamiento de la impresora local.");
  if (response.status === 409) throw new Error("La impresora elegida no está disponible en esta PC.");
  if (!response.ok) throw new Error("No se pudo guardar la impresora elegida.");
  const result = await response.json() as { selected?: PrinterId };
  if (result.selected !== printer) throw new Error("Respuesta inválida del agente local.");
  return { selected: printer };
}

export async function printLocal(
  job: PrintJob,
  fetcher: typeof fetch = fetch,
): Promise<"queued" | "duplicate"> {
  const token = storedToken();
  if (!token) throw new Error("Emparejá la impresora local antes de enviar la comanda.");
  const response = await request("/print", token, fetcher, job);
  if (response.status === 403) throw new Error("Se perdió el emparejamiento de la impresora local.");
  if (response.status === 409) throw new Error("Resultado de impresión incierto; revisá papel y cola antes de reimprimir.");
  if (!response.ok) throw new Error("No se pudo enviar la comanda; el pedido sigue guardado.");
  const result = await response.json() as { status?: string; duplicate?: boolean };
  if (result.status !== "queued") throw new Error("Respuesta inválida del agente local.");
  return result.duplicate === true ? "duplicate" : "queued";
}

export function newAttemptId(): string {
  return crypto.randomUUID();
}

/** Versión del agente instalado, o null si no responde o no está emparejado. */
export async function printerVersion(fetcher: typeof fetch = fetch): Promise<number | null> {
  const token = storedToken();
  if (!token) return null;
  try {
    const response = await request("/health", token, fetcher);
    if (!response.ok) return null;
    const result = await response.json() as { version?: unknown };
    const version = Number(result.version);
    return Number.isInteger(version) && version > 0 ? version : null;
  } catch {
    return null;
  }
}

export const VERSION_COPIA_CLIENTE = 3;

export class AgenteSinCopiaCliente extends Error {
  constructor() {
    super("Actualizá el agente de impresión para imprimir la copia del cliente.");
    this.name = "AgenteSinCopiaCliente";
  }
}

/**
 * Como printLocal, pero la copia del cliente solo viaja a un agente que la entiende:
 * uno viejo ignoraría `copy` y la imprimiría con el formato de cocina.
 */
export async function printCopy(job: PrintJob, fetcher: typeof fetch = fetch): Promise<"queued" | "duplicate"> {
  if (job.copy === "cliente") {
    const version = await printerVersion(fetcher);
    if (version === null) throw new Error("Agente no disponible; el pedido sigue guardado.");
    if (version < VERSION_COPIA_CLIENTE) throw new AgenteSinCopiaCliente();
  }
  return printLocal(job, fetcher);
}

export interface ResultadoCopias {
  /** Lo que no salió, con sus mismas claves: reintentar no duplica lo que ya salió. */
  readonly pendientes: PrintJob[];
  readonly agenteViejo: boolean;
  readonly error?: unknown;
}

/** Imprime en orden (cocina y después cliente) y se detiene en el primer fallo. */
export async function imprimirCopias(
  jobs: readonly PrintJob[],
  print: (job: PrintJob) => Promise<"queued" | "duplicate"> = job => printCopy(job),
): Promise<ResultadoCopias> {
  let agenteViejo = false;
  for (let i = 0; i < jobs.length; i++) {
    try {
      await print(jobs[i]);
    } catch (error) {
      if (error instanceof AgenteSinCopiaCliente) { agenteViejo = true; continue; }
      return { pendientes: jobs.slice(i), agenteViejo, error };
    }
  }
  return { pendientes: [], agenteViejo };
}

/** Texto para el operario según qué copias se intentaron y cuáles salieron. */
export function mensajeCopias(jobs: readonly PrintJob[], resultado: ResultadoCopias): { ok: boolean; texto: string } {
  const conCocina = jobs.some(job => job.copy !== "cliente");
  const conCliente = jobs.some(job => job.copy === "cliente");
  if (resultado.pendientes.length) {
    const motivo = resultado.error instanceof Error ? resultado.error.message : "No se pudo enviar la comanda; el pedido sigue guardado.";
    const salioCocina = conCocina && resultado.pendientes.every(job => job.copy === "cliente");
    return { ok: false, texto: salioCocina ? `Comanda de cocina enviada; copia del cliente no enviada. ${motivo}` : motivo };
  }
  if (resultado.agenteViejo) {
    const aviso = new AgenteSinCopiaCliente().message;
    return { ok: false, texto: conCocina ? `Comanda de cocina enviada a la cola. ${aviso}` : aviso };
  }
  if (conCocina && conCliente) return { ok: true, texto: "Comanda de cocina y copia del cliente enviadas a la cola." };
  return { ok: true, texto: conCliente ? "Copia del cliente enviada a la cola." : "Comanda de cocina enviada a la cola." };
}
