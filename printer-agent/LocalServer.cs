using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    public sealed class LocalServer : IDisposable {
        readonly AgentConfig config;
        readonly Action<string, byte[]> spool;
        readonly AttemptLedger ledger;
        readonly PrinterSelection selection;
        readonly Func<string, bool> queueExists;
        readonly HttpListener listener = new HttpListener();
        readonly JavaScriptSerializer json = new JavaScriptSerializer();
        Thread worker;
        volatile bool stopping;
        public int Port { get; private set; }
        public LocalServer(AgentConfig config, Action<string, byte[]> spool, AttemptLedger ledger, int port = 8765,
            string selectionPath = null, Func<string, bool> queueExists = null) {
            config.Validate(); this.config = config; this.spool = spool; this.ledger = ledger; Port = port;
            selection = new PrinterSelection(config, selectionPath);
            this.queueExists = queueExists ?? RawSpooler.Exists;
            listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
            listener.TimeoutManager.EntityBody = TimeSpan.FromSeconds(5);
            listener.TimeoutManager.HeaderWait = TimeSpan.FromSeconds(5);
        }
        public void Start() {
            listener.Start();
            worker = new Thread(Loop) { IsBackground = true }; worker.Start();
        }
        public static void Run(AgentConfig config, Action<string, byte[]> spool, AttemptLedger ledger, string selectionPath) {
            using (var server = new LocalServer(config, spool, ledger, 8765, selectionPath)) {
                server.Start();
                Console.WriteLine("Agente disponible en 127.0.0.1:8765. En cola no significa impreso.");
                server.worker.Join();
            }
        }
        void Loop() {
            while (!stopping) {
                HttpListenerContext context;
                try { context = listener.GetContext(); }
                catch (HttpListenerException) { if (stopping) return; throw; }
                catch (ObjectDisposedException) { if (stopping) return; throw; }
                try { Handle(context); }
                catch (Exception) {
                    // No request bodies, tokens, paths, addresses or exception messages in logs.
                    try { Reply(context.Response, 503, new { error = "agent_unavailable" }); } catch { }
                } finally { context.Response.Close(); }
            }
        }
        bool TokenMatches(string supplied) {
            byte[] expected, actual;
            using (var hash = SHA256.Create()) {
                expected = hash.ComputeHash(Encoding.UTF8.GetBytes(config.token));
                actual = hash.ComputeHash(Encoding.UTF8.GetBytes(supplied ?? ""));
            }
            int difference = 0;
            for (int i = 0; i < expected.Length; i++) difference |= expected[i] ^ actual[i];
            return difference == 0;
        }
        void Handle(HttpListenerContext context) {
            var request = context.Request; var response = context.Response;
            string origin = request.Headers["Origin"];
            if (!IPAddress.IsLoopback(request.RemoteEndPoint.Address) || request.Url.Host != "127.0.0.1" || !config.allowedOrigins.Contains(origin, StringComparer.Ordinal)) {
                Reply(response, 403, new { error = "origin_forbidden" }); return;
            }
            response.Headers["Access-Control-Allow-Origin"] = origin;
            response.Headers["Vary"] = "Origin";
            response.Headers["Cache-Control"] = "no-store";
            if (request.Url.AbsolutePath != "/health" && request.Url.AbsolutePath != "/print" && request.Url.AbsolutePath != "/printers") { Reply(response, 404, new { error = "not_found" }); return; }
            if (request.HttpMethod == "OPTIONS") {
                string method = request.Headers["Access-Control-Request-Method"];
                string[] headers = (request.Headers["Access-Control-Request-Headers"] ?? "").Split(',');
                if ((method != "POST" && method != "GET") || headers.Any(h => h.Trim().Length > 0 && !h.Trim().Equals("content-type", StringComparison.OrdinalIgnoreCase) && !h.Trim().Equals("x-printer-token", StringComparison.OrdinalIgnoreCase))) {
                    Reply(response, 403, new { error = "preflight_forbidden" }); return;
                }
                response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
                response.Headers["Access-Control-Allow-Headers"] = "Content-Type, X-Printer-Token";
                if (request.Headers["Access-Control-Request-Private-Network"] == "true") response.Headers["Access-Control-Allow-Private-Network"] = "true";
                response.StatusCode = 204; return;
            }
            string token = request.Headers["X-Printer-Token"];
            string source = origin == config.allowedOrigins[0] ? "impasto" : "carro-fogon";
            if (request.Url.AbsolutePath == "/health" && request.HttpMethod == "GET") {
                if (token != null && !TokenMatches(token)) { Reply(response, 403, new { error = "pairing_required" }); return; }
                Reply(response, 200, new { status = "available", version = "2", queueName = selection.Queue(source), paired = token != null }); return;
            }
            if (request.Url.AbsolutePath == "/printers") {
                if (!TokenMatches(token)) { Reply(response, 403, new { error = "pairing_required" }); return; }
                if (request.HttpMethod == "GET") {
                    Reply(response, 200, new { selected = selection.Selected(source), epsonAvailable = queueExists(config.queueName),
                        threeNStarAvailable = config.secondaryQueueName != null && queueExists(config.secondaryQueueName) }); return;
                }
                if (request.HttpMethod != "POST") { Reply(response, 405, new { error = "method_not_allowed" }); return; }
                if (request.ContentLength64 > 1024 || request.ContentType == null || !request.ContentType.Split(';')[0].Trim().Equals("application/json", StringComparison.OrdinalIgnoreCase)) {
                    Reply(response, 400, new { error = "invalid_selection" }); return;
                }
                string requested;
                try {
                    byte[] data = ReadBody(request, 1024);
                    var choice = json.Deserialize<PrinterChoice>(new UTF8Encoding(false, true).GetString(data));
                    requested = choice == null ? null : choice.printer;
                } catch (Exception) { Reply(response, 400, new { error = "invalid_selection" }); return; }
                if (!selection.CanSelect(requested)) { Reply(response, 400, new { error = "invalid_selection" }); return; }
                string chosenQueue = requested == "epson" ? config.queueName : config.secondaryQueueName;
                if (!queueExists(chosenQueue)) { Reply(response, 409, new { error = "printer_unavailable" }); return; }
                try { selection.Select(source, requested); }
                catch (Exception) { Reply(response, 503, new { error = "selection_unavailable" }); return; }
                Reply(response, 200, new { selected = requested }); return;
            }
            if (request.Url.AbsolutePath != "/print" || request.HttpMethod != "POST") { Reply(response, 405, new { error = "method_not_allowed" }); return; }
            if (!TokenMatches(token)) { Reply(response, 403, new { error = "pairing_required" }); return; }
            if (request.ContentLength64 > PrintRequest.MaxBodyBytes) { Reply(response, 413, new { error = "body_too_large" }); return; }
            if (request.ContentType == null || !request.ContentType.Split(';')[0].Trim().Equals("application/json", StringComparison.OrdinalIgnoreCase)) { Reply(response, 415, new { error = "json_required" }); return; }
            byte[] body;
            try { body = ReadBody(request, PrintRequest.MaxBodyBytes); }
            catch (ArgumentException) { Reply(response, 413, new { error = "body_too_large" }); return; }
            PrintRequest job;
            try { job = PrintRequest.Parse(new UTF8Encoding(false, true).GetString(body)); }
            catch (ArgumentException) { Reply(response, 400, new { error = "invalid_receipt" }); return; }
            if (job.source != source) { Reply(response, 403, new { error = "source_forbidden" }); return; }
            string printerId = selection.Selected(source);
            string queueName = selection.Queue(source);
            byte[] ticket = ReceiptEncoder.Encode(job, job.reprint, printerId == "3nstar");
            string identity;
            using (var hash = SHA256.Create()) identity = Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(json.Serialize(job))));
            try {
                if (!ledger.TryReserve(job.attemptId, identity)) {
                    if (ledger.IsQueued(job.attemptId)) Reply(response, 200, new { status = "queued", duplicate = true });
                    else Reply(response, 409, new { error = "outcome_unknown" });
                    return;
                }
            } catch (InvalidOperationException) { Reply(response, 409, new { error = "attempt_conflict" }); return; }
            catch (Exception) { Reply(response, 503, new { error = "ledger_unavailable" }); return; }
            try { spool(queueName, ticket); ledger.MarkQueued(job.attemptId); }
            catch (Exception) { Reply(response, 503, new { error = "outcome_unknown" }); return; }
            Reply(response, 200, new { status = "queued", duplicate = false });
        }
        sealed class PrinterChoice { public string printer { get; set; } }
        static byte[] ReadBody(HttpListenerRequest request, int maximum) {
            using (var buffer = new MemoryStream()) {
                byte[] chunk = new byte[4096]; int count;
                while ((count = request.InputStream.Read(chunk, 0, chunk.Length)) > 0) {
                    if (buffer.Length + count > maximum) throw new ArgumentException("Cuerpo demasiado largo.");
                    buffer.Write(chunk, 0, count);
                }
                return buffer.ToArray();
            }
        }
        void Reply(HttpListenerResponse response, int status, object payload) {
            byte[] bytes = Encoding.UTF8.GetBytes(json.Serialize(payload));
            response.StatusCode = status; response.ContentType = "application/json; charset=utf-8"; response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
        }
        public void Dispose() {
            stopping = true; listener.Close();
            // The ledger owner must not release its lock while a spool/commit is still running.
            if (worker != null) worker.Join();
        }
    }
}
