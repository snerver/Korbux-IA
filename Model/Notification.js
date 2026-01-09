/**
 * @file notification.js
 * @description Clase para gestionar un registro de notificaciones en el lado del cliente utilizando localStorage.
 * Esta clase implementa el patrón Singleton y proporciona métodos para añadir, recuperar,
 * actualizar y eliminar notificaciones, con opciones de configuración y validación.
 *
 * @version 1.0.0
 */

class NotificationManager {
  /**
   * @private
   * @type {string}
   * @description Clave utilizada para almacenar las notificaciones en localStorage.
   */
  static #STORAGE_KEY = "korbux_notifications";

  /**
   * @private
   * @type {NotificationManager}
   * @description Instancia única de la clase NotificationManager (patrón Singleton).
   */
  static #instance = null;

  /**
   * @private
   * @type {Array<Object>}
   * @description Array interno para almacenar las entradas de notificaciones.
   */
  #notifications = [];

  /**
   * @private
   * @type {Object}
   * @description Configuración de la instancia de NotificationManager.
   */
  #config = {
    isEnabled: true, // Si la gestión de notificaciones está habilitada.
    debounceDelay: 200, // Retraso en ms para guardar en localStorage (para evitar escrituras excesivas).
    logLevel: "INFO", // Nivel mínimo de log a registrar (DEBUG, INFO, WARN, ERROR).
    logSource: "frontend-notification", // Fuente de los logs (ej. 'frontend-notification', 'backend-event').
  };

  /**
   * @private
   * @type {number|null}
   * @description ID del temporizador para la función debounce de guardado.
   */
  #saveTimer = null;

  /**
   * @private
   * @type {Object}
   * @description Niveles de log para facilitar la comparación y filtrado.
   */
  static #LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  /**
   * Crea una instancia de NotificationManager.
   * Implementa el patrón Singleton para asegurar que solo haya una instancia.
   * @param {Object} [options={}] - Opciones de configuración iniciales.
   * @param {boolean} [options.isEnabled=true] - Si la gestión de notificaciones está habilitada.
   * @param {number} [options.debounceDelay=200] - Retraso en ms para guardar en localStorage.
   * @param {string} [options.logLevel='INFO'] - Nivel mínimo de log a registrar.
   * @param {string} [options.logSource='frontend-notification'] - Fuente de los logs.
   */
  constructor(options = {}) {
    if (NotificationManager.#instance) {
      return NotificationManager.#instance;
    }

    // Aplicar configuración inicial
    this.#config = { ...this.#config, ...options };

    // Validar el nivel de log
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);

    this.#loadNotifications();
    this.#logToConsole(
      "INFO",
      `Gestor de Notificaciones inicializado. Notificaciones cargadas: ${
        this.#notifications.length
      }. Configuración:`,
      this.#config
    );

    NotificationManager.#instance = this;
  }

  /**
   * Obtiene la instancia única de NotificationManager (Singleton).
   * Si no existe, crea una nueva.
   * @param {Object} [options={}] - Opciones de configuración para la primera inicialización.
   * @returns {NotificationManager} La instancia única de NotificationManager.
   */
  static getInstance(options = {}) {
    if (!NotificationManager.#instance) {
      NotificationManager.#instance = new NotificationManager(options);
    }
    return NotificationManager.#instance;
  }

  /**
   * @private
   * @param {string} level - El nivel de log a validar.
   * @returns {string} El nivel de log validado o el valor por defecto ('INFO').
   * @description Método para validar y normalizar el nivel de log.
   */
  #validateLogLevel(level) {
    const sanitizedLevel = level.toUpperCase();
    if (!NotificationManager.#LOG_LEVELS.hasOwnProperty(sanitizedLevel)) {
      console.warn(
        `NotificationManager: Nivel de log '${level}' no reconocido. Usando 'INFO'.`
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
    const currentLevelValue =
      NotificationManager.#LOG_LEVELS[this.#config.logLevel];
    const messageLevelValue = NotificationManager.#LOG_LEVELS[level];

    if (messageLevelValue >= currentLevelValue) {
      const logPrefix = `[NotificationManager - ${level}]`;
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
   * Carga las notificaciones desde localStorage al array interno.
   * @private
   */
  #loadNotifications() {
    try {
      const storedNotifications = localStorage.getItem(
        NotificationManager.#STORAGE_KEY
      );
      if (storedNotifications) {
        const parsedNotifications = JSON.parse(storedNotifications);
        if (Array.isArray(parsedNotifications)) {
          this.#notifications = parsedNotifications;
        } else {
          this.#logToConsole(
            "WARN",
            "NotificationManager: Datos de notificaciones en localStorage no son un array. Reiniciando notificaciones."
          );
          this.#notifications = [];
          localStorage.removeItem(NotificationManager.#STORAGE_KEY);
        }
      }
    } catch (error) {
      this.#logToConsole(
        "ERROR",
        `Error al cargar notificaciones desde localStorage: ${error.name} - ${error.message}`,
        error
      );
      this.#notifications = [];
      localStorage.removeItem(NotificationManager.#STORAGE_KEY);
    }
  }

  /**
   * Guarda el array interno de notificaciones en localStorage con debounce.
   * @private
   */
  #saveNotifications() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          NotificationManager.#STORAGE_KEY,
          JSON.stringify(this.#notifications)
        );
        this.#logToConsole(
          "DEBUG",
          "Notificaciones guardadas en localStorage."
        );
      } catch (error) {
        this.#logToConsole(
          "ERROR",
          "Error al guardar notificaciones en localStorage:",
          error
        );
        if (error.name === "QuotaExceededError") {
          this.#logToConsole(
            "WARN",
            "QuotaExceededError: El almacenamiento local está lleno. Considera purgar notificaciones antiguas."
          );
          // Opcional: Intentar purgar automáticamente si la cuota está excedida
          // this.purgeOldNotifications(7 * 24 * 60 * 60 * 1000); // Purga notificaciones de más de 7 días
          // this.#saveNotifications(); // Reintentar guardar después de purgar
        }
      }
    }, this.#config.debounceDelay);
  }

  /**
   * Genera un objeto de entrada de notificación estandarizado.
   * @private
   * @param {string} message - El contenido del mensaje de la notificación.
   * @param {string} type - El tipo de notificación (ej. 'info', 'success', 'warning', 'error').
   * @param {string} [userId='anonymous'] - ID del usuario al que va dirigida la notificación.
   * @param {Object} [context={}] - Objeto con datos de contexto adicionales para la notificación.
   * @returns {Object} La entrada de notificación formateada.
   */
  #createNotificationEntry(message, type, userId, context) {
    const now = Date.now(); // Usar timestamp numérico
    return {
      _v: 1, // Versión del esquema de la entrada de notificación
      id: crypto.randomUUID(), // ID único para cada notificación
      message: message.trim(),
      type: type.trim(),
      timestamp: now, // Fecha y hora de creación
      read: false, // Estado inicial de la notificación
      userId: userId,
      context: context, // Contexto adicional
    };
  }

  /**
   * Añade una nueva notificación al registro.
   * @param {string} message - El contenido del mensaje de la notificación.
   * @param {string} [type='info'] - El tipo de notificación (ej. 'info', 'success', 'warning', 'error').
   * @param {string} [userId='anonymous'] - ID del usuario al que va dirigida la notificación.
   * @param {Object} [context={}] - Objeto con datos de contexto adicionales para la notificación.
   * @returns {Object|null} La notificación añadida o null si falla.
   */
  addNotification(message, type = "info", userId = "anonymous", context = {}) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Notificaciones está deshabilitado. No se añadió la notificación."
      );
      return null;
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "NotificationManager: El mensaje de la notificación debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (typeof type !== "string" || type.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "NotificationManager: El tipo de notificación debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (typeof userId !== "string" || userId.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "NotificationManager: El ID de usuario debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (typeof context !== "object" || context === null) {
      this.#logToConsole(
        "WARN",
        "NotificationManager: El contexto de la notificación debe ser un objeto válido. Se usará un objeto vacío."
      );
      context = {};
    }

    const newNotification = this.#createNotificationEntry(
      message,
      type,
      userId,
      context
    );
    this.#notifications.push(newNotification);
    this.#saveNotifications();
    this.#logToConsole("INFO", "Nueva notificación añadida:", newNotification);
    return newNotification;
  }

  /**
   * Recupera notificaciones con opciones de filtrado y ordenamiento.
   * @param {Object} [options={}] - Opciones de filtrado y ordenamiento.
   * @param {string} [options.userId] - Filtra por ID de usuario.
   * @param {string} [options.type] - Filtra por tipo de notificación (ej. 'info', 'error').
   * @param {boolean} [options.read] - Filtra por estado de lectura (true para leídas, false para no leídas).
   * @param {string} [options.search] - Busca notificaciones cuyo mensaje contenga el texto (insensible a mayúsculas/minúsculas).
   * @param {Date|number} [options.startDate] - Fecha de inicio para el rango de tiempo (Date object o timestamp).
   * @param {Date|number} [options.endDate] - Fecha de fin para el rango de tiempo (Date object o timestamp).
   * @param {'asc'|'desc'} [options.sortByTimestamp='desc'] - Ordena por timestamp (ascendente o descendente).
   * @returns {Array<Object>} Un array de objetos, donde cada objeto es una notificación.
   */
  getNotifications(options = {}) {
    let filteredNotifications = [...this.#notifications];

    if (options.userId) {
      filteredNotifications = filteredNotifications.filter(
        (notif) => notif.userId === options.userId
      );
    }
    if (options.type) {
      filteredNotifications = filteredNotifications.filter(
        (notif) => notif.type === options.type
      );
    }
    if (options.read !== undefined && typeof options.read === "boolean") {
      filteredNotifications = filteredNotifications.filter(
        (notif) => notif.read === options.read
      );
    }
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      filteredNotifications = filteredNotifications.filter((notif) =>
        notif.message.toLowerCase().includes(searchTerm)
      );
    }

    // Filtrar por rango de fechas
    if (options.startDate || options.endDate) {
      const start = options.startDate
        ? new Date(options.startDate).getTime()
        : -Infinity;
      const end = options.endDate
        ? new Date(options.endDate).getTime()
        : Infinity;
      filteredNotifications = filteredNotifications.filter((notif) => {
        return notif.timestamp >= start && notif.timestamp <= end;
      });
    }

    // Aplicar ordenamiento
    if (options.sortByTimestamp === "asc") {
      filteredNotifications.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      // default 'desc'
      filteredNotifications.sort((a, b) => b.timestamp - a.timestamp);
    }

    return filteredNotifications;
  }

  /**
   * Obtiene una notificación por su ID.
   * @param {string} notificationId - El ID único de la notificación.
   * @returns {Object|undefined} La notificación encontrada o undefined si no existe.
   */
  getNotificationById(notificationId) {
    return this.#notifications.find((notif) => notif.id === notificationId);
  }

  /**
   * Marca una notificación específica como leída.
   * @param {string} notificationId - El ID de la notificación a marcar como leída.
   * @returns {boolean} True si la notificación fue marcada como leída, false de lo contrario.
   */
  markAsRead(notificationId) {
    const notification = this.getNotificationById(notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.#saveNotifications();
      this.#logToConsole(
        "INFO",
        `Notificación con ID ${notificationId} marcada como leída.`
      );
      return true;
    }
    this.#logToConsole(
      "WARN",
      `No se encontró la notificación con ID ${notificationId} o ya estaba leída.`
    );
    return false;
  }

  /**
   * Marca todas las notificaciones (o las de un usuario específico) como leídas.
   * @param {string} [userId] - Opcional. Si se proporciona, marca solo las notificaciones de ese usuario como leídas.
   * @returns {number} El número de notificaciones marcadas como leídas.
   */
  markAllAsRead(userId) {
    let count = 0;
    this.#notifications.forEach((notif) => {
      if ((!userId || notif.userId === userId) && !notif.read) {
        notif.read = true;
        count++;
      }
    });
    if (count > 0) {
      this.#saveNotifications();
      this.#logToConsole(
        "INFO",
        `${count} notificaciones marcadas como leídas para ${
          userId ? `el usuario '${userId}'` : "todos los usuarios"
        }.`
      );
    } else {
      this.#logToConsole(
        "INFO",
        `No se encontraron notificaciones no leídas para marcar como leídas para ${
          userId ? `el usuario '${userId}'` : "todos los usuarios"
        }.`
      );
    }
    return count;
  }

  /**
   * Actualiza una notificación existente por su ID.
   * @param {string} notificationId - El ID de la notificación a actualizar.
   * @param {Object} updates - Un objeto con las propiedades a actualizar (ej. { message: 'Nuevo Mensaje', read: true }).
   * @returns {Object|null} La notificación actualizada o null si no se encontró o la actualización falla.
   */
  updateNotification(notificationId, updates) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Notificaciones está deshabilitado. No se actualizó la notificación."
      );
      return null;
    }
    if (
      typeof updates !== "object" ||
      updates === null ||
      Object.keys(updates).length === 0
    ) {
      this.#logToConsole(
        "ERROR",
        "NotificationManager: Las actualizaciones deben ser un objeto no vacío."
      );
      return null;
    }

    const notificationIndex = this.#notifications.findIndex(
      (notif) => notif.id === notificationId
    );
    if (notificationIndex === -1) {
      this.#logToConsole(
        "WARN",
        `NotificationManager: No se encontró la notificación con ID ${notificationId} para actualizar.`
      );
      return null;
    }

    const currentNotification = this.#notifications[notificationIndex];
    let updated = false;

    // Aplica las actualizaciones con validación
    if (Object.prototype.hasOwnProperty.call(updates, "message")) {
      if (
        typeof updates.message === "string" &&
        updates.message.trim().length > 0
      ) {
        const newMessage = updates.message.trim();
        if (currentNotification.message !== newMessage) {
          currentNotification.message = newMessage;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'message' con un valor inválido."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "type")) {
      if (typeof updates.type === "string" && updates.type.trim().length > 0) {
        const newType = updates.type.trim();
        if (currentNotification.type !== newType) {
          currentNotification.type = newType;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'type' con un valor inválido."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "read")) {
      if (typeof updates.read === "boolean") {
        if (currentNotification.read !== updates.read) {
          currentNotification.read = updates.read;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'read' con un valor inválido (debe ser booleano)."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "context")) {
      if (typeof updates.context === "object" && updates.context !== null) {
        // Una actualización profunda de contexto podría ser más compleja, aquí se sobrescribe directamente.
        // Podrías implementar un merge si es necesario.
        if (
          JSON.stringify(currentNotification.context) !==
          JSON.stringify(updates.context)
        ) {
          currentNotification.context = { ...updates.context };
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'context' con un valor inválido (debe ser un objeto)."
        );
      }
    }

    if (updated) {
      // No hay un campo updatedAt en el esquema actual, pero se podría añadir si es relevante
      // currentNotification.updatedAt = Date.now();
      this.#saveNotifications();
      this.#logToConsole(
        "INFO",
        `Notificación con ID ${notificationId} actualizada:`,
        currentNotification
      );
      return currentNotification;
    } else {
      this.#logToConsole(
        "INFO",
        `Notificación con ID ${notificationId} no requirió actualización (no hubo cambios o actualizaciones inválidas).`
      );
      return currentNotification;
    }
  }

  /**
   * Elimina una notificación específica por su ID.
   * @param {string} notificationId - El ID de la notificación a eliminar.
   * @returns {boolean} True si la notificación fue eliminada, false de lo contrario.
   */
  removeNotification(notificationId) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Notificaciones está deshabilitado. No se eliminó la notificación."
      );
      return false;
    }
    const initialLength = this.#notifications.length;
    this.#notifications = this.#notifications.filter(
      (notif) => notif.id !== notificationId
    );
    if (this.#notifications.length < initialLength) {
      this.#saveNotifications();
      this.#logToConsole(
        "INFO",
        `Notificación con ID ${notificationId} eliminada.`
      );
      return true;
    }
    this.#logToConsole(
      "WARN",
      `No se encontró la notificación con ID ${notificationId} para eliminar.`
    );
    return false;
  }

  /**
   * Limpia todas las notificaciones (o las de un usuario específico).
   * @param {string} [userId] - Opcional. Si se proporciona, limpia solo las notificaciones de ese usuario.
   * @returns {number} El número de notificaciones eliminadas.
   */
  clearNotifications(userId) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Notificaciones está deshabilitado. No se limpiaron las notificaciones."
      );
      return 0;
    }
    const initialLength = this.#notifications.length;
    if (userId) {
      this.#notifications = this.#notifications.filter(
        (notif) => notif.userId !== userId
      );
    } else {
      this.#notifications = []; // Limpiar todas las notificaciones
    }
    const removedCount = initialLength - this.#notifications.length;
    if (removedCount > 0) {
      this.#saveNotifications();
      this.#logToConsole(
        "INFO",
        `Se eliminaron ${removedCount} notificaciones para ${
          userId ? `el usuario '${userId}'` : "todos los usuarios"
        }.`
      );
    } else {
      this.#logToConsole(
        "INFO",
        `No se encontraron notificaciones para limpiar para ${
          userId ? `el usuario '${userId}'` : "todos los usuarios"
        }.`
      );
    }
    return removedCount;
  }

  /**
   * Limpia las notificaciones que son más antiguas que un tiempo dado.
   * @param {number} maxAgeMs - La edad máxima en milisegundos para mantener los registros.
   * Ej: 7 días = 7 * 24 * 60 * 60 * 1000
   * @returns {number} El número de entradas eliminadas.
   */
  purgeOldNotifications(maxAgeMs) {
    const cutoffTime = Date.now() - maxAgeMs;
    const initialLength = this.#notifications.length;
    this.#notifications = this.#notifications.filter((notif) => {
      return notif.timestamp >= cutoffTime;
    });
    const purgedCount = initialLength - this.#notifications.length;
    if (purgedCount > 0) {
      this.#saveNotifications();
      this.#logToConsole(
        "INFO",
        `NotificationManager: Se purgaron ${purgedCount} notificaciones más antiguas que ${
          maxAgeMs / (1000 * 60 * 60 * 24)
        } días.`
      );
    } else {
      this.#logToConsole(
        "DEBUG",
        "NotificationManager: No se encontraron notificaciones para purgar."
      );
    }
    return purgedCount;
  }

  /**
   * Obtiene el número total de notificaciones o el número de notificaciones de un usuario/tipo específico.
   * @param {Object} [options={}] - Opciones de conteo.
   * @param {string} [options.userId] - Opcional. Si se proporciona, cuenta las notificaciones de ese usuario.
   * @param {string} [options.type] - Opcional. Si se proporciona, cuenta las notificaciones de ese tipo.
   * @param {boolean} [options.read] - Opcional. Si se proporciona, cuenta las notificaciones con ese estado de lectura.
   * @returns {number} El número de notificaciones.
   */
  getNotificationCount(options = {}) {
    let count = this.#notifications.length;
    if (options.userId) {
      count = this.#notifications.filter(
        (notif) => notif.userId === options.userId
      ).length;
    }
    if (options.type) {
      count = this.#notifications.filter(
        (notif) => notif.type === options.type
      ).length;
    }
    if (options.read !== undefined && typeof options.read === "boolean") {
      count = this.#notifications.filter(
        (notif) => notif.read === options.read
      ).length;
    }
    return count;
  }

  /**
   * Exporta todas las notificaciones almacenadas como una cadena JSON.
   * @returns {string} Una cadena JSON que representa todas las notificaciones.
   * @throws {Error} Si las notificaciones no pueden ser serializadas.
   */
  exportNotifications() {
    try {
      return JSON.stringify(this.#notifications, null, 2); // Formato legible
    } catch (error) {
      this.#logToConsole("ERROR", "Error al exportar notificaciones:", error);
      return "[]";
    }
  }

  /**
   * Restablece la instancia de NotificationManager a su estado inicial, borrando notificaciones y reiniciando la configuración.
   * @param {Object} [newOptions={}] - Nuevas opciones de configuración para aplicar después del reinicio.
   */
  reset(newOptions = {}) {
    this.#logToConsole(
      "WARN",
      "NotificationManager: Reiniciando la instancia (borrando notificaciones y configuración)..."
    );
    this.clearNotifications(); // Limpiar todas las notificaciones
    this.#config = {
      isEnabled: true,
      debounceDelay: 200,
      logLevel: "INFO",
      logSource: "frontend-notification",
    };
    // Aplicar nuevas opciones si se proporcionan
    this.#config = { ...this.#config, ...newOptions };
    // Validar el nivel de log después de aplicar las nuevas opciones
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#logToConsole(
      "INFO",
      "NotificationManager reiniciado con la configuración:",
      this.#config
    );
  }

  /**
   * Actualiza la configuración de NotificationManager.
   * @param {Object} newConfig - Objeto con las propiedades de configuración a actualizar.
   */
  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    if (newConfig.logLevel) {
      this.#config.logLevel = this.#validateLogLevel(newConfig.logLevel);
    }
    this.#logToConsole(
      "INFO",
      "NotificationManager: Configuración actualizada:",
      this.#config
    );
  }

  /**
   * Obtiene la configuración actual de NotificationManager.
   * @returns {Object} La configuración actual.
   */
  getConfig() {
    return { ...this.#config }; // Devolver una copia para evitar modificaciones directas
  }
}

// Exportar la clase para su uso con módulos ES
export default NotificationManager;
