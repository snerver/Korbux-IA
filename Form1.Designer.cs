using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Permissions;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace KORBUX_IA
{
    [ComVisible(true)]
    [PermissionSet(SecurityAction.Demand, Name = "FullTrust")]
    public class MainForm : Form
    {
        private readonly WebBrowser browser;

        public MainForm()
        {
            browser = new WebBrowser();
            InitializeComponent();
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            string basePath = AppDomain.CurrentDomain.BaseDirectory;
            string htmlPath = Path.Combine(basePath, "view", "index.html");

            if (!File.Exists(htmlPath))
            {
                MessageBox.Show(
                    "ERROR: No se encontró view/korbux.html\n\n" +
                    $"Ruta buscada:\n{htmlPath}\n\n" +
                    "Asegúrate de que la carpeta 'view' y sus archivos tengan:\n" +
                    "Propiedades → Copiar en el directorio de salida = 'Copiar siempre'",
                    "KORBUX IA - Interfaz no encontrada",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            Console.WriteLine($"[KORBUX IA] Interfaz cargada: {htmlPath}");
            SetWebBrowserFeatures();
            browser.Navigate(new Uri(htmlPath));
        }

        private void InitializeComponent()
        {
            browser.Dock = DockStyle.Fill;
            browser.ScriptErrorsSuppressed = false;
            browser.IsWebBrowserContextMenuEnabled = false;
            browser.AllowWebBrowserDrop = false;
            browser.WebBrowserShortcutsEnabled = false;
            browser.ObjectForScripting = this;

            this.Text = "KORBUX IA";
            this.WindowState = FormWindowState.Normal;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Size = new System.Drawing.Size(1280, 800);
            this.MinimumSize = new System.Drawing.Size(1000, 600);
            this.FormBorderStyle = FormBorderStyle.Sizable;
            this.BackColor = System.Drawing.Color.FromArgb(18, 18, 18);

            this.Load += MainForm_Load;
            this.Controls.Add(browser);
        }

        private static void SetWebBrowserFeatures()
        {
            var appName = Path.GetFileName(Application.ExecutablePath);
            var key = @"HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION";
            try
            {
                Microsoft.Win32.Registry.SetValue(key, appName, 11001, Microsoft.Win32.RegistryValueKind.DWord);
                Microsoft.Win32.Registry.SetValue(key, appName + ".exe", 11001, Microsoft.Win32.RegistryValueKind.DWord);
            }
            catch { }
        }

        // ==============================================================
        // COMUNICACIÓN JS → C#
        // ==============================================================

        public void MostrarAlerta(string mensaje)
        {
            this.Invoke((MethodInvoker)delegate
            {
                MessageBox.Show(mensaje, "JavaScript", MessageBoxButtons.OK, MessageBoxIcon.Information);
            });
        }

        public void RecibirPrompt(string prompt)
        {
            if (string.IsNullOrWhiteSpace(prompt)) return;

            Console.WriteLine($"[JS → C#] Prompt recibido: {prompt}");
            MostrarCargando("Procesando...");

            // Aquí conectarás más adelante con tu modelo neuronal
            // Respuesta de prueba inmediata:
            Task.Delay(1500).ContinueWith(_ =>
            {
                string respuesta = $"Recibido: \"{prompt}\". ¡KORBUX IA está lista!";
                EnviarRespuestaAlFrontend(respuesta);
                OcultarCargando();
            }, TaskScheduler.FromCurrentSynchronizationContext());
        }

        public void EnviarRespuestaAlFrontend(string respuesta)
        {
            if (browser.Document != null)
            {
                try
                {
                    browser.Document.InvokeScript("recibirRespuestaDesdeCSharp", new object[] { respuesta });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ERROR JS] {ex.Message}");
                }
            }
        }

        // ==============================================================
        // MÉTODOS DISPONIBLES PARA JAVASCRIPT
        // ==============================================================

        public void CambiarTema(string tema)
        {
            if (string.IsNullOrWhiteSpace(tema)) return;

            this.Invoke((MethodInvoker)delegate
            {
                switch (tema.ToLower())
                {
                    case "dark":
                    case "oscuro":
                        this.BackColor = System.Drawing.Color.FromArgb(18, 18, 18);
                        EnviarComandoJs("aplicarTema", "dark");
                        break;
                    case "light":
                    case "claro":
                        this.BackColor = System.Drawing.Color.FromArgb(245, 245, 247);
                        EnviarComandoJs("aplicarTema", "light");
                        break;
                    case "matrix":
                        this.BackColor = System.Drawing.Color.Black;
                        EnviarComandoJs("aplicarTema", "matrix");
                        break;
                    default:
                        EnviarComandoJs("aplicarTema", tema);
                        break;
                }
            });
        }

        public void MostrarNotificacion(string titulo, string mensaje, int duracionMs = 4000)
        {
            this.Invoke((MethodInvoker)delegate
            {
                EnviarComandoJs("mostrarNotificacion", titulo, mensaje, duracionMs);
            });
        }

        public void ReproducirSonido(string tipo)
        {
            this.Invoke((MethodInvoker)delegate
            {
                try
                {
                    switch (tipo.ToLower())
                    {
                        case "exito": case "success": System.Media.SystemSounds.Asterisk.Play(); break;
                        case "error": System.Media.SystemSounds.Hand.Play(); break;
                        case "alerta": case "warning": System.Media.SystemSounds.Exclamation.Play(); break;
                        case "pregunta": case "question": System.Media.SystemSounds.Question.Play(); break;
                        default: System.Media.SystemSounds.Beep.Play(); break;
                    }
                }
                catch { }
            });
        }

        public void MostrarCargando(string mensaje = "Pensando...")
        {
            this.Invoke((MethodInvoker)delegate
            {
                EnviarComandoJs("mostrarCargando", mensaje);
            });
        }

        public void OcultarCargando()
        {
            this.Invoke((MethodInvoker)delegate
            {
                EnviarComandoJs("ocultarCargando");
            });
        }

        private void EnviarComandoJs(string funcion, params object[] args)
        {
            if (browser.Document != null)
            {
                try
                {
                    browser.Document.InvokeScript(funcion, args);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ERROR JS] No se pudo ejecutar {funcion}: {ex.Message}");
                }
            }
        }
    }
}