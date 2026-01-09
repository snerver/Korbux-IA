/**
 * @file Permission.js
 * @description Clase para gestionar un registro de permisos en el lado del cliente utilizando localStorage.
 * Esta clase implementa el patrón Singleton y proporciona métodos para añadir, recuperar,
 * actualizar y eliminar permisos, con opciones de configuración y validación.
 *
 * @version 1.0.0
 */

class PermissionManager {
  /**
   * @private
   * @type {string}
   * @description Clave utilizada para almacenar los permisos en localStorage.
   */
  static #STORAGE_KEY = "korbux_permissions";

  /**
   * @private
   * @type {PermissionManager}
   * @description Instancia única de la clase PermissionManager (patrón Singleton).
   */
  static #instance = null;

  /**
   * @private
   * @type {Array<Object>}
   * @description Array interno para almacenar las entradas de permisos.
   */
  #permissions = [];

  /**
   * @private
   * @type {Object}
   * @description Configuración de la instancia de PermissionManager.
   */
  #config = {
    isEnabled: true, // Si la gestión de permisos está habilitada.
    debounceDelay: 200, // Retraso en ms para guardar en localStorage (para evitar escrituras excesivas).
    logLevel: "INFO", // Nivel mínimo de log a registrar (DEBUG, INFO, WARN, ERROR).
    logSource: "frontend-permission", // Fuente de los logs (ej. 'frontend-permission', 'backend-api').
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
   * Crea una instancia de PermissionManager.
   * Implementa el patrón Singleton para asegurar que solo haya una instancia.
   * @param {Object} [options={}] - Opciones de configuración iniciales.
   * @param {boolean} [options.isEnabled=true] - Si la gestión de permisos está habilitada.
   * @param {number} [options.debounceDelay=200] - Retraso en ms para guardar en localStorage.
   * @param {string} [options.logLevel='INFO'] - Nivel mínimo de log a registrar.
   * @param {string} [options.logSource='frontend-permission'] - Fuente de los logs.
   */
  constructor(options = {}) {
    if (PermissionManager.#instance) {
      return PermissionManager.#instance;
    }

    // Aplicar configuración inicial
    this.#config = { ...this.#config, ...options };

    // Validar el nivel de log
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);

    this.#loadPermissions();
    this.#logToConsole(
      "INFO",
      `Gestor de Permisos inicializado. Permisos cargados: ${
        this.#permissions.length
      }. Configuración:`,
      this.#config
    );

    PermissionManager.#instance = this;
  }

  /**
   * Obtiene la instancia única de PermissionManager (Singleton).
   * Si no existe, crea una nueva.
   * @param {Object} [options={}] - Opciones de configuración para la primera inicialización.
   * @returns {PermissionManager} La instancia única de PermissionManager.
   */
  static getInstance(options = {}) {
    if (!PermissionManager.#instance) {
      PermissionManager.#instance = new PermissionManager(options);
    }
    return PermissionManager.#instance;
  }

  /**
   * @private
   * @param {string} level - El nivel de log a validar.
   * @returns {string} El nivel de log validado o el valor por defecto ('INFO').
   * @description Método para validar y normalizar el nivel de log.
   */
  #validateLogLevel(level) {
    const sanitizedLevel = level.toUpperCase();
    if (!PermissionManager.#LOG_LEVELS.hasOwnProperty(sanitizedLevel)) {
      console.warn(
        `PermissionManager: Nivel de log '${level}' no reconocido. Usando 'INFO'.`
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
      PermissionManager.#LOG_LEVELS[this.#config.logLevel];
    const messageLevelValue = PermissionManager.#LOG_LEVELS[level];

    if (messageLevelValue >= currentLevelValue) {
      const logPrefix = `[PermissionManager - ${level}]`;
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
   * Carga los permisos desde localStorage al array interno.
   * @private
   */
  #loadPermissions() {
    try {
      const storedPermissions = localStorage.getItem(
        PermissionManager.#STORAGE_KEY
      );
      if (storedPermissions) {
        const parsedPermissions = JSON.parse(storedPermissions);
        if (Array.isArray(parsedPermissions)) {
          this.#permissions = parsedPermissions;
        } else {
          this.#logToConsole(
            "WARN",
            "PermissionManager: Datos de permisos en localStorage no son un array. Reiniciando permisos."
          );
          this.#permissions = [];
          localStorage.removeItem(PermissionManager.#STORAGE_KEY);
        }
      }
    } catch (error) {
      this.#logToConsole(
        "ERROR",
        `Error al cargar permisos desde localStorage: ${error.name} - ${error.message}`,
        error
      );
      this.#permissions = [];
      localStorage.removeItem(PermissionManager.#STORAGE_KEY);
    }
  }

  /**
   * Guarda el array interno de permisos en localStorage con debounce.
   * @private
   */
  #savePermissions() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          PermissionManager.#STORAGE_KEY,
          JSON.stringify(this.#permissions)
        );
        this.#logToConsole("DEBUG", "Permisos guardados en localStorage.");
      } catch (error) {
        this.#logToConsole(
          "ERROR",
          "Error al guardar permisos en localStorage:",
          error
        );
        if (error.name === "QuotaExceededError") {
          this.#logToConsole(
            "WARN",
            "QuotaExceededError: El almacenamiento local está lleno. Considera purgar permisos antiguos."
          );
          // Opcional: Intentar purgar automáticamente si la cuota está excedida
          // this.purgeOldPermissions(365 * 24 * 60 * 60 * 1000); // Purga permisos de más de 1 año
          // this.#savePermissions(); // Reintentar guardar después de purgar
        }
      }
    }, this.#config.debounceDelay);
  }

  /**
   * Genera un objeto de entrada de permiso estandarizado.
   * @private
   * @param {string} name - Nombre único del permiso.
   * @param {string} [description=''] - Descripción del permiso.
   * @param {string} [status='active'] - Estado del permiso (ej. 'active', 'inactive', 'deprecated').
   * @returns {Object} La entrada de permiso formateada.
   */
  #createPermissionEntry(name, description, status) {
    const now = Date.now(); // Usar timestamp numérico
    return {
      _v: 1, // Versión del esquema de la entrada de permiso
      id: crypto.randomUUID(), // ID único para cada permiso
      name: name.trim(),
      description: description.trim(),
      status: status.trim(),
      createdAt: now, // Fecha y hora de creación
      updatedAt: now, // Fecha y hora de última actualización
      source: this.#config.logSource, // Fuente del permiso
    };
  }

  /**
   * Añade un nuevo permiso al registro.
   * @param {string} name - Nombre único del permiso.
   * @param {string} [description=''] - Descripción del permiso.
   * @param {string} [status='active'] - Estado inicial del permiso (ej. 'active', 'inactive', 'deprecated').
   * @returns {Object|null} El permiso añadido o null si falla.
   */
  addPermission(name, description = "", status = "active") {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Permisos está deshabilitado. No se añadió el permiso."
      );
      return null;
    }

    // Validaciones
    if (typeof name !== "string" || name.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "PermissionManager: El nombre del permiso debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (typeof description !== "string") {
      this.#logToConsole(
        "WARN",
        "PermissionManager: La descripción debe ser una cadena de texto. Se usará una cadena vacía."
      );
      description = "";
    }
    if (typeof status !== "string" || status.trim().length === 0) {
      this.#logToConsole(
        "WARN",
        "PermissionManager: El estado del permiso debe ser una cadena de texto no vacía. Se usará 'active'."
      );
      status = "active";
    }

    const normalizedName = name.trim().toLowerCase();
    if (
      this.#permissions.some((p) => p.name.toLowerCase() === normalizedName)
    ) {
      this.#logToConsole(
        "WARN",
        `PermissionManager: El permiso con nombre '${name}' ya existe.`
      );
      return null;
    }

    const newPermission = this.#createPermissionEntry(
      name,
      description,
      status
    );
    this.#permissions.push(newPermission);
    this.#savePermissions();
    this.#logToConsole("INFO", "Nuevo permiso añadido:", newPermission);
    return newPermission;
  }

  /**
   * Recupera permisos con opciones de filtrado y ordenamiento.
   * @param {Object} [options={}] - Opciones de filtrado y ordenamiento.
   * @param {string} [options.name] - Filtra por nombre exacto del permiso (insensible a mayúsculas/minúsculas).
   * @param {string} [options.status] - Filtra por estado del permiso (ej. 'active', 'inactive').
   * @param {string} [options.search] - Busca permisos cuyo nombre o descripción contenga el texto (insensible a mayúsculas/minúsculas).
   * @param {Date|number} [options.startDate] - Fecha de inicio para el rango de tiempo (Date object o timestamp).
   * @param {Date|number} [options.endDate] - Fecha de fin para el rango de tiempo (Date object o timestamp).
   * @param {'asc'|'desc'} [options.sortByName='asc'] - Ordena por nombre (ascendente o descendente).
   * @param {'asc'|'desc'} [options.sortByTimestamp='desc'] - Ordena por timestamp (creación) (ascendente o descendente).
   * @returns {Array<Object>} Un array de objetos, donde cada objeto es un permiso.
   */
  getPermissions(options = {}) {
    let filteredPermissions = [...this.#permissions];

    if (options.name) {
      const searchName = options.name.toLowerCase();
      filteredPermissions = filteredPermissions.filter(
        (p) => p.name.toLowerCase() === searchName
      );
    }
    if (options.status) {
      filteredPermissions = filteredPermissions.filter(
        (p) => p.status === options.status
      );
    }
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      filteredPermissions = filteredPermissions.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.description.toLowerCase().includes(searchTerm)
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
      filteredPermissions = filteredPermissions.filter((p) => {
        return p.createdAt >= start && p.createdAt <= end;
      });
    }

    // Aplicar ordenamiento
    if (options.sortByName) {
      filteredPermissions.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return options.sortByName === "asc" ? -1 : 1;
        if (nameA > nameB) return options.sortByName === "asc" ? 1 : -1;
        return 0;
      });
    } else if (options.sortByTimestamp === "asc") {
      filteredPermissions.sort((a, b) => a.createdAt - b.createdAt);
    } else {
      // default 'desc' para timestamp
      filteredPermissions.sort((a, b) => b.createdAt - a.createdAt);
    }

    return filteredPermissions;
  }

  /**
   * Obtiene un permiso por su ID.
   * @param {string} permissionId - El ID único del permiso.
   * @returns {Object|undefined} El permiso encontrado o undefined si no existe.
   */
  getPermissionById(permissionId) {
    return this.#permissions.find((p) => p.id === permissionId);
  }

  /**
   * Actualiza un permiso existente por su ID.
   * @param {string} permissionId - El ID del permiso a actualizar.
   * @param {Object} updates - Un objeto con las propiedades a actualizar (ej. { name: 'nuevo_permiso', status: 'inactive' }).
   * @returns {Object|null} El permiso actualizado o null si no se encontró o la actualización falla.
   */
  updatePermission(permissionId, updates) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Permisos está deshabilitado. No se actualizó el permiso."
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
        "PermissionManager: Las actualizaciones deben ser un objeto no vacío."
      );
      return null;
    }

    const permissionIndex = this.#permissions.findIndex(
      (p) => p.id === permissionId
    );
    if (permissionIndex === -1) {
      this.#logToConsole(
        "WARN",
        `PermissionManager: No se encontró el permiso con ID ${permissionId} para actualizar.`
      );
      return null;
    }

    const currentPermission = this.#permissions[permissionIndex];
    let updated = false;

    // Aplica las actualizaciones con validación
    if (Object.prototype.hasOwnProperty.call(updates, "name")) {
      if (typeof updates.name === "string" && updates.name.trim().length > 0) {
        const newName = updates.name.trim();
        // Verificar si el nuevo nombre ya existe en otro permiso (insensible a mayúsculas/minúsculas)
        if (
          this.#permissions.some(
            (p, idx) =>
              idx !== permissionIndex &&
              p.name.toLowerCase() === newName.toLowerCase()
          )
        ) {
          this.#logToConsole(
            "WARN",
            `PermissionManager: El nombre '${newName}' ya está en uso por otro permiso.`
          );
          return null;
        }
        if (currentPermission.name !== newName) {
          currentPermission.name = newName;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'name' con un valor inválido."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "description")) {
      if (typeof updates.description === "string") {
        const newDescription = updates.description.trim();
        if (currentPermission.description !== newDescription) {
          currentPermission.description = newDescription;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'description' con un valor inválido."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "status")) {
      if (
        typeof updates.status === "string" &&
        updates.status.trim().length > 0
      ) {
        const newStatus = updates.status.trim();
        if (currentPermission.status !== newStatus) {
          currentPermission.status = newStatus;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'status' con un valor inválido."
        );
      }
    }

    if (updated) {
      currentPermission.updatedAt = Date.now(); // Actualizar timestamp
      this.#savePermissions();
      this.#logToConsole(
        "INFO",
        `Permiso con ID ${permissionId} actualizado:`,
        currentPermission
      );
      return currentPermission;
    } else {
      this.#logToConsole(
        "INFO",
        `Permiso con ID ${permissionId} no requirió actualización (no hubo cambios o actualizaciones inválidas).`
      );
      return currentPermission;
    }
  }

  /**
   * Elimina un permiso específico por su ID.
   * @param {string} permissionId - El ID del permiso a eliminar.
   * @returns {boolean} True si el permiso fue eliminado, false de lo contrario.
   */
  removePermission(permissionId) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Permisos está deshabilitado. No se eliminó el permiso."
      );
      return false;
    }
    const initialLength = this.#permissions.length;
    this.#permissions = this.#permissions.filter((p) => p.id !== permissionId);
    if (this.#permissions.length < initialLength) {
      this.#savePermissions();
      this.#logToConsole("INFO", `Permiso con ID ${permissionId} eliminado.`);
      return true;
    }
    this.#logToConsole(
      "WARN",
      `No se encontró el permiso con ID ${permissionId} para eliminar.`
    );
    return false;
  }

  /**
   * Limpia todos los permisos (o los de un estado específico).
   * @param {Object} [options={}] - Opciones de limpieza.
   * @param {string} [options.status] - Opcional. Si se proporciona, limpia solo los permisos con ese estado.
   * @returns {number} El número de permisos eliminados.
   */
  clearPermissions(options = {}) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Permisos está deshabilitado. No se limpiaron los permisos."
      );
      return 0;
    }
    const initialLength = this.#permissions.length;
    let filteredForRemoval = [...this.#permissions];

    if (options.status) {
      filteredForRemoval = filteredForRemoval.filter(
        (p) => p.status === options.status
      );
    }

    // Si no hay filtros, o los filtros resultan en todos los permisos, limpiar todo.
    if (!options.status) {
      this.#permissions = [];
    } else {
      // Eliminar los permisos filtrados del array original
      const idsToRemove = new Set(filteredForRemoval.map((p) => p.id));
      this.#permissions = this.#permissions.filter(
        (p) => !idsToRemove.has(p.id)
      );
    }

    const removedCount = initialLength - this.#permissions.length;

    if (removedCount > 0) {
      this.#savePermissions();
      this.#logToConsole(
        "INFO",
        `Se eliminaron ${removedCount} permisos ${
          options.status ? `con estado '${options.status}'` : ""
        }.`
      );
    } else {
      this.#logToConsole(
        "INFO",
        `No se encontraron permisos para limpiar ${
          options.status ? `con estado '${options.status}'` : ""
        }.`
      );
    }
    return removedCount;
  }

  /**
   * Limpia los permisos que son más antiguos que un tiempo dado.
   * @param {number} maxAgeMs - La edad máxima en milisegundos para mantener los permisos.
   * Ej: 365 días = 365 * 24 * 60 * 60 * 1000
   * @returns {number} El número de entradas eliminadas.
   */
  purgeOldPermissions(maxAgeMs) {
    const cutoffTime = Date.now() - maxAgeMs;
    const initialLength = this.#permissions.length;
    this.#permissions = this.#permissions.filter((p) => {
      return p.createdAt >= cutoffTime;
    });
    const purgedCount = initialLength - this.#permissions.length;
    if (purgedCount > 0) {
      this.#savePermissions();
      this.#logToConsole(
        "INFO",
        `PermissionManager: Se purgaron ${purgedCount} permisos más antiguos que ${
          maxAgeMs / (1000 * 60 * 60 * 24)
        } días.`
      );
    } else {
      this.#logToConsole(
        "DEBUG",
        "PermissionManager: No se encontraron permisos para purgar."
      );
    }
    return purgedCount;
  }

  /**
   * Obtiene el número total de permisos o el número de permisos de un estado específico.
   * @param {Object} [options={}] - Opciones de conteo.
   * @param {string} [options.status] - Opcional. Si se proporciona, cuenta los permisos con ese estado.
   * @returns {number} El número de permisos.
   */
  getPermissionCount(options = {}) {
    let count = this.#permissions.length;
    if (options.status) {
      count = this.#permissions.filter(
        (p) => p.status === options.status
      ).length;
    }
    return count;
  }

  /**
   * Exporta todos los permisos almacenados como una cadena JSON.
   * @returns {string} Una cadena JSON que representa todos los permisos.
   * @throws {Error} Si los permisos no pueden ser serializados.
   */
  exportPermissions() {
    try {
      return JSON.stringify(this.#permissions, null, 2); // Formato legible
    } catch (error) {
      this.#logToConsole("ERROR", "Error al exportar permisos:", error);
      return "[]";
    }
  }

  /**
   * Restablece la instancia de PermissionManager a su estado inicial, borrando permisos y reiniciando la configuración.
   * @param {Object} [newOptions={}] - Nuevas opciones de configuración para aplicar después del reinicio.
   */
  reset(newOptions = {}) {
    this.#logToConsole(
      "WARN",
      "PermissionManager: Reiniciando la instancia (borrando permisos y configuración)..."
    );
    this.clearPermissions(); // Limpiar todos los permisos
    this.#config = {
      isEnabled: true,
      debounceDelay: 200,
      logLevel: "INFO",
      logSource: "frontend-permission",
    };
    // Aplicar nuevas opciones si se proporcionan
    this.#config = { ...this.#config, ...newOptions };
    // Validar el nivel de log después de aplicar las nuevas opciones
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#logToConsole(
      "INFO",
      "PermissionManager reiniciado con la configuración:",
      this.#config
    );
  }

  /**
   * Actualiza la configuración de PermissionManager.
   * @param {Object} newConfig - Objeto con las propiedades de configuración a actualizar.
   */
  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    if (newConfig.logLevel) {
      this.#config.logLevel = this.#validateLogLevel(newConfig.logLevel);
    }
    this.#logToConsole(
      "INFO",
      "PermissionManager: Configuración actualizada:",
      this.#config
    );
  }

  /**
   * Obtiene la configuración actual de PermissionManager.
   * @returns {Object} La configuración actual.
   */
  getConfig() {
    return { ...this.#config }; // Devolver una copia para evitar modificaciones directas
  }
}

// Exportar la clase para su uso con módulos ES
export default PermissionManager;
