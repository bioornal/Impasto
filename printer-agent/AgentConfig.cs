using System;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;

namespace PrinterAgent {
    public sealed class AgentConfig {
        public string queueName { get; set; }
        public string token { get; set; }
        public string[] allowedOrigins { get; set; }
        public static AgentConfig Load(string path) {
            var config = new JavaScriptSerializer().Deserialize<AgentConfig>(File.ReadAllText(path));
            if (config == null) throw new ArgumentException("Configuración vacía.");
            config.Validate(); return config;
        }
        public void Validate() {
            if (string.IsNullOrWhiteSpace(queueName) || queueName.Length > 256) throw new ArgumentException("Falta nombre exacto de cola.");
            if (token == null || token.Length < 32 || token.Length > 256 || token.Any(c => c < 33 || c > 126)) throw new ArgumentException("Secreto local inválido.");
            if (allowedOrigins == null || allowedOrigins.Length != 2 || allowedOrigins.Distinct(StringComparer.Ordinal).Count() != 2)
                throw new ArgumentException("Configurar los dos orígenes exactos.");
            foreach (string origin in allowedOrigins) {
                Uri uri;
                if (!Uri.TryCreate(origin, UriKind.Absolute, out uri) || uri.Scheme != "https" || uri.UserInfo.Length != 0 || uri.GetLeftPart(UriPartial.Authority) != origin)
                    throw new ArgumentException("Origen HTTPS inválido.");
            }
        }
    }
}
