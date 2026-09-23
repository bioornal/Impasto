using System;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace PrinterAgent {
    public static class ReceiptEncoder {
        static readonly Encoding Page = Encoding.GetEncoding(1252, new EncoderReplacementFallback("?"), new DecoderReplacementFallback("?"));
        static readonly CultureInfo Money = CultureInfo.GetCultureInfo("es-AR");
        public static byte[] Encode(PrintRequest request, bool reprint) {
            if (request == null) throw new ArgumentException("Falta la comanda.");
            request.Validate();
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
                Command(output, 29,86,0); // final cut; no page/form feed
                return output.ToArray();
            }
        }
        static void Command(Stream output, params byte[] bytes) { output.Write(bytes, 0, bytes.Length); }
        static void Line(Stream output, string value, int width) {
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
                    byte[] bytes = Page.GetBytes(line.Substring(0, take));
                    output.Write(bytes, 0, bytes.Length); output.WriteByte(10);
                    line = line.Substring(take).TrimStart();
                }
            }
        }
    }
}
