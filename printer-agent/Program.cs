using System;
using System.Globalization;
using System.IO;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    public static class Program {
        public static int Main(string[] args) {
            if (args.Length == 2 && args[0] == "--serve") {
                try {
                    var config = AgentConfig.Load(args[1]);
                    string ledgerPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ImpastoPrinter", "attempts.json");
                    using (var ledger = new AttemptLedger(ledgerPath)) LocalServer.Run(config, RawSpooler.Send, ledger);
                    return 0;
                } catch (Exception error) {
                    Console.Error.WriteLine("No se pudo iniciar el agente (" + error.GetType().Name + "). Revisar configuración, cola o permisos locales.");
                    return 1;
                }
            }
            if (args.Length != 2 || (args[0] != "--test-raw" && args[0] != "--test-raw-long")) {
                Console.WriteLine("Uso: PrinterAgent.exe --serve <config.local.json>");
                Console.WriteLine("     PrinterAgent.exe --test-raw <nombre exacto de cola>");
                Console.WriteLine("     PrinterAgent.exe --test-raw-long <nombre exacto de cola>");
                return 2;
            }
            try {
                bool longTicket = args[0] == "--test-raw-long";
                var item = new ReceiptItem { name = "Pizza á/ñ: jamón y morrón", quantity = 1, detail = "Mitad muzza / mitad jamón", unitPrice = 1000 };
                var items = new ReceiptItem[longTicket ? 8 : 1];
                for (int i = 0; i < items.Length; i++) items[i] = item;
                var request = new PrintRequest {
                    attemptId = Guid.NewGuid().ToString(), source = "impasto", orderId = "prueba-raw", reprint = false,
                    receipt = new Receipt { kind = "retiro", date = DateTime.Now.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                        number = longTicket ? "PRUEBA LARGA" : "PRUEBA RAW", customer = "", phone = "", address = "",
                        notes = longTicket ? "FICTICIO - NO PREPARAR. " + new string('X', 120) : "FICTICIO - NO PREPARAR", items = items,
                        total = 1000 * items.Length, paymentMethod = "PRUEBA", paymentStatus = "SIN COBRO" }
                };
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
    }
}
