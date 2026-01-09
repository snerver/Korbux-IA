// routes/interaccion.js

/**
 * @file Rutas para la interacción de usuario con el chat.
 * @description Define los endpoints para registrar mensajes de usuario, obtener respuestas del asistente,
 * y gestionar el historial de chat. Estas rutas están diseñadas para ser rápidas y eficientes.
 * @module routes/interaccion
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

//  Importa el objeto de servicios centralizado.
// Este objeto contiene instancias de todos tus servicios (chatService, auditService, etc.).
const services = require(path.join(__dirname, "..", "services"));

//  Importa middlewares de validación específicos para las entradas de interacción.
let validarInteraccion;
try {
  const validationMiddleware = require(path.join(
    __dirname,
    "..",
    "middleware",
    "validationMiddleware.js"
  ));
  validarInteraccion = validationMiddleware.validateInteraction; // Asume que existe un middleware `validateInteraction`
} catch (e) {
  logger.error(
    " [Interaccion Routes] No se pudo cargar validationMiddleware.js. Las validaciones en rutas de interacción no funcionarán. Error: " +
      e.message
  );
  // Define un middleware dummy que simplemente pasa al siguiente para evitar que la app se detenga en desarrollo.
  validarInteraccion = (req, res, next) => next();
}

//  Importa el módulo de métricas (si existe).
let metrics;
try {
  metrics = require(path.join(__dirname, "..", "utils", "metrics.js")); // Asume una ruta a tu módulo de métricas
} catch (e) {
  logger.warn(
    " [Interaccion Routes] No se pudo cargar el módulo de métricas. Las métricas no se registrarán. Error: " +
      e.message
  );
  // Define un objeto dummy para evitar errores de referencia.
  metrics = {
    contar: () => {},
    incrementar: () => {},
    medir: () => {},
  };
}

/**
 * @swagger
 * /api/interaccion:
 * post:
 * summary: Registra una interacción de usuario y genera una respuesta del asistente.
 * description: Recibe el ID de usuario y un mensaje, valida la entrada, registra el mensaje del usuario,
 * genera una respuesta del asistente y la registra también.
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - usuarioId
 * - mensajeUsuario
 * properties:
 * usuarioId:
 * type: string
 * description: Identificador único del usuario.
 * example: "user123"
 * mensajeUsuario:
 * type: string
 * description: Mensaje enviado por el usuario.
 * example: "¿Cuál es el horario de atención?"
 * responses:
 * 200:
 * description: Interacción registrada y respuesta del asistente generada exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: "success"
 * message:
 * type: string
 * example: "Mensaje procesado y respuesta del asistente generada."
 * data:
 * type: object
 * properties:
 * userMessage:
 * type: object
 * description: El mensaje del usuario guardado.
 * assistantResponse:
 * type: object
 * description: La respuesta del asistente guardada.
 * timestamp:
 * type: string
 * format: date-time
 * example: "2025-07-05T18:30:00.000Z"
 * 400:
 * description: Solicitud inválida debido a falta de usuarioId o mensajeUsuario, o formato incorrecto.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/ErrorResponse'
 * 500:
 * description: Error interno del servidor al procesar la interacción.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/interaccion", validarInteraccion, async (req, res, next) => {
  // `validarInteraccion` middleware ya debería haber validado y saneado `usuarioId` y `mensajeUsuario`.
  const { usuarioId, mensajeUsuario } = req.body;
  const username = req.user?.username || "Desconocido"; // Asume que req.user está disponible desde el middleware de autenticación.

  logger.debug(
    `[Interaccion Routes] Solicitud POST /interaccion de usuario ${usuarioId}: "${mensajeUsuario.substring(
      0,
      50
    )}..."`
  );
  const startTime = process.hrtime.bigint(); // Para medir el tiempo de procesamiento.

  try {
    if (!services.chatService) {
      logger.error(" [Interaccion Routes] chatService no está disponible.");
      throw new Errores.ServiceUnavailableError(
        "El servicio de chat no está disponible. Inténtalo de nuevo más tarde."
      );
    }

    // 1. Guardar el mensaje del usuario.
    const userMessageRecord = await services.chatService.saveMessage(
      usuarioId,
      mensajeUsuario,
      "user"
    );
    logger.info(
      ` [Interaccion Routes] Mensaje de usuario ${usuarioId} guardado.`
    );

    // 2. Obtener la respuesta del asistente.
    const assistantResponseText =
      await services.chatService.getAssistantResponse(
        usuarioId,
        mensajeUsuario
      );
    logger.info(
      ` [Interaccion Routes] Respuesta del asistente generada para usuario ${usuarioId}.`
    );

    // 3. Guardar la respuesta del asistente.
    const assistantMessageRecord = await services.chatService.saveMessage(
      usuarioId,
      assistantResponseText,
      "assistant"
    );
    logger.info(
      ` [Interaccion Routes] Respuesta del asistente para usuario ${usuarioId} guardada.`
    );

    // 4. Registrar acción de auditoría (opcional, si es de alto volumen, podría ir en un servicio de logs asíncrono).
    if (services.auditService) {
      await services.auditService.logUserAction(
        usuarioId,
        username,
        "CHAT_MESSAGE",
        {
          userMessageId: userMessageRecord.id,
          assistantMessageId: assistantMessageRecord.id,
        },
        req.ip, // IP del cliente
        "ChatMessage",
        userMessageRecord.id, // ID del recurso principal (mensaje de usuario)
        req // Pasar el objeto req para más contexto de auditoría
      );
      logger.debug(
        `[Interaccion Routes] Acción de chat auditada para usuario ${usuarioId}.`
      );
    }

    // 5. Registrar métricas de éxito.
    if (metrics) {
      metrics.contar("interaccion_exitosa");
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000; // Convertir nanosegundos a milisegundos.
      metrics.medir("interaccion_tiempo_respuesta_ms", durationMs);
      logger.debug(
        `[Interaccion Routes] Interacción procesada en ${durationMs.toFixed(
          2
        )}ms.`
      );
    }

    // 6. Enviar respuesta exitosa.
    return res.status(200).json({
      status: "success",
      message: "Mensaje procesado y respuesta del asistente generada.",
      data: {
        userMessage: userMessageRecord,
        assistantResponse: assistantMessageRecord,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Registrar métricas de fallo.
    if (metrics) {
      metrics.contar("interaccion_fallida");
    }

    logger.error(
      ` [Interaccion Routes] Error al procesar la interacción para usuario ${usuarioId}:`,
      error.stack || error.message || error
    );

    // Pasar el error al middleware centralizado de manejo de errores.
    // Si el error ya es una instancia de Errores.AppError, se pasa directamente.
    // De lo contrario, se envuelve en un InternalServerError.
    if (error instanceof Errores.AppError) {
      next(error);
    } else {
      next(
        new Errores.InternalServerError(
          "Ocurrió un error interno al procesar la interacción.",
          error // Pasar el error original para logging detallado.
        )
      );
    }
  }
});

/**
 * @swagger
 * /api/interaccion/history/{userId}:
 * get:
 * summary: Obtiene el historial de chat de un usuario.
 * description: Recupera los mensajes de chat previos de un usuario específico, con opciones de paginación.
 * parameters:
 * - in: path
 * name: userId
 * schema:
 * type: string
 * required: true
 * description: Identificador único del usuario.
 * example: "user123"
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 20
 * description: Número máximo de mensajes a devolver.
 * - in: query
 * name: offset
 * schema:
 * type: integer
 * default: 0
 * description: Número de mensajes a omitir (para paginación).
 * responses:
 * 200:
 * description: Historial de chat obtenido exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: "success"
 * message:
 * type: string
 * example: "Historial de chat obtenido exitosamente."
 * data:
 * type: array
 * items:
 * type: object
 * properties:
 * id: { type: string }
 * userId: { type: string }
 * message: { type: string }
 * timestamp: { type: string, format: "date-time" }
 * type: { type: string, enum: ["user", "assistant"] }
 * 400:
 * description: Solicitud inválida (ej. userId no proporcionado).
 * 404:
 * description: No se encontró historial de chat para el usuario.
 * 500:
 * description: Error interno del servidor.
 */
router.get("/interaccion/history/:userId", async (req, res, next) => {
  const userId = req.params.userId;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;

  logger.debug(
    `[Interaccion Routes] Solicitud GET /interaccion/history/${userId} con límite ${limit}, offset ${offset}.`
  );

  try {
    if (!services.chatService) {
      logger.error(
        " [Interaccion Routes] chatService no está disponible para obtener historial."
      );
      throw new Errores.ServiceUnavailableError(
        "El servicio de chat no está disponible."
      );
    }

    const historial = await services.chatService.getChatHistory(
      userId,
      limit,
      offset
    );

    return res.status(200).json({
      status: "success",
      message: "Historial de chat obtenido exitosamente.",
      data: historial,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      ` [Interaccion Routes] Error al obtener historial de chat para usuario ${userId}:`,
      error.stack || error.message || error
    );
    if (error instanceof Errores.AppError) {
      next(error);
    } else {
      next(
        new Errores.InternalServerError(
          `Error al obtener el historial de chat para el usuario ${userId}.`,
          error
        )
      );
    }
  }
});

/**
 * @swagger
 * /api/interaccion/history/{userId}:
 * delete:
 * summary: Elimina el historial de chat de un usuario.
 * description: Elimina todos los mensajes de chat asociados a un usuario específico.
 * parameters:
 * - in: path
 * name: userId
 * schema:
 * type: string
 * required: true
 * description: Identificador único del usuario.
 * example: "user123"
 * responses:
 * 204:
 * description: Historial de chat eliminado exitosamente (No Content).
 * 400:
 * description: Solicitud inválida (ej. userId no proporcionado).
 * 404:
 * description: No se encontró historial de chat para el usuario o no se pudo eliminar.
 * 500:
 * description: Error interno del servidor.
 */
router.delete("/interaccion/history/:userId", async (req, res, next) => {
  const userId = req.params.userId;

  logger.debug(
    `[Interaccion Routes] Solicitud DELETE /interaccion/history/${userId}.`
  );

  try {
    if (!services.chatService) {
      logger.error(
        " [Interaccion Routes] chatService no está disponible para eliminar historial."
      );
      throw new Errores.ServiceUnavailableError(
        "El servicio de chat no está disponible."
      );
    }

    const deleted = await services.chatService.deleteChatHistory(userId);

    if (!deleted) {
      // chatService.deleteChatHistory ya lanza NotFoundError si no encuentra/elimina.
      // Esto es un fallback si la lógica del servicio cambia.
      throw new Errores.NotFoundError(
        `No se encontró historial de chat para el usuario ${userId} o no se pudo eliminar.`
      );
    }

    // Registrar acción de auditoría.
    if (services.auditService) {
      const username = req.user?.username || "Desconocido"; // Asume req.user del middleware de autenticación.
      await services.auditService.logUserAction(
        userId,
        username,
        "DELETE_CHAT_HISTORY",
        {},
        req.ip,
        "ChatMessage",
        userId, // El ID del usuario es el recurso afectado en este caso.
        req
      );
      logger.debug(
        `[Interaccion Routes] Eliminación de historial de chat auditada para usuario ${userId}.`
      );
    }

    return res.status(204).send(); // 204 No Content para eliminación exitosa.
  } catch (error) {
    logger.error(
      ` [Interaccion Routes] Error al eliminar historial de chat para usuario ${userId}:`,
      error.stack || error.message || error
    );
    if (error instanceof Errores.AppError) {
      next(error);
    } else {
      next(
        new Errores.InternalServerError(
          `Error al eliminar el historial de chat para el usuario ${userId}.`,
          error
        )
      );
    }
  }
});

// ---------------------------------------------------
//  Ruta Catch-all para 404 dentro de /api/interaccion
// Este middleware DEBE ser el ÚLTIMO en este archivo de rutas.
// Si una solicitud llega a este router `/api/interaccion` pero no coincide con ninguna de las rutas
// definidas anteriormente, se considera un 404 (Not Found) dentro de este contexto.
// ---------------------------------------------------
router.use((req, res, next) => {
  next(
    new Errores.NotFoundError(
      `La ruta de interacción solicitada (${req.method} ${req.originalUrl}) no fue encontrada en este módulo.`
    )
  );
});

//  Exportación del router para que pueda ser utilizado por 'app.js' (o 'server.js').
module.exports = router;
