using System;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    public static class Tests {
        static int passed, failed;
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        // Comanda de cocina del agente versión 2, capturada antes de la copia del cliente. No debe cambiar.
        const string GoldenRetiro = "G0AbdBAbYQFJTVBBU1RPCh0hESNQUlVFQkEKUkVUSVJPCh0hADIzLzA5LzIwMjYgMjA6MzAKG2EALS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tCkNsaWVudGU6IENsaWVudGUgZmljdGljaW8KG0UBMiB4IFBpenphIOEv8QobRQBNaXRhZCBtdXp6YSAvIG1pdGFkIGphbfNuCk5vdGFzOiBTaW4gc2FsCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpUT1RBTCAkIDIuMDAwLDAwClBhZ286IGVmZWN0aXZvIC8gcGVuZGllbnRlCgoKCh1WAA==";
        const string GoldenDelivery = "G0AbdBAbYQFJTVBBU1RPCh0hESNQUlVFQkEKREVMSVZFUlkKHSEAMjMvMDkvMjAyNiAyMDozMAobYQAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQ2xpZW50ZTogQ2xpZW50ZSBmaWN0aWNpbwpEaXJlY2Np8246IENhbGxlIGRlIHBydWViYSAxMjMKG0UBMiB4IFBpenphIOEv8QobRQBNaXRhZCBtdXp6YSAvIG1pdGFkIGphbfNuCk5vdGFzOiBTaW4gc2FsCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpUT1RBTCAkIDIuMDAwLDAwClBhZ286IGVmZWN0aXZvIC8gcGVuZGllbnRlCgoKCh1WAA==";
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
        public static string Fixture(string name = "Pizza á/ñ", string kind = "retiro", string notes = "Sin sal") {
            return Json.Serialize(new {
                attemptId = "test-attempt-1", source = "impasto", orderId = "test-order-1", reprint = false,
                receipt = new { kind = kind, date = "23/09/2026 20:30", number = "PRUEBA", customer = "Cliente ficticio",
                    phone = "", address = "Calle de prueba 123", notes = notes,
                    items = new[] { new { name = name, quantity = 2, detail = "Mitad muzza / mitad jamón", unitPrice = 1000m } },
                    total = 2000m, paymentMethod = "efectivo", paymentStatus = "pendiente" }
            });
        }
        static void Check(bool value, string message) { if (!value) throw new Exception(message); }
        static void Reject(string json) {
            try { PrintRequest.Parse(json); } catch (ArgumentException) { return; }
            throw new Exception("Expected validation rejection");
        }
        static bool Contains(byte[] bytes, byte[] sequence) {
            for (int i = 0; i <= bytes.Length - sequence.Length; i++)
                if (bytes.Skip(i).Take(sequence.Length).SequenceEqual(sequence)) return true;
            return false;
        }
        static void Run(string name, Action body) {
            try { body(); passed++; Console.WriteLine("PASS " + name); }
            catch (Exception error) { failed++; Console.WriteLine("FAIL " + name + ": " + error.Message); }
        }
        public static int Main() {
            Run("reset, bounded feed and final cut", delegate {
                byte[] bytes = ReceiptEncoder.Encode(PrintRequest.Parse(Fixture()), false);
                Check(bytes[0] == 27 && bytes[1] == 64, "ESC @");
                Check(bytes.Skip(bytes.Length - 3).SequenceEqual(new byte[] {29,86,0}), "GS V 0");
                Check(bytes.Length < 1000, "short receipt");
            });
            Run("3nStar profile advances the final payment past the cutter", delegate {
                byte[] epson = ReceiptEncoder.Encode(PrintRequest.Parse(Fixture()), false);
                byte[] threeNStar = ReceiptEncoder.Encode(PrintRequest.Parse(Fixture()), false, true);
                Check(threeNStar.Length == epson.Length + 3, "only three extra feeds for 3nStar");
                Check(threeNStar.Take(epson.Length - 3).SequenceEqual(epson.Take(epson.Length - 3)), "Epson content unchanged");
                Check(threeNStar.Skip(threeNStar.Length - 6).Take(3).SequenceEqual(new byte[] { 10, 10, 10 }), "extra feed before cut");
                Check(threeNStar.Skip(threeNStar.Length - 3).SequenceEqual(new byte[] { 29, 86, 0 }), "final cut retained");
            });
            Run("Spanish characters use matching code page", delegate {
                byte[] bytes = ReceiptEncoder.Encode(PrintRequest.Parse(Fixture()), false);
                Check(Contains(bytes, new byte[] {27,116,16}), "WPC1252 selected");
                Check(Contains(bytes, new byte[] {225,47,241}), "á/ñ bytes");
            });
            Run("control characters cannot inject printer commands", delegate {
                string attack = "Pizza" + (char)27 + "p" + (char)0 + (char)29 + "V" + (char)0 + (char)12;
                byte[] clean = ReceiptEncoder.Encode(PrintRequest.Parse(Fixture("Pizza p V")), false);
                byte[] bytes = ReceiptEncoder.Encode(PrintRequest.Parse(Fixture(attack)), false);
                Check(bytes.SequenceEqual(clean), "untrusted control bytes removed, text retained");
                Check(!Contains(bytes, new byte[] {27,112}), "no drawer pulse");
            });
            Run("long item wraps without truncation or extra blank lines", delegate {
                string longName = new string('X', 120);
                string text = Encoding.GetEncoding(1252).GetString(ReceiptEncoder.Encode(PrintRequest.Parse(Fixture(longName, "retiro", "A\r\n\n\nB")), false));
                Check(text.Count(c => c == 'X') == 120, "no text lost");
                Check(!text.Contains(new string('X', 43)), "42-column wrapping");
                Check(text.Contains("A\nB"), "collapsed blank lines");
                Check(text.Contains("Mitad muzza / mitad jamón"), "item detail retained");
            });
            Run("delivery has address; pickup does not invent shipping", delegate {
                string pickup = Encoding.GetEncoding(1252).GetString(ReceiptEncoder.Encode(PrintRequest.Parse(Fixture()), false));
                string delivery = Encoding.GetEncoding(1252).GetString(ReceiptEncoder.Encode(PrintRequest.Parse(Fixture("Pizza", " Delivery ")), false));
                Check(!pickup.Contains("Calle de prueba"), "pickup omits address");
                Check(delivery.Contains("Calle de prueba 123") && delivery.Contains("DELIVERY"), "delivery destination");
            });
            Run("reprint marker is explicit", delegate {
                var request = PrintRequest.Parse(Fixture());
                Check(Encoding.GetEncoding(1252).GetString(ReceiptEncoder.Encode(request, true)).Contains("REIMPRESIÓN"), "reprint marked");
                Check(!Encoding.GetEncoding(1252).GetString(ReceiptEncoder.Encode(request, false)).Contains("REIMPRESIÓN"), "original unmarked");
            });
            Run("payment status is preserved without claiming approval", delegate {
                string text = Encoding.GetEncoding(1252).GetString(ReceiptEncoder.Encode(PrintRequest.Parse(Fixture().Replace("efectivo", "tarjeta").Replace("pendiente", "rechazado")), false));
                Check(text.Contains("rechazado") && text.Contains("tarjeta"), "actual payment status");
                Check(!text.Contains("COBRADO") && !text.Contains("Cobrar al entregar"), "no invented payment instruction");
            });
            Run("empty items rejected", delegate { Reject(Fixture().Replace(Json.Serialize(new[] { new { name = "Pizza á/ñ", quantity = 2, detail = "Mitad muzza / mitad jamón", unitPrice = 1000m } }), "[]")); });
            Run("missing order ID rejected", delegate { Reject(Fixture().Replace("test-order-1", "")); });
            Run("invalid kind rejected", delegate { Reject(Fixture("Pizza", "other")); });
            Run("zero quantity rejected", delegate { Reject(Fixture().Replace("\"quantity\":2", "\"quantity\":0")); });
            Run("negative total rejected", delegate { Reject(Fixture().Replace("\"total\":2000", "\"total\":-1")); });
            Run("long fields rejected", delegate { Reject(Fixture(new string('X', 241))); });
            Run("body byte limit enforced for Unicode", delegate { Reject(Fixture("Pizza", "retiro", new string('á', 33000))); });
            Run("malformed JSON rejected", delegate { Reject("{invalid}"); });
            Run("missing receipt rejected", delegate { Reject("{}"); });
            Run("spooler rejects unknown exact queue", delegate {
                try { RawSpooler.Send("Impasto-Nonexistent-Test-Queue-39fb1d", new byte[] {27,64}); }
                catch (System.ComponentModel.Win32Exception) { return; }
                throw new Exception("unknown queue accepted");
            });
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
            ServerTests.Run(Run);
            Console.WriteLine("Tests: " + passed + " passed, " + failed + " failed");
            return failed == 0 ? 0 : 1;
        }
    }
}
