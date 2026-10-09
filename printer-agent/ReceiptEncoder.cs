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
