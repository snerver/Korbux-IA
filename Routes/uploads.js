// routes/uploads.js

/**
 * @file Rutas para la subida de archivos.
 * @description Define los endpoints para que los usuarios puedan subir archivos a la aplicación.
 * Estas rutas requieren autenticación y pueden requerir roles específicos.
 * @module routes/uploads
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

//  Importa el objeto de servicios centralizado.
const services = require(path.join(__dirname, "..", "services"));

//  Importa el middleware para el Control de Acceso Basado en Roles (RBAC).
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
    " [Uploads Routes] No se pudo cargar rbacMiddleware.js. Las rutas de subida no tendrán protección RBAC. Error: " +
      e.message
  );
  checkRoles = (requiredRoles) => (req, res, next) => {
    logger.warn(
      ` [Uploads Routes] RBAC Middleware simulado: Acceso permitido para depuración. Roles requeridos: ${requiredRoles.join(
        ", "
      )}`
    );
    next();
  };
}

//  Importa Multer para el manejo de subidas de archivos.
// Si no lo tienes instalado, ejecuta: npm install multer
let multer;
let upload; // Multer middleware instance
try {
  multer = require("multer");
  // Configuración de almacenamiento de Multer.
  // Para producción, considera usar un almacenamiento de cloud (ej. multer-s3, multer-google-storage).
  const storage = multer.memoryStorage(); // Almacenar el archivo en memoria como Buffer
  // const storage = multer.diskStorage({ // Almacenar en disco
  //     destination: function (req, file, cb) {
  //         const uploadDir = path.join(__dirname, '..', 'uploads');
  //         if (!fs.existsSync(uploadDir)) {
  //             fs.mkdirSync(uploadDir, { recursive: true });
  //         }
  //         cb(null, uploadDir);
  //     },
  //     filename: function (req, file, cb) {
  //         cb(null, Date.now() + '-' + file.originalname);
  //     }
  // });
  upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB por archivo.
    fileFilter: (req, file, cb) => {
      // Filtrar tipos de archivo permitidos.
      const allowedMimes = [
        "image/jpeg",
        "image/png",
        "application/pdf",
        "video/mp4",
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Errores.BadRequestError("Tipo de archivo no permitido."), false);
      }
    },
  });
  logger.info(
    "[Uploads Routes] Multer configurado para la subida de archivos."
  );
} catch (e) {
  logger.error(
    " [Uploads Routes] No se pudo cargar o configurar Multer. La subida de archivos no funcionará. Error: " +
      e.message
  );
  // Define un middleware dummy para evitar que la app se detenga.
  upload = {
    single: (fieldName) => (req, res, next) => {
      logger.warn(
        ` [Uploads Routes] Multer simulado: La subida de archivos para '${fieldName}' no está operativa.`
      );
      next(
        new Errores.ServiceUnavailableError(
          "El servicio de subida de archivos no está disponible."
        )
      );
    },
    array: (fieldName, maxCount) => (req, res, next) => {
      logger.warn(
        ` [Uploads Routes] Multer simulado: La subida de archivos para '${fieldName}' no está operativa.`
      );
      next(
        new Errores.ServiceUnavailableError(
          "El servicio de subida de archivos no está disponible."
        )
      );
    },
  };
}

/**
 * @swagger
 * /api/uploads/single:
 * post:
 * summary: Sube un solo archivo.
 * description: Permite a un usuario autenticado subir un único archivo al servidor.
 * security:
 * - BearerAuth: []
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * file:
 * type: string
 * format: binary
 * description: El archivo a subir.
 * responses:
 * 200:
 * description: Archivo subido exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Archivo subido exitosamente." }
 * data:
 * type: object
 * properties:
 * fileName: { type: string, example: "imagen_ejemplo.jpg" }
 * filePath: { type: string, example: "/uploads/imagen_ejemplo.jpg" }
 * fileUrl: { type: string, example: "https://cdn.example.com/imagen_ejemplo.jpg" }
 * 400:
 * description: Solicitud inválida (ej. archivo no proporcionado, tipo de archivo no permitido, tamaño excedido).
 * 401:
 * description: No autorizado.
 * 403:
 * description: Prohibido (el usuario no tiene los permisos necesarios).
 * 500:
 * description: Error interno del servidor.
 */
router.post(
  "/single",
  checkRoles(["user", "admin"]),
  upload.single("file"),
  async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    logger.debug(
      `[Uploads Routes] Solicitud POST /uploads/single por usuario ${userId}.`
    );

    try {
      if (!req.file) {
        throw new Errores.BadRequestError(
          "No se proporcionó ningún archivo para subir."
        );
      }
      if (!services.storageService) {
        logger.error(" [Uploads Routes] storageService no está disponible.");
        throw new Errores.ServiceUnavailableError(
          "El servicio de almacenamiento no está disponible. Inténtalo de nuevo más tarde."
        );
      }

      // Asume que storageService.uploadFile maneja el Buffer del archivo y devuelve metadatos.
      const fileMetadata = await services.storageService.uploadFile(
        req.file,
        userId
      );

      // Registrar acción de auditoría.
      if (services.auditService) {
        await services.auditService.logUserAction(
          userId,
          username,
          "FILE_UPLOAD",
          {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            storedPath: fileMetadata.filePath,
          },
          req.ip,
          "File",
          fileMetadata.id || "N/A", // Si storageService devuelve un ID para el archivo.
          req
        );
        logger.debug(
          `[Uploads Routes] Subida de archivo auditada para usuario ${userId}.`
        );
      }

      res.status(200).json({
        status: "success",
        message: "Archivo subido exitosamente.",
        data: fileMetadata, // Debería contener filePath, fileUrl, etc.
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        ` [Uploads Routes] Error al subir archivo para usuario ${userId}:`,
        error.stack || error.message || error
      );
      if (error instanceof Errores.AppError) {
        next(error);
      } else if (error instanceof multer.MulterError) {
        // Manejo específico de errores de Multer.
        if (error.code === "LIMIT_FILE_SIZE") {
          next(
            new Errores.BadRequestError(
              "El archivo es demasiado grande. Tamaño máximo permitido: 10MB."
            )
          );
        } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
          next(
            new Errores.BadRequestError(
              'Campo de archivo inesperado. Asegúrate de que el nombre del campo sea "file".'
            )
          );
        } else {
          next(
            new Errores.InternalServerError(
              `Error de subida de archivo: ${error.message}`,
              error
            )
          );
        }
      } else {
        next(
          new Errores.InternalServerError(`Error al subir el archivo.`, error)
        );
      }
    }
  }
);

/**
 * @swagger
 * /api/uploads/multiple:
 * post:
 * summary: Sube múltiples archivos.
 * description: Permite a un usuario autenticado subir múltiples archivos al servidor.
 * security:
 * - BearerAuth: []
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * files:
 * type: array
 * items:
 * type: string
 * format: binary
 * description: Los archivos a subir.
 * responses:
 * 200:
 * description: Archivos subidos exitosamente.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status: { type: string, example: "success" }
 * message: { type: string, example: "Archivos subidos exitosamente." }
 * data:
 * type: array
 * items:
 * type: object
 * properties:
 * fileName: { type: string }
 * filePath: { type: string }
 * fileUrl: { type: string }
 * 400:
 * description: Solicitud inválida.
 * 401:
 * description: No autorizado.
 * 403:
 * description: Prohibido.
 * 500:
 * description: Error interno del servidor.
 */
router.post(
  "/multiple",
  checkRoles(["user", "admin"]),
  upload.array("files", 10),
  async (req, res, next) => {
    const userId = req.user?.id;
    const username = req.user?.username;
    logger.debug(
      `[Uploads Routes] Solicitud POST /uploads/multiple por usuario ${userId}.`
    );

    try {
      if (!req.files || req.files.length === 0) {
        throw new Errores.BadRequestError(
          "No se proporcionaron archivos para subir."
        );
      }
      if (!services.storageService) {
        logger.error(" [Uploads Routes] storageService no está disponible.");
        throw new Errores.ServiceUnavailableError(
          "El servicio de almacenamiento no está disponible. Inténtalo de nuevo más tarde."
        );
      }

      const uploadedFilesMetadata = [];
      for (const file of req.files) {
        const fileMetadata = await services.storageService.uploadFile(
          file,
          userId
        );
        uploadedFilesMetadata.push(fileMetadata);

        // Registrar acción de auditoría para cada archivo.
        if (services.auditService) {
          await services.auditService.logUserAction(
            userId,
            username,
            "MULTIPLE_FILE_UPLOAD",
            {
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              storedPath: fileMetadata.filePath,
            },
            req.ip,
            "File",
            fileMetadata.id || "N/A",
            req
          );
        }
      }
      logger.debug(
        `[Uploads Routes] Subida de múltiples archivos auditada para usuario ${userId}.`
      );

      res.status(200).json({
        status: "success",
        message: "Archivos subidos exitosamente.",
        data: uploadedFilesMetadata,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        ` [Uploads Routes] Error al subir múltiples archivos para usuario ${userId}:`,
        error.stack || error.message || error
      );
      if (error instanceof Errores.AppError) {
        next(error);
      } else if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_COUNT") {
          next(
            new Errores.BadRequestError(
              "Demasiados archivos. Se permite un máximo de 10 archivos."
            )
          );
        } else if (error.code === "LIMIT_FILE_SIZE") {
          next(
            new Errores.BadRequestError(
              "Uno o más archivos son demasiado grandes. Tamaño máximo permitido: 10MB por archivo."
            )
          );
        } else {
          next(
            new Errores.InternalServerError(
              `Error de subida de archivos: ${error.message}`,
              error
            )
          );
        }
      } else {
        next(
          new Errores.InternalServerError(`Error al subir los archivos.`, error)
        );
      }
    }
  }
);

// ---------------------------------------------------
//  Ruta Catch-all para 404 dentro de /api/uploads
// Este middleware DEBE ser el ÚLTIMO en este archivo de rutas.
// Si una solicitud llega a este router `/api/uploads` pero no coincide con ninguna de las rutas
// definidas anteriormente, se considera un 404 (Not Found) dentro de este contexto.
// ---------------------------------------------------
router.use((req, res, next) => {
  next(
    new Errores.NotFoundError(
      `La ruta de subida solicitada (${req.method} ${req.originalUrl}) no fue encontrada en este módulo.`
    )
  );
});

//  Exportación del router para que pueda ser utilizado por 'app.js' (o 'server.js').
module.exports = router;
