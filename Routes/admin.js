// routes/admin.js

/**
 * @file Rutas para funcionalidades de administración de la aplicación.
 * @description Define los endpoints para la gestión de usuarios, auditoría y generación de informes,
 * accesibles solo por usuarios con el rol de administrador.
 * @module routes/admin
 */

const express = require("express");
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa los servicios necesarios para las operaciones de administración.
const services = require(path.join(__dirname, "..", "services")); // Importa el objeto de servicios centralizado

// Importa el middleware de control de acceso basado en roles (RBAC).
// Asume que tienes un archivo middleware/rbacMiddleware.js que exporta una función.
let rbacMiddleware;
try {
  rbacMiddleware = require(path.join(
    __dirname,
    "..",
    "middleware",
    "rbacMiddleware.js"
  ));
  if (typeof rbacMiddleware !== "function") {
    throw new Error("rbacMiddleware.js no exporta una función válida.");
  }
} catch (e) {
  logger.error(
    " [Admin Routes] No se pudo cargar rbacMiddleware.js. Las rutas de administración no tendrán protección RBAC.",
    e
  );
  // Define un middleware dummy para evitar errores si el real no se carga.
  rbacMiddleware = (requiredRoles) => (req, res, next) => {
    logger.warn(
      ` [Admin Routes] RBAC Middleware simulado: Acceso permitido para depuración. Roles requeridos: ${requiredRoles.join(
        ", "
      )}`
    );
    next();
  };
}

const router = express.Router();

// Middleware para aplicar el control de acceso basado en roles a todas las rutas de administración.
// Solo permite el acceso a usuarios con el rol 'admin'.
router.use(rbacMiddleware(["admin"]));

/**
 * @route GET /api/admin/users
 * @description Obtiene una lista de todos los usuarios con opciones de paginación y filtrado.
 * @access Admin
 * @param {object} req.query - Parámetros de consulta para filtrado, paginación y ordenación.
 * @param {string} [req.query.limit] - Límite de resultados por página.
 * @param {string} [req.query.offset] - Offset para paginación.
 * @param {string} [req.query.sortBy] - Campo para ordenar los resultados.
 * @param {string} [req.query.sortOrder] - Orden de clasificación ('ASC' o 'DESC').
 * @param {string} [req.query.searchText] - Texto para búsqueda general en campos de usuario.
 * @param {string} [req.query.role] - Filtrar por rol de usuario.
 * @returns {Array<object>} 200 - Lista de usuarios.
 * @throws {Errores.InternalServerError} 500 - Si ocurre un error en el servidor.
 */
router.get("/users", async (req, res, next) => {
  try {
    // Extraer opciones de consulta. Convertir a número si es necesario.
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset
      ? parseInt(req.query.offset, 10)
      : undefined;
    const sortBy = req.query.sortBy;
    const sortOrder = req.query.sortOrder;
    const searchText = req.query.searchText;
    const filters = {};
    if (req.query.role) filters.role = req.query.role;

    logger.debug(
      `[Admin Routes] Solicitud de lista de usuarios. Filtros: ${JSON.stringify(
        filters
      )}, Búsqueda: ${searchText}`
    );

    const users = await services.userService.getAllUsers({
      limit,
      offset,
      sortBy,
      sortOrder,
      filters,
      searchText,
    });

    res.status(200).json({
      status: "success",
      message: "Usuarios obtenidos exitosamente.",
      data: users,
      total: users.length, // En un caso real, se necesitaría un count separado para el total sin límite/offset.
    });
  } catch (error) {
    logger.error(
      " [Admin Routes] Error al obtener lista de usuarios:",
      error
    );
    next(error); // Pasar el error al middleware de manejo de errores.
  }
});

/**
 * @route GET /api/admin/users/:id
 * @description Obtiene los detalles de un usuario específico por su ID.
 * @access Admin
 * @param {string} req.params.id - ID del usuario.
 * @returns {object} 200 - Objeto del usuario.
 * @throws {Errores.NotFoundError} 404 - Si el usuario no se encuentra.
 * @throws {Errores.BadRequestError} 400 - Si el ID es inválido.
 * @throws {Errores.InternalServerError} 500 - Si ocurre un error en el servidor.
 */
router.get("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;
    logger.debug(`[Admin Routes] Solicitud de usuario por ID: ${userId}`);

    const user = await services.userService.getUserById(userId);

    if (!user) {
      throw new Errores.NotFoundError(
        `Usuario con ID ${userId} no encontrado.`
      );
    }

    res.status(200).json({
      status: "success",
      message: "Usuario obtenido exitosamente.",
      data: user,
    });
  } catch (error) {
    logger.error(
      ` [Admin Routes] Error al obtener usuario ${req.params.id}:`,
      error
    );
    next(error);
  }
});

/**
 * @route PUT /api/admin/users/:id
 * @description Actualiza la información de un usuario existente por su ID.
 * @access Admin
 * @param {string} req.params.id - ID del usuario a actualizar.
 * @param {object} req.body - Datos a actualizar del usuario (ej. username, email, role, isActive).
 * @returns {object} 200 - Objeto del usuario actualizado.
 * @throws {Errores.BadRequestError} 400 - Si los datos son inválidos.
 * @throws {Errores.NotFoundError} 404 - Si el usuario no se encuentra.
 * @throws {Errores.InternalServerError} 500 - Si ocurre un error en el servidor.
 */
router.put("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;
    logger.debug(
      `[Admin Routes] Solicitud de actualización para usuario ID: ${userId}, Datos: ${JSON.stringify(
        updateData
      )}`
    );

    // Aquí podrías añadir validación de esquema para updateData si es necesario.
    // Por ejemplo, asegurar que 'role' sea un valor permitido.

    const updatedUser = await services.userService.updateUser(
      userId,
      updateData
    );

    res.status(200).json({
      status: "success",
      message: "Usuario actualizado exitosamente.",
      data: updatedUser,
    });
  } catch (error) {
    logger.error(
      ` [Admin Routes] Error al actualizar usuario ${req.params.id}:`,
      error
    );
    next(error);
  }
});

/**
 * @route DELETE /api/admin/users/:id
 * @description Elimina un usuario por su ID.
 * @access Admin
 * @param {string} req.params.id - ID del usuario a eliminar.
 * @returns {object} 204 - No Content si la eliminación fue exitosa.
 * @throws {Errores.BadRequestError} 400 - Si el ID es inválido.
 * @throws {Errores.NotFoundError} 404 - Si el usuario no se encuentra.
 * @throws {Errores.InternalServerError} 500 - Si ocurre un error en el servidor.
 */
router.delete("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;
    logger.debug(
      `[Admin Routes] Solicitud de eliminación para usuario ID: ${userId}`
    );

    const deleted = await services.userService.deleteUser(userId);

    if (!deleted) {
      throw new Errores.NotFoundError(
        `Usuario con ID ${userId} no encontrado para eliminar.`
      );
    }

    res.status(204).send(); // 204 No Content para eliminación exitosa.
  } catch (error) {
    logger.error(
      ` [Admin Routes] Error al eliminar usuario ${req.params.id}:`,
      error
    );
    next(error);
  }
});

/**
 * @route GET /api/admin/audit-logs
 * @description Obtiene logs de auditoría con opciones de paginación y filtrado.
 * @access Admin
 * @param {object} req.query - Parámetros de consulta para filtrado, paginación y ordenación.
 * @param {string} [req.query.limit] - Límite de resultados.
 * @param {string} [req.query.offset] - Offset.
 * @param {string} [req.query.eventType] - Filtrar por tipo de evento.
 * @param {string} [req.query.userId] - Filtrar por ID de usuario.
 * @param {string} [req.query.startDate] - Fecha de inicio (ISO string).
 * @param {string} [req.query.endDate] - Fecha de fin (ISO string).
 * @returns {Array<object>} 200 - Lista de logs de auditoría.
 * @throws {Errores.InternalServerError} 500 - Si ocurre un error en el servidor.
 */
router.get("/audit-logs", async (req, res, next) => {
  try {
    const options = {
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : undefined,
      eventType: req.query.eventType,
      userId: req.query.userId,
      startDate: req.query.startDate
        ? new Date(req.query.startDate)
        : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };
    logger.debug(
      `[Admin Routes] Solicitud de logs de auditoría. Opciones: ${JSON.stringify(
        options
      )}`
    );

    const logs = await services.auditService.getAuditLogs(options);

    res.status(200).json({
      status: "success",
      message: "Logs de auditoría obtenidos exitosamente.",
      data: logs,
      total: logs.length, // En un caso real, se necesitaría un count separado para el total.
    });
  } catch (error) {
    logger.error(
      " [Admin Routes] Error al obtener logs de auditoría:",
      error
    );
    next(error);
  }
});

/**
 * @route POST /api/admin/reports/generate
 * @description Genera un informe específico.
 * @access Admin
 * @param {string} req.body.reportType - Tipo de informe a generar (ej. 'user_activity', 'chat_usage').
 * @param {object} [req.body.options] - Opciones para la generación del informe (ej. startDate, endDate).
 * @returns {object} 200 - Objeto del informe generado.
 * @throws {Errores.BadRequestError} 400 - Si el tipo de informe es inválido o faltan opciones.
 * @throws {Errores.InternalServerError} 500 - Si ocurre un error en la generación del informe.
 */
router.post("/reports/generate", async (req, res, next) => {
  try {
    const { reportType, options } = req.body;
    logger.debug(
      `[Admin Routes] Solicitud de generación de informe: ${reportType}, Opciones: ${JSON.stringify(
        options
      )}`
    );

    const report = await services.reportService.generateReport(
      reportType,
      options
    );

    res.status(200).json({
      status: "success",
      message: `Informe '${report.reportName}' generado exitosamente.`,
      data: report,
    });
  } catch (error) {
    logger.error(" [Admin Routes] Error al generar informe:", error);
    next(error);
  }
});

/**
 * @route POST /api/admin/reports/send-email
 * @description Envía un informe generado por correo electrónico.
 * @access Admin
 * @param {string} req.body.toEmail - Correo electrónico del destinatario.
 * @param {object} req.body.report - Objeto del informe a enviar (generado previamente por /reports/generate).
 * @param {string} [req.body.username] - Nombre de usuario para personalizar el correo.
 * @returns {object} 200 - Confirmación de envío de correo.
 * @throws {Errores.BadRequestError} 400 - Si faltan parámetros o el informe es inválido.
 * @throws {Errores.InternalServerError} 500 - Si ocurre un error al enviar el correo.
 */
router.post("/reports/send-email", async (req, res, next) => {
  try {
    const { toEmail, report, username } = req.body;
    logger.debug(
      `[Admin Routes] Solicitud de envío de informe por email a: ${toEmail}, Informe: ${report?.reportName}`
    );

    if (!toEmail || !report) {
      throw new Errores.BadRequestError(
        "Correo del destinatario y objeto de informe son obligatorios."
      );
    }

    const emailInfo = await services.reportService.sendReportByEmail(
      toEmail,
      report,
      username
    );

    res.status(200).json({
      status: "success",
      message: `Informe '${report.reportName}' enviado por correo a ${toEmail}.`,
      data: { messageId: emailInfo?.messageId || "N/A" },
    });
  } catch (error) {
    logger.error(
      " [Admin Routes] Error al enviar informe por correo:",
      error
    );
    next(error);
  }
});

module.exports = router;
