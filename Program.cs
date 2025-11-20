using System;
using System.Windows.Forms;

namespace KORBUX_IA
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Form1()); // ✔ Corrección: tu formulario principal es Form1
        }
    }
}
