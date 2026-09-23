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
        readonly HttpListener listener = new HttpListener();
        readonly JavaScriptSerializer json = new JavaScriptSerializer();
        Thread worker;
        volatile bool stopping;
        public int Port { get; private set; }
        public LocalServer(AgentConfig config, Action<string, byte[]> spool, AttemptLedger ledger, int port = 8765) {
            config.Validate(); this.config = config; this.spool = spool; this.ledger = ledger; Port = port;
            listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
            listener.TimeoutManager.EntityBody = TimeSpan.FromSeconds(5);
            listener.TimeoutManager.HeaderWait = TimeSpan.FromSeconds(5);
        }
        public void Start() {
            listener.Start();
            worker = new Thread(Loop) { IsBackground = true }; worker.Start();
        }
        public static void Run(AgentConfig config, Action<string, byte[]> spool, AttemptLedger ledger) {
            using (var server = new LocalServer(config, spool, ledger)) {
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
            if (request.Url.AbsolutePath != "/health" && request.Url.AbsolutePath != "/print") { Reply(response, 404, new { error = "not_found" }); return; }
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
            if (request.Url.AbsolutePath == "/health" && request.HttpMethod == "GET") {
                if (token != null && !TokenMatches(token)) { Reply(response, 403, new { error = "pairing_required" }); return; }
                Reply(response, 200, new { status = "available", version = "1", queueName = config.queueName, paired = token != null }); return;
            }
            if (request.Url.AbsolutePath != "/print" || request.HttpMethod != "POST") { Reply(response, 405, new { error = "method_not_allowed" }); return; }
            if (!TokenMatches(token)) { Reply(response, 403, new { error = "pairing_required" }); return; }
            if (request.ContentLength64 > PrintRequest.MaxBodyBytes) { Reply(response, 413, new { error = "body_too_large" }); return; }
            if (request.ContentType == null || !request.ContentType.Split(';')[0].Trim().Equals("application/json", StringComparison.OrdinalIgnoreCase)) { Reply(response, 415, new { error = "json_required" }); return; }
            byte[] body;
            using (var buffer = new MemoryStream()) {
                byte[] chunk = new byte[4096]; int count;
                while ((count = request.InputStream.Read(chunk, 0, chunk.Length)) > 0) {
                    if (buffer.Length + count > PrintRequest.MaxBodyBytes) { Reply(response, 413, new { error = "body_too_large" }); return; }
                    buffer.Write(chunk, 0, count);
                }
                body = buffer.ToArray();
            }
            PrintRequest job; byte[] ticket;
            try { job = PrintRequest.Parse(new UTF8Encoding(false, true).GetString(body)); ticket = ReceiptEncoder.Encode(job, job.reprint); }
            catch (ArgumentException) { Reply(response, 400, new { error = "invalid_receipt" }); return; }
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
            try { spool(config.queueName, ticket); ledger.MarkQueued(job.attemptId); }
            catch (Exception) { Reply(response, 503, new { error = "outcome_unknown" }); return; }
            Reply(response, 200, new { status = "queued", duplicate = false });
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
