// routes/profile.js

/**
 * @file Rutas para la gestión del perfil de usuario.
 * @description Define los endpoints para obtener y actualizar el perfil del usuario autenticado.
 * Estas rutas requieren autenticación.
 * @module routes/profile
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

//  Importa el objeto de servicios centralizado.
const services = require(path.join(__dirname, "..", "services"));

//  Importa middlewares de validación específicos.
let validateUserUpdate;
try {
  const validationMiddleware = require(path.join(
    __dirname,
    "..",
    "middleware",
    "validationMiddleware.js"
  ));
  validateUserUpdate = validationMiddleware.validateUserUpdate; // Para PUT/PATCH /profile/me
} catch (e) {
  logger.error(
    " [Profile Routes] No se pudo cargar validationMiddleware.js. Las validaciones en rutas de perfil no funcionarán. Error: " +
      e.message
  );
  validateUserUpdate = (req, res, next) => next();
}

// 🔹 Importa un middleware para el Control de Acceso Basado en Roles (RBAC).
// Aunque estas rutas son principalmente para el propio usuario, RBAC puede ser útil
// si se decide permitir a los administradores ver/editar perfiles directamente aquí.
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
    " [Profile Routes] No se pudo cargar rbacMiddleware.js. Las rutas de perfil no tendrán protección RBAC. Error: " +
      e.message
  );
  checkRoles = (requiredRoles) => (req, res, next) => {
    logger.warn(
      ` [Profile Routes] RBAC Middleware simulado: Acceso permitido para depuración. Roles requeridos: ${requiredRoles.join(
        ", "
      )}`
    );
    next();
  };
}

/**
 * @swagger
 * /api/profile/me:
 * get:
 * summary: Obtiene el perfil del usuario autenticado.
 * description: Recupera los detalles del perfil del usuario que ha iniciado sesión.
 * responses:
 * 200:
 * description: Perfil de usuario obtenido exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Perfil de usuario obtenido exitosamente." }
 * data:
 * $ref: '#/components/schemas/User'
 * 401:
 * description: No autorizado (si el usuario no está autenticado).
 * 404:
 * description: Usuario no encontrado (aunque debería estar autenticado).
 * 500:
 * description: Error interno del servidor.
 */
router.get("/me", async (req, res, next) => {
  const userId = req.user?.id; // ID del usuario autenticado (proporcionado por authenticateRequest middleware)
  logger.debug(
    `[Profile Routes] Solicitud GET /profile/me por usuario: ${userId}.`
  );

  try {
    if (!userId) {
      // Esto no debería ocurrir si authenticateRequest funciona correctamente.
      throw new Errores.UnauthorizedError("Usuario no autenticado.");
    }
    if (!services.userService) {
      logger.error(" [Profile Routes] userService no está disponible.");
      throw new Errores.ServiceUnavailableError(
        "El servicio de usuario no está disponible. Inténtalo de nuevo más tarde."
      );
    }

    const userProfile = await services.userService.getUserById(userId);

    if (!userProfile) {
      // Esto podría indicar un usuario eliminado después de la autenticación, o un error de DB.
      logger.error(
        ` [Profile Routes] Perfil de usuario ${userId} no encontrado después de la autenticación.`
      );
      throw new Errores.NotFoundError(
        `Perfil de usuario ${userId} no encontrado.`
      );
    }

    res.status(200).json({
      status: "success",
      message: "Perfil de usuario obtenido exitosamente.",
      data: userProfile,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      ` [Profile Routes] Error al obtener perfil para usuario ${userId}:`,
      error.stack || error.message || error
    );
    if (error instanceof Errores.AppError) {
      next(error);
    } else {
      next(
        new Errores.InternalServerError(
          `Error al obtener el perfil del usuario ${userId}.`,
          error
        )
      );
    }
  }
});

/**
 * @swagger
 * /api/profile/me:
 * put:
 * summary: Actualiza completamente el perfil del usuario autenticado.
 * description: Permite al usuario actualizar sus propios datos de perfil (ej. nombre de usuario, email).
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/UserUpdate' # Asume un esquema para la actualización de usuario
 * responses:
 * 200:
 * description: Perfil de usuario actualizado exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Perfil de usuario actualizado exitosamente." }
 * data:
 * $ref: '#/components/schemas/User'
 * 400:
 * description: Solicitud inválida (ej. datos incompletos o formato incorrecto).
 * 401:
 * description: No autorizado.
 * 404:
 * description: Usuario no encontrado.
 * 500:
 * description: Error interno del servidor.
 */
router.put("/me", validateUserUpdate, async (req, res, next) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const updateData = req.body;
  logger.debug(
    `[Profile Routes] Solicitud PUT /profile/me por usuario ${userId}. Datos: ${JSON.stringify(
      updateData
    )}`
  );

  try {
    if (!userId) {
      throw new Errores.UnauthorizedError("Usuario no autenticado.");
    }
    if (!services.userService) {
      logger.error(" [Profile Routes] userService no está disponible.");
      throw new Errores.ServiceUnavailableError(
        "El servicio de usuario no está disponible."
      );
    }

    // El servicio de usuario ya maneja la lógica de actualización y validación de unicidad de email.
    const updatedUser = await services.userService.updateUser(
      userId,
      updateData
    );

    if (!updatedUser) {
      // Esto podría indicar que el usuario fue eliminado justo antes de la actualización.
      logger.error(
        ` [Profile Routes] No se pudo actualizar el perfil de usuario ${userId}: usuario no encontrado.`
      );
      throw new Errores.NotFoundError(
        `Usuario con ID ${userId} no encontrado para actualizar.`
      );
    }

    // Registrar acción de auditoría.
    if (services.auditService) {
      await services.auditService.logUserAction(
        userId,
        username,
        "UPDATE_PROFILE",
        { changes: updateData },
        req.ip,
        "User",
        userId,
        req
      );
      logger.debug(
        `[Profile Routes] Actualización de perfil auditada para usuario ${userId}.`
      );
    }

    res.status(200).json({
      status: "success",
      message: "Perfil de usuario actualizado exitosamente.",
      data: updatedUser,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      ` [Profile Routes] Error al actualizar perfil para usuario ${userId}:`,
      error.stack || error.message || error
    );
    if (error instanceof Errores.AppError) {
      next(error);
    } else {
      next(
        new Errores.InternalServerError(
          `Error al actualizar el perfil del usuario ${userId}.`,
          error
        )
      );
    }
  }
});

/**
 * @swagger
 * /api/profile/me:
 * patch:
 * summary: Actualiza parcialmente el perfil del usuario autenticado.
 * description: Permite al usuario actualizar algunos de sus datos de perfil.
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/UserPartialUpdate' # Asume un esquema para la actualización parcial
 * responses:
 * 200:
 * description: Perfil de usuario actualizado parcialmente exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Perfil de usuario actualizado parcialmente exitosamente." }
 * data:
 * $ref: '#/components/schemas/User'
 * 400:
 * description: Solicitud inválida.
 * 401:
 * description: No autorizado.
 * 404:
 * description: Usuario no encontrado.
 * 500:
 * description: Error interno del servidor.
 */
router.patch("/me", validateUserUpdate, async (req, res, next) => {
  const userId = req.user?.id;
  const username = req.user?.username;
  const updateData = req.body;
  logger.debug(
    `[Profile Routes] Solicitud PATCH /profile/me por usuario ${userId}. Datos: ${JSON.stringify(
      updateData
    )}`
  );

  try {
    if (!userId) {
      throw new Errores.UnauthorizedError("Usuario no autenticado.");
    }
    if (!services.userService) {
      logger.error(" [Profile Routes] userService no está disponible.");
      throw new Errores.ServiceUnavailableError(
        "El servicio de usuario no está disponible."
      );
    }

    // El servicio de usuario ya maneja la lógica de actualización y validación.
    const updatedUser = await services.userService.updateUser(
      userId,
      updateData
    );

    if (!updatedUser) {
      logger.error(
        ` [Profile Routes] No se pudo actualizar parcialmente el perfil de usuario ${userId}: usuario no encontrado.`
      );
      throw new Errores.NotFoundError(
        `Usuario con ID ${userId} no encontrado para actualizar.`
      );
    }

    // Registrar acción de auditoría.
    if (services.auditService) {
      await services.auditService.logUserAction(
        userId,
        username,
        "PARTIAL_UPDATE_PROFILE",
        { changes: updateData },
        req.ip,
        "User",
        userId,
        req
      );
      logger.debug(
        `[Profile Routes] Actualización parcial de perfil auditada para usuario ${userId}.`
      );
    }

    res.status(200).json({
      status: "success",
      message: "Perfil de usuario actualizado parcialmente exitosamente.",
      data: updatedUser,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      ` [Profile Routes] Error al actualizar parcialmente perfil para usuario ${userId}:`,
      error.stack || error.message || error
    );
    if (error instanceof Errores.AppError) {
      next(error);
    } else {
      next(
        new Errores.InternalServerError(
          `Error al actualizar parcialmente el perfil del usuario ${userId}.`,
          error
        )
      );
    }
  }
});

// Opcional: Ruta para que un administrador pueda ver el perfil de cualquier usuario.
// Esto podría duplicar funcionalidad con /api/admin/users/:id, pero podría tener un propósito diferente.
/**
 * @swagger
 * /api/profile/{userId}:
 * get:
 * summary: Obtiene el perfil de cualquier usuario por su ID (solo para administradores).
 * description: Permite a un administrador recuperar los detalles del perfil de cualquier usuario.
 * parameters:
 * - in: path
 * name: userId
 * schema:
 * type: string
 * required: true
 * description: ID del usuario cuyo perfil se desea obtener.
 * example: "anotherUser456"
 * responses:
 * 200:
 * description: Perfil de usuario obtenido exitosamente.
 * 401:
 * description: No autorizado.
 * 403:
 * description: Prohibido (el usuario no tiene rol de administrador).
 * 404:
 * description: Usuario no encontrado.
 * 500:
 * description: Error interno del servidor.
 */
router.get("/:userId", checkRoles(["admin"]), async (req, res, next) => {
  const requestingUserId = req.user?.id;
  const targetUserId = req.params.userId;
  logger.debug(
    `[Profile Routes] Solicitud GET /profile/${targetUserId} por admin ${requestingUserId}.`
  );

  try {
    if (!services.userService) {
      logger.error(" [Profile Routes] userService no está disponible.");
      throw new Errores.ServiceUnavailableError(
        "El servicio de usuario no está disponible."
      );
    }

    const userProfile = await services.userService.getUserById(targetUserId);

    if (!userProfile) {
      throw new Errores.NotFoundError(
        `Usuario con ID ${targetUserId} no encontrado.`
      );
    }

    res.status(200).json({
      status: "success",
      message: "Perfil de usuario obtenido exitosamente.",
      data: userProfile,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      ` [Profile Routes] Error al obtener perfil para usuario ${targetUserId} (admin request):`,
      error.stack || error.message || error
    );
    if (error instanceof Errores.AppError) {
      next(error);
    } else {
      next(
        new Errores.InternalServerError(
          `Error al obtener el perfil del usuario ${targetUserId}.`,
          error
        )
      );
    }
  }
});

// ---------------------------------------------------
//  Ruta Catch-all para 404 dentro de /api/profile
// Este middleware DEBE ser el ÚLTIMO en este archivo de rutas.
// Si una solicitud llega a este router `/api/profile` pero no coincide con ninguna de las rutas
// definidas anteriormente, se considera un 404 (Not Found) dentro de este contexto.
// ---------------------------------------------------
router.use((req, res, next) => {
  next(
    new Errores.NotFoundError(
      `La ruta de perfil solicitada (${req.method} ${req.originalUrl}) no fue encontrada en este módulo.`
    )
  );
});

//  Exportación del router para que pueda ser utilizado por 'app.js' (o 'server.js').
module.exports = router;
