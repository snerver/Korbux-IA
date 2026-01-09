// services/chatService.js

/**
 * @file Servicio de lógica de negocio para las operaciones de chat.
 * @description Proporciona funciones para obtener, guardar y eliminar mensajes del historial de chat,
 * encapsulando la lógica de negocio y la interacción con la capa de datos.
 * @module services/chatService
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const config = require(path.join(__dirname, "..", "config")); // Importa tu configuración centralizada
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa la clase de errores personalizados

// Importa las funciones de interacción con la base de datos desde tu modelo de chat.
// Asegúrate de que models/chatModel.js exista y exporte estas funciones.
let chatModel;
try {
  chatModel = require(path.join(__dirname, "..", "models", "chatModel.js"));
  // Verificar que las funciones esperadas existan en chatModel
  if (
    typeof chatModel.obtenerHistorialDeChatDeBD !== "function" ||
    typeof chatModel.guardarMensajeEnBD !== "function" ||
    typeof chatModel.eliminarHistorialDeChatDeBD !== "function"
  ) {
    throw new Error(
      "chatModel.js no exporta las funciones esperadas (obtenerHistorialDeChatDeBD, guardarMensajeEnBD, eliminarHistorialDeChatDeBD)."
    );
  }
} catch (e) {
  logger.error(
    " [ChatService] No se pudo cargar o validar el modelo de chat (models/chatModel.js). Asegúrate de que exista y exporte las funciones necesarias.",
    e
  );
  // Define un modelo dummy para evitar errores de referencia, pero las operaciones fallarán.
  chatModel = {
    obtenerHistorialDeChatDeBD: async () => {
      logger.warn(
        " [ChatService] Operación de DB simulada: chatModel no cargado."
      );
      return [];
    },
    guardarMensajeEnBD: async (userId, message) => {
      logger.warn(
        " [ChatService] Operación de DB simulada: chatModel no cargado."
      );
      return { userId, message, id: "simulated_id" };
    },
    eliminarHistorialDeChatDeBD: async () => {
      logger.warn(
        " [ChatService] Operación de DB simulada: chatModel no cargado."
      );
      return false;
    },
  };
}

/**
 * @class ChatService
 * @description Servicio que encapsula la lógica de negocio para las operaciones de chat.
 * Proporciona una interfaz para interactuar con el modelo de datos del chat.
 */
class ChatService {
  /**
   * Crea una instancia de ChatService.
   * @param {object} dependencies - Dependencias para el servicio.
   * @param {object} dependencies.chatModel - Módulo que contiene las funciones de interacción con la base de datos del chat.
   * @param {object} dependencies.logger - Instancia del logger para registrar eventos.
   * @param {object} dependencies.Errores - Clase de errores personalizados.
   * @param {string} dependencies.environment - Entorno actual de la aplicación (ej. 'development', 'production').
   */
  constructor(dependencies) {
    this.chatModel = dependencies.chatModel;
    this.logger = dependencies.logger;
    this.Errores = dependencies.Errores;
    this.environment = dependencies.environment;

    this.logger.info("[ChatService] Servicio de chat inicializado.");
  }

  /**
   * Obtiene el historial de chat de un usuario específico.
   * @param {string} userId - El ID único del usuario.
   * @param {number} [limit=20] - El número máximo de mensajes a devolver. Por defecto es 20.
   * @returns {Promise<Array<Object>>} Una promesa que resuelve con un array de objetos de mensaje.
   * @throws {Errores.BadRequestError} Si el ID de usuario no es proporcionado o no es una cadena válida.
   * @throws {Errores.NotFoundError} Si no hay mensajes disponibles para el usuario.
   * @throws {Errores.InternalServerError} Si ocurre un error interno al acceder a la base de datos.
   */
  async getChatHistory(userId, limit = 20) {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      this.logger.warn(
        ` [ChatService] Intento de obtener historial de chat con ID de usuario inválido: '${userId}'`
      );
      throw new this.Errores.BadRequestError(
        "El ID de usuario es requerido y debe ser una cadena válida para obtener el historial de chat."
      );
    }
    if (typeof limit !== "number" || limit <= 0) {
      this.logger.warn(
        ` [ChatService] Límite de historial de chat inválido: ${limit}. Usando el valor por defecto.`
      );
      limit = 20; // Asegurar un límite válido.
    }

    try {
      this.logger.debug(
        `[ChatService] Intentando obtener historial de chat para usuario ${userId} con límite ${limit}.`
      );
      const historial = await this.chatModel.obtenerHistorialDeChatDeBD(
        userId,
        limit
      );

      if (!historial || historial.length === 0) {
        this.logger.info(
          `[ChatService] No se encontraron mensajes para el usuario ${userId}.`
        );
        throw new this.Errores.NotFoundError(
          `No hay mensajes disponibles para el usuario ${userId}.`
        );
      }

      this.logger.info(
        ` [ChatService] Historial de chat obtenido para usuario ${userId}: ${historial.length} mensajes.`
      );
      return historial;
    } catch (error) {
      // Si el error ya es una instancia de Errores.AppError (tu clase base), lo relanzamos directamente.
      if (error instanceof this.Errores.AppError) {
        throw error;
      }
      // Para otros errores (ej. de la base de datos), lanzamos un error personalizado de servidor.
      this.logger.error(
        ` [ChatService] Error interno al obtener el historial de chat para el usuario ${userId}:`,
        error
      );
      throw new this.Errores.InternalServerError(
        `Error interno al obtener el historial de chat para el usuario ${userId}.`,
        {
          userId,
          error: error.message,
          stack: this.environment === "development" ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Guarda un mensaje de un usuario en la base de datos.
   * @param {string} userId - El ID único del usuario.
   * @param {string} message - El contenido del mensaje a guardar.
   * @param {string} [senderType='user'] - El tipo de remitente ('user' o 'assistant').
   * @returns {Promise<Object>} Una promesa que resuelve con el objeto del mensaje guardado.
   * @throws {Errores.BadRequestError} Si el ID de usuario o el mensaje no son proporcionados o son inválidos.
   * @throws {Errores.InternalServerError} Si el mensaje no pudo ser guardado en la base de datos.
   */
  async saveMessage(userId, message, senderType = "user") {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      this.logger.warn(
        ` [ChatService] Intento de guardar mensaje con ID de usuario inválido: '${userId}'`
      );
      throw new this.Errores.BadRequestError(
        "El ID de usuario es requerido y debe ser una cadena válida para guardar el mensaje."
      );
    }
    if (!message || typeof message !== "string" || message.trim() === "") {
      this.logger.warn(
        ` [ChatService] Intento de guardar mensaje vacío o inválido para usuario ${userId}.`
      );
      throw new this.Errores.BadRequestError(
        "El contenido del mensaje es requerido y debe ser una cadena válida."
      );
    }
    if (!["user", "assistant"].includes(senderType)) {
      this.logger.warn(
        ` [ChatService] Tipo de remitente inválido: '${senderType}'. Usando 'user' por defecto.`
      );
      senderType = "user";
    }

    try {
      this.logger.debug(
        `[ChatService] Intentando guardar mensaje de tipo '${senderType}' para usuario ${userId}.`
      );
      const messageSaved = await this.chatModel.guardarMensajeEnBD(
        userId,
        message,
        senderType
      );

      if (!messageSaved) {
        this.logger.error(
          ` [ChatService] El modelo de chat no devolvió el mensaje guardado para el usuario ${userId}.`
        );
        throw new this.Errores.InternalServerError(
          `No se pudo guardar el mensaje para el usuario ${userId}.`
        );
      }

      this.logger.info(
        ` [ChatService] Mensaje de tipo '${senderType}' guardado exitosamente para usuario ${userId}.`
      );
      return messageSaved;
    } catch (error) {
      if (error instanceof this.Errores.AppError) {
        throw error;
      }
      this.logger.error(
        ` [ChatService] Error interno al guardar el mensaje para el usuario ${userId}:`,
        error
      );
      throw new this.Errores.InternalServerError(
        `Error interno al guardar el mensaje para el usuario ${userId}.`,
        {
          userId,
          message,
          senderType,
          error: error.message,
          stack: this.environment === "development" ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Elimina el historial de chat completo de un usuario.
   * @param {string} userId - El ID único del usuario cuyo historial se va a eliminar.
   * @returns {Promise<boolean>} Una promesa que resuelve a `true` si el historial se eliminó con éxito.
   * @throws {Errores.BadRequestError} Si el ID de usuario no es proporcionado o no es una cadena válida.
   * @throws {Errores.NotFoundError} Si no se encontró historial de chat para el usuario o no se pudo eliminar.
   * @throws {Errores.InternalServerError} Si ocurre un error interno al acceder a la base de datos.
   */
  async deleteChatHistory(userId) {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      this.logger.warn(
        ` [ChatService] Intento de eliminar historial de chat con ID de usuario inválido: '${userId}'`
      );
      throw new this.Errores.BadRequestError(
        "El ID de usuario es requerido y debe ser una cadena válida para eliminar el historial de chat."
      );
    }

    try {
      this.logger.debug(
        `[ChatService] Intentando eliminar historial de chat para usuario ${userId}.`
      );
      const deleted = await this.chatModel.eliminarHistorialDeChatDeBD(userId);

      if (!deleted) {
        this.logger.info(
          `[ChatService] No se encontró historial de chat para el usuario ${userId} o la operación de eliminación no tuvo efecto.`
        );
        throw new this.Errores.NotFoundError(
          `No se encontró historial de chat para el usuario ${userId} o no se pudo eliminar.`
        );
      }

      this.logger.info(
        ` [ChatService] Historial de chat eliminado exitosamente para usuario ${userId}.`
      );
      return true; // Indica éxito en la eliminación.
    } catch (error) {
      if (error instanceof this.Errores.AppError) {
        throw error;
      }
      this.logger.error(
        ` [ChatService] Error interno al eliminar el historial de chat para el usuario ${userId}:`,
        error
      );
      throw new this.Errores.InternalServerError(
        `Error interno al eliminar el historial de chat para el usuario ${userId}.`,
        {
          userId,
          error: error.message,
          stack: this.environment === "development" ? error.stack : undefined,
        }
      );
    }
  }

  /**
   * Procesa un mensaje de usuario y genera una respuesta del asistente.
   * Este método podría integrar la lógica de tu módulo 'neuronal'.
   * @param {string} userId - El ID del usuario.
   * @param {string} userMessage - El mensaje enviado por el usuario.
   * @returns {Promise<string>} La respuesta generada por el asistente.
   * @throws {Errores.BadRequestError} Si el mensaje de usuario es inválido.
   * @throws {Errores.InternalServerError} Si el asistente no puede generar una respuesta.
   */
  async getAssistantResponse(userId, userMessage) {
    if (
      !userMessage ||
      typeof userMessage !== "string" ||
      userMessage.trim() === ""
    ) {
      this.logger.warn(
        ` [ChatService] Intento de obtener respuesta del asistente con mensaje vacío o inválido para usuario ${userId}.`
      );
      throw new this.Errores.BadRequestError(
        "El mensaje del usuario es requerido para obtener una respuesta del asistente."
      );
    }

    try {
      this.logger.debug(
        `[ChatService] Procesando mensaje de usuario para asistente: ${userMessage.substring(
          0,
          50
        )}...`
      );

      // Aquí es donde integrarías tu lógica de IA (módulo 'neuronal').
      // Por ejemplo:
      // const neuronalService = require('./neuronalService'); // Asumiendo que tienes un servicio para la IA.
      // const aiResponse = await neuronalService.generateResponse(userId, userMessage);

      // Simulación de respuesta del asistente
      const aiResponse = `Entendido: "${userMessage}". Estoy procesando tu solicitud.`;

      if (!aiResponse) {
        this.logger.error(
          ` [ChatService] El asistente no pudo generar una respuesta para el usuario ${userId}.`
        );
        throw new this.Errores.InternalServerError(
          "El asistente no pudo generar una respuesta en este momento."
        );
      }

      this.logger.info(
        ` [ChatService] Respuesta del asistente generada para usuario ${userId}.`
      );
      return aiResponse;
    } catch (error) {
      if (error instanceof this.Errores.AppError) {
        throw error;
      }
      this.logger.error(
        ` [ChatService] Error al obtener respuesta del asistente para el usuario ${userId}:`,
        error
      );
      throw new this.Errores.InternalServerError(
        `Error interno al obtener respuesta del asistente para el usuario ${userId}.`,
        {
          userId,
          userMessage,
          error: error.message,
          stack: this.environment === "development" ? error.stack : undefined,
        }
      );
    }
  }
}

// Exporta una instancia única del servicio de chat, inyectando sus dependencias.
module.exports = new ChatService({
  chatModel: chatModel,
  logger: logger,
  Errores: Errores,
  environment: config.get("app.env"), // Pasa el entorno para el stack trace condicional.
});
