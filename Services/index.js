// services/index.js

/**
 * @file Archivo de índice para la carpeta de servicios.
 * @description Centraliza la exportación de todos los servicios de la aplicación,
 * permitiendo una importación más limpia y organizada en otros módulos.
 * Carga dinámicamente todos los servicios definidos en esta carpeta.
 * @module services/index
 */

const path = require("path");
const fs = require("fs"); // Módulo nativo de Node.js para interactuar con el sistema de archivos.
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger

/**
 * Objeto que contendrá todas las instancias de los servicios cargados.
 * @type {Object.<string, any>}
 */
const services = {};

/**
 * Ruta absoluta a la carpeta de servicios.
 * @type {string}
 */
const servicesPath = __dirname;

logger.info(" [Services Index] Iniciando carga dinámica de servicios...");

try {
  // Leer todos los archivos en la carpeta de servicios.
  const serviceFiles = fs.readdirSync(servicesPath);

  for (const file of serviceFiles) {
    // Ignorar el archivo index.js y cualquier archivo que no sea .js.
    if (file === "index.js" || !file.endsWith(".js")) {
      continue;
    }

    // Obtener el nombre del servicio (ej. 'chatService' de 'chatService.js').
    const serviceName = path.basename(file, ".js");

    // Construir la ruta completa al archivo del servicio.
    const serviceFilePath = path.join(servicesPath, file);

    try {
      // Importar el servicio y asignarlo al objeto 'services'.
      // Convertir el nombre del archivo a camelCase para el nombre de la propiedad.
      const camelCaseServiceName =
        serviceName.charAt(0).toLowerCase() + serviceName.slice(1);
      services[camelCaseServiceName] = require(serviceFilePath);
      logger.info(
        ` [Services Index] Servicio '${serviceName}' cargado exitosamente.`
      );
    } catch (e) {
      logger.error(
        ` [Services Index] Error al cargar el servicio '${serviceName}' desde '${serviceFilePath}': ${e.message}`
      );
      services[serviceName] = null; // Asignar null si falla la carga para evitar errores de referencia.
    }
  }
} catch (e) {
  logger.error(
    " [Services Index] Error crítico al leer la carpeta de servicios:",
    e.message
  );
}

logger.info(" [Services Index] Carga de servicios completada.");

/**
 * Exporta un objeto que contiene todas las instancias de los servicios cargados.
 * Esto permite importar múltiples servicios de forma desestructurada en otros módulos:
 * `const { chatService, authService, userService } = require('../services');`
 *
 * @property {AnalyticsService|null} analyticsService - Instancia del servicio de analíticas.
 * @property {AuditService|null} auditService - Instancia del servicio de auditoría.
 * @property {AuthService|null} authService - Instancia del servicio de autenticación.
 * @property {CacheService|null} cacheService - Instancia del servicio de caché.
 * @property {ChatService|null} chatService - Instancia del servicio de chat.
 * @property {EmailService|null} emailService - Instancia del servicio de correo electrónico.
 * @property {EncryptionService|null} encryptionService - Instancia del servicio de encriptación.
 * // Añade aquí las propiedades para cualquier otro servicio que crees (ej. userService, storageService).
 */
module.exports = services;
