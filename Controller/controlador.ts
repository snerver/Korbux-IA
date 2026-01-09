import { agregarInteraccion } from "../modelo/modelo";

/**
 * 📌 Maneja la interacción con el asistente virtual.
 * @param usuarioId - ID único del usuario.
 * @param mensajeUsuario - Mensaje enviado por el usuario.
 * @param contexto - (Opcional) Contexto adicional para la interacción.
 * @returns Promesa que resuelve con la respuesta del asistente y el contexto actualizado.
 * @throws Error Si ocurre un error al procesar la interacción.
 */
export async function manejarInteraccion(
  usuarioId: string,
  mensajeUsuario: string,
  contexto: Record<string, unknown> | null = null
): Promise<{ mensajeAsistente: string; contexto: Record<string, unknown> | string }> {
  try {
    // 🔍 Validación de entrada
    if (!usuarioId || !usuarioId.trim()) {
      throw new Error("❌ ID de usuario inválido. Debe ser una cadena no vacía.");
    }

    if (!mensajeUsuario || !mensajeUsuario.trim()) {
      throw new Error("❌ Mensaje de usuario inválido. Debe ser una cadena no vacía.");
    }

    usuarioId = usuarioId.trim();
    mensajeUsuario = mensajeUsuario.trim();

    // 📡 Simular respuesta del asistente (esto vendría de un servicio de IA en una implementación real)
    const mensajeAsistente = `Has dicho: "${mensajeUsuario}". ¿En qué más puedo ayudarte?`;

    // 📦 Incluir contexto si se proporciona
    const respuesta = {
      mensajeAsistente,
      contexto: contexto && typeof contexto === "object" ? contexto : "sin contexto",
    };

    // 💾 Registrar la interacción en el modelo
    await agregarInteraccion(usuarioId, mensajeUsuario, mensajeAsistente);

    return respuesta;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ Error al manejar la interacción:", error.stack || error.message);
    } else {
      console.error("❌ Error desconocido al manejar la interacción:", error);
    }

    // 📢 Registrar el error internamente y devolver un mensaje genérico al usuario
    throw new Error("⚠️ Ocurrió un error inesperado. Por favor, intenta nuevamente.");
  }
}


