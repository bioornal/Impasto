using System;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    public static class Tests {
        static int passed, failed;
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
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
            ServerTests.Run(Run);
            Console.WriteLine("Tests: " + passed + " passed, " + failed + " failed");
            return failed == 0 ? 0 : 1;
        }
    }
}
