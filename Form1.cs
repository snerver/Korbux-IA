using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace KORBUX_IA
{
    [ComVisible(true)]
    public partial class Form1 : Form
    {
        private WebBrowser webBrowser1;

        public Form1()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.SuspendLayout();

            // === WebBrowser (ocupa todo el formulario) ===
            webBrowser1 = new WebBrowser
            {
                Dock = DockStyle.Fill,
                ScriptErrorsSuppressed = false,
                IsWebBrowserContextMenuEnabled = false,
                AllowWebBrowserDrop = false,
                WebBrowserShortcutsEnabled = false,
                ObjectForScripting = this // ¡Importante! Permite window.external
            };

            // === Form1 ===
            this.ClientSize = new System.Drawing.Size(1280, 720);
            this.MinimumSize = new System.Drawing.Size(800, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Text = "KORBUX IA - Asistente Inteligente Local";
            this.Icon = System.Drawing.SystemIcons.Application;
            this.Controls.Add(webBrowser1);

            this.Load += Form1_Load;
            this.ResumeLayout(false);
        }

        private void Form1_Load(object sender, EventArgs e)
        {
            SetWebBrowserFeatures();     // Forzar modo moderno (Edge/IE11)
            ConfigurarWebBrowser();
            CargarInterfazHTML();
        }

        private void ConfigurarWebBrowser()
        {
            if (webBrowser1 == null) return;

            webBrowser1.DocumentCompleted -= WebBrowser1_DocumentCompleted;
            webBrowser1.DocumentCompleted += WebBrowser1_DocumentCompleted;

            Console.WriteLine("[KORBUX IA] WebBrowser configurado correctamente.");
        }

        private void WebBrowser1_DocumentCompleted(object sender, WebBrowserDocumentCompletedEventArgs e)
        {
            Console.WriteLine("[KORBUX IA] Interfaz HTML cargada y lista.");
            // Aquí puedes forzar tema inicial si quieres
            // CambiarTema("dark");
        }

        private void CargarInterfazHTML()
        {
            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            string htmlPath = Path.Combine(basePath, "view", "korbux.html");

            if (!File.Exists(htmlPath))
            {
                MessageBox.Show(
                    "ERROR CRÍTICO: No se encontró el archivo de interfaz.\n\n" +
                    $"Ruta esperada:\n{htmlPath}\n\n" +
                    "SOLUCIÓN:\n" +
                    "1. Haz clic derecho en 'korbux.html' → Propiedades\n" +
                    "2. 'Copiar en directorio de salida' → 'Copiar siempre' o 'Copiar si es más reciente'",
                    "KORBUX IA - Archivo no encontrado",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                Application.Exit();
                return;
            }

            Console.WriteLine($"[KORBUX IA] Cargando interfaz: {htmlPath}");
            webBrowser1.Navigate(new Uri(htmlPath));
        }

        // ============================================================
        // Forzar modo moderno del WebBrowser (Edge si está disponible, o IE11)
        // ============================================================
        private static void SetWebBrowserFeatures()
        {
            string exeName = Path.GetFileName(Application.ExecutablePath);

            // Intentar modo Edge (Windows 10/11)
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION", true))
                {
                    if (key != null)
                        key.SetValue(exeName, 11001, RegistryValueKind.DWord); // 11001 = IE11
                }

                // Forzar Edge si está disponible (Windows 10 1809+)
                using (var key = Registry.CurrentUser.CreateSubKey(
                    @"Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION"))
                {
                    key?.SetValue(exeName, 99999, RegistryValueKind.DWord); // Edge mode
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ADVERTENCIA] No se pudo configurar modo Edge/IE11: {ex.Message}");
            }
        }

        // ============================================================
        // Llamar funciones JavaScript desde C#
        // ============================================================
        private void LlamarJs(string funcion, params object[] args)
        {
            try
            {
                if (webBrowser1.Document != null)
                    webBrowser1.Document.InvokeScript(funcion, args);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR JS] {funcion}: {ex.Message}");
            }
        }

        // ============================================================
        // Métodos expuestos a JavaScript (window.external)
        // ============================================================
        public void RecibirPrompt(string prompt)
        {
            if (string.IsNullOrWhiteSpace(prompt)) return;

            Console.WriteLine($"[JS → C#] Prompt recibido: {prompt}");
            MostrarCargando("KORBUX IA está pensando...");

            Task.Run(() =>
            {
                // Aquí irá tu modelo real (Ollama, LM Studio, etc.)
                System.Threading.Thread.Sleep(1500);

                string respuesta = $"¡Perfecto! Recibí:\n\n\"{prompt}\"\n\n" +
                                  "KORBUX IA está lista. ¿Qué hacemos ahora?";

                this.BeginInvoke((MethodInvoker)(() =>
                {
                    EnviarRespuestaAlFrontend(respuesta);
                    OcultarCargando();
                }));
            });
        }

        public void EnviarRespuestaAlFrontend(string respuesta)
            => LlamarJs("recibirRespuestaDesdeCSharp", respuesta);

        public void CambiarTema(string tema)
        {
            if (string.IsNullOrWhiteSpace(tema)) return;

            this.Invoke((MethodInvoker)(() =>
            {
                switch (tema.ToLower().Trim())
                {
                    case "dark":
                    case "oscuro":
                        this.BackColor = System.Drawing.Color.FromArgb(15, 23, 42);
                        break;
                    case "light":
                    case "claro":
                        this.BackColor = System.Drawing.Color.FromArgb(248, 250, 252);
                        break;
                    case "matrix":
                        this.BackColor = System.Drawing.Color.Black;
                        break;
                }
                LlamarJs("aplicarTema", tema);
            }));
        }

        public void MostrarNotificacion(string titulo, string mensaje, int duracion = 4000)
            => LlamarJs("mostrarNotificacion", titulo, mensaje, duracion);

        public void MostrarCargando(string msg = "Pensando…")
            => LlamarJs("mostrarCargando", msg);

        public void OcultarCargando()
            => LlamarJs("ocultarCargando");
    }
}