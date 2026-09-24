using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace PrinterAgent {
    public static class RawSpooler {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct DocInfo {
            [MarshalAs(UnmanagedType.LPWStr)] public string documentName;
            [MarshalAs(UnmanagedType.LPWStr)] public string outputFile;
            [MarshalAs(UnmanagedType.LPWStr)] public string dataType;
        }
        [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
        [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern uint StartDocPrinter(IntPtr handle, uint level, ref DocInfo info);
        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool StartPagePrinter(IntPtr handle);
        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool WritePrinter(IntPtr handle, byte[] bytes, uint count, out uint written);
        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool EndPagePrinter(IntPtr handle);
        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool EndDocPrinter(IntPtr handle);
        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool AbortPrinter(IntPtr handle);
        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool ClosePrinter(IntPtr handle);

        static Win32Exception Failure(string operation) { return new Win32Exception(Marshal.GetLastWin32Error(), "Falló " + operation + "."); }
        public static bool Exists(string queueName) {
            if (string.IsNullOrWhiteSpace(queueName)) return false;
            IntPtr printer;
            if (!OpenPrinter(queueName, out printer, IntPtr.Zero)) return false;
            ClosePrinter(printer);
            return true;
        }
        public static void Send(string queueName, byte[] bytes) {
            if (string.IsNullOrWhiteSpace(queueName) || bytes == null || bytes.Length == 0) throw new ArgumentException("Cola o trabajo vacío.");
            IntPtr printer;
            if (!OpenPrinter(queueName, out printer, IntPtr.Zero)) throw Failure("OpenPrinter");
            bool documentOpen = false;
            try {
                var info = new DocInfo { documentName = "Comanda térmica", dataType = "RAW", outputFile = null };
                if (StartDocPrinter(printer, 1, ref info) == 0) throw Failure("StartDocPrinter");
                documentOpen = true;
                if (!StartPagePrinter(printer)) throw Failure("StartPagePrinter");
                uint written;
                if (!WritePrinter(printer, bytes, (uint)bytes.Length, out written)) throw Failure("WritePrinter");
                if (written != bytes.Length) throw new InvalidOperationException("Escritura RAW incompleta; revisar cola antes de reintentar.");
                if (!EndPagePrinter(printer)) throw Failure("EndPagePrinter");
                if (!EndDocPrinter(printer)) throw Failure("EndDocPrinter");
                documentOpen = false;
            } finally {
                if (documentOpen) AbortPrinter(printer);
                ClosePrinter(printer);
            }
        }
    }
}
