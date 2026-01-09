// routes/api.js

/**
 * @file Rutas de API generales que requieren autenticación y limitación de tasa.
 * @description Define los endpoints para recursos genéricos y operaciones de usuario
 * que están protegidos y requieren roles específicos.
 * @module routes/api
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

//  Importa el objeto de servicios centralizado.
// Este objeto contiene instancias de todos tus servicios (userService, auditService, etc.).
const services = require(path.join(__dirname, "..", "services"));

//  Importa middlewares de validación específicos para las entradas de la API.
// Se asume que 'validationMiddleware.js' contiene funciones como 'validateUserCreation', etc.
// Se implementa un fallback para asegurar que la aplicación no falle si el middleware no se carga.
let validateUserCreation;
let validateUserUpdate;
let validateResourceCreation;
let validateQueryParams;
try {
  const validationMiddleware = require(path.join(
    __dirname,
    "..",
    "middleware",
    "validationMiddleware.js"
  ));
  validateUserCreation = validationMiddleware.validateUserCreation;
  validateUserUpdate = validationMiddleware.validateUserUpdate;
  validateResourceCreation = validationMiddleware.validateResourceCreation;
  validateQueryParams = validationMiddleware.validateQueryParams;
} catch (e) {
  logger.error(
    " [API Routes] No se pudo cargar validationMiddleware.js. Las validaciones en rutas API no funcionarán. Error: " +
      e.message
  );
  // Define middlewares dummy que simplemente pasan al siguiente para evitar que la app se detenga en desarrollo.
  validateUserCreation = (req, res, next) => next();
  validateUserUpdate = (req, res, next) => next();
  validateResourceCreation = (req, res, next) => next();
  validateQueryParams = (req, res, next) => next();
}

//  Importa un middleware para el Control de Acceso Basado en Roles (RBAC).
// Se asume que 'rbacMiddleware.js' exporta una función que toma un array de roles.
let checkRoles;
try {
  const rbacMiddlewareModule = require(path.join(
    __dirname,
    "..",
    "middleware",
    "rbacMiddleware.js"
  ));
  // Asume que rbacMiddleware.js exporta directamente la función checkRoles.
  // Si exporta un objeto con una propiedad checkRoles, se ajustaría aquí.
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
    " [API Routes] No se pudo cargar rbacMiddleware.js. Las rutas API no tendrán protección RBAC. Error: " +
      e.message
  );
  // Define un middleware dummy para permitir el acceso en desarrollo si RBAC falla.
  checkRoles = (requiredRoles) => (req, res, next) => {
    logger.warn(
      ` [API Routes] RBAC Middleware simulado: Acceso permitido para depuración. Roles requeridos: ${requiredRoles.join(
        ", "
      )}`
    );
    next();
  };
}

// NOTA IMPORTANTE sobre middlewares globales:
// Tal como se configuró en `app.js` (o `server.js`), este router ya está montado bajo `/api`
// y los middlewares `apiLimiter` (limitación de tasa) y `authenticateRequest` (autenticación)
// se aplican ANTES de que las solicitudes lleguen a las rutas definidas aquí.
// Esto significa que TODAS las rutas en este archivo ya estarán protegidas por:
// 1. Limitación de tasa (apiLimiter)
// 2. Autenticación (authenticateRequest)
// Si una ruta específica necesitara un comportamiento diferente (ej. sin autenticación),
// debería definirse antes de montar este router en `app.js` o usar un middleware específico.

// ---------------------------------------------------
//  RUTA GET: Ruta de ejemplo protegida
// Endpoint: GET /api/saludo-protegido
// Solo usuarios autenticados y no excediendo el límite de tasa pueden acceder.
// ---------------------------------------------------
router.get("/saludo-protegido", async (req, res, next) => {
  // logger.debug(`[API Route] Solicitud a /saludo-protegido por usuario: ${req.user?.id || 'Desconocido'}`);
  try {
    // `req.user` debería estar disponible aquí si `authenticateRequest`
    // agrega la información del usuario autenticado al objeto de solicitud.
    const userName = req.user ? req.user.username : "Usuario Autenticado";

    res.status(200).json({
      status: "success",
      message: `¡Hola, ${userName}! Accediste a una ruta protegida con éxito.`,
      data: {
        userId: req.user ? req.user.id : null,
        roles: req.user ? req.user.roles : [],
      },
    });
  } catch (err) {
    // Pasa cualquier error al middleware centralizado de manejo de errores.
    next(err);
  }
});

// ---------------------------------------------------
//  RUTA POST: Crear un nuevo recurso genérico
// Endpoint: POST /api/recursos
// Requiere autenticación y validación del cuerpo de la solicitud.
// ---------------------------------------------------
router.post(
  "/recursos",
  validateResourceCreation, // Middleware para validar el cuerpo de la solicitud.
  checkRoles(["admin", "editor"]), // Ejemplo: Solo 'admin' o 'editor' pueden crear recursos.
  async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    logger.debug(`[API Route] Solicitud POST /recursos por usuario: ${userId}`);
    try {
      const nuevoRecursoData = req.body;

      // Lógica para crear el recurso, delegando al servicio correspondiente.
      // Asumiendo un 'resourceService' que maneja recursos genéricos.
      const recursoCreado = await services.resourceService.createResource(
        nuevoRecursoData,
        userId
      );

      // Registrar acción de auditoría.
      if (services.auditService) {
        await services.auditService.logUserAction(
          userId,
          username,
          "CREATE_RESOURCE",
          { resourceId: recursoCreado.id, resourceType: "GenericResource" },
          req.ip,
          "GenericResource",
          recursoCreado.id,
          req
        );
      }

      res.status(201).json({
        status: "success",
        message: "Recurso creado exitosamente.",
        data: recursoCreado,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA GET: Obtener todos los recursos genéricos
// Endpoint: GET /api/recursos
// Soporta paginación, filtrado y ordenamiento.
// ---------------------------------------------------
router.get(
  "/recursos",
  validateQueryParams, // Middleware para validar parámetros de paginación/filtrado.
  async (req, res, next) => {
    const userId = req.user?.id;
    logger.debug(`[API Route] Solicitud GET /recursos por usuario: ${userId}`);
    try {
      // Extraer parámetros de consulta para paginación, filtrado, ordenamiento.
      const { limit, offset, filter, sort, searchText } = req.query;

      // Lógica para obtener recursos paginados/filtrados desde la base de datos.
      // Asumiendo que services.resourceService.getAllResources devuelve { count, rows }.
      const { count, rows: recursos } =
        await services.resourceService.getAllResources({
          limit: limit ? parseInt(limit, 10) : undefined,
          offset: offset ? parseInt(offset, 10) : undefined,
          filters: filter ? JSON.parse(filter) : undefined, // Asume que 'filter' es un JSON string.
          sortBy: sort ? sort.split(":")[0] : undefined,
          sortOrder: sort ? sort.split(":")[1] : undefined,
          searchText: searchText,
        });

      res.status(200).json({
        status: "success",
        message: "Recursos obtenidos exitosamente.",
        data: {
          total: count,
          page: limit && offset ? Math.floor(offset / limit) + 1 : 1, // Calcular la página actual.
          limit: limit ? parseInt(limit, 10) : recursos.length, // Usar el límite real o la longitud de los resultados.
          recursos,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA GET: Obtener un recurso genérico por ID
// Endpoint: GET /api/recursos/:id
// ---------------------------------------------------
router.get("/recursos/:id", async (req, res, next) => {
  const userId = req.user?.id;
  const recursoId = req.params.id;
  logger.debug(
    `[API Route] Solicitud GET /recursos/:id (${recursoId}) por usuario: ${userId}`
  );
  try {
    // Lógica para obtener un recurso específico.
    const recurso = await services.resourceService.getResourceById(recursoId);

    if (!recurso) {
      throw new Errores.NotFoundError(
        `Recurso con ID ${recursoId} no encontrado.`
      );
    }

    res.status(200).json({
      status: "success",
      message: "Recurso obtenido exitosamente.",
      data: recurso,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------
//  RUTA PUT: Actualizar completamente un recurso genérico por ID
// Endpoint: PUT /api/recursos/:id
// Requiere autenticación y validación del cuerpo de la solicitud.
// ---------------------------------------------------
router.put(
  "/recursos/:id",
  validateResourceCreation, // Reutilizamos la validación si el PUT requiere el cuerpo completo.
  checkRoles(["admin", "editor"]), // Ejemplo: Solo 'admin' o 'editor' pueden actualizar.
  async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const recursoId = req.params.id;
    logger.debug(
      `[API Route] Solicitud PUT /recursos/:id (${recursoId}) por usuario: ${userId}`
    );
    try {
      const datosActualizacion = req.body;

      if (!datosActualizacion || Object.keys(datosActualizacion).length === 0) {
        throw new Errores.BadRequestError(
          "El cuerpo de la solicitud no puede estar vacío para la actualización."
        );
      }

      // Lógica para actualizar el recurso.
      const recursoActualizado = await services.resourceService.updateResource(
        recursoId,
        datosActualizacion,
        userId
      );

      if (!recursoActualizado) {
        throw new Errores.NotFoundError(
          `Recurso con ID ${recursoId} no encontrado para actualizar.`
        );
      }

      // Registrar acción de auditoría.
      if (services.auditService) {
        await services.auditService.logUserAction(
          userId,
          username,
          "UPDATE_RESOURCE",
          {
            resourceId: recursoActualizado.id,
            resourceType: "GenericResource",
            changes: datosActualizacion,
          },
          req.ip,
          "GenericResource",
          recursoActualizado.id,
          req
        );
      }

      res.status(200).json({
        status: "success",
        message: "Recurso actualizado exitosamente.",
        data: recursoActualizado,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA PATCH: Actualizar parcialmente un recurso genérico por ID
// Endpoint: PATCH /api/recursos/:id
// Requiere autenticación y validación del cuerpo de la solicitud.
// ---------------------------------------------------
router.patch(
  "/recursos/:id",
  validateUserUpdate, // Middleware específico para validación de PATCH (cambios parciales).
  checkRoles(["admin", "editor"]),
  async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const recursoId = req.params.id;
    logger.debug(
      `[API Route] Solicitud PATCH /recursos/:id (${recursoId}) por usuario: ${userId}`
    );
    try {
      const datosParciales = req.body;

      if (!datosParciales || Object.keys(datosParciales).length === 0) {
        throw new Errores.BadRequestError(
          "El cuerpo de la solicitud no puede estar vacío para la actualización parcial."
        );
      }

      // Lógica para actualizar parcialmente el recurso.
      const recursoActualizado =
        await services.resourceService.updateResourcePartially(
          recursoId,
          datosParciales,
          userId
        );

      if (!recursoActualizado) {
        throw new Errores.NotFoundError(
          `Recurso con ID ${recursoId} no encontrado para actualización parcial.`
        );
      }

      // Registrar acción de auditoría.
      if (services.auditService) {
        await services.auditService.logUserAction(
          userId,
          username,
          "PATCH_RESOURCE",
          {
            resourceId: recursoActualizado.id,
            resourceType: "GenericResource",
            changes: datosParciales,
          },
          req.ip,
          "GenericResource",
          recursoActualizado.id,
          req
        );
      }

      res.status(200).json({
        status: "success",
        message: "Recurso actualizado parcialmente exitosamente.",
        data: recursoActualizado,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA DELETE: Eliminar un recurso genérico por ID
// Endpoint: DELETE /api/recursos/:id
// Requiere autenticación y roles específicos.
// ---------------------------------------------------
router.delete(
  "/recursos/:id",
  checkRoles(["admin"]), // Ejemplo: Solo 'admin' puede eliminar recursos.
  async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    const recursoId = req.params.id;
    logger.debug(
      `[API Route] Solicitud DELETE /recursos/:id (${recursoId}) por usuario: ${userId}`
    );
    try {
      // Lógica para eliminar el recurso.
      const eliminado = await services.resourceService.deleteResource(
        recursoId,
        userId
      );

      if (!eliminado) {
        throw new Errores.NotFoundError(
          `Recurso con ID ${recursoId} no encontrado para eliminar.`
        );
      }

      // Registrar acción de auditoría.
      if (services.auditService) {
        await services.auditService.logUserAction(
          userId,
          username,
          "DELETE_RESOURCE",
          { resourceId: recursoId, resourceType: "GenericResource" },
          req.ip,
          "GenericResource",
          recursoId,
          req
        );
      }

      res.status(204).send(); // 204 No Content para eliminación exitosa sin cuerpo de respuesta.
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA GET: Obtener todos los usuarios
// Endpoint: GET /api/usuarios
// Requiere autenticación y un rol específico (ej. 'admin').
// Soporta paginación, filtrado y ordenamiento.
// ---------------------------------------------------
router.get(
  "/usuarios",
  checkRoles(["admin"]), // Solo usuarios con rol 'admin' pueden listar todos los usuarios.
  validateQueryParams, // Middleware para validar parámetros de consulta (paginación, etc.).
  async (req, res, next) => {
    const userId = req.user?.id;
    logger.debug(`[API Route] Solicitud GET /usuarios por usuario: ${userId}`);
    try {
      const { limit, offset, filter, sort, searchText } = req.query;

      // Lógica para obtener usuarios paginados/filtrados desde el servicio.
      // Asumiendo que services.userService.getAllUsers devuelve { count, rows }.
      const { count, rows: usuarios } = await services.userService.getAllUsers({
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        filters: filter ? JSON.parse(filter) : undefined, // Asume que 'filter' es un JSON string.
        sortBy: sort ? sort.split(":")[0] : undefined,
        sortOrder: sort ? sort.split(":")[1] : undefined,
        searchText: searchText,
      });

      res.status(200).json({
        status: "success",
        message: "Usuarios obtenidos exitosamente.",
        data: {
          total: count,
          page: limit && offset ? Math.floor(offset / limit) + 1 : 1,
          limit: limit ? parseInt(limit, 10) : usuarios.length,
          usuarios,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA GET: Obtener un usuario por ID
// Endpoint: GET /api/usuarios/:id
// Requiere autenticación y puede requerir que el usuario sea 'admin' o el propio usuario.
// ---------------------------------------------------
router.get(
  "/usuarios/:id",
  // checkRoles(['admin', 'user']), // Ejemplo: 'admin' o el propio 'user' pueden ver su perfil.
  async (req, res, next) => {
    const requestingUserId = req.user?.id;
    const targetUserId = req.params.id;
    logger.debug(
      `[API Route] Solicitud GET /usuarios/:id (${targetUserId}) por usuario: ${requestingUserId}`
    );
    try {
      // Opcional: Asegurar que un usuario solo pueda ver su propio perfil a menos que sea admin.
      // if (!req.user.roles.includes('admin') && requestingUserId !== targetUserId) {
      //     throw new Errores.ForbiddenError("No tienes permiso para ver este perfil de usuario.");
      // }

      // Lógica para obtener un usuario específico desde el servicio.
      const usuario = await services.userService.getUserById(targetUserId);

      if (!usuario) {
        throw new Errores.NotFoundError(
          `Usuario con ID ${targetUserId} no encontrado.`
        );
      }

      res.status(200).json({
        status: "success",
        message: "Usuario obtenido exitosamente.",
        data: usuario,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA PUT: Actualizar un usuario por ID
// Endpoint: PUT /api/usuarios/:id
// Requiere autenticación y roles específicos.
// ---------------------------------------------------
router.put(
  "/usuarios/:id",
  validateUserUpdate, // Middleware para validar el cuerpo de la solicitud de actualización.
  checkRoles(["admin", "user"]), // Solo 'admin' o el propio 'user' pueden actualizar.
  async (req, res, next) => {
    const requestingUserId = req.user?.id;
    const requestingUsername = req.user?.username;
    const targetUserId = req.params.id;
    logger.debug(
      `[API Route] Solicitud PUT /usuarios/:id (${targetUserId}) por usuario: ${requestingUserId}`
    );
    try {
      const datosActualizacion = req.body;

      // Opcional: Asegurar que un usuario solo pueda actualizar su propio perfil a menos que sea admin.
      if (
        !req.user.roles.includes("admin") &&
        requestingUserId !== targetUserId
      ) {
        throw new Errores.ForbiddenError(
          "No tienes permiso para actualizar este perfil de usuario."
        );
      }

      const usuarioActualizado = await services.userService.updateUser(
        targetUserId,
        datosActualizacion
      );

      if (!usuarioActualizado) {
        throw new Errores.NotFoundError(
          `Usuario con ID ${targetUserId} no encontrado para actualizar.`
        );
      }

      // Registrar acción de auditoría.
      if (services.auditService) {
        await services.auditService.logUserAction(
          requestingUserId,
          requestingUsername,
          "UPDATE_USER",
          { targetUserId: usuarioActualizado.id, changes: datosActualizacion },
          req.ip,
          "User",
          usuarioActualizado.id,
          req
        );
      }

      res.status(200).json({
        status: "success",
        message: "Usuario actualizado exitosamente.",
        data: usuarioActualizado,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  RUTA DELETE: Eliminar un usuario por ID
// Endpoint: DELETE /api/usuarios/:id
// Requiere autenticación y un rol de 'admin'.
// ---------------------------------------------------
router.delete(
  "/usuarios/:id",
  checkRoles(["admin"]), // Solo 'admin' puede eliminar usuarios.
  async (req, res, next) => {
    const requestingUserId = req.user?.id;
    const requestingUsername = req.user?.username;
    const targetUserId = req.params.id;
    logger.debug(
      `[API Route] Solicitud DELETE /usuarios/:id (${targetUserId}) por usuario: ${requestingUserId}`
    );
    try {
      const eliminado = await services.userService.deleteUser(targetUserId);

      if (!eliminado) {
        throw new Errores.NotFoundError(
          `Usuario con ID ${targetUserId} no encontrado para eliminar.`
        );
      }

      // Registrar acción de auditoría.
      if (services.auditService) {
        await services.auditService.logUserAction(
          requestingUserId,
          requestingUsername,
          "DELETE_USER",
          { targetUserId: targetUserId },
          req.ip,
          "User",
          targetUserId,
          req
        );
      }

      res.status(204).send(); // 204 No Content para eliminación exitosa sin cuerpo de respuesta.
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------
//  Ruta Catch-all para 404 dentro de /api
// Este middleware DEBE ser el ÚLTIMO en este archivo de rutas.
// Si una solicitud llega a este router `/api` pero no coincide con ninguna de las rutas
// definidas anteriormente, se considera un 404 (Not Found) dentro de este contexto.
// ---------------------------------------------------
router.use((req, res, next) => {
  // Se lanza un error NotFoundError que será capturado por el middleware de errores centralizado.
  // Esto asegura que las respuestas 404 de la API sigan el formato de error estándar de tu aplicación.
  next(
    new Errores.NotFoundError(
      `La ruta API solicitada (${req.method} ${req.originalUrl}) no fue encontrada en este módulo.`
    )
  );
});

//  Exportación del router para que pueda ser utilizado por 'app.js' (o 'server.js').
module.exports = router;
