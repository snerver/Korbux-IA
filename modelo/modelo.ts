/**
 * 📦 Módulo de modelo para registrar interacciones con el asistente.
 * Mejora: incluye trazabilidad, búsqueda avanzada y exportación.
 */

export interface Interaccion {
  usuarioId: string;
  mensajeUsuario: string;
  mensajeAsistente: string;
  fecha: Date;
}

// 🗂️ Almacenamiento en memoria
const interacciones: Interaccion[] = [];

/**
 * 💾 Agrega una interacción al modelo.
 */
export async function agregarInteraccion(
  usuarioId: string,
  mensajeUsuario: string,
  mensajeAsistente: string
): Promise<void> {
  const nuevaInteraccion: Interaccion = {
    usuarioId,
    mensajeUsuario,
    mensajeAsistente,
    fecha: new Date(),
  };

  interacciones.push(nuevaInteraccion);
}

/**
 * 🔍 Obtiene todas las interacciones de un usuario.
 */
export async function obtenerInteracciones(
  usuarioId: string
): Promise<Interaccion[]> {
  return interacciones.filter((i) => i.usuarioId === usuarioId);
}

/**
 * 🔎 Busca interacciones que contengan una palabra clave.
 */
export async function buscarPorPalabraClave(
  usuarioId: string,
  palabra: string
): Promise<Interaccion[]> {
  const clave = palabra.toLowerCase();
  return interacciones.filter(
    (i) =>
      i.usuarioId === usuarioId &&
      (i.mensajeUsuario.toLowerCase().includes(clave) ||
        i.mensajeAsistente.toLowerCase().includes(clave))
  );
}

/**
 * 📊 Obtiene estadísticas de uso por usuario.
 */
export async function obtenerEstadisticas(
  usuarioId: string
): Promise<{ total: number; ultimaInteraccion: Date | null }> {
  const lista = interacciones.filter((i) => i.usuarioId === usuarioId);
  return {
    total: lista.length,
    ultimaInteraccion: lista.length > 0 ? lista[lista.length - 1].fecha : null,
  };
}

/**
 * 📤 Exporta todas las interacciones a JSON (útil para persistencia).
 */
export async function exportarJSON(): Promise<string> {
  return JSON.stringify(interacciones, null, 2);
}

/**
 * 🧹 Limpia todas las interacciones (útil para pruebas).
 */
export async function limpiarInteracciones(): Promise<void> {
  interacciones.length = 0;
}
