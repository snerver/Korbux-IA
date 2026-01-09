/**
 * @file AuditLog.js
 * @description Clase para gestionar un registro de auditoría (audit log) en el lado del cliente utilizando localStorage.
 * Este log es útil para depuración y seguimiento de acciones del usuario en la sesión actual o entre sesiones.
 * Para un registro de auditoría robusto y seguro, se recomienda una solución del lado del servidor.
 *
 * @version 2.1.0 - Correcciones y mejoras aplicadas.
 */
class AuditLog {
  /**
   * @private
   * @type {string}
   * @description Clave utilizada para almacenar los registros en localStorage.
   */
  static #STORAGE_KEY = "korbux_audit_logs";
  /**
   * @private
   * @type {AuditLog}
   * @description Instancia única de la clase AuditLog (patrón Singleton).
   */
  static #instance = null;
  /**
   * @private
   * @type {Array<Object>}
   * @description Array interno para almacenar las entradas del registro.
   */
  #logs = [];
  /**
   * @private
   * @type {Object}
   * @description Configuración de la instancia de AuditLog.
   */
  #config = {
    maxLogEntries: 500,
    logLevel: "INFO",
    debounceDelay: 500,
    logSource: "frontend",
    isEnabled: true,
  };
  /**
   * @private
   * @type {number|null}
   * @description ID del temporizador para la función debounce.
   */
  #saveTimer = null;
  /**
   * Niveles de log para facilitar la comparación.
   * @private
   */
  static #LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };
  /**
   * Crea una instancia de AuditLog.
   * Implementa el patrón Singleton para asegurar que solo haya una instancia.
   * @param {Object} [options={}] - Opciones de configuración iniciales.
   * @param {number} [options.maxLogEntries=500] - Límite máximo de entradas en el log.
   * @param {string} [options.logLevel='INFO'] - Nivel mínimo de log a registrar.
   * @param {number} [options.debounceDelay=500] - Retraso en ms para guardar en localStorage.
   * @param {string} [options.logSource='frontend'] - Fuente de los logs.
   * @param {boolean} [options.isEnabled=true] - Si el registro de auditoría está habilitado.
   */
  constructor(options = {}) {
    if (AuditLog.#instance) {
      return AuditLog.#instance;
    }
    this.#config = { ...this.#config, ...options };
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#loadLogs();
    this.#logToConsole(
      "INFO",
      `AuditLog inicializado. Registros cargados: ${
        this.#logs.length
      }. Configuración:`,
      this.#config
    );
    AuditLog.#instance = this;
  }
  /**
   * Obtiene la instancia única de AuditLog (Singleton).
   * Si no existe, crea una nueva.
   * @param {Object} [options={}] - Opciones de configuración para la primera inicialización.
   * @returns {AuditLog} La instancia única de AuditLog.
   */
  static getInstance(options = {}) {
    if (!AuditLog.#instance) {
      AuditLog.#instance = new AuditLog(options);
    }
    return AuditLog.#instance;
  }
  /**
   * @private
   * @param {string} level - El nivel de log a validar.
   * @returns {string} El nivel de log validado o el valor por defecto ('INFO').
   * @description Método extraído para evitar la repetición de lógica.
   */
  #validateLogLevel(level) {
    const sanitizedLevel = level.toUpperCase();
    if (!AuditLog.#LOG_LEVELS.hasOwnProperty(sanitizedLevel)) {
      console.warn(
        `AuditLog: Nivel de log '${level}' no reconocido. Usando 'INFO'.`
      );
      return "INFO";
    }
    return sanitizedLevel;
  }
  /**
   * Registra un mensaje en la consola si el nivel de log actual lo permite.
   * @private
   * @param {string} level - Nivel del mensaje (DEBUG, INFO, WARN, ERROR).
   * @param {string} message - El mensaje a registrar.
   * @param {...any} args - Argumentos adicionales para pasar a console.log.
   */
  #logToConsole(level, message, ...args) {
    const currentLevelValue = AuditLog.#LOG_LEVELS[this.#config.logLevel];
    const messageLevelValue = AuditLog.#LOG_LEVELS[level];
    if (messageLevelValue >= currentLevelValue) {
      const logPrefix = `[AuditLog - ${level}]`;
      switch (level) {
        case "ERROR":
          console.error(logPrefix, message, ...args);
          break;
        case "WARN":
          console.warn(logPrefix, message, ...args);
          break;
        case "INFO":
          console.info(logPrefix, message, ...args);
          break;
        case "DEBUG":
          console.debug(logPrefix, message, ...args);
          break;
        default:
          console.log(logPrefix, message, ...args);
      }
    }
  }
  /**
   * Carga los registros de auditoría desde localStorage al array interno.
   * Aplica el límite máximo de entradas al cargar.
   * @private
   */
  #loadLogs() {
    try {
      const storedLogs = localStorage.getItem(AuditLog.#STORAGE_KEY);
      if (storedLogs) {
        const parsedLogs = JSON.parse(storedLogs);
        if (Array.isArray(parsedLogs)) {
          this.#logs = parsedLogs.slice(-this.#config.maxLogEntries);
        } else {
          this.#logToConsole(
            "WARN",
            "AuditLog: Datos de log en localStorage no son un array. Reiniciando logs."
          );
          this.#logs = [];
          localStorage.removeItem(AuditLog.#STORAGE_KEY);
        }
      }
    } catch (error) {
      this.#logToConsole(
        "ERROR",
        "Error al cargar registros de auditoría desde localStorage:",
        error
      );
      this.#logs = [];
      localStorage.removeItem(AuditLog.#STORAGE_KEY);
    }
  }
  /**
   * Guarda el array interno de registros de auditoría en localStorage con debounce.
   * @private
   */
  #saveLogs() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      try {
        if (this.#logs.length > this.#config.maxLogEntries) {
          this.#logs = this.#logs.slice(-this.#config.maxLogEntries);
        }
        localStorage.setItem(AuditLog.#STORAGE_KEY, JSON.stringify(this.#logs));
        this.#logToConsole(
          "DEBUG",
          "Registros de auditoría guardados en localStorage."
        );
      } catch (error) {
        this.#logToConsole(
          "ERROR",
          "Error al guardar registros de auditoría en localStorage:",
          error
        );
        if (error.name === "QuotaExceededError") {
          this.#logToConsole(
            "WARN",
            "QuotaExceededError: El espacio de almacenamiento local está lleno. Se recomienda purgar logs manualmente."
          );
        }
      }
    }, this.#config.debounceDelay);
  }
  /**
   * Genera un objeto de entrada de log estandarizado.
   * @private
   * @param {string} action - Descripción de la acción.
   * @param {Object} details - Detalles adicionales.
   * @param {string} userId - ID del usuario.
   * @param {string} sessionId - ID de la sesión.
   * @returns {Object} La entrada de log formateada.
   */
  #createEntry(action, details, userId, sessionId) {
    return {
      _v: 1,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      userId: userId,
      sessionId: sessionId,
      source: this.#config.logSource,
      action: action,
      details: details,
    };
  }
  /**
   * Añade una nueva entrada al registro de auditoría.
   * @param {string} action - Descripción breve de la acción realizada (ej. "THEME_TOGGLE", "MESSAGE_SENT").
   * @param {Object} [details={}] - Objeto con detalles adicionales sobre la acción.
   * @param {string} [userId='anonymous'] - ID del usuario que realizó la acción. Por defecto 'anonymous'.
   * @param {string} [sessionId='unknown'] - ID de la sesión actual. Por defecto 'unknown'.
   */
  addEntry(action, details = {}, userId = "anonymous", sessionId = "unknown") {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "DEBUG",
        "AuditLog está deshabilitado. No se añadió la entrada."
      );
      return;
    }
    if (typeof action !== "string" || action.trim() === "") {
      this.#logToConsole(
        "ERROR",
        "AuditLog: La acción debe ser una cadena de texto no vacía."
      );
      return;
    }
    if (typeof details !== "object" || details === null) {
      this.#logToConsole(
        "ERROR",
        "AuditLog: Los detalles deben ser un objeto válido."
      );
      details = {};
    }
    const entry = this.#createEntry(action, details, userId, sessionId);
    this.#logs.push(entry);
    this.#saveLogs();
    this.#logToConsole("INFO", "Nueva entrada de auditoría añadida:", entry);
  }
  /**
   * Recupera entradas del registro de auditoría con opciones de filtrado y ordenamiento.
   * @param {Object} [options={}] - Opciones de filtrado y ordenamiento.
   * @param {string} [options.action] - Filtra por una acción específica.
   * @param {string} [options.userId] - Filtra por un ID de usuario específico.
   * @param {string} [options.sessionId] - Filtra por un ID de sesión específico.
   * @param {string} [options.source] - Filtra por la fuente del log.
   * @param {Date|number} [options.startDate] - Fecha de inicio para el rango de tiempo (Date object o timestamp).
   * @param {Date|number} [options.endDate] - Fecha de fin para el rango de tiempo (Date object o timestamp).
   * @param {'asc'|'desc'} [options.sortByTimestamp='desc'] - Ordena por timestamp (ascendente o descendente).
   * @returns {Array<Object>} Un array de objetos, donde cada objeto es una entrada del registro.
   */
  getEntries(options = {}) {
    let filteredLogs = [...this.#logs];
    if (options.action) {
      filteredLogs = filteredLogs.filter(
        (entry) => entry.action === options.action
      );
    }
    if (options.userId) {
      filteredLogs = filteredLogs.filter(
        (entry) => entry.userId === options.userId
      );
    }
    if (options.sessionId) {
      filteredLogs = filteredLogs.filter(
        (entry) => entry.sessionId === options.sessionId
      );
    }
    if (options.source) {
      filteredLogs = filteredLogs.filter(
        (entry) => entry.source === options.source
      );
    }
    if (options.startDate || options.endDate) {
      const start = options.startDate
        ? new Date(options.startDate).getTime()
        : -Infinity;
      const end = options.endDate
        ? new Date(options.endDate).getTime()
        : Infinity;
      filteredLogs = filteredLogs.filter(
        (entry) => entry.timestamp >= start && entry.timestamp <= end
      );
    }
    if (options.sortByTimestamp === "asc") {
      filteredLogs.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
    }
    return filteredLogs;
  }
  /**
   * Obtiene un resumen de las entradas de log, agrupadas por acción.
   * @returns {Object} Un objeto donde las claves son las acciones y los valores son los conteos.
   */
  getLogSummary() {
    const summary = {};
    this.#logs.forEach((entry) => {
      summary[entry.action] = (summary[entry.action] || 0) + 1;
    });
    return summary;
  }
  /**
   * Elimina una entrada de log específica por su ID.
   * @param {string} entryId - El ID de la entrada a eliminar.
   * @returns {boolean} True si la entrada fue eliminada, false de lo contrario.
   */
  removeEntryById(entryId) {
    const initialLength = this.#logs.length;
    this.#logs = this.#logs.filter((entry) => entry.id !== entryId);
    if (this.#logs.length < initialLength) {
      this.#saveLogs();
      this.#logToConsole(
        "INFO",
        `Entrada de auditoría con ID ${entryId} eliminada.`
      );
      return true;
    }
    this.#logToConsole(
      "WARN",
      `No se encontró la entrada de auditoría con ID ${entryId} para eliminar.`
    );
    return false;
  }
  /**
   * Limpia las entradas del registro de auditoría que son más antiguas que un tiempo dado.
   * @param {number} maxAgeMs - La edad máxima en milisegundos para mantener los registros.
   * Ej: 7 días = 7 * 24 * 60 * 60 * 1000
   * @returns {number} El número de entradas eliminadas.
   */
  purgeOldLogs(maxAgeMs) {
    const cutoffTime = Date.now() - maxAgeMs;
    const initialLength = this.#logs.length;
    this.#logs = this.#logs.filter((entry) => entry.timestamp >= cutoffTime);
    const purgedCount = initialLength - this.#logs.length;
    if (purgedCount > 0) {
      this.#saveLogs();
      this.#logToConsole(
        "INFO",
        `AuditLog: Se purgaron ${purgedCount} entradas más antiguas que ${
          maxAgeMs / (1000 * 60 * 60 * 24)
        } días.`
      );
    } else {
      this.#logToConsole(
        "DEBUG",
        "AuditLog: No se encontraron entradas para purgar."
      );
    }
    return purgedCount;
  }
  /**
   * Limpia todas las entradas del registro de auditoría.
   * Esto eliminará los registros tanto del array interno como de localStorage.
   */
  clearLogs() {
    this.#logs = [];
    this.#saveLogs();
    this.#logToConsole(
      "INFO",
      "AuditLog: Todos los registros han sido limpiados."
    );
  }
  /**
   * Restablece la instancia de AuditLog a su estado inicial, borrando logs y reiniciando la configuración.
   * @param {Object} [newOptions={}] - Nuevas opciones de configuración para aplicar después del reinicio.
   */
  reset(newOptions = {}) {
    this.#logToConsole(
      "WARN",
      "AuditLog: Reiniciando la instancia (borrando logs y configuración)..."
    );
    this.clearLogs();
    this.#config = {
      maxLogEntries: 500,
      logLevel: "INFO",
      debounceDelay: 500,
      logSource: "frontend",
      isEnabled: true,
    };
    this.#config = { ...this.#config, ...newOptions };
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#logToConsole(
      "INFO",
      "AuditLog reiniciado con la configuración:",
      this.#config
    );
  }
  /**
   * Actualiza la configuración de AuditLog.
   * @param {Object} newConfig - Objeto con las propiedades de configuración a actualizar.
   */
  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    if (newConfig.logLevel) {
      this.#config.logLevel = this.#validateLogLevel(newConfig.logLevel);
    }
    this.#logToConsole(
      "INFO",
      "AuditLog: Configuración actualizada:",
      this.#config
    );
  }
  /**
   * Obtiene la configuración actual de AuditLog.
   * @returns {Object} La configuración actual.
   */
  getConfig() {
    return { ...this.#config };
  }
}
export default AuditLog;
