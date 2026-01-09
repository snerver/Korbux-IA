import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Ruta absoluta al archivo korbux.json
 */
const FILE_PATH = path.resolve(__dirname, "../data/korbux.json");

/**
 * Tipo de interacción registrada
 */
export interface Interaccion {
  id: string;
  usuarioId: string;
  mensajeUsuario: string;
  conversationId: string;
  timestamp: string;
}

/**
 * Genera un UUID único
 */
function generarUUID(): string {
  return crypto.randomUUID();
}

/**
 * Lee el archivo korbux.json de forma segura
 */
function leerArchivo(): Interaccion[] {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return [];
    }
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(data) as Interaccion[];
  } catch (err) {
    console.error("[interaccionService] Error al leer korbux.json:", err);
    return [];
  }
}

/**
 * Escribe en korbux.json de forma segura
 */
function escribirArchivo(interacciones: Interaccion[]): void {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(interacciones, null, 2), "utf-8");
  } catch (err) {
    console.error("[interaccionService] Error al escribir korbux.json:", err);
    throw err;
  }
}

/**
 * Registra una interacción en korbux.json
 * @param usuarioId - ID único del usuario
 * @param mensajeUsuario - Mensaje enviado por el usuario
 * @param conversationId - Conversación asociada (default: "default")
 * @returns La interacción registrada
 */
export async function registrarInteraccion(
  usuarioId: string,
  mensajeUsuario: string,
  conversationId: string = "default"
): Promise<Interaccion> {
  if (!usuarioId || !mensajeUsuario) {
    throw new Error("usuarioId y mensajeUsuario son obligatorios.");
  }

  const nuevaInteraccion: Interaccion = {
    id: generarUUID(),
    usuarioId: usuarioId.trim(),
    mensajeUsuario: mensajeUsuario.trim(),
    conversationId: conversationId.trim(),
    timestamp: new Date().toISOString(),
  };

  const interacciones = leerArchivo();
  interacciones.push(nuevaInteraccion);
  escribirArchivo(interacciones);

  console.info("[interaccionService] Interacción registrada:", nuevaInteraccion);

  return nuevaInteraccion;
}
