using System;
using System.Speech.Synthesis;

class Program
{
    static void Main()
    {
        try
        {
            using (var synth = new SpeechSynthesizer())
            {
                synth.Volume = 100;
                synth.Rate = 1;
                synth.SetOutputToDefaultAudioDevice();

                Console.WriteLine("KORBUX IA está hablando...");
                Console.WriteLine();

                synth.Speak("Hola jefe, soy KORBUX IA. Tu asistente del futuro ya tiene voz.");

                Console.WriteLine();
                Console.WriteLine("¡Listo! Presiona cualquier tecla para salir...");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("ERROR: " + ex.Message);
        }

        Console.ReadKey();
    }
}