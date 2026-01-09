// routes/notifications.js

/**
 * @file Rutas para la gestión de notificaciones de usuario.
 * @description Define los endpoints para obtener, marcar como leídas y eliminar notificaciones.
 * Estas rutas requieren autenticación y, en algunos casos, verificación de propiedad o rol.
 * @module routes/notifications
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

//  Importa el objeto de servicios centralizado.
const services = require(path.join(__dirname, "..", "services"));

//  Importa middlewares de validación específicos.
let validateNotificationQueryParams;
let validateNotificationId;
try {
  const validationMiddleware = require(path.join(
    __dirname,
    "..",
    "middleware",
    "validationMiddleware.js"
  ));
  validateNotificationQueryParams =
    validationMiddleware.validateNotificationQueryParams; // Para GET /notifications
  validateNotificationId = validationMiddleware.validateNotificationId; // Para PUT/DELETE /notifications/:id
} catch (e) {
  logger.error(
    " [Notifications Routes] No se pudo cargar validationMiddleware.js. Las validaciones en rutas de notificaciones no funcionarán. Error: " +
      e.message
  );
  validateNotificationQueryParams = (req, res, next) => next();
  validateNotificationId = (req, res, next) => next();
}

// Importa un middleware para el Control de Acceso Basado en Roles (RBAC).
let checkRoles;
try {
  const rbacMiddlewareModule = require(path.join(
    __dirname,
    "..",
    "middleware",
    "rbacMiddleware.js"
  ));
  if (typeof rbacMiddlewareModule === "function") {
    checkRoles = rbacMiddlewareModule;
  } else if (typeof rbacMiddlewareModule.checkRoles === "function") {
    checkRoles = rbacMiddlewareModule.checkRoles;
  } else {
    throw new Error(
      "rbacMiddleware.js no exporta una función 'checkRoles' válida."
    );
  }
} catch (e) {
  logger.error(
    " [Notifications Routes] No se pudo cargar rbacMiddleware.js. Las rutas de notificaciones no tendrán protección RBAC. Error: " +
      e.message
  );
  checkRoles = (requiredRoles) => (req, res, next) => {
    logger.warn(
      ` [Notifications Routes] RBAC Middleware simulado: Acceso permitido para depuración. Roles requeridos: ${requiredRoles.join(
        ", "
      )}`
    );
    next();
  };
}

/**
 * @swagger
 * /api/notifications/user/{userId}:
 * get:
 * summary: Obtiene las notificaciones de un usuario.
 * description: Recupera una lista de notificaciones para un usuario específico, con opciones de filtrado y paginación.
 * parameters:
 * - in: path
 * name: userId
 * schema:
 * type: string
 * required: true
 * description: ID del usuario cuyas notificaciones se desean obtener.
 * example: "user123"
 * - in: query
 * name: readStatus
 * schema:
 * type: boolean
 * description: Filtra por estado de lectura (true para leídas, false para no leídas).
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 20
 * description: Número máximo de notificaciones a devolver.
 * - in: query
 * name: offset
 * schema:
 * type: integer
 * default: 0
 * description: Número de notificaciones a omitir (para paginación).
 * responses:
 * 200:
 * description: Notificaciones obtenidas exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Notificaciones obtenidas exitosamente." }
 * data:
 * type: array
 * items:
 * $ref: '#/components/schemas/Notification'
 * 400:
 * description: Solicitud inválida (ej. userId no proporcionado o formato incorrecto).
 * 403:
 * description: Prohibido (el usuario no tiene permiso para acceder a estas notificaciones).
 * 500:
 * description: Error interno del servidor.
 */
router.get(
  "/user/:userId",
  validateNotificationQueryParams,
  async (req, res, next) => {
    const requestingUserId = req.user?.id; // ID del usuario autenticado haciendo la solicitud
    const targetUserId = req.params.userId; // ID del usuario cuyas notificaciones se solicitan
    const { readStatus, limit, offset } = req.query;

    logger.debug(
      `[Notifications Routes] Solicitud GET /notifications/user/${targetUserId} por usuario ${requestingUserId}.`
    );

    try {
      if (!services.notificationService) {
        logger.error(
          " [Notifications Routes] notificationService no está disponible."
        );
        throw new Errores.ServiceUnavailableError(
          "El servicio de notificaciones no está disponible. Inténtalo de nuevo más tarde."
        );
      }

      // Control de acceso: Un usuario solo puede ver sus propias notificaciones, a menos que sea admin.
      if (
        !req.user?.roles.includes("admin") &&
        requestingUserId !== targetUserId
      ) {
        throw new Errores.ForbiddenError(
          "No tienes permiso para acceder a las notificaciones de este usuario."
        );
      }

      const options = {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        readStatus:
          readStatus !== undefined ? readStatus === "true" : undefined, // Convertir a booleano
      };

      const notifications = await services.notificationService.getNotifications(
        targetUserId,
        options
      );

      res.status(200).json({
        status: "success",
        message: "Notificaciones obtenidas exitosamente.",
        data: notifications,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        ` [Notifications Routes] Error al obtener notificaciones para usuario ${targetUserId}:`,
        error.stack || error.message || error
      );
      if (error instanceof Errores.AppError) {
        next(error);
      } else {
        next(
          new Errores.InternalServerError(
            `Error al obtener notificaciones para el usuario ${targetUserId}.`,
            error
          )
        );
      }
    }
  }
);

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 * put:
 * summary: Marca una notificación como leída.
 * description: Cambia el estado `isRead` de una notificación específica a `true`.
 * parameters:
 * - in: path
 * name: notificationId
 * schema:
 * type: string
 * required: true
 * description: ID de la notificación a marcar como leída.
 * example: "notif123"
 * requestBody:
 * required: false
 * responses:
 * 200:
 * description: Notificación marcada como leída exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Notificación marcada como leída." }
 * 400:
 * description: Solicitud inválida (ej. notificationId no proporcionado o formato incorrecto).
 * 403:
 * description: Prohibido (el usuario no es el propietario de la notificación).
 * 404:
 * description: Notificación no encontrada.
 * 500:
 * description: Error interno del servidor.
 */
router.put(
  "/:notificationId/read",
  validateNotificationId,
  async (req, res, next) => {
    const requestingUserId = req.user?.id; // ID del usuario autenticado
    const notificationId = req.params.notificationId;

    logger.debug(
      `[Notifications Routes] Solicitud PUT /notifications/${notificationId}/read por usuario ${requestingUserId}.`
    );

    try {
      if (!services.notificationService) {
        logger.error(
          " [Notifications Routes] notificationService no está disponible."
        );
        throw new Errores.ServiceUnavailableError(
          "El servicio de notificaciones no está disponible."
        );
      }

      // El servicio de notificaciones ya maneja la verificación de propiedad.
      const marked = await services.notificationService.markNotificationAsRead(
        notificationId,
        requestingUserId
      );

      if (!marked) {
        // Si el servicio devuelve false, significa que no se encontró o no se pudo actualizar.
        throw new Errores.NotFoundError(
          `Notificación con ID ${notificationId} no encontrada o no pertenece al usuario.`
        );
      }

      res.status(200).json({
        status: "success",
        message: "Notificación marcada como leída.",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        ` [Notifications Routes] Error al marcar notificación ${notificationId} como leída:`,
        error.stack || error.message || error
      );
      if (error instanceof Errores.AppError) {
        next(error);
      } else {
        next(
          new Errores.InternalServerError(
            `Error al marcar la notificación ${notificationId} como leída.`,
            error
          )
        );
      }
    }
  }
);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 * delete:
 * summary: Elimina una notificación.
 * description: Elimina una notificación específica del historial del usuario.
 * parameters:
 * - in: path
 * name: notificationId
 * schema:
 * type: string
 * required: true
 * description: ID de la notificación a eliminar.
 * example: "notif123"
 * responses:
 * 204:
 * description: Notificación eliminada exitosamente (No Content).
 * 400:
 * description: Solicitud inválida (ej. notificationId no proporcionado o formato incorrecto).
 * 403:
 * description: Prohibido (el usuario no es el propietario de la notificación).
 * 404:
 * description: Notificación no encontrada.
 * 500:
 * description: Error interno del servidor.
 */
router.delete(
  "/:notificationId",
  validateNotificationId,
  async (req, res, next) => {
    const requestingUserId = req.user?.id; // ID del usuario autenticado
    const notificationId = req.params.notificationId;

    logger.debug(
      `[Notifications Routes] Solicitud DELETE /notifications/${notificationId} por usuario ${requestingUserId}.`
    );

    try {
      if (!services.notificationService) {
        logger.error(
          " [Notifications Routes] notificationService no está disponible."
        );
        throw new Errores.ServiceUnavailableError(
          "El servicio de notificaciones no está disponible."
        );
      }

      // El servicio de notificaciones ya maneja la verificación de propiedad.
      const deleted = await services.notificationService.deleteNotification(
        notificationId,
        requestingUserId
      );

      if (!deleted) {
        // Si el servicio devuelve false, significa que no se encontró o no se pudo eliminar.
        throw new Errores.NotFoundError(
          `Notificación con ID ${notificationId} no encontrada o no pertenece al usuario.`
        );
      }

      res.status(204).send(); // 204 No Content para eliminación exitosa.
    } catch (error) {
      logger.error(
        ` [Notifications Routes] Error al eliminar notificación ${notificationId}:`,
        error.stack || error.message || error
      );
      if (error instanceof Errores.AppError) {
        next(error);
      } else {
        next(
          new Errores.InternalServerError(
            `Error al eliminar la notificación ${notificationId}.`,
            error
          )
        );
      }
    }
  }
);

// ---------------------------------------------------
//  Ruta Catch-all para 404 dentro de /api/notifications
// Este middleware DEBE ser el ÚLTIMO en este archivo de rutas.
// Si una solicitud llega a este router `/api/notifications` pero no coincide con ninguna de las rutas
// definidas anteriormente, se considera un 404 (Not Found) dentro de este contexto.
// ---------------------------------------------------
router.use((req, res, next) => {
  next(
    new Errores.NotFoundError(
      `La ruta de notificaciones solicitada (${req.method} ${req.originalUrl}) no fue encontrada en este módulo.`
    )
  );
});

//  Exportación del router para que pueda ser utilizado por 'app.js' (o 'server.js').
module.exports = router;
