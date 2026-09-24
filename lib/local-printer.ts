export const PRINTER_URL = "http://127.0.0.1:8765";
const STORAGE_KEY = "impasto-printer-token";
export type PrinterId = "epson" | "3nstar";
export interface PrinterSelection { selected: PrinterId; epsonAvailable: boolean; threeNStarAvailable: boolean }

export interface PrintJob {
  readonly attemptId: string;
  readonly source: "impasto" | "carro-fogon";
  readonly orderId: string;
  readonly reprint: boolean;
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
    }>;
    readonly total: number;
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
