using System;
using System.IO;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    // Only fixed printer IDs are persisted. Queue names come from the trusted local config.
    public sealed class PrinterSelection {
        sealed class State { public string impasto { get; set; } public string carroFogon { get; set; } }
        readonly AgentConfig config;
        readonly string path;
        readonly JavaScriptSerializer json = new JavaScriptSerializer();
        State state = new State { impasto = "epson", carroFogon = "epson" };
        public PrinterSelection(AgentConfig config, string path) {
            this.config = config; this.path = path;
            if (path != null && File.Exists(path)) {
                var saved = json.Deserialize<State>(File.ReadAllText(path));
                if (saved == null || !Valid(saved.impasto) || !Valid(saved.carroFogon)) throw new InvalidDataException("Selección de impresoras inválida.");
                state = saved;
            }
        }
        bool Valid(string id) { return id == "epson" || (id == "3nstar" && !string.IsNullOrWhiteSpace(config.secondaryQueueName)); }
        public string Selected(string source) { return source == "impasto" ? state.impasto : state.carroFogon; }
        public string Queue(string source) { return Selected(source) == "epson" ? config.queueName : config.secondaryQueueName; }
        public bool CanSelect(string id) { return Valid(id); }
        public void Select(string source, string id) {
            if (!Valid(id) || (source != "impasto" && source != "carro-fogon")) throw new ArgumentException("Impresora inválida.");
            var next = new State { impasto = source == "impasto" ? id : state.impasto,
                carroFogon = source == "carro-fogon" ? id : state.carroFogon };
            if (path != null) {
                string directory = Path.GetDirectoryName(path);
                Directory.CreateDirectory(directory);
                string temporary = path + ".tmp-" + Guid.NewGuid().ToString("N");
                try {
                    File.WriteAllText(temporary, json.Serialize(next));
                    if (File.Exists(path)) File.Replace(temporary, path, null);
                    else File.Move(temporary, path);
                } finally { if (File.Exists(temporary)) File.Delete(temporary); }
            }
            state = next;
        }
    }
}
