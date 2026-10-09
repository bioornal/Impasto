# Copia del cliente en la impresora térmica — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Impasto y Carro Fogón impriman, además de la comanda de cocina, una copia para pegar en la caja del cliente, con su propio corte.

**Architecture:** El agente local (`Impasto/printer-agent`, C#) aprende un segundo formato (`copy: "cliente"`) y pasa a versión 3; la comanda de cocina no cambia ni un byte. Las dos webs comparten `local-printer.ts` (idéntico en ambos repos) con `printCopy`, que solo manda la copia del cliente a un agente versión 3 o más, e `imprimirCopias`, que imprime cocina → cliente y devuelve lo que falta para reintentar con las mismas claves.

**Tech Stack:** C# 5 / .NET Framework 4 (`csc` de `v4.0.30319`, `JavaScriptSerializer`); Next.js 15 + `node --test` (Carro Fogón, npm); Next.js 16 + `tsx` (Impasto, pnpm).

**Diseño:** `docs/superpowers/specs/2026-10-09-copia-cliente-design.md`.

## Global Constraints

- Rutas relativas a `C:\Users\spezi\Documents\PROYECTOS`. Dos repositorios git: `Impasto/` (incluye `printer-agent/`) y `carroFogon/`.
- C# compila con `csc` de .NET Framework 4 y `/warnaserror+`: **nada de** interpolación `$"..."`, `?.`, `nameof`, miembros `=>`, `out var` ni tuplas. Concatenar con `+`.
- Los `.cs` son UTF-8 **sin BOM** con CRLF; mantenerlos así.
- **La copia del cliente nunca lleva el número de pedido**, ni notas, ni la marca `REIMPRESIÓN`, ni el estado de pago crudo.
- Textos exactos de la copia del cliente: `IMPASTO`; `Pizza a la piedra · técnica napoletana`; `Puerto Iguazú, Misiones`; `DELIVERY` / `RETIRO`; `Tel. <teléfono>`; `Subtotal`; `Envío` (`Gratis` si es 0); `Descuento`; `TOTAL`; `Pagado con efectivo|transferencia|Mercado Pago`; `Pago en efectivo · a abonar $X`; `Pago por transferencia · a abonar $X`; `Forma de pago: efectivo|transferencia|Mercado Pago`; pie `¡Gracias por elegir Impasto!` / `Pedí online: www.impastopizzas.com` / `WhatsApp (03757) 65-2003 · @impasto.iguazu`.
- Importes de la copia del cliente: `"$" + valor.ToString("N0" o "N2", es-AR)` → `$63.500`, `$1.234,50`.
- La clave de la copia del cliente es la de cocina más `:cliente`.
- `local-printer.ts` debe quedar **byte a byte idéntico** en `carroFogon/next-app/src/lib/` e `Impasto/lib/`.
- Mensajes de UI exactos: `Comanda de cocina enviada; copia del cliente no enviada. <motivo>` y `Actualizá el agente de impresión para imprimir la copia del cliente.`
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Nada de push hasta la Task 7.**
- Impasto usa `pnpm`; Carro Fogón usa `npm`. No crear `package-lock.json` en Impasto.

---

### Task 1: Agente — formato de la copia del cliente

**Files:**
- Modify: `Impasto/printer-agent/PrintRequest.cs`
- Modify: `Impasto/printer-agent/ReceiptEncoder.cs`
- Test: `Impasto/printer-agent/Tests.cs`

**Interfaces:**
- Produces: `PrintRequest.copy` (`"cocina"` | `"cliente"`, normalizado por `Validate()`); `Receipt.subtotal`, `Receipt.shipping` (`decimal?`); `ReceiptItem.lineTotal` (`decimal?`); `ReceiptEncoder.Encode(request, reprint, threeNStar)` elige el formato por `copy`; `Tests.ClienteFixture(...)` (público, lo usa `ServerTests` en la Task 2).

- [ ] **Step 1: Capturar la comanda de cocina actual (golden) antes de tocar nada**

Desde `Impasto/printer-agent`, compilar las pruebas con el código actual:

```powershell
powershell -NoProfile -File build.ps1 -Test
```

Esperado: termina con `Tests: N passed, 0 failed`.

Crear `%TEMP%\golden.cs` (fuera del repo):

```csharp
using System;
class Golden {
    static void Main() {
        foreach (string kind in new[] { "retiro", "delivery" }) {
            var request = PrinterAgent.PrintRequest.Parse(PrinterAgent.Tests.Fixture(kind: kind));
            Console.WriteLine(kind + "=" + Convert.ToBase64String(PrinterAgent.ReceiptEncoder.Encode(request, false)));
        }
    }
}
```

Compilarlo junto a las pruebas y ejecutarlo:

```powershell
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $csc /nologo /reference:bin/PrinterAgent.Tests.exe /reference:System.Web.Extensions.dll /out:bin/Golden.exe "$env:TEMP\golden.cs"
.\bin\Golden.exe
Remove-Item bin/Golden.exe, "$env:TEMP\golden.cs"
```

Esperado: dos líneas, `retiro=<base64>` y `delivery=<base64>`. Guardar los dos valores para el Step 2.

- [ ] **Step 2: Escribir las pruebas (fallan)**

En `Tests.cs`, dentro de `public static class Tests`, debajo de `static readonly JavaScriptSerializer Json = ...;`, agregar (reemplazando `<retiro>` y `<delivery>` por los base64 del Step 1):

```csharp
        // Comanda de cocina del agente versión 2, capturada antes de la copia del cliente. No debe cambiar.
        const string GoldenRetiro = "<retiro>";
        const string GoldenDelivery = "<delivery>";
        public static string ClienteFixture(string kind = "delivery", string method = "efectivo", string status = "pendiente",
            decimal shipping = 3000m, decimal total = 6000m, string source = "impasto") {
            return Json.Serialize(new {
                attemptId = "test-attempt-1:cliente", source = source, orderId = "test-order-1", reprint = true, copy = "cliente",
                receipt = new { kind = kind, date = "9/10/2026, 21:15:00", number = "4", customer = "Juan Pérez",
                    phone = "3757 123456", address = "Santa María 123 · portón negro", notes = "Nota interna de cocina",
                    items = new object[] {
                        new { name = "Pizza mitad y mitad", quantity = 1, detail = "Mitad muzza / mitad jamón", unitPrice = 1500m, lineTotal = 2000m },
                        new { name = "Coca-Cola 1.5 L", quantity = 2, detail = "", unitPrice = 500m } },
                    subtotal = 3000m, shipping = shipping,
                    total = total, paymentMethod = method, paymentStatus = status }
            });
        }
        // Texto impreso sin los comandos ESC/GS, para medir columnas.
        static string Visible(byte[] bytes) {
            var kept = new System.Collections.Generic.List<byte>();
            for (int i = 0; i < bytes.Length; i++) {
                if (bytes[i] == 27 && i + 1 < bytes.Length && bytes[i + 1] == 64) { i += 1; continue; } // ESC @
                if (bytes[i] == 27 || bytes[i] == 29) { i += 2; continue; } // ESC/GS x n
                kept.Add(bytes[i]);
            }
            return Encoding.GetEncoding(1252).GetString(kept.ToArray());
        }
        static string Cliente(string json) { return Visible(ReceiptEncoder.Encode(PrintRequest.Parse(json), true)); }
```

En `Main()`, antes de `ServerTests.Run(Run);`, agregar:

```csharp
            Run("kitchen ticket is byte-identical to version 2", delegate {
                Check(Convert.ToBase64String(ReceiptEncoder.Encode(PrintRequest.Parse(Fixture()), false)) == GoldenRetiro, "retiro unchanged");
                Check(Convert.ToBase64String(ReceiptEncoder.Encode(PrintRequest.Parse(Fixture(kind: "delivery")), false)) == GoldenDelivery, "delivery unchanged");
            });
            Run("missing or empty copy is the kitchen ticket", delegate {
                Check(PrintRequest.Parse(Fixture()).copy == "cocina", "absent copy");
                Check(PrintRequest.Parse(Fixture().Replace("\"reprint\":false", "\"reprint\":false,\"copy\":\"\"")).copy == "cocina", "empty copy");
            });
            Run("invalid copy rejected", delegate { Reject(ClienteFixture().Replace("\"copy\":\"cliente\"", "\"copy\":\"otra\"")); });
            Run("customer copy requires subtotal and shipping", delegate {
                Reject(ClienteFixture().Replace("\"subtotal\":3000,", ""));
                Reject(ClienteFixture().Replace("\"shipping\":3000,", ""));
            });
            Run("negative line total rejected", delegate { Reject(ClienteFixture().Replace("\"lineTotal\":2000", "\"lineTotal\":-1")); });
            Run("customer copy: brand, no order number, notes or reprint mark", delegate {
                string text = Cliente(ClienteFixture());
                Check(text.Contains("IMPASTO") && text.Contains("Pizza a la piedra · técnica napoletana") && text.Contains("Puerto Iguazú, Misiones"), "brand header");
                Check(!text.Contains("#4") && !text.Contains("Nota interna") && !text.Contains("REIMPRESIÓN") && !text.Contains("pendiente"), "kitchen-only data omitted");
                Check(text.Contains("¡Gracias por elegir Impasto!") && text.Contains("WhatsApp (03757) 65-2003 · @impasto.iguazu"), "footer");
            });
            Run("customer copy is the same from both sites", delegate {
                byte[] web = ReceiptEncoder.Encode(PrintRequest.Parse(ClienteFixture()), true);
                byte[] pos = ReceiptEncoder.Encode(PrintRequest.Parse(ClienteFixture(source: "carro-fogon")), true);
                Check(web.SequenceEqual(pos), "no CARRO FOGÓN header");
            });
            Run("customer copy lines fit 42 columns with amounts on the right", delegate {
                string[] lines = Cliente(ClienteFixture()).Split('\n');
                Check(lines.All(l => l.Length <= 42), "42 columns");
                Check(lines.Any(l => l.StartsWith("9/10/2026, 21:15:00") && l.EndsWith("DELIVERY") && l.Length == 42), "date and mode");
                Check(lines.Contains("Juan Pérez") && lines.Contains("Santa María 123 · portón negro") && lines.Contains("Tel. 3757 123456"), "delivery recipient");
                Check(lines.Any(l => l.StartsWith("1 x Pizza mitad y mitad") && l.EndsWith("$2.000") && l.Length == 42), "line total used");
                Check(lines.Contains("    Mitad muzza / mitad jamón"), "indented detail");
                Check(lines.Any(l => l.StartsWith("2 x Coca-Cola 1.5 L") && l.EndsWith("$1.000") && l.Length == 42), "quantity x unit price");
                Check(lines.Any(l => l.StartsWith("Subtotal") && l.EndsWith("$3.000")), "subtotal");
                Check(lines.Any(l => l.StartsWith("Envío") && l.EndsWith("$3.000")), "shipping");
                Check(lines.Any(l => l.StartsWith("TOTAL") && l.EndsWith("$6.000")), "total");
                Check(lines.Contains("Pago en efectivo · a abonar $6.000"), "payment to collect");
            });
            Run("long item name keeps its amount on the last line", delegate {
                string[] lines = Cliente(ClienteFixture().Replace("Pizza mitad y mitad", new string('X', 60))).Split('\n');
                Check(lines.Any(l => l.StartsWith("XXXX") && l.EndsWith("$2.000")), "amount after wrapped name");
                Check(lines.All(l => l.Length <= 42), "42 columns");
            });
            Run("pickup copy omits address, phone and shipping", delegate {
                string text = Cliente(ClienteFixture("retiro", shipping: 0m, total: 3000m));
                Check(text.Contains("RETIRO") && text.Contains("Juan Pérez"), "pickup mode and name");
                Check(!text.Contains("Santa María") && !text.Contains("Tel.") && !text.Contains("Envío"), "no delivery data");
            });
            Run("free shipping and historical discount", delegate {
                Check(Cliente(ClienteFixture(shipping: 0m, total: 3000m)).Split('\n').Any(l => l.StartsWith("Envío") && l.EndsWith("Gratis")), "free shipping");
                Check(Cliente(ClienteFixture(total: 5500m)).Split('\n').Any(l => l.StartsWith("Descuento") && l.EndsWith("-$500")), "discount");
                Check(!Cliente(ClienteFixture()).Contains("Descuento"), "no invented discount");
            });
            Run("customer payment wording", delegate {
                Check(Cliente(ClienteFixture(method: "transferencia", status: "aprobado")).Contains("Pagado con transferencia"), "paid transfer");
                Check(Cliente(ClienteFixture(method: "mercadopago", status: "aprobado")).Contains("Pagado con Mercado Pago"), "paid MP");
                Check(Cliente(ClienteFixture(method: "transferencia")).Contains("Pago por transferencia · a abonar $6.000"), "transfer to collect");
                Check(Cliente(ClienteFixture(status: "rechazado")).Contains("Forma de pago: efectivo"), "other status");
                string unknown = Cliente(ClienteFixture(method: "n/d"));
                Check(!unknown.Contains("Pago") && !unknown.Contains("pago") && !unknown.Contains("n/d"), "unknown method prints no payment line");
            });
            Run("customer amounts with cents", delegate {
                Check(Cliente(ClienteFixture().Replace("\"lineTotal\":2000", "\"lineTotal\":1234.5")).Contains("$1.234,50"), "cents shown");
            });
            Run("customer copy ends with feed and cut; 3nStar gets extra feed", delegate {
                byte[] epson = ReceiptEncoder.Encode(PrintRequest.Parse(ClienteFixture()), false);
                byte[] threeNStar = ReceiptEncoder.Encode(PrintRequest.Parse(ClienteFixture()), false, true);
                Check(epson.Skip(epson.Length - 3).SequenceEqual(new byte[] {29,86,0}), "final cut");
                Check(threeNStar.Length == epson.Length + 3, "3nStar extra feed");
            });
```

- [ ] **Step 3: Verificar que fallan**

Run: `powershell -NoProfile -File build.ps1 -Test`
Esperado: error de compilación (`PrintRequest` no tiene `copy`). Es la falla esperada.

- [ ] **Step 4: Implementar `PrintRequest.cs`**

Reemplazar `Validate()` y las clases `Receipt` / `ReceiptItem`, y agregar la propiedad `copy`:

```csharp
    public sealed class PrintRequest {
        public string attemptId { get; set; }
        public string source { get; set; }
        public string orderId { get; set; }
        public bool reprint { get; set; }
        /// <summary>"cocina" (comanda) o "cliente" (copia para la caja). Ausente equivale a "cocina".</summary>
        public string copy { get; set; }
        public Receipt receipt { get; set; }
        public const int MaxBodyBytes = 65536;
```

(`Parse` queda igual.)

```csharp
        internal void Validate() {
            Required(attemptId, 128); Required(orderId, 128);
            if (source != "impasto" && source != "carro-fogon") throw new ArgumentException("Origen de comanda inválido.");
            copy = string.IsNullOrWhiteSpace(copy) ? "cocina" : copy.Trim().ToLowerInvariant();
            if (copy != "cocina" && copy != "cliente") throw new ArgumentException("Copia inválida.");
            if (receipt == null) throw new ArgumentException("Falta el recibo.");
            receipt.kind = (receipt.kind ?? "").Trim().ToLowerInvariant();
            if (receipt.kind != "delivery" && receipt.kind != "retiro") throw new ArgumentException("Modalidad inválida.");
            Required(receipt.date, 64); Required(receipt.number, 64);
            Optional(receipt.customer, 160); Optional(receipt.phone, 64); Optional(receipt.address, 500); Optional(receipt.notes, 2000);
            Required(receipt.paymentMethod, 64); Required(receipt.paymentStatus, 64);
            if (receipt.total < 0 || receipt.total > 100000000) throw new ArgumentException("Total inválido.");
            if (receipt.subtotal.HasValue) Amount(receipt.subtotal.Value);
            if (receipt.shipping.HasValue) Amount(receipt.shipping.Value);
            if (copy == "cliente" && (!receipt.subtotal.HasValue || !receipt.shipping.HasValue))
                throw new ArgumentException("La copia del cliente requiere subtotal y envío.");
            if (receipt.items == null || receipt.items.Length == 0 || receipt.items.Length > 100) throw new ArgumentException("Cantidad de ítems inválida.");
            foreach (ReceiptItem item in receipt.items) {
                if (item == null) throw new ArgumentException("Ítem inválido.");
                Required(item.name, 240); Optional(item.detail, 1000);
                if (item.quantity <= 0 || item.quantity > 1000 || item.unitPrice < 0 || item.unitPrice > 100000000)
                    throw new ArgumentException("Cantidad o precio inválido.");
                if (item.lineTotal.HasValue) Amount(item.lineTotal.Value);
            }
        }
        static void Amount(decimal value) {
            if (value < 0 || value > 100000000) throw new ArgumentException("Importe inválido.");
        }
```

(`Required` y `Optional` quedan igual.) Clases de datos:

```csharp
    public sealed class Receipt {
        public string kind { get; set; }
        public string date { get; set; }
        public string number { get; set; }
        public string customer { get; set; }
        public string phone { get; set; }
        public string address { get; set; }
        public string notes { get; set; }
        public ReceiptItem[] items { get; set; }
        public decimal total { get; set; }
        public decimal? subtotal { get; set; }
        public decimal? shipping { get; set; }
        public string paymentMethod { get; set; }
        public string paymentStatus { get; set; }
    }
    public sealed class ReceiptItem {
        public string name { get; set; }
        public int quantity { get; set; }
        public string detail { get; set; }
        public decimal unitPrice { get; set; }
        /// <summary>Importe de la línea con extras; si falta, cantidad × precio unitario.</summary>
        public decimal? lineTotal { get; set; }
    }
```

- [ ] **Step 5: Implementar `ReceiptEncoder.cs`**

Reemplazar el archivo completo. El cuerpo de `EncodeCocina` es **exactamente** el `using (...)` actual de `Encode`; `Line` ahora delega en `Wrap` + `Write` y produce los mismos bytes:

```csharp
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace PrinterAgent {
    public static class ReceiptEncoder {
        static readonly Encoding Page = Encoding.GetEncoding(1252, new EncoderReplacementFallback("?"), new DecoderReplacementFallback("?"));
        static readonly CultureInfo Money = CultureInfo.GetCultureInfo("es-AR");
        const int Width = 42;
        // Datos públicos del negocio para la copia del cliente. Cambiarlos exige recompilar el agente.
        static readonly string[] Encabezado = { "Pizza a la piedra · técnica napoletana", "Puerto Iguazú, Misiones" };
        static readonly string[] Pie = { "¡Gracias por elegir Impasto!", "Pedí online: www.impastopizzas.com", "WhatsApp (03757) 65-2003 · @impasto.iguazu" };

        public static byte[] Encode(PrintRequest request, bool reprint, bool threeNStar = false) {
            if (request == null) throw new ArgumentException("Falta la comanda.");
            request.Validate();
            return request.copy == "cliente" ? EncodeCliente(request.receipt, threeNStar) : EncodeCocina(request, reprint, threeNStar);
        }

        static byte[] EncodeCocina(PrintRequest request, bool reprint, bool threeNStar) {
            Receipt r = request.receipt;
            using (var output = new MemoryStream()) {
                Command(output, 27,64); // ESC @: reset
                Command(output, 27,116,16); // ESC t 16: WPC1252
                Command(output, 27,97,1); // center
                Line(output, request.source == "impasto" ? "IMPASTO" : "CARRO FOGÓN", 42);
                Command(output, 29,33,17); // double width and height
                Line(output, "#" + r.number, 21);
                Line(output, r.kind.ToUpperInvariant(), 21);
                Command(output, 29,33,0);
                if (reprint) Line(output, "REIMPRESIÓN", 42);
                Line(output, r.date, 42);
                Command(output, 27,97,0);
                Line(output, new string('-', 42), 42);
                if (!string.IsNullOrWhiteSpace(r.customer)) Line(output, "Cliente: " + r.customer, 42);
                if (!string.IsNullOrWhiteSpace(r.phone)) Line(output, "Tel: " + r.phone, 42);
                if (r.kind == "delivery" && !string.IsNullOrWhiteSpace(r.address)) Line(output, "Dirección: " + r.address, 42);
                foreach (ReceiptItem item in r.items) {
                    Command(output, 27,69,1); // bold item
                    Line(output, item.quantity.ToString(CultureInfo.InvariantCulture) + " x " + item.name, 42);
                    Command(output, 27,69,0);
                    if (!string.IsNullOrWhiteSpace(item.detail)) Line(output, item.detail, 42);
                }
                if (!string.IsNullOrWhiteSpace(r.notes)) Line(output, "Notas: " + r.notes, 42);
                Line(output, new string('-', 42), 42);
                Line(output, "TOTAL $ " + r.total.ToString("N2", Money), 42);
                Line(output, "Pago: " + r.paymentMethod + " / " + r.paymentStatus, 42);
                Command(output, 10,10,10); // four line feeds including final payment line
                if (threeNStar) Command(output, 10,10,10); // observed cut through final payment line without this margin
                Command(output, 29,86,0); // final cut; no page/form feed
                return output.ToArray();
            }
        }

        // Copia para pegar en la caja: sin número de pedido, notas ni estado crudo de pago.
        static byte[] EncodeCliente(Receipt r, bool threeNStar) {
            using (var output = new MemoryStream()) {
                Command(output, 27,64); // ESC @: reset
                Command(output, 27,116,16); // ESC t 16: WPC1252
                Command(output, 27,97,1); // center
                Command(output, 29,33,17); // double width and height
                Line(output, "IMPASTO", 21);
                Command(output, 29,33,0);
                foreach (string linea in Encabezado) Line(output, linea, Width);
                Command(output, 27,97,0);
                Line(output, new string('-', Width), Width);
                Columns(output, r.date, r.kind == "delivery" ? "DELIVERY" : "RETIRO");
                Line(output, new string('-', Width), Width);
                bool destinatario = false;
                if (!string.IsNullOrWhiteSpace(r.customer)) { Line(output, r.customer, Width); destinatario = true; }
                if (r.kind == "delivery") {
                    if (!string.IsNullOrWhiteSpace(r.address)) { Line(output, r.address, Width); destinatario = true; }
                    if (!string.IsNullOrWhiteSpace(r.phone)) { Line(output, "Tel. " + r.phone, Width); destinatario = true; }
                }
                if (destinatario) Line(output, new string('-', Width), Width);
                foreach (ReceiptItem item in r.items) {
                    decimal importe = item.lineTotal ?? item.quantity * item.unitPrice;
                    Columns(output, item.quantity.ToString(CultureInfo.InvariantCulture) + " x " + item.name, Pesos(importe));
                    if (!string.IsNullOrWhiteSpace(item.detail)) Indented(output, item.detail, 4);
                }
                Line(output, new string('-', Width), Width);
                decimal subtotal = r.subtotal.Value, envio = r.shipping.Value;
                Columns(output, "Subtotal", Pesos(subtotal));
                if (r.kind == "delivery") Columns(output, "Envío", envio == 0 ? "Gratis" : Pesos(envio));
                decimal descuento = subtotal + envio - r.total;
                if (descuento > 0) Columns(output, "Descuento", "-" + Pesos(descuento));
                Command(output, 27,69,1); // bold total
                Columns(output, "TOTAL", Pesos(r.total));
                Command(output, 27,69,0);
                string pago = PagoCliente(r.paymentMethod, r.paymentStatus, r.total);
                if (pago != null) { Line(output, new string('-', Width), Width); Line(output, pago, Width); }
                Line(output, new string('-', Width), Width);
                Command(output, 27,97,1); // center
                foreach (string linea in Pie) Line(output, linea, Width);
                Command(output, 27,97,0);
                Command(output, 10,10,10);
                if (threeNStar) Command(output, 10,10,10);
                Command(output, 29,86,0); // final cut
                return output.ToArray();
            }
        }

        // Lo que el cliente necesita saber del pago; null si el medio no se reconoce.
        static string PagoCliente(string metodo, string estado, decimal total) {
            string medio;
            switch ((metodo ?? "").Trim().ToLowerInvariant()) {
                case "efectivo": medio = "efectivo"; break;
                case "transferencia": medio = "transferencia"; break;
                case "mercadopago": medio = "Mercado Pago"; break;
                default: return null;
            }
            string e = (estado ?? "").Trim().ToLowerInvariant();
            if (e == "aprobado") return "Pagado con " + medio;
            if (e == "pendiente" && medio == "efectivo") return "Pago en efectivo · a abonar " + Pesos(total);
            if (e == "pendiente" && medio == "transferencia") return "Pago por transferencia · a abonar " + Pesos(total);
            return "Forma de pago: " + medio;
        }

        static string Pesos(decimal value) {
            return "$" + value.ToString(decimal.Truncate(value) == value ? "N0" : "N2", Money);
        }

        static void Command(Stream output, params byte[] bytes) { output.Write(bytes, 0, bytes.Length); }
        static void Line(Stream output, string value, int width) {
            foreach (string piece in Wrap(value, width)) Write(output, piece);
        }
        static void Indented(Stream output, string value, int indent) {
            string margin = new string(' ', indent);
            foreach (string piece in Wrap(value, Width - indent)) Write(output, margin + piece);
        }
        // Texto a la izquierda e importe a la derecha, en la última línea del texto.
        static void Columns(Stream output, string left, string right) {
            List<string> pieces = Wrap(left, Width);
            List<string> rightPieces = Wrap(right, Width);
            string amount = rightPieces.Count == 0 ? "" : rightPieces[0];
            string last = pieces.Count == 0 ? "" : pieces[pieces.Count - 1];
            for (int i = 0; i < pieces.Count - 1; i++) Write(output, pieces[i]);
            if (last.Length + 1 + amount.Length <= Width) Write(output, last + new string(' ', Width - last.Length - amount.Length) + amount);
            else { Write(output, last); Write(output, new string(' ', Width - amount.Length) + amount); }
        }
        static void Write(Stream output, string text) {
            byte[] bytes = Page.GetBytes(text);
            output.Write(bytes, 0, bytes.Length); output.WriteByte(10);
        }
        static List<string> Wrap(string value, int width) {
            var pieces = new List<string>();
            // Normalize before byte encoding: never allow untrusted C0/C1, ESC, GS, DEL.
            var clean = new StringBuilder();
            foreach (char c in (value ?? "").Normalize(NormalizationForm.FormC)) {
                if (c == '\r' || c == '\n') clean.Append('\n');
                else if (char.IsControl(c) || char.GetUnicodeCategory(c) == UnicodeCategory.Format) clean.Append(' ');
                else clean.Append(c);
            }
            foreach (string rawLine in clean.ToString().Split('\n')) {
                string line = Regex.Replace(rawLine, @"\s+", " ").Trim();
                // Round-trip unsupported characters before wrapping, so columns match encoded bytes.
                line = Page.GetString(Page.GetBytes(line));
                while (line.Length > 0) {
                    int take = Math.Min(width, line.Length);
                    if (take < line.Length) {
                        int space = line.LastIndexOf(' ', take - 1, take);
                        if (space > 0) take = space;
                    }
                    pieces.Add(line.Substring(0, take));
                    line = line.Substring(take).TrimStart();
                }
            }
            return pieces;
        }
    }
}
```

- [ ] **Step 6: Verificar que pasan**

Run: `powershell -NoProfile -File build.ps1 -Test`
Esperado: `Tests: N passed, 0 failed`, con `PASS kitchen ticket is byte-identical to version 2` y todos los `PASS customer ...`.

- [ ] **Step 7: Commit**

```bash
cd Impasto
git add printer-agent/PrintRequest.cs printer-agent/ReceiptEncoder.cs printer-agent/Tests.cs
git commit -m "feat(impresora): formato de copia del cliente en el agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Agente — versión 3 por HTTP y ticket de prueba

**Files:**
- Modify: `Impasto/printer-agent/LocalServer.cs:90`
- Modify: `Impasto/printer-agent/Program.cs`
- Test: `Impasto/printer-agent/ServerTests.cs`

**Interfaces:**
- Consumes: `Tests.ClienteFixture(...)` y `copy` de la Task 1.
- Produces: `GET /health` → `"version":"3"` (lo leen las webs en la Task 3); `PrinterAgent.exe --test-cliente "<cola>"` (Task 7).

- [ ] **Step 1: Escribir las pruebas (fallan)**

En `ServerTests.cs`, dentro del primer bloque `using (...)` (después del test `"attempt cannot be reused with different receipt"`):

```csharp
                    test("health reports version 3 for the customer copy", delegate {
                        Check(Send(port, "/health", "GET", Origin, Token, null).body.Contains("\"version\":\"3\""), "version 3");
                    });
```

Y después del test `"failed ledger persistence prevents spool"` (fuera del primer `using`), un servidor propio para no alterar el contador `calls`:

```csharp
                test("HTTP customer copy is queued with its own key", delegate {
                    byte[] ticket = null; int prints = 0;
                    using (var ledger = new AttemptLedger(Path.Combine(directory, "cliente.json")))
                    using (var server = new LocalServer(config, delegate(string queue, byte[] bytes) { prints++; ticket = bytes; }, ledger, Port())) {
                        server.Start();
                        Check(Send(server.Port, "/print", "POST", Origin, Token, Tests.Fixture()).status == 200, "kitchen queued");
                        Check(Send(server.Port, "/print", "POST", Origin, Token, Tests.ClienteFixture()).body.Contains("\"duplicate\":false"), "customer queued separately");
                        Check(prints == 2 && Encoding.GetEncoding(1252).GetString(ticket).Contains("¡Gracias por elegir Impasto!"), "customer layout spooled");
                        Check(Send(server.Port, "/print", "POST", Origin, Token, Tests.ClienteFixture().Replace("\"copy\":\"cliente\"", "\"copy\":\"otra\"")).status == 400, "invalid copy rejected");
                        Check(prints == 2, "invalid copy not spooled");
                    }
                });
```

- [ ] **Step 2: Verificar que falla**

Run: `powershell -NoProfile -File build.ps1 -Test`
Esperado: `FAIL health reports version 3 for the customer copy: version 3`.

- [ ] **Step 3: Implementar**

`LocalServer.cs:90`, cambiar `version = "2"` por `version = "3"`:

```csharp
                Reply(response, 200, new { status = "available", version = "3", queueName = selection.Queue(source), paired = token != null }); return;
```

`Program.cs`: reemplazar desde `if (args.Length != 2 || ...` hasta el final de `Main` por:

```csharp
            if (args.Length != 2 || (args[0] != "--test-raw" && args[0] != "--test-raw-long" && args[0] != "--test-cliente")) {
                Console.WriteLine("Uso: PrinterAgent.exe --serve <config.local.json>");
                Console.WriteLine("     PrinterAgent.exe --test-raw <nombre exacto de cola>");
                Console.WriteLine("     PrinterAgent.exe --test-raw-long <nombre exacto de cola>");
                Console.WriteLine("     PrinterAgent.exe --test-cliente <nombre exacto de cola>");
                return 2;
            }
            try {
                PrintRequest request = args[0] == "--test-cliente" ? PruebaCliente() : PruebaRaw(args[0] == "--test-raw-long");
                request = PrintRequest.Parse(new JavaScriptSerializer().Serialize(request));
                RawSpooler.Send(args[1], ReceiptEncoder.Encode(request, false));
                Console.WriteLine("Enviado a la cola. Verificar papel, corte, tildes y largo físicamente.");
                return 0;
            } catch (Exception error) {
                // Deliberately avoid exception messages, request fields and customer data in logs.
                Console.Error.WriteLine("No se pudo enviar la prueba RAW (" + error.GetType().Name + "). Revisar la cola.");
                return 1;
            }
        }
        static PrintRequest PruebaRaw(bool longTicket) {
            var item = new ReceiptItem { name = "Pizza á/ñ: jamón y morrón", quantity = 1, detail = "Mitad muzza / mitad jamón", unitPrice = 1000 };
            var items = new ReceiptItem[longTicket ? 8 : 1];
            for (int i = 0; i < items.Length; i++) items[i] = item;
            return new PrintRequest {
                attemptId = Guid.NewGuid().ToString(), source = "impasto", orderId = "prueba-raw", reprint = false,
                receipt = new Receipt { kind = "retiro", date = DateTime.Now.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                    number = longTicket ? "PRUEBA LARGA" : "PRUEBA RAW", customer = "", phone = "", address = "",
                    notes = longTicket ? "FICTICIO - NO PREPARAR. " + new string('X', 120) : "FICTICIO - NO PREPARAR", items = items,
                    total = 1000 * items.Length, paymentMethod = "PRUEBA", paymentStatus = "SIN COBRO" }
            };
        }
        // Copia del cliente ficticia: el nombre avisa que no se prepara, porque esta copia no imprime notas.
        static PrintRequest PruebaCliente() {
            return new PrintRequest {
                attemptId = Guid.NewGuid().ToString(), source = "impasto", orderId = "prueba-cliente", reprint = false, copy = "cliente",
                receipt = new Receipt { kind = "delivery", date = DateTime.Now.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                    number = "PRUEBA", customer = "PRUEBA - NO PREPARAR", phone = "3757 000000", address = "Dirección de prueba 123", notes = "",
                    items = new[] {
                        new ReceiptItem { name = "Muzzarella", quantity = 2, detail = "", unitPrice = 16000, lineTotal = 32000 },
                        new ReceiptItem { name = "Caja x12 empanadas", quantity = 1, detail = "4 Carne, 4 Pollo, 4 Árabe", unitPrice = 27000, lineTotal = 27000 },
                        new ReceiptItem { name = "Coca-Cola 1.5 L", quantity = 1, detail = "", unitPrice = 4500, lineTotal = 4500 } },
                    subtotal = 63500, shipping = 0, total = 63500, paymentMethod = "efectivo", paymentStatus = "pendiente" }
            };
        }
    }
}
```

- [ ] **Step 4: Verificar que pasan y que compila el ejecutable**

Run: `powershell -NoProfile -File build.ps1 -Test`
Esperado: `Tests: N passed, 0 failed`.

Run: `powershell -NoProfile -File build.ps1` y luego `.\bin\PrinterAgent.exe`
Esperado: compila sin advertencias; sin argumentos imprime las cuatro líneas de `Uso:` (incluida `--test-cliente`) y sale con código 2.

- [ ] **Step 5: Commit**

```bash
cd Impasto
git add printer-agent/LocalServer.cs printer-agent/Program.cs printer-agent/ServerTests.cs
git commit -m "feat(impresora): agente versión 3 y ticket de prueba de la copia del cliente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cliente compartido `local-printer.ts` (las dos webs)

**Files:**
- Modify: `carroFogon/next-app/src/lib/local-printer.ts`
- Copy to: `Impasto/lib/local-printer.ts` (idéntico)
- Test: `carroFogon/next-app/tests/local-printer.test.mjs`, `Impasto/tests/local-printer.test.ts`

**Interfaces:**
- Consumes: `/health` con `version` (Task 2).
- Produces (los usan las Tasks 4 a 6):
  - `type PrintCopy = "cocina" | "cliente"`
  - `PrintJob.copy?: PrintCopy`, `PrintJob.receipt.subtotal?: number`, `PrintJob.receipt.shipping?: number`, `PrintJob.receipt.items[].lineTotal?: number`
  - `printerVersion(fetcher?): Promise<number | null>`
  - `class AgenteSinCopiaCliente extends Error`
  - `printCopy(job, fetcher?): Promise<"queued" | "duplicate">`
  - `interface ResultadoCopias { pendientes: PrintJob[]; agenteViejo: boolean; error?: unknown }`
  - `imprimirCopias(jobs, print?): Promise<ResultadoCopias>`
  - `mensajeCopias(jobs, resultado): { ok: boolean; texto: string }`

- [ ] **Step 1: Escribir las pruebas (fallan) en Carro Fogón**

En `carroFogon/next-app/tests/local-printer.test.mjs`, cambiar el import de la línea 2 por:

```js
import { AgenteSinCopiaCliente, configurePrinter, getPrinterSelection, imprimirCopias, mensajeCopias, newAttemptId, printCopy, printLocal, printerHealth, printerVersion, selectPrinter } from '../src/lib/local-printer.ts';
```

Y antes de la última línea (`process.stdout.write('PASA cliente local: ...`), agregar:

```js
assert.equal(await printerVersion(async () => reply(200, { status: 'available', version: '3', paired: true })), 3);
assert.equal(await printerVersion(async () => reply(200, { status: 'available', version: '2', paired: true })), 2);
assert.equal(await printerVersion(async () => { throw new TypeError('offline'); }), null);
const clienteJob = { ...job, attemptId: 'stable-1:cliente', copy: 'cliente', receipt: { ...job.receipt, subtotal: 1000, shipping: 0 } };
const viejoCalls = [];
await assert.rejects(printCopy(clienteJob, async url => { viejoCalls.push(String(url)); return reply(200, { status: 'available', version: '2', paired: true }); }), AgenteSinCopiaCliente);
assert.deepEqual(viejoCalls, ['http://127.0.0.1:8765/health'], 'un agente viejo nunca recibe la copia del cliente');
await assert.rejects(printCopy(clienteJob, async () => { throw new TypeError('offline'); }), /agente no disponible/i);
const nuevoCalls = [];
assert.equal(await printCopy(clienteJob, async url => { nuevoCalls.push(String(url)); return String(url).endsWith('/health') ? reply(200, { version: '3', paired: true }) : reply(200, { status: 'queued', duplicate: false }); }), 'queued');
assert.deepEqual(nuevoCalls, ['http://127.0.0.1:8765/health', 'http://127.0.0.1:8765/print']);
const cocinaCalls = [];
assert.equal(await printCopy(job, async url => { cocinaCalls.push(String(url)); return reply(200, { status: 'queued' }); }), 'queued');
assert.deepEqual(cocinaCalls, ['http://127.0.0.1:8765/print'], 'la cocina no consulta la versión');
const orden = [];
const todo = await imprimirCopias([job, clienteJob], async j => { orden.push(j.copy ?? 'cocina'); return 'queued'; });
assert.deepEqual(orden, ['cocina', 'cliente'], 'cocina primero');
assert.deepEqual(todo.pendientes, []);
assert.deepEqual(mensajeCopias([job, clienteJob], todo), { ok: true, texto: 'Comanda de cocina y copia del cliente enviadas a la cola.' });
const sinCocina = await imprimirCopias([job, clienteJob], async () => { throw new Error('Agente no disponible; el pedido sigue guardado.'); });
assert.deepEqual(sinCocina.pendientes.map(j => j.attemptId), ['stable-1', 'stable-1:cliente'], 'si falla la cocina no se intenta la del cliente');
assert.deepEqual(mensajeCopias([job, clienteJob], sinCocina), { ok: false, texto: 'Agente no disponible; el pedido sigue guardado.' });
const sinCliente = await imprimirCopias([job, clienteJob], async j => { if (j.copy === 'cliente') throw new Error('Sin papel.'); return 'queued'; });
assert.deepEqual(sinCliente.pendientes.map(j => j.attemptId), ['stable-1:cliente'], 'el reintento manda solo la que faltó');
assert.deepEqual(mensajeCopias([job, clienteJob], sinCliente), { ok: false, texto: 'Comanda de cocina enviada; copia del cliente no enviada. Sin papel.' });
const viejo = await imprimirCopias([job, clienteJob], async j => { if (j.copy === 'cliente') throw new AgenteSinCopiaCliente(); return 'queued'; });
assert.deepEqual(viejo.pendientes, [], 'con agente viejo no queda nada para reintentar');
assert.equal(viejo.agenteViejo, true);
assert.deepEqual(mensajeCopias([job, clienteJob], viejo), { ok: false, texto: 'Comanda de cocina enviada a la cola. Actualizá el agente de impresión para imprimir la copia del cliente.' });
assert.deepEqual(mensajeCopias([clienteJob], await imprimirCopias([clienteJob], async () => 'queued')), { ok: true, texto: 'Copia del cliente enviada a la cola.' });
assert.deepEqual(mensajeCopias([job], await imprimirCopias([job], async () => 'queued')), { ok: true, texto: 'Comanda de cocina enviada a la cola.' });
```

- [ ] **Step 2: Verificar que falla**

Run (en `carroFogon/next-app`): `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/local-printer.test.mjs`
Esperado: `SyntaxError` / exportación `AgenteSinCopiaCliente` inexistente.

- [ ] **Step 3: Implementar en `carroFogon/next-app/src/lib/local-printer.ts`**

Reemplazar la interfaz `PrintJob` por:

```ts
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
```

Y al final del archivo (después de `newAttemptId`):

```ts
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
```

- [ ] **Step 4: Verificar que pasa en Carro Fogón**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/local-printer.test.mjs`
Esperado: `PASA cliente local: ...`.

- [ ] **Step 5: Copiar a Impasto y portar el test**

```bash
cp carroFogon/next-app/src/lib/local-printer.ts Impasto/lib/local-printer.ts
cmp carroFogon/next-app/src/lib/local-printer.ts Impasto/lib/local-printer.ts && echo IDENTICOS
```

En `Impasto/tests/local-printer.test.ts`, cambiar el import de la línea 2 por:

```ts
import { AgenteSinCopiaCliente, configurePrinter, getPrinterSelection, imprimirCopias, mensajeCopias, newAttemptId, printCopy, printLocal, printerHealth, printerVersion, selectPrinter, type PrintJob } from '../lib/local-printer';
```

Y antes de la línea `process.stdout.write('PASA cliente local: ...`, el mismo bloque del Step 1 con tipos (los fetchers son `typeof fetch`):

```ts
const fake = (handler: (url: string) => Response | Promise<Response>) => (async (url: RequestInfo | URL) => handler(String(url))) as typeof fetch;
assert.equal(await printerVersion(fake(() => reply(200, { status: 'available', version: '3', paired: true }))), 3);
assert.equal(await printerVersion(fake(() => reply(200, { status: 'available', version: '2', paired: true }))), 2);
assert.equal(await printerVersion(fake(() => { throw new TypeError('offline'); })), null);
const cocinaJob: PrintJob = job;
const clienteJob: PrintJob = { ...job, attemptId: 'stable-1:cliente', copy: 'cliente', receipt: { ...job.receipt, subtotal: 1000, shipping: 0 } };
const viejoCalls: string[] = [];
await assert.rejects(printCopy(clienteJob, fake(url => { viejoCalls.push(url); return reply(200, { status: 'available', version: '2', paired: true }); })), AgenteSinCopiaCliente);
assert.deepEqual(viejoCalls, ['http://127.0.0.1:8765/health'], 'un agente viejo nunca recibe la copia del cliente');
await assert.rejects(printCopy(clienteJob, fake(() => { throw new TypeError('offline'); })), /agente no disponible/i);
const nuevoCalls: string[] = [];
assert.equal(await printCopy(clienteJob, fake(url => { nuevoCalls.push(url); return url.endsWith('/health') ? reply(200, { version: '3', paired: true }) : reply(200, { status: 'queued', duplicate: false }); })), 'queued');
assert.deepEqual(nuevoCalls, ['http://127.0.0.1:8765/health', 'http://127.0.0.1:8765/print']);
const cocinaCalls: string[] = [];
assert.equal(await printCopy(cocinaJob, fake(url => { cocinaCalls.push(url); return reply(200, { status: 'queued' }); })), 'queued');
assert.deepEqual(cocinaCalls, ['http://127.0.0.1:8765/print'], 'la cocina no consulta la versión');
const orden: string[] = [];
const todo = await imprimirCopias([cocinaJob, clienteJob], async j => { orden.push(j.copy ?? 'cocina'); return 'queued'; });
assert.deepEqual(orden, ['cocina', 'cliente'], 'cocina primero');
assert.deepEqual(todo.pendientes, []);
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], todo), { ok: true, texto: 'Comanda de cocina y copia del cliente enviadas a la cola.' });
const sinCocina = await imprimirCopias([cocinaJob, clienteJob], async () => { throw new Error('Agente no disponible; el pedido sigue guardado.'); });
assert.deepEqual(sinCocina.pendientes.map(j => j.attemptId), ['stable-1', 'stable-1:cliente'], 'si falla la cocina no se intenta la del cliente');
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], sinCocina), { ok: false, texto: 'Agente no disponible; el pedido sigue guardado.' });
const sinCliente = await imprimirCopias([cocinaJob, clienteJob], async j => { if (j.copy === 'cliente') throw new Error('Sin papel.'); return 'queued'; });
assert.deepEqual(sinCliente.pendientes.map(j => j.attemptId), ['stable-1:cliente'], 'el reintento manda solo la que faltó');
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], sinCliente), { ok: false, texto: 'Comanda de cocina enviada; copia del cliente no enviada. Sin papel.' });
const viejo = await imprimirCopias([cocinaJob, clienteJob], async j => { if (j.copy === 'cliente') throw new AgenteSinCopiaCliente(); return 'queued'; });
assert.deepEqual(viejo.pendientes, [], 'con agente viejo no queda nada para reintentar');
assert.equal(viejo.agenteViejo, true);
assert.deepEqual(mensajeCopias([cocinaJob, clienteJob], viejo), { ok: false, texto: 'Comanda de cocina enviada a la cola. Actualizá el agente de impresión para imprimir la copia del cliente.' });
assert.deepEqual(mensajeCopias([clienteJob], await imprimirCopias([clienteJob], async () => 'queued')), { ok: true, texto: 'Copia del cliente enviada a la cola.' });
assert.deepEqual(mensajeCopias([cocinaJob], await imprimirCopias([cocinaJob], async () => 'queued')), { ok: true, texto: 'Comanda de cocina enviada a la cola.' });
```

Run (en `Impasto`): `pnpm exec tsx tests/local-printer.test.ts`
Esperado: `PASA cliente local: ...`.

- [ ] **Step 6: Commits (uno por repo)**

```bash
cd carroFogon
git add next-app/src/lib/local-printer.ts next-app/tests/local-printer.test.mjs
git commit -m "feat(impresion): copias de cocina y cliente en el cliente del agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
cd ../Impasto
git add lib/local-printer.ts tests/local-printer.test.ts
git commit -m "feat(impresion): copias de cocina y cliente en el cliente del agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Carro Fogón — armar e imprimir las dos copias (lógica)

**Files:**
- Modify: `carroFogon/next-app/src/lib/pos-print-flow.ts`
- Test: `carroFogon/next-app/tests/pos-save-print.test.mjs`, `carroFogon/next-app/tests/pos-reprint.test.mjs`

**Interfaces:**
- Consumes: `PrintJob`, `PrintCopy`, `ResultadoCopias` (Task 3).
- Produces (Task 5):
  - `posPrintJob(order, attemptId, reprint, copy: PrintCopy = 'cocina'): PrintJob | null`
  - `posPrintJobs(order, attemptId, reprint): PrintJob[]` → `[cocina, cliente]` o `[]`
  - `guardarYEnviarComanda<T>(save, onSaved, makeJobs: (order: T) => readonly PrintJob[], imprimir: (jobs: readonly PrintJob[]) => Promise<ResultadoCopias>): Promise<SavePrintResult<T>>`
  - `type SavePrintResult<T> = { saved: false; error: unknown } | { saved: true; order: T; jobs: readonly PrintJob[]; resultado: ResultadoCopias | null; error?: unknown }`
  - `reimprimirPedido(order, print, makeId, confirm?, copy: PrintCopy = 'cocina')`

- [ ] **Step 1: Reescribir `tests/pos-save-print.test.mjs` (falla)**

```js
import assert from 'node:assert/strict';
import { guardarYEnviarComanda, posPrintJob, posPrintJobs } from '../src/lib/pos-print-flow.ts';
import { imprimirCopias } from '../src/lib/local-printer.ts';

const order = { id: 'saved-42', numero_pedido: 42, created_at: '2026-09-23T23:20:00Z',
  modalidad: 'takeaway', direccion: 'Retiro en local', nombre_cliente: 'Ana', telefono_cliente: '', notas: '',
  productos: [{ nombre: 'Caja x12', cantidad: 1, precio: 12000, detalle: '4 Carne, 8 Jamón y muzza' }],
  total: 12000, metodo_pago: 'efectivo', estado_pago: 'pendiente', status: 'normal' };
let saves = 0, consumed = 0;
const save = async () => { saves++; return order; };
const afterSave = () => { consumed++; };

const job = posPrintJob(order, 'attempt-1', false);
assert.ok(job);
assert.equal(job.orderId, 'saved-42');
assert.equal(job.receipt.number, '42');
assert.equal(job.receipt.items[0].detail, '4 Carne, 8 Jamón y muzza');
assert.equal(job.receipt.kind, 'retiro');
assert.equal(job.receipt.address, '');
assert.equal(job.receipt.paymentStatus, 'pendiente');
assert.equal(job.copy, undefined, 'la comanda de cocina no cambia');
assert.equal('subtotal' in job.receipt, false);
assert.equal('lineTotal' in job.receipt.items[0], false);

const conExtra = { ...order, modalidad: 'delivery', direccion: 'Calle Falsa 123', telefono_cliente: '3757 1',
  productos: [{ nombre: 'Muzzarella', cantidad: 2, precio: 15000, extra: 1000 }], subtotal: 31000, envio: 3000, total: 34000 };
const cliente = posPrintJob(conExtra, 'k-1', false, 'cliente');
assert.equal(cliente.copy, 'cliente');
assert.equal(cliente.attemptId, 'k-1:cliente');
assert.equal(cliente.receipt.items[0].lineTotal, 31000, 'el importe de la línea incluye el extra');
assert.equal(cliente.receipt.subtotal, 31000);
assert.equal(cliente.receipt.shipping, 3000);
assert.deepEqual(posPrintJobs(conExtra, 'k-1', false).map(j => j.attemptId), ['k-1', 'k-1:cliente']);

const printed = [];
const ok = await guardarYEnviarComanda(save, afterSave, p => posPrintJobs(p, 'attempt-1', false),
  jobs => imprimirCopias(jobs, async j => { printed.push(j.attemptId); return 'queued'; }));
assert.equal(ok.saved, true);
assert.deepEqual(printed, ['attempt-1', 'attempt-1:cliente'], 'cocina primero, cliente después');
assert.deepEqual(ok.resultado?.pendientes, []);

const offline = await guardarYEnviarComanda(save, afterSave, p => posPrintJobs(p, 'attempt-2', false),
  jobs => imprimirCopias(jobs, async () => { throw new TypeError('printer offline'); }));
assert.equal(offline.saved, true);
assert.deepEqual(offline.resultado?.pendientes.map(j => j.attemptId), ['attempt-2', 'attempt-2:cliente'], 'reintento con las mismas claves');

const parcial = await guardarYEnviarComanda(save, afterSave, p => posPrintJobs(p, 'attempt-3', false),
  jobs => imprimirCopias(jobs, async j => { if (j.copy === 'cliente') throw new Error('sin papel'); return 'queued'; }));
assert.deepEqual(parcial.resultado?.pendientes.map(j => j.attemptId), ['attempt-3:cliente'], 'solo queda pendiente la del cliente');

let builds = 0;
const once = await guardarYEnviarComanda(save, () => {}, p => { builds++; return posPrintJobs(p, 'attempt-4', false); },
  jobs => imprimirCopias(jobs, async () => { throw new TypeError('response lost'); }));
assert.equal(builds, 1, 'las copias se arman una vez, después de guardar');
assert.equal(once.resultado?.pendientes[0].attemptId, 'attempt-4');

const failedSave = await guardarYEnviarComanda(async () => { saves++; throw new Error('database offline'); }, afterSave,
  p => posPrintJobs(p, 'x', false), async () => { throw new Error('must not print'); });
assert.equal(failedSave.saved, false);
assert.equal(consumed, 3, 'el carrito se consume solo con el pedido guardado');

const delivered = posPrintJob({ ...order, modalidad: 'delivery', direccion: 'Calle Falsa 123' }, 'attempt-5', false);
assert.equal(delivered?.receipt.kind, 'delivery');
assert.equal(delivered?.receipt.address, 'Calle Falsa 123');
let blockedPrints = 0;
for (const blocked of [{ ...order, status: 'cancelado' }, { ...order, metodo_pago: 'mercadopago' }, { ...order, productos: [] }]) {
  assert.equal(posPrintJob(blocked, 'blocked', false), null);
  assert.deepEqual(posPrintJobs(blocked, 'blocked', false), []);
  const outcome = await guardarYEnviarComanda(async () => blocked, () => {}, p => posPrintJobs(p, 'blocked', false),
    async jobs => { blockedPrints++; return imprimirCopias(jobs, async () => 'queued'); });
  assert.equal(outcome.saved, true);
  assert.equal(outcome.resultado, null);
}
assert.equal(blockedPrints, 0, 'MP pendiente, cancelado y productos inválidos nunca imprimen');
assert.equal(posPrintJob({ ...order, id: '' }, 'invalid', false), null, 'must have persisted id');
process.stdout.write('PASA POS: pedido guardado separado de impresión, dos copias y pagos bloqueados\n');
```

En `tests/pos-reprint.test.mjs`, antes de la última línea:

```js
const clienteSent = [];
const outcomeCliente = await reimprimirPedido(order, async job => { clienteSent.push(job); return 'queued'; }, () => 'fresh-c', () => true, 'cliente');
assert.equal(outcomeCliente.status, 'queued');
assert.equal(clienteSent[0].copy, 'cliente');
assert.equal(clienteSent[0].attemptId, 'fresh-c:cliente');
assert.equal(clienteSent[0].reprint, true);
assert.equal(clienteSent[0].receipt.shipping, 0);
```

- [ ] **Step 2: Verificar que fallan**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/pos-save-print.test.mjs`
Esperado: falla la importación de `posPrintJobs`.

- [ ] **Step 3: Implementar `pos-print-flow.ts`**

Cambiar el import de tipos por:

```ts
import type { PrintCopy, PrintJob, ResultadoCopias } from './local-printer.ts';
```

Reemplazar `posPrintJob` y agregar `posPrintJobs`:

```ts
/** Build only from the row returned by the POST/GET, never the POS counter. */
export function posPrintJob(order: StoredOrder, attemptId: string, reprint: boolean, copy: PrintCopy = 'cocina'): PrintJob | null {
  if (!order || typeof order.id !== 'string' || !order.id || !puedeImprimirComanda(order)) return null;
  const comanda = toComanda(order);
  if (!comanda) return null;
  const cliente = copy === 'cliente';
  return {
    attemptId: cliente ? `${attemptId}:cliente` : attemptId,
    source: 'carro-fogon',
    orderId: order.id,
    reprint,
    ...(cliente ? { copy } : {}),
    receipt: {
      kind: comanda.modalidad === 'takeaway' ? 'retiro' : 'delivery',
      date: (comanda.fecha ?? new Date()).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
      number: String(comanda.numero ?? order.id),
      customer: comanda.nombre ?? '',
      phone: comanda.telefono ?? '',
      address: comanda.modalidad === 'takeaway' ? '' : comanda.direccion ?? '',
      notes: comanda.detalles ?? '',
      items: comanda.items.map(item => ({
        name: item.nombre,
        quantity: item.cantidad,
        detail: item.detalle ?? '',
        unitPrice: item.precio,
        ...(cliente ? { lineTotal: item.precio * item.cantidad + (item.extra ?? 0) } : {}),
      })),
      total: comanda.total,
      ...(cliente ? { subtotal: comanda.subtotal, shipping: comanda.envio } : {}),
      paymentMethod: comanda.metodoPago ?? 'efectivo',
      paymentStatus: comanda.estadoPago ?? 'pendiente',
    },
  };
}

/** Comanda de cocina y copia del cliente, en ese orden; vacío si el pedido no se puede imprimir. */
export function posPrintJobs(order: StoredOrder, attemptId: string, reprint: boolean): PrintJob[] {
  const cocina = posPrintJob(order, attemptId, reprint, 'cocina');
  const cliente = posPrintJob(order, attemptId, reprint, 'cliente');
  return cocina && cliente ? [cocina, cliente] : [];
}
```

Reemplazar `SavePrintResult` y `guardarYEnviarComanda`:

```ts
export type SavePrintResult<T> =
  | { saved: false; error: unknown }
  | { saved: true; order: T; jobs: readonly PrintJob[]; resultado: ResultadoCopias | null; error?: unknown };

/** Printing happens after persistence and after UI cleanup; it cannot undo the saved order. */
export async function guardarYEnviarComanda<T>(
  save: () => Promise<T>,
  onSaved: (order: T) => void | Promise<void>,
  makeJobs: (order: T) => readonly PrintJob[],
  imprimir: (jobs: readonly PrintJob[]) => Promise<ResultadoCopias>,
): Promise<SavePrintResult<T>> {
  let order: T;
  try { order = await save(); }
  catch (error) { return { saved: false, error }; }
  let jobs: readonly PrintJob[] = [];
  try {
    await onSaved(order);
    jobs = makeJobs(order);
    if (!jobs.length) return { saved: true, order, jobs, resultado: null };
    return { saved: true, order, jobs, resultado: await imprimir(jobs) };
  } catch (error) {
    // The order already exists. Keep the keys for an explicit retry.
    return { saved: true, order, jobs, resultado: jobs.length ? { pendientes: [...jobs], agenteViejo: false, error } : null, error };
  }
}
```

Reemplazar la firma y la construcción del job en `reimprimirPedido`:

```ts
export async function reimprimirPedido(
  order: StoredOrder,
  print: (job: PrintJob) => Promise<'queued' | 'duplicate'>,
  makeId: () => string,
  confirm?: () => boolean,
  copy: PrintCopy = 'cocina',
): Promise<{ status: 'blocked' | 'cancelled' | 'queued' | 'failed'; job?: PrintJob; error?: unknown }> {
  if (!puedeImprimirComanda(order)) return { status: 'blocked' };
  if (confirm && !confirm()) return { status: 'cancelled' };
  const job = posPrintJob(order, makeId(), true, copy);
```

(El resto de `reimprimirPedido` queda igual.)

- [ ] **Step 4: Verificar que pasan**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/pos-save-print.test.mjs && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/pos-reprint.test.mjs`
Esperado: `PASA POS: ...` y `PASA Comandas: ...`.

- [ ] **Step 5: Commit**

```bash
cd carroFogon
git add next-app/src/lib/pos-print-flow.ts next-app/tests/pos-save-print.test.mjs next-app/tests/pos-reprint.test.mjs
git commit -m "feat(impresion): el POS arma la comanda de cocina y la copia del cliente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Carro Fogón — pantallas (guardar y Comandas)

**Files:**
- Modify: `carroFogon/next-app/src/components/FormCliente.tsx`
- Modify: `carroFogon/next-app/app/pedidos/page.tsx`
- Modify: `carroFogon/CLAUDE.md`

**Interfaces:**
- Consumes: `posPrintJobs`, `guardarYEnviarComanda`, `reimprimirPedido(..., copy)` (Task 4); `imprimirCopias`, `mensajeCopias`, `printCopy`, `PrintCopy`, `PrintJob` (Task 3).

- [ ] **Step 1: `FormCliente.tsx` — imports y estado**

Cambiar los imports de las líneas 5-6 por:

```tsx
import { configurePrinter, imprimirCopias, mensajeCopias, type PrintJob } from "@/src/lib/local-printer";
import { guardarYEnviarComanda, posPrintJobs } from "@/src/lib/pos-print-flow";
```

Cambiar `const [pendingJob, setPendingJob] = useState<PrintJob | null>(null);` por:

```tsx
  const [pendingJobs, setPendingJobs] = useState<PrintJob[]>([]);
```

- [ ] **Step 2: `FormCliente.tsx` — reintento**

Reemplazar la función `reintentarComanda` completa por:

```tsx
  const reintentarComanda = async () => {
    if (!pendingJobs.length || retrying) return;
    setRetrying(true);
    try {
      // Mismas claves: lo que ya salió no se repite.
      const resultado = await imprimirCopias(pendingJobs);
      const mensaje = mensajeCopias(pendingJobs, resultado);
      setPendingJobs(resultado.pendientes);
      setPrintMessage(mensaje.ok ? '' : mensaje.texto);
      if (!resultado.pendientes.length) showToast(`Pedido guardado. ${mensaje.texto}`, mensaje.ok, 6000);
    } finally { setRetrying(false); }
  };
```

- [ ] **Step 3: `FormCliente.tsx` — guardar e imprimir**

En `handleImprimir`, en la llamada a `guardarYEnviarComanda`, reemplazar los dos últimos argumentos:

```tsx
        (creado) => posPrintJobs(creado, attempt.key, false),
        (jobs) => imprimirCopias(jobs),
      );
```

Y reemplazar desde `const number = Number(result.order?.numero_pedido);` hasta el cierre del `else` final (antes de `} catch (error) {`) por:

```tsx
      const number = Number(result.order?.numero_pedido);
      const label = Number.isFinite(number) && number > 0 ? `#${number}` : 'sin número';
      if (!result.resultado) {
        setPendingJobs([]);
        setPrintMessage('');
        showToast(`Pedido ${label} guardado; cocina bloqueada o faltan datos. Revisalo en Comandas.`, true, 7000);
      } else {
        const mensaje = mensajeCopias(result.jobs, result.resultado);
        setPendingJobs(result.resultado.pendientes);
        setPrintMessage(mensaje.ok ? '' : `Pedido guardado. ${mensaje.texto}`);
        showToast(`Pedido ${label} guardado. ${mensaje.texto}`, mensaje.ok, mensaje.ok ? 6000 : 7000);
      }
```

- [ ] **Step 4: `FormCliente.tsx` — botón de reintento**

Reemplazar `{pendingJob && <button` por `{pendingJobs.length > 0 && <button` (mismo resto de la línea).

- [ ] **Step 5: `app/pedidos/page.tsx` — reimprimir cada copia**

Import de la línea 5: reemplazar `printLocal` por `printCopy` y agregar `type PrintCopy`:

```tsx
import { configurePrinter, getPrinterSelection, newAttemptId, printCopy, selectPrinter, type PrintCopy, type PrinterId, type PrinterSelection } from "@/src/lib/local-printer";
```

Reemplazar `imprimirPedido` por:

```tsx
  const imprimirPedido = async (p: Pedido, copy: PrintCopy = 'cocina') => {
    if (printingRef.current) return;
    printingRef.current = true; setPrintingId(`${p.id}:${copy}`);
    try {
      const pregunta = copy === 'cliente'
        ? 'Se imprimirá la copia del cliente de este pedido. ¿Continuar?'
        : 'Se enviará otra copia de esta comanda a la impresora térmica. ¿Continuar?';
      const outcome = await reimprimirPedido(p, printCopy, newAttemptId, () => window.confirm(pregunta), copy);
      if (outcome.status === 'queued') showToast(copy === 'cliente' ? 'Copia del cliente enviada a la cola; comprobá la salida del papel' : 'Enviado a la cola; comprobá la salida física del papel');
      else if (outcome.status === 'failed') showToast(outcome.error instanceof Error ? outcome.error.message : 'No se pudo enviar a la impresora; pedido guardado.', false, 7000);
      else if (outcome.status === 'blocked') showToast('Comanda bloqueada: pago sin acreditar o productos inválidos', false);
    } finally { printingRef.current = false; setPrintingId(null); }
  };
```

En el detalle, reemplazar el botón `🖨 Enviar a térmica` completo (el que tiene `onClick={() => imprimirPedido(selected)}`) por dos botones:

```tsx
                <button
                  onClick={() => imprimirPedido(selected, 'cocina')}
                  aria-label="Reimprimir la comanda de cocina en la impresora térmica"
                  disabled={!puedeImprimirComanda(selected) || printingId !== null}
                  className="px-4 font-bold py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "white")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
                >
                  {printingId === `${selected.id}:cocina` ? "Enviando..." : "🖨 Comanda cocina"}
                </button>
                <button
                  onClick={() => imprimirPedido(selected, 'cliente')}
                  aria-label="Imprimir la copia del cliente en la impresora térmica"
                  disabled={!puedeImprimirComanda(selected) || printingId !== null}
                  className="px-4 font-bold py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "white")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
                >
                  {printingId === `${selected.id}:cliente` ? "Enviando..." : "🧾 Copia cliente"}
                </button>
```

El ícono 🖨 de cada fila (`onClick={(e) => { e.stopPropagation(); imprimirPedido(p); }}`) queda igual: reimprime la cocina.

- [ ] **Step 6: Verificar**

Run (en `carroFogon/next-app`, con el servidor de desarrollo detenido): `npm test && npx tsc --noEmit && npm run lint && npm run build`
Esperado: tests en verde, sin errores de tipos, lint sin errores nuevos (quedan las advertencias previas de `<img>` y `exhaustive-deps`), build exitoso.

- [ ] **Step 7: Documentar en `carroFogon/CLAUDE.md`**

Debajo de la sección "Impresión térmica local — avance 24/09/2026", agregar:

```markdown
## Copia del cliente (09/10/2026)

- Al guardar, el POS imprime la comanda de cocina y después la **copia del cliente** (para pegar en la caja), cada una con su corte y en la impresora elegida. Diseño: `Impasto/docs/superpowers/specs/2026-10-09-copia-cliente-design.md`.
- La copia del cliente **no lleva el número de pedido** (decisión del dueño: un correlativo bajo deja ver cuánto se vende), ni notas, ni `REIMPRESIÓN`; lleva IMPASTO, precios por línea, subtotal, envío, total, el pago en texto para el cliente y el pie de contacto. El formato vive en el agente (versión 3).
- `local-printer.ts` es idéntico al de Impasto: `printCopy` solo manda la copia del cliente a un agente versión 3+; `imprimirCopias` imprime cocina → cliente y devuelve las pendientes con sus mismas claves (`<clave>` y `<clave>:cliente`). Si sale la cocina y falla la del cliente, "Reintentar comanda" manda solo la del cliente.
- En Comandas, el detalle tiene "Comanda cocina" y "Copia cliente"; el ícono de la fila reimprime la cocina. La impresión por navegador sigue siendo solo de cocina.
```

- [ ] **Step 8: Commit**

```bash
cd carroFogon
git add next-app/src/components/FormCliente.tsx next-app/app/pedidos/page.tsx CLAUDE.md
git commit -m "feat(impresion): el POS imprime la copia del cliente al guardar y desde Comandas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Impasto — panel de pedidos

**Files:**
- Modify: `Impasto/app/admin/components/types.ts:19-24`
- Modify: `Impasto/lib/adapt-order.ts:18-25`
- Modify: `Impasto/lib/admin-print-job.ts`
- Modify: `Impasto/app/admin/components/Orders.tsx`
- Test: `Impasto/tests/admin-print-job.test.ts`, `Impasto/tests/adapt-order.test.ts`
- Modify: `Impasto/CLAUDE.md`

**Interfaces:**
- Consumes: `PrintCopy`, `PrintJob`, `imprimirCopias`, `mensajeCopias`, `newAttemptId` (Task 3).
- Produces: `adminPrintJob(order, attemptId, reprint = true, copy: PrintCopy = 'cocina'): PrintJob`; `adminPrintJobs(order, attemptId, reprint, copias: readonly PrintCopy[] = ['cocina', 'cliente']): PrintJob[]` (lanza `Pedido bloqueado para cocina.` / `Pedido sin productos válidos.`). Se elimina `sendAdminPrint`.

- [ ] **Step 1: Pruebas (fallan)**

`tests/adapt-order.test.ts`: en `rawConDetalle.productos`, cambiar el segundo ítem por `{ name: "Coca-Cola 1.5 L", qty: 1, price: 3000, extra: 500 }` y agregar, antes del resumen final (`console.log(fallos === 0 ? ...`):

```ts
if (adapted.items[1]?.extra === 500 && adapted.items[0]?.extra === 0) {
  console.log("PASA   adaptOrder conserva el extra del POS (0 si no hay)");
} else {
  fallos++;
  console.log("FALLA  extra esperado 0 y 500, obtuvo:", adapted.items[0]?.extra, adapted.items[1]?.extra);
}
```

`tests/admin-print-job.test.ts`: cambiar el import por:

```ts
import { adminPrintJob, adminPrintJobs } from '../lib/admin-print-job';
```

Reemplazar desde `let sent = 0;` hasta `assert.equal(sent, 2, 'blocked orders never reach printer');` por:

```ts
const cocina = adminPrintJob(base, 'attempt-9', false);
assert.equal(cocina.copy, undefined, 'la comanda de cocina no cambia');
assert.equal('subtotal' in cocina.receipt, false);
assert.equal('lineTotal' in cocina.receipt.items[0], false);
const cliente = adminPrintJob({ ...base, items: [...base.items, { name: 'Pizza POS', qty: 2, price: 10000, extra: 500 }] }, 'attempt-9', false, 'cliente');
assert.equal(cliente.copy, 'cliente');
assert.equal(cliente.attemptId, 'attempt-9:cliente');
assert.equal(cliente.receipt.subtotal, 27000);
assert.equal(cliente.receipt.shipping, 1000);
assert.deepEqual(cliente.receipt.items.map(i => i.lineTotal), [12000, 15000, 20500], 'importe con extra');
assert.deepEqual(adminPrintJobs(base, 'k', false).map(j => j.attemptId), ['k', 'k:cliente']);
assert.deepEqual(adminPrintJobs(base, 'k', true, ['cliente']).map(j => j.copy), ['cliente']);
for (const blocked of [
  { ...base, estado: 'cancelado' },
  { ...base, pago: 'mercadopago', pagoEstado: 'pendiente' },
  { ...base, pago: 'mercadopago', pagoEstado: 'rechazado' },
  { ...base, items: [] },
]) {
  assert.throws(() => adminPrintJobs(blocked, 'blocked', false), /bloquead|sin productos/i);
}
```

Run (en `Impasto`): `pnpm exec tsx tests/admin-print-job.test.ts`
Esperado: falla (`adminPrintJobs` no existe).

- [ ] **Step 2: Implementar `types.ts` y `adapt-order.ts`**

`app/admin/components/types.ts`, en `OrderItem`:

```ts
export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  detail?: string;
  /** Recargo manual del POS sobre la línea (no unitario). */
  extra?: number;
}
```

`lib/adapt-order.ts`, en el `map` de `items`, agregar después de `detail`:

```ts
        extra: Math.max(0, Number(i.extra) || 0),
```

- [ ] **Step 3: Implementar `lib/admin-print-job.ts`**

Reemplazar el archivo por:

```ts
import type { AdminOrder } from '../app/admin/components/types';
import { esPedidoParaCocina } from './pedido-visible';
import type { PrintCopy, PrintJob } from './local-printer';

export function adminPrintJob(order: AdminOrder, attemptId: string, reprint = true, copy: PrintCopy = 'cocina'): PrintJob {
  const cliente = copy === 'cliente';
  const address = order.mode === 'delivery'
    ? [order.dir, order.referencia].filter(Boolean).join(' · ')
    : '';
  const notes = [order.notas, order.cuando === 'asap' ? '' : `Horario: ${order.cuando}`]
    .filter(Boolean).join(' · ');
  return {
    attemptId: cliente ? `${attemptId}:cliente` : attemptId,
    source: 'impasto',
    orderId: order._dbId,
    reprint,
    ...(cliente ? { copy } : {}),
    receipt: {
      kind: order.mode === 'delivery' ? 'delivery' : 'retiro',
      date: new Date(order.fecha).toLocaleString('es-AR'),
      number: order.id,
      customer: order.cliente,
      phone: order.tel,
      address,
      notes,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.qty,
        detail: item.detail || '',
        unitPrice: item.price,
        ...(cliente ? { lineTotal: item.price * item.qty + (item.extra ?? 0) } : {}),
      })),
      total: order.total,
      ...(cliente ? { subtotal: order.subtotal, shipping: order.shipping } : {}),
      paymentMethod: order.pago,
      paymentStatus: order.pagoEstado,
    },
  };
}

/** Las copias pedidas, en orden (cocina y después cliente), con la misma regla de bloqueo de cocina. */
export function adminPrintJobs(
  order: AdminOrder,
  attemptId: string,
  reprint: boolean,
  copias: readonly PrintCopy[] = ['cocina', 'cliente'],
): PrintJob[] {
  if (!esPedidoParaCocina(order)) throw new Error('Pedido bloqueado para cocina.');
  if (!order._dbId || !order.items.length) throw new Error('Pedido sin productos válidos.');
  return copias.map(copy => adminPrintJob(order, attemptId, reprint, copy));
}
```

Run: `pnpm exec tsx tests/admin-print-job.test.ts && pnpm exec tsx tests/adapt-order.test.ts`
Esperado: `PASA impresión manual Impasto: ...` y `Todos los casos pasan`.

- [ ] **Step 4: `Orders.tsx` — imprimir las copias**

Imports de las líneas 10-11:

```tsx
import { adminPrintJobs } from "@/lib/admin-print-job";
import { configurePrinter, getPrinterSelection, imprimirCopias, mensajeCopias, newAttemptId, selectPrinter, type PrintCopy, type PrinterId, type PrinterSelection, type PrintJob } from "@/lib/local-printer";
```

Cambiar `const failedAttempts = useRef(new Map<string, PrintJob>());` por:

```tsx
  // Copias que no salieron, por pedido, con sus claves: reintentar no duplica lo que ya salió.
  const failedAttempts = useRef(new Map<string, PrintJob[]>());
```

Reemplazar `printOrder` completo por:

```tsx
  async function printOrder(order: AdminOrder, copias: readonly PrintCopy[] = ['cocina', 'cliente']) {
    if (printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    try {
      const previas = failedAttempts.current.get(order._dbId) ?? [];
      const reintento = previas.filter(job => copias.includes(job.copy ?? 'cocina'));
      const jobs = reintento.length ? reintento : adminPrintJobs(order, newAttemptId(), sentOrders.current.has(order._dbId), copias);
      const resultado = await imprimirCopias(jobs);
      const quedan = [...previas.filter(job => !jobs.includes(job)), ...resultado.pendientes];
      if (quedan.length) failedAttempts.current.set(order._dbId, quedan);
      else failedAttempts.current.delete(order._dbId);
      if (resultado.pendientes.length < jobs.length) sentOrders.current.add(order._dbId);
      const mensaje = mensajeCopias(jobs, resultado);
      setPrintState({ orderId: order._dbId, message: mensaje.ok ? `${mensaje.texto} Revisá el papel para confirmar la impresión.` : mensaje.texto, error: !mensaje.ok });
    } catch (error) {
      setPrintState({ orderId: order._dbId, message: error instanceof Error ? error.message : 'No se pudo enviar la comanda.', error: true });
    } finally {
      printingRef.current = false;
      setPrinting(false);
    }
  }
```

En el uso de `<OrderDetail` (línea ~229), agregar la prop:

```tsx
          onPrintCliente={() => printOrder(selected, ['cliente'])}
```

En la firma de `function OrderDetail(...)`, agregar `onPrintCliente` en la desestructuración y `onPrintCliente: () => void;` en el tipo. En el pie del modal, antes del botón `Enviar a impresora térmica`, agregar:

```tsx
          <button
            className="btn btn-ghost btn-sm"
            disabled={!habilitadoCocina || printing}
            title={habilitadoCocina ? "Imprimir la copia para pegar en la caja" : "Pago sin acreditar: la comanda está bloqueada"}
            onClick={onPrintCliente}
          >
            Copia cliente
          </button>
```

- [ ] **Step 5: Verificar**

Run (en `Impasto`): `pnpm test && pnpm exec tsc --noEmit && pnpm exec eslint app/admin/components/Orders.tsx app/admin/components/types.ts lib/admin-print-job.ts lib/adapt-order.ts lib/local-printer.ts tests/admin-print-job.test.ts tests/adapt-order.test.ts tests/local-printer.test.ts && pnpm build`
Esperado: todo en verde (eslint solo sobre lo tocado: `pnpm lint` también analiza `.worktrees/`).

- [ ] **Step 6: Documentar en `Impasto/CLAUDE.md`**

Al final del bloque "Impresión térmica directa — avance 24/09/2026", agregar:

```markdown
- **Copia del cliente (09/10/2026):** "Enviar a impresora térmica" imprime la comanda de cocina y después la copia para pegar en la caja (sin número de pedido, notas ni `REIMPRESIÓN`; con IMPASTO, precios, subtotal, envío, total, pago en texto para el cliente y pie de contacto), cada una con su corte. El detalle suma "Copia cliente". El formato vive en el agente versión 3 (`copy: "cliente"`); `lib/local-printer.ts` es idéntico al del POS y solo manda esa copia a un agente 3+. Reintentar manda solo las copias que faltaron, con sus claves (`<clave>` y `<clave>:cliente`). Diseño y plan: `docs/superpowers/specs/2026-10-09-copia-cliente-design.md`, `docs/superpowers/plans/2026-10-09-copia-cliente.md`.
```

- [ ] **Step 7: Commit**

```bash
cd Impasto
git add app/admin/components/types.ts lib/adapt-order.ts lib/admin-print-job.ts app/admin/components/Orders.tsx tests/admin-print-job.test.ts tests/adapt-order.test.ts CLAUDE.md
git commit -m "feat(admin): imprimir la copia del cliente junto con la comanda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Instalar el agente, probar en papel y publicar

**Files:**
- Modify: `Impasto/printer-agent/README.md`
- Instalación local: `%LOCALAPPDATA%\ImpastoPrinter\agent\bin\PrinterAgent.exe`

- [ ] **Step 1: Documentar el agente**

En `Impasto/printer-agent/README.md`, debajo de "## Pruebas ficticias opcionales", agregar al bloque de comandos:

```powershell
./printer-agent/bin/PrinterAgent.exe --test-cliente "EPSON TM-T20II Receipt"
```

y debajo del primer párrafo del README:

```markdown
**Versión 3 (09/10/2026): copia del cliente.** Un trabajo con `copy: "cliente"` (más `receipt.subtotal`, `receipt.shipping` e `items[].lineTotal`) sale con el formato para pegar en la caja: IMPASTO, sin número de pedido, notas ni `REIMPRESIÓN`, con precios, totales, el pago en texto para el cliente y el pie de contacto (textos fijos en `ReceiptEncoder.cs`). Sin `copy`, la comanda de cocina sale byte a byte igual que en la versión 2. `/health` informa `"version":"3"`; las webs solo mandan la copia del cliente a un agente 3+.
```

Commit:

```bash
cd Impasto
git add printer-agent/README.md
git commit -m "docs(impresora): copia del cliente y versión 3 del agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Reemplazar el agente en la PC (pedir confirmación al dueño antes)**

Unos segundos sin poder imprimir. Desde `Impasto/printer-agent`:

```powershell
powershell -NoProfile -File build.ps1
$stable = Join-Path $env:LOCALAPPDATA 'ImpastoPrinter\agent'
Get-Process PrinterAgent -ErrorAction SilentlyContinue | Stop-Process
Copy-Item "$stable\bin\PrinterAgent.exe" "$stable\bin\PrinterAgent.v2.exe" -Force
Copy-Item bin\PrinterAgent.exe "$stable\bin\PrinterAgent.exe" -Force
Start-Process (Join-Path ([Environment]::GetFolderPath('Startup')) 'Impasto Printer Agent.lnk')
Start-Sleep -Seconds 3
Invoke-WebRequest http://127.0.0.1:8765/health -Headers @{Origin='https://carro-fogon.vercel.app'} -UseBasicParsing | Select-Object -ExpandProperty Content
```

Esperado: `{"status":"available","version":"3",...}`. No tocar `config.local.json`, `attempts.json` ni `printer-selection.json`. Si no arranca: volver a copiar `PrinterAgent.v2.exe` sobre `PrinterAgent.exe` y abrir el acceso directo.

- [ ] **Step 3: Ticket de prueba en papel**

```powershell
& "$env:LOCALAPPDATA\ImpastoPrinter\agent\bin\PrinterAgent.exe" --test-cliente "EPSON TM-T20II Receipt"
```

Esperado: `Enviado a la cola...`. Pedir al dueño que confirme en el papel: encabezado IMPASTO, sin número, precios alineados, `Gratis`, `Pago en efectivo · a abonar $63.500`, pie y corte.

- [ ] **Step 4: Publicar**

```bash
cd carroFogon && git push origin main
cd ../Impasto && git push origin main
```

Comprobar el despliegue: `gh api repos/bioornal/carroFogon/commits/main/status --jq .state` (Vercel) y el estado de Netlify de Impasto.

- [ ] **Step 5: Humo en producción (con el dueño)**

En `carro-fogon.vercel.app` → Comandas → un pedido viejo no cancelado → detalle → "Copia cliente": sale la copia sin número. "Comanda cocina": sale la comanda como antes, con `REIMPRESIÓN`. No crea ni modifica pedidos. Registrar el resultado en los dos `CLAUDE.md`.
