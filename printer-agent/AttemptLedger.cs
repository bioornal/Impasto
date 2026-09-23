using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    public sealed class AttemptLedger : IDisposable {
        public sealed class Entry {
            public string identity { get; set; }
            public string state { get; set; }
            public DateTime createdUtc { get; set; }
        }
        readonly string path;
        readonly FileStream exclusiveLock;
        readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
        Dictionary<string, Entry> entries;
        public AttemptLedger(string path) {
            this.path = Path.GetFullPath(path);
            Directory.CreateDirectory(Path.GetDirectoryName(this.path));
            exclusiveLock = new FileStream(this.path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            try {
                entries = File.Exists(this.path) ? json.Deserialize<Dictionary<string, Entry>>(File.ReadAllText(this.path)) : new Dictionary<string, Entry>();
                if (entries == null || entries.Any(p => p.Value == null || string.IsNullOrEmpty(p.Value.identity) || (p.Value.state != "pending" && p.Value.state != "queued")))
                    throw new InvalidDataException("Registro de impresión inválido.");
            } catch { exclusiveLock.Dispose(); throw; }
        }
        public bool TryReserve(string attemptId, string orderId) {
            Entry existing;
            if (entries.TryGetValue(attemptId, out existing)) {
                if (existing.identity != orderId) throw new InvalidOperationException("attempt_conflict");
                return false;
            }
            // Unknown outcomes never expire automatically. Only old confirmed queued entries are pruned.
            var next = entries.Where(p => p.Value.state != "queued" || p.Value.createdUtc >= DateTime.UtcNow.AddDays(-30)).ToDictionary(p => p.Key, p => p.Value);
            if (next.Count >= 10000) throw new IOException("Registro lleno; requiere revisión local.");
            next.Add(attemptId, new Entry { identity = orderId, state = "pending", createdUtc = DateTime.UtcNow });
            Save(next); entries = next; return true;
        }
        public bool IsQueued(string attemptId) { return entries.ContainsKey(attemptId) && entries[attemptId].state == "queued"; }
        public void MarkQueued(string attemptId) {
            Entry entry = entries[attemptId];
            var next = new Dictionary<string, Entry>(entries);
            next[attemptId] = new Entry { identity = entry.identity, state = "queued", createdUtc = entry.createdUtc };
            Save(next); entries = next;
        }
        void Save(Dictionary<string, Entry> next) {
            string temporary = path + ".tmp";
            byte[] bytes = Encoding.UTF8.GetBytes(json.Serialize(next));
            using (var file = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None)) {
                file.Write(bytes, 0, bytes.Length); file.Flush(true);
            }
            if (File.Exists(path)) File.Replace(temporary, path, null);
            else File.Move(temporary, path);
        }
        public void Dispose() { exclusiveLock.Dispose(); }
    }
}
