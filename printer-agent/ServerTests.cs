using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace PrinterAgent {
    public static class ServerTests {
        const string Origin = "https://www.impastopizzas.com";
        const string Token = "test-token-not-a-real-secret-0123456789";
        sealed class Response { public int status; public string body; public WebHeaderCollection headers; }
        static void Check(bool value, string message) { if (!value) throw new Exception(message); }
        static int TrailingFeeds(byte[] bytes) {
            int cursor = bytes.Length - 4;
            while (cursor >= 0 && bytes[cursor] == 10) cursor--;
            return bytes.Length - 4 - cursor;
        }
        static Response Send(int port, string path, string method, string origin, string token, string body) {
            var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + path);
            request.Proxy = null; request.Method = method; request.Timeout = 5000;
            if (origin != null) request.Headers["Origin"] = origin;
            if (token != null) request.Headers["X-Printer-Token"] = token;
            if (method == "OPTIONS") {
                request.Headers["Access-Control-Request-Method"] = "POST";
                request.Headers["Access-Control-Request-Headers"] = "content-type,x-printer-token";
                request.Headers["Access-Control-Request-Private-Network"] = "true";
            }
            if (body != null) {
                request.ContentType = "application/json";
                byte[] bytes = Encoding.UTF8.GetBytes(body); request.ContentLength = bytes.Length;
                using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
            }
            HttpWebResponse response;
            try { response = (HttpWebResponse)request.GetResponse(); }
            catch (WebException error) { if (error.Response == null) throw; response = (HttpWebResponse)error.Response; }
            using (response) using (var reader = new StreamReader(response.GetResponseStream()))
                return new Response { status = (int)response.StatusCode, body = reader.ReadToEnd(), headers = response.Headers };
        }
        static int Port() {
            var socket = new TcpListener(IPAddress.Loopback, 0); socket.Start();
            int port = ((IPEndPoint)socket.LocalEndpoint).Port; socket.Stop(); return port;
        }
        public static void Run(Action<string, Action> test) {
            string directory = Path.Combine(Path.GetTempPath(), "ImpastoPrinterTests-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(directory);
            string path = Path.Combine(directory, "attempts.json");
            var config = new AgentConfig { queueName = "test-queue", token = Token, allowedOrigins = new[] { Origin, "https://carro-fogon.vercel.app" } };
            int calls = 0;
            try {
                using (var ledger = new AttemptLedger(path)) using (var server = new LocalServer(config, delegate(string queue, byte[] bytes) {
                    Check(queue == "test-queue" && bytes[0] == 27, "validated bytes to configured queue"); calls++;
                }, ledger, Port())) {
                    server.Start(); int port = server.Port;
                    test("HTTP rejects missing/untrusted origins and invalid tokens", delegate {
                        foreach (string origin in new[] { null, "https://evil.test", Origin + ".evil.test" })
                            Check(Send(port, "/print", "POST", origin, Token, Tests.Fixture()).status == 403, "origin rejected");
                        Check(Send(port, "/print", "POST", Origin, "wrong", Tests.Fixture()).status == 403, "token rejected");
                        Check(calls == 0, "no unauthorized spool");
                    });
                    test("HTTP bounded body and validation fail without printing", delegate {
                        Check(Send(port, "/print", "POST", Origin, Token, new string('X', 65537)).status == 413, "body cap");
                        Check(Send(port, "/print", "POST", Origin, Token, "{}").status == 400, "invalid receipt");
                        Check(calls == 0, "no invalid spool");
                    });
                    test("CORS preflight grants only approved origin", delegate {
                        var response = Send(port, "/print", "OPTIONS", Origin, null, null);
                        Check(response.status == 204 && response.headers["Access-Control-Allow-Origin"] == Origin, "exact origin");
                        Check(response.headers["Access-Control-Allow-Private-Network"] == "true", "private network preflight");
                        Check(Send(port, "/print", "OPTIONS", "https://evil.test", null, null).headers["Access-Control-Allow-Origin"] == null, "no CORS for outsider");
                    });
                    test("health exposes no token or receipt; pairing validates token", delegate {
                        var health = Send(port, "/health", "GET", Origin, null, null);
                        Check(health.status == 200 && !health.body.Contains(Token) && !health.body.Contains("Cliente"), "safe health");
                        Check(Send(port, "/health", "GET", Origin, "wrong", null).status == 403, "pairing rejected");
                        Check(Send(port, "/health", "GET", Origin, Token, null).body.Contains("\"paired\":true"), "pairing accepted");
                    });
                    test("HTTP same attempt queues once and reports duplicate", delegate {
                        var first = Send(port, "/print", "POST", Origin, Token, Tests.Fixture());
                        var second = Send(port, "/print", "POST", Origin, Token, Tests.Fixture());
                        Check(first.status == 200 && first.body.Contains("\"duplicate\":false"), "first queued");
                        Check(second.status == 200 && second.body.Contains("\"duplicate\":true"), "duplicate queued");
                        Check(calls == 1, "one spool");
                    });
                    test("attempt cannot be reused with different receipt", delegate {
                        Check(Send(port, "/print", "POST", Origin, Token, Tests.Fixture("Different pizza")).status == 409, "changed receipt conflict");
                        Check(calls == 1, "no conflict spool");
                    });
                }
                test("dedup survives process restart without storing customer text", delegate {
                    using (var ledger = new AttemptLedger(path)) using (var server = new LocalServer(config, delegate { calls++; }, ledger, Port())) {
                        server.Start();
                        Check(Send(server.Port, "/print", "POST", Origin, Token, Tests.Fixture()).body.Contains("\"duplicate\":true"), "persistent duplicate");
                        Check(calls == 1, "restart no spool");
                    }
                    string stored = File.ReadAllText(path);
                    Check(!stored.Contains("Cliente") && !stored.Contains("Pizza") && !stored.Contains("Sin sal"), "no PII stored");
                });
                test("spool failure remains uncertain and never reports queued", delegate {
                    int failedCalls = 0;
                    using (var ledger = new AttemptLedger(Path.Combine(directory, "failure.json"))) using (var server = new LocalServer(config, delegate { failedCalls++; throw new IOException("secret PII must not leak"); }, ledger, Port())) {
                        server.Start();
                        var first = Send(server.Port, "/print", "POST", Origin, Token, Tests.Fixture());
                        var second = Send(server.Port, "/print", "POST", Origin, Token, Tests.Fixture());
                        Check(first.status == 503 && !first.body.Contains("secret PII") && !first.body.Contains("queued"), "safe spool failure");
                        Check(second.status == 409 && failedCalls == 1, "unknown outcome not silently reprinted");
                    }
                });
                test("shutdown keeps ledger ownership until slow spool finishes", delegate {
                    using (var entered = new System.Threading.ManualResetEvent(false))
                    using (var release = new System.Threading.ManualResetEvent(false))
                    using (var disposed = new System.Threading.ManualResetEvent(false)) {
                        var ledger = new AttemptLedger(Path.Combine(directory, "shutdown.json"));
                        var server = new LocalServer(config, delegate { entered.Set(); release.WaitOne(); }, ledger, Port());
                        server.Start();
                        var client = new System.Threading.Thread(delegate() {
                            try { Send(server.Port, "/print", "POST", Origin, Token, Tests.Fixture()); } catch (WebException) { }
                        });
                        client.Start();
                        System.Threading.Thread closer = null;
                        try {
                            Check(entered.WaitOne(3000), "spool started");
                            closer = new System.Threading.Thread(delegate() { server.Dispose(); ledger.Dispose(); disposed.Set(); });
                            closer.Start();
                            Check(!disposed.WaitOne(6500), "shutdown returned before spool completed and released ledger lock");
                        } finally {
                            release.Set();
                            if (closer != null) closer.Join(5000);
                            else { server.Dispose(); ledger.Dispose(); }
                            client.Join(5000);
                        }
                    }
                });
                test("failed ledger persistence prevents spool", delegate {
                    string blocked = Path.Combine(directory, "blocked.json");
                    using (var ledger = new AttemptLedger(blocked)) using (var server = new LocalServer(config, delegate { calls++; }, ledger, Port())) {
                        Directory.CreateDirectory(blocked); server.Start();
                        Check(Send(server.Port, "/print", "POST", Origin, Token, Tests.Fixture()).status == 503, "persistence failure");
                        Check(calls == 1, "no print without durable reservation");
                    }
                });
                test("printer selection is saved separately for each site and routes later jobs", delegate {
                    string selectionPath = Path.Combine(directory, "selection.json");
                    var twoPrinters = new AgentConfig { queueName = "test-queue", secondaryQueueName = "test-3nstar", token = Token,
                        allowedOrigins = new[] { Origin, "https://carro-fogon.vercel.app" } };
                    string lastQueue = null;
                    byte[] lastTicket = null;
                    using (var ledger = new AttemptLedger(Path.Combine(directory, "two-printers.json")))
                    using (var server = new LocalServer(twoPrinters, delegate(string queue, byte[] bytes) { lastQueue = queue; lastTicket = bytes; }, ledger, Port(), selectionPath,
                        delegate(string queue) { return queue == "test-queue" || queue == "test-3nstar"; })) {
                        server.Start();
                        Check(Send(server.Port, "/printers", "GET", Origin, Token, null).body.Contains("\"selected\":\"epson\""), "Epson is default");
                        Check(Send(server.Port, "/printers", "POST", Origin, "wrong", "{\"printer\":\"3nstar\"}").status == 403, "wrong token cannot select");
                        Check(Send(server.Port, "/printers", "POST", Origin, Token, "{\"printer\":\"arbitrary-queue\"}").status == 400, "arbitrary queue rejected");
                        Check(Send(server.Port, "/printers", "POST", Origin, Token, "{\"printer\":\"3nstar\"}").status == 200, "3nStar selected");
                        Check(Send(server.Port, "/printers", "GET", Origin, Token, null).body.Contains("\"selected\":\"3nstar\""), "Impasto selection updated");
                        Check(Send(server.Port, "/printers", "GET", "https://carro-fogon.vercel.app", Token, null).body.Contains("\"selected\":\"epson\""), "Carro selection unchanged");
                        string impastoJob = Tests.Fixture().Replace("test-attempt-1", "selection-impasto-1");
                        Check(Send(server.Port, "/print", "POST", Origin, Token, impastoJob).status == 200 && lastQueue == "test-3nstar", "Impasto routed to 3nStar");
                        Check(TrailingFeeds(lastTicket) == 7, "3nStar gets the longer cutter feed");
                        string carroJob = Tests.Fixture().Replace("test-attempt-1", "selection-carro-1").Replace("\"source\":\"impasto\"", "\"source\":\"carro-fogon\"");
                        Check(Send(server.Port, "/print", "POST", "https://carro-fogon.vercel.app", Token, carroJob).status == 200 && lastQueue == "test-queue", "Carro routed to Epson");
                        Check(TrailingFeeds(lastTicket) == 4, "Epson feed stays unchanged");
                    }
                    using (var ledger = new AttemptLedger(Path.Combine(directory, "two-printers-restart.json")))
                    using (var server = new LocalServer(twoPrinters, delegate { }, ledger, Port(), selectionPath, delegate { return true; })) {
                        server.Start();
                        Check(Send(server.Port, "/printers", "GET", Origin, Token, null).body.Contains("\"selected\":\"3nstar\""), "selection survives restart");
                    }
                });
                test("missing secondary Windows queue cannot become the active printer", delegate {
                    var twoPrinters = new AgentConfig { queueName = "test-queue", secondaryQueueName = "missing-3nstar", token = Token,
                        allowedOrigins = new[] { Origin, "https://carro-fogon.vercel.app" } };
                    using (var ledger = new AttemptLedger(Path.Combine(directory, "unavailable.json")))
                    using (var server = new LocalServer(twoPrinters, delegate { throw new Exception("Must not print"); }, ledger, Port(),
                        Path.Combine(directory, "unavailable-selection.json"), delegate(string queue) { return queue == "test-queue"; })) {
                        server.Start();
                        Check(Send(server.Port, "/printers", "POST", Origin, Token, "{\"printer\":\"3nstar\"}").status == 409, "missing queue rejected");
                        Check(Send(server.Port, "/printers", "GET", Origin, Token, null).body.Contains("\"selected\":\"epson\""), "Epson remains selected");
                    }
                });
            } finally { Directory.Delete(directory, true); }
        }
    }
}
