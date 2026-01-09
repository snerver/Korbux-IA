// services/auditService.js

/**
 * @file Servicio para la gestión de logs de auditoría.
 * @description Centraliza la lógica para registrar eventos importantes del sistema y acciones de usuario
 * con fines de seguridad, trazabilidad y cumplimiento.
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const Errores = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa el modelo AuditLog. Asegúrate de que este modelo esté definido en tu carpeta models/.
// Por ejemplo, en models/AuditLog.js.
// También importa 'Op' de Sequelize para operaciones de consulta avanzadas como rangos de fecha.
let AuditLog;
let Op; // Declarar Op aquí para que esté disponible globalmente en este archivo.

try {
  const sequelize = require(path.join(
    __dirname,
    "..",
    "config",
    "database.js"
  )); // Asume que database.js exporta la instancia de Sequelize
  AuditLog = require(path.join(__dirname, "..", "models", "AuditLog.js")); // Tu modelo AuditLog
  Op = sequelize.Op; // Obtener Op de la instancia de Sequelize
} catch (e) {
  logger.error(
    " [AuditService] No se pudo cargar el modelo AuditLog o Sequelize. Asegúrate de que models/AuditLog.js y config/database.js existan y estén configurados.",
    e
  );
  // Define un modelo dummy para evitar errores si el real no se carga, pero esto indicará un problema.
  AuditLog = {
    create: async (data) => {
      logger.warn(
        " [AuditService] Operación de auditoría simulada: AuditLog model no cargado o DB no disponible.",
        data
      );
      return data;
    },
    findAll: async () => {
      logger.warn(
        " [AuditService] Operación de auditoría simulada: AuditLog model no cargado. No se pueden recuperar logs."
      );
      return [];
    },
  };
  Op = {}; // Define un objeto vacío para Op para evitar ReferenceError.
}

/**
 * @class AuditService
 * @description Clase que proporciona métodos para registrar eventos de auditoría en la base de datos.
 * Incluye un mecanismo de batching para mejorar el rendimiento en escenarios de alto volumen.
 */
class AuditService {
  /**
   * @private
   * @property {Array<object>} _auditQueue - Cola interna para eventos de auditoría pendientes de guardar.
   */
  _auditQueue = [];

  /**
   * @private
   * @property {NodeJS.Timeout|null} _flushTimer - Temporizador para el vaciado periódico de la cola.
   */
  _flushTimer = null;

  /**
   * @private
   * @property {number} _batchSize - Número de eventos en cola antes de forzar un vaciado.
   */
  _batchSize = 20; // Número de eventos para vaciado por lote

  /**
   * @private
   * @property {number} _flushInterval - Intervalo en milisegundos para el vaciado periódico de la cola.
   */
  _flushInterval = 5000; // 5 segundos

  /**
   * @private
   * @property {boolean} _batchingEnabled - Indica si el batching de auditoría está habilitado.
   */
  _batchingEnabled = false; // Por defecto deshabilitado, se puede habilitar en el constructor.

  /**
   * Crea una instancia de AuditService.
   * @param {object} [options={}] - Opciones de configuración para el servicio.
   * @param {boolean} [options.enableBatching=false] - Habilita el batching de logs de auditoría.
   * @param {number} [options.batchSize=20] - Tamaño del lote para el batching.
   * @param {number} [options.flushInterval=5000] - Intervalo de vaciado en milisegundos para el batching.
   */
  constructor(options = {}) {
    this._batchingEnabled = options.enableBatching || false;
    this._batchSize = options.batchSize || this._batchSize;
    this._flushInterval = options.flushInterval || this._flushInterval;

    if (this._batchingEnabled) {
      this._startFlushTimer();
      logger.info(
        `[AuditService] Servicio de auditoría inicializado con batching: tamaño de lote=${this._batchSize}, intervalo=${this._flushInterval}ms.`
      );
    } else {
      logger.info(
        "[AuditService] Servicio de auditoría inicializado (batching deshabilitado)."
      );
    }
  }

  /**
   * Inicia el temporizador para el vaciado periódico de la cola de auditoría.
   * @private
   */
  _startFlushTimer() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
    }
    this._flushTimer = setInterval(() => {
      if (this._auditQueue.length > 0) {
        this._flushQueue();
      }
    }, this._flushInterval);
  }

  /**
   * Vacía la cola de eventos de auditoría, guardándolos en la base de datos.
   * @private
   * @returns {Promise<void>}
   */
  async _flushQueue() {
    if (this._auditQueue.length === 0) {
      return;
    }

    const eventsToFlush = [...this._auditQueue];
    this._auditQueue = []; // Limpiar la cola inmediatamente para nuevas entradas.

    logger.debug(
      `[AuditService] Vaciando cola de auditoría con ${eventsToFlush.length} eventos.`
    );

    try {
      // Usar bulkCreate para insertar múltiples registros de una vez, si es compatible con Sequelize.
      // Esto es mucho más eficiente que `create` individualmente en un bucle.
      if (AuditLog && typeof AuditLog.bulkCreate === "function") {
        await AuditLog.bulkCreate(eventsToFlush);
        logger.info(
          ` [AuditService] ${eventsToFlush.length} eventos de auditoría guardados en lote.`
        );
      } else {
        // Fallback si bulkCreate no está disponible (ej. modelo dummy o versión antigua de ORM).
        for (const eventData of eventsToFlush) {
          await AuditLog.create(eventData);
        }
        logger.info(
          ` [AuditService] ${eventsToFlush.length} eventos de auditoría guardados individualmente (fallback).`
        );
      }
    } catch (error) {
      logger.error(
        ` [AuditService] Error al vaciar la cola de auditoría:`,
        error
      );
      // Opcional: Reencolar eventos fallidos o moverlos a un log de errores para análisis.
      // this._auditQueue.push(...eventsToFlush); // Reencolar
    }
  }

  /**
   * Procesa un evento de auditoría, encolándolo o guardándolo directamente.
   * @private
   * @param {object} eventData - Datos del evento a procesar.
   * @returns {Promise<object|void>} El registro de auditoría creado o void si está encolado.
   */
  async _processEvent(eventData) {
    if (this._batchingEnabled) {
      this._auditQueue.push(eventData);
      logger.debug(
        `[AuditService] Evento encolado. Cola actual: ${this._auditQueue.length}`
      );
      if (this._auditQueue.length >= this._batchSize) {
        await this._flushQueue(); // Forzar vaciado si se alcanza el tamaño del lote.
      }
      return; // No devuelve el registro si está encolado.
    } else {
      // Guardar directamente si el batching está deshabilitado.
      try {
        const auditRecord = await AuditLog.create(eventData);
        logger.info(
          ` [AuditService] Evento auditado: ${
            eventData.eventType
          } (Usuario: ${eventData.username || eventData.userId || "N/A"})`
        );
        return auditRecord;
      } catch (error) {
        logger.error(
          ` [AuditService] Error al registrar evento de auditoría '${eventData.eventType}' directamente:`,
          error
        );
        throw new Errores.InternalServerError(
          "Error al registrar evento de auditoría en la base de datos.",
          error
        );
      }
    }
  }

  /**
   * Registra un evento de auditoría en la base de datos.
   * Este es el método principal para registrar cualquier tipo de evento auditable.
   * Puede recibir un objeto `req` de Express para extraer información contextual.
   *
   * @param {object} eventData - Objeto que contiene los detalles del evento.
   * @param {string} eventData.eventType - Tipo de evento (ej. 'LOGIN_SUCCESS', 'USER_CREATED', 'PRODUCT_DELETED', 'SYSTEM_ERROR').
   * @param {string} [eventData.userId=null] - ID del usuario asociado con el evento (si aplica).
   * @param {string} [eventData.username=null] - Nombre de usuario asociado con el evento (si aplica).
   * @param {object} [eventData.details={}] - Detalles adicionales del evento en formato JSON.
   * @param {string} [eventData.ipAddress=null] - Dirección IP desde donde se originó el evento.
   * @param {string} [eventData.resourceType=null] - Tipo de recurso afectado (ej. 'User', 'Product', 'Order').
   * @param {string} [eventData.resourceId=null] - ID del recurso afectado.
   * @param {object} [req=null] - Objeto de solicitud de Express para extraer contexto adicional.
   * @returns {Promise<object|void>} El registro de auditoría creado o void si está encolado.
   * @throws {Errores.BadRequestError} Si `eventType` no es válido.
   * @throws {Errores.InternalServerError} Si ocurre un error al guardar en la base de datos (solo si no hay batching).
   */
  async logEvent(
    {
      eventType,
      userId = null,
      username = null,
      details = {},
      ipAddress = null,
      resourceType = null,
      resourceId = null,
    },
    req = null
  ) {
    if (!eventType || typeof eventType !== "string") {
      logger.error(
        " [AuditService] Intento de logear evento sin eventType válido."
      );
      throw new Errores.BadRequestError(
        "El tipo de evento de auditoría es obligatorio."
      );
    }

    // --- Captura de contexto de la solicitud (si se proporciona `req`) ---
    let finalIpAddress = ipAddress;
    let userAgent = null;
    let requestUrl = null;
    let httpMethod = null;

    if (req) {
      // Prioriza la IP de los headers de proxy si confías en ellos (app.set('trust proxy', 1))
      finalIpAddress =
        req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        ipAddress;
      userAgent = req.headers?.["user-agent"] || null;
      requestUrl = req.originalUrl || req.url || null;
      httpMethod = req.method || null;
    }

    //  Considera redactar o encriptar datos sensibles en 'details' antes de guardar.
    // Por ejemplo: if (details.password) details.password = '[REDACTED]';

    const eventData = {
      eventType: eventType,
      userId: userId,
      username: username,
      details: details,
      ipAddress: finalIpAddress,
      resourceType: resourceType,
      resourceId: resourceId,
      timestamp: new Date(), // Usar la fecha del servidor de la aplicación.
      userAgent: userAgent,
      requestUrl: requestUrl,
      httpMethod: httpMethod,
    };

    return this._processEvent(eventData);
  }

  /**
   * Registra una acción específica realizada por un usuario.
   * Un wrapper conveniente para `logEvent` para acciones de usuario.
   *
   * @param {string} userId - ID del usuario que realizó la acción.
   * @param {string} username - Nombre de usuario que realizó la acción.
   * @param {string} actionType - Tipo de acción (ej. 'LOGIN', 'CREATE_PRODUCT', 'UPDATE_PROFILE').
   * @param {object} [details={}] - Detalles adicionales de la acción.
   * @param {string} [ipAddress=null] - Dirección IP del usuario.
   * @param {string} [resourceType=null] - Tipo de recurso afectado por la acción.
   * @param {string} [resourceId=null] - ID del recurso afectado por la acción.
   * @param {object} [req=null] - Objeto de solicitud de Express para extraer contexto adicional.
   * @returns {Promise<object|void>} El registro de auditoría creado o void si está encolado.
   * @throws {Errores.BadRequestError} Si falta userId o actionType.
   * @throws {Errores.InternalServerError} Si ocurre un error al guardar en la base de datos.
   */
  async logUserAction(
    userId,
    username,
    actionType,
    details = {},
    ipAddress = null,
    resourceType = null,
    resourceId = null,
    req = null
  ) {
    if (!userId || !actionType) {
      logger.error(
        " [AuditService] Intento de logear acción de usuario sin userId o actionType."
      );
      throw new Errores.BadRequestError(
        "userId y actionType son obligatorios para logUserAction."
      );
    }
    return this.logEvent(
      {
        eventType: `USER_ACTION_${actionType.toUpperCase()}`,
        userId,
        username,
        details,
        ipAddress,
        resourceType,
        resourceId,
      },
      req
    );
  }

  /**
   * Registra un evento interno del sistema.
   * Un wrapper conveniente para `logEvent` para eventos no relacionados directamente con un usuario.
   *
   * @param {string} eventType - Tipo de evento del sistema (ej. 'SERVER_START', 'DB_CONNECTION_ERROR', 'CRON_JOB_SUCCESS').
   * @param {object} [details={}] - Detalles adicionales del evento del sistema.
   * @param {string} [ipAddress='SYSTEM'] - Dirección IP o identificador del sistema.
   * @returns {Promise<object|void>} El registro de auditoría creado o void si está encolado.
   * @throws {Errores.BadRequestError} Si falta eventType.
   * @throws {Errores.InternalServerError} Si ocurre un error al guardar en la base de datos.
   */
  async logSystemEvent(eventType, details = {}, ipAddress = "SYSTEM") {
    if (!eventType) {
      logger.error(
        " [AuditService] Intento de logear evento de sistema sin eventType."
      );
      throw new Errores.BadRequestError(
        "El tipo de evento del sistema es obligatorio."
      );
    }
    return this.logEvent({
      eventType: `SYSTEM_EVENT_${eventType.toUpperCase()}`,
      userId: null, // No hay usuario asociado directamente
      username: "SYSTEM", // Identificador para eventos del sistema
      details,
      ipAddress,
    });
  }

  /**
   * Recupera logs de auditoría con opciones de paginación y filtrado.
   * @param {object} [options={}] - Opciones de consulta.
   * @param {number} [options.limit=20] - Número máximo de registros a devolver.
   * @param {number} [options.offset=0] - Número de registros a omitir.
   * @param {string} [options.eventType=null] - Filtrar por tipo de evento.
   * @param {string} [options.userId=null] - Filtrar por ID de usuario.
   * @param {Date} [options.startDate=null] - Fecha de inicio para el rango de tiempo.
   * @param {Date} [options.endDate=null] - Fecha de fin para el rango de tiempo.
   * @param {string} [options.sortBy='timestamp'] - Campo por el cual ordenar.
   * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - Orden de clasificación ('ASC' o 'DESC').
   * @returns {Promise<object[]>} Un array de registros de auditoría.
   * @throws {Errores.InternalServerError} Si ocurre un error al consultar la base de datos.
   */
  async getAuditLogs(options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        eventType,
        userId,
        startDate,
        endDate,
        sortBy = "timestamp",
        sortOrder = "DESC",
      } = options;
      const whereClause = {};

      if (eventType) whereClause.eventType = eventType;
      if (userId) whereClause.userId = userId;

      if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) whereClause.timestamp[Op.gte] = startDate;
        if (endDate) whereClause.timestamp[Op.lte] = endDate;
      }

      // Validar sortBy y sortOrder para prevenir inyección SQL si no se usan ORM.
      const validSortFields = ["timestamp", "eventType", "userId", "ipAddress"];
      const validSortOrders = ["ASC", "DESC"];

      const finalSortBy = validSortFields.includes(sortBy)
        ? sortBy
        : "timestamp";
      const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      const logs = await AuditLog.findAll({
        where: whereClause,
        limit: limit,
        offset: offset,
        order: [[finalSortBy, finalSortOrder]],
      });
      logger.debug(
        `[AuditService] Logs de auditoría recuperados: ${logs.length} registros.`
      );
      return logs;
    } catch (error) {
      logger.error(
        " [AuditService] Error al recuperar logs de auditoría:",
        error
      );
      throw new Errores.InternalServerError(
        "Error al recuperar logs de auditoría.",
        error
      );
    }
  }

  /**
   * Detiene el temporizador de vaciado de la cola de auditoría.
   * Útil al apagar la aplicación para asegurar que todos los logs pendientes se guarden.
   * @public
   * @returns {Promise<void>}
   */
  async stop() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
      logger.info(
        "[AuditService] Temporizador de vaciado de auditoría detenido."
      );
    }
    // Forzar un último vaciado para asegurar que no queden eventos en cola.
    if (this._auditQueue.length > 0) {
      logger.info(
        "[AuditService] Realizando vaciado final de la cola de auditoría..."
      );
      await this._flushQueue();
    }
    logger.info("[AuditService] Servicio de auditoría detenido.");
  }
}

// Exporta una instancia única del servicio de auditoría.
// Puedes pasar opciones de batching aquí si quieres que se inicien con el servicio.
module.exports = new AuditService({
  enableBatching: true, // Habilitar el batching por defecto
  batchSize: 50, // Tamaño del lote de 50 eventos
  flushInterval: 10000, // Vaciar cada 10 segundos
});
