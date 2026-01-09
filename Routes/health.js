// routes/health.js

/**
 * @file Rutas para la verificación de estado (health check) de la aplicación.
 * @description Define un endpoint para comprobar la salud operativa del servidor y sus dependencias críticas.
 * @module routes/health
 */

const express = require("express");
const router = express.Router();
const path = require("path");

const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa las instancias de los servicios críticos para verificar su estado.
let sequelizeInstance;
try {
  sequelizeInstance = require(path.join(
    __dirname,
    "..",
    "config",
    "database.js"
  )); // Asume que database.js exporta la instancia de Sequelize
} catch (e) {
  logger.error(
    " [Health Routes] No se pudo cargar la instancia de Sequelize desde config/database.js. La verificación de la DB no funcionará.",
    e
  );
  sequelizeInstance = null;
}

let cacheService;
try {
  cacheService = require(path.join(
    __dirname,
    "..",
    "services",
    "cacheService.js"
  ));
} catch (e) {
  logger.error(
    " [Health Routes] No se pudo cargar cacheService.js. La verificación de la caché no funcionará.",
    e
  );
  cacheService = null;
}

/**
 * @route GET /health
 * @description Realiza una verificación de estado de la aplicación y sus dependencias.
 * Retorna el estado 'UP' si todos los componentes críticos están operativos.
 * @access Public (generalmente)
 * @returns {object} 200 - Objeto con el estado general y el estado de cada componente.
 * @returns {object} 503 - Si alguna dependencia crítica falla.
 */
router.get("/health", async (req, res, next) => {
  logger.debug("[Health Routes] Solicitud de verificación de estado recibida.");

  const healthStatus = {
    status: "UP", // Estado general inicial
    timestamp: new Date().toISOString(),
    dependencies: {
      application: {
        status: "UP",
        message: "La aplicación Express está en ejecución.",
      },
    },
  };

  // 1. Verificar estado de la base de datos (Sequelize)
  if (sequelizeInstance) {
    try {
      await sequelizeInstance.authenticate();
      healthStatus.dependencies.database = {
        status: "UP",
        message: "Conexión a la base de datos exitosa.",
      };
    } catch (error) {
      healthStatus.dependencies.database = {
        status: "DOWN",
        message: `Fallo en la conexión a la base de datos: ${error.message}`,
      };
      healthStatus.status = "DEGRADED"; // O 'DOWN' si la DB es crítica para el funcionamiento.
      logger.error(
        " [Health Check] La base de datos está DOWN:",
        error.message
      );
    }
  } else {
    healthStatus.dependencies.database = {
      status: "UNKNOWN",
      message: "La instancia de Sequelize no se cargó o no está disponible.",
    };
    healthStatus.status = "DEGRADED";
  }

  // 2. Verificar estado del servicio de caché (Redis)
  if (cacheService && typeof cacheService.isServiceReady === "function") {
    if (cacheService.isServiceReady()) {
      // Intentar una operación simple para confirmar que Redis responde.
      try {
        await cacheService.set("health_check_key", "test_value", 10); // Establecer con TTL de 10s
        const testValue = await cacheService.get("health_check_key");
        if (testValue === "test_value") {
          healthStatus.dependencies.cache = {
            status: "UP",
            message: "Conexión a la caché (Redis) exitosa.",
          };
        } else {
          healthStatus.dependencies.cache = {
            status: "DEGRADED",
            message: "La caché (Redis) no respondió como se esperaba.",
          };
          healthStatus.status = "DEGRADED";
        }
        await cacheService.del("health_check_key"); // Limpiar la clave de prueba
      } catch (error) {
        healthStatus.dependencies.cache = {
          status: "DOWN",
          message: `Fallo en la conexión a la caché (Redis): ${error.message}`,
        };
        healthStatus.status = "DEGRADED";
        logger.error(
          " [Health Check] La caché (Redis) está DOWN:",
          error.message
        );
      }
    } else {
      healthStatus.dependencies.cache = {
        status: "DOWN",
        message: "El servicio de caché no está listo o configurado.",
      };
      healthStatus.status = "DEGRADED";
    }
  } else {
    healthStatus.dependencies.cache = {
      status: "UNKNOWN",
      message: "El servicio de caché no se cargó o no está disponible.",
    };
    healthStatus.status = "DEGRADED";
  }

  // 3. Puedes añadir más verificaciones para otros servicios aquí:
  //    - emailService (verificar conexión SMTP)
  //    - externalAPIService (hacer una llamada de prueba a una API externa)
  //    - messageQueue (verificar conexión a RabbitMQ/Kafka)
  //    - storageService (verificar acceso a S3/Cloudinary)

  // Determinar el código de estado HTTP de la respuesta.
  const statusCode = healthStatus.status === "UP" ? 200 : 503; // 503 Service Unavailable si está degradado o caído.

  logger.info(
    `[Health Check] Estado general de la aplicación: ${healthStatus.status}.`
  );
  res.status(statusCode).json(healthStatus);
});

//  Exportación del router.
module.exports = router;
