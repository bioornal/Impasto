using System;
using System.Text;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    public sealed class PrintRequest {
        public string attemptId { get; set; }
        public string source { get; set; }
        public string orderId { get; set; }
        public bool reprint { get; set; }
        /// <summary>"cocina" (comanda) o "cliente" (copia para la caja). Ausente equivale a "cocina".</summary>
        public string copy { get; set; }
        public Receipt receipt { get; set; }
        public const int MaxBodyBytes = 65536;

        public static PrintRequest Parse(string json) {
            if (json == null || Encoding.UTF8.GetByteCount(json) > MaxBodyBytes)
                throw new ArgumentException("Cuerpo inválido o mayor a 64 KiB.");
            PrintRequest request;
            try {
                request = new JavaScriptSerializer { MaxJsonLength = MaxBodyBytes, RecursionLimit = 16 }.Deserialize<PrintRequest>(json);
            } catch (Exception error) {
                if (!(error is ArgumentException) && !(error is InvalidOperationException) && !(error is FormatException) && !(error is OverflowException)) throw;
                throw new ArgumentException("Comanda JSON inválida.");
            }
            if (request == null) throw new ArgumentException("Falta la comanda.");
            request.Validate();
            return request;
        }
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
        static void Required(string value, int max) {
            if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Falta un campo requerido.");
            Optional(value, max);
        }
        static void Optional(string value, int max) {
            if (value != null && value.Length > max) throw new ArgumentException("Campo demasiado largo.");
        }
    }
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
}
