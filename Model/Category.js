/**
 * @file Category.js
 * @description Clase para gestionar un registro de categorías en el lado del cliente utilizando localStorage.
 * Esta clase implementa el patrón Singleton y proporciona métodos para añadir, recuperar,
 * actualizar y eliminar categorías, con opciones de configuración y validación.
 *
 * @version 1.2.0 - Eliminado el límite de categorías.
 */

class Category {
  /**
   * @private
   * @type {string}
   * @description Clave utilizada para almacenar las categorías en localStorage.
   */
  static #STORAGE_KEY = "korbux_categories";

  /**
   * @private
   * @type {Category}
   * @description Instancia única de la clase Category (patrón Singleton).
   */
  static #instance = null;

  /**
   * @private
   * @type {Array<Object>}
   * @description Array interno para almacenar las entradas de categoría.
   */
  #categories = [];

  /**
   * @private
   * @type {Object}
   * @description Configuración de la instancia de Category.
   */
  #config = {
    // maxCategories: 200, // Límite máximo de categorías a almacenar. (Eliminado)
    isEnabled: true, // Si la gestión de categorías está habilitada.
    debounceDelay: 300, // Retraso en ms para guardar en localStorage (para evitar escrituras excesivas).
    logLevel: "INFO", // Nivel mínimo de log a registrar (DEBUG, INFO, WARN, ERROR).
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
   * Crea una instancia de Category.
   * Implementa el patrón Singleton para asegurar que solo haya una instancia.
   * @param {Object} [options={}] - Opciones de configuración iniciales.
   * @param {boolean} [options.isEnabled=true] - Si la gestión de categorías está habilitada.
   * @param {number} [options.debounceDelay=300] - Retraso en ms para guardar en localStorage.
   * @param {string} [options.logLevel='INFO'] - Nivel mínimo de log a registrar.
   */
  constructor(options = {}) {
    if (Category.#instance) {
      return Category.#instance;
    }

    // Aplicar configuración inicial
    this.#config = { ...this.#config, ...options };

    // Mejora: Validar el nivel de log al inicializar
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);

    this.#loadCategories();
    this.#logToConsole(
      "INFO",
      `Category Manager inicializado. Categorías cargadas: ${
        this.#categories.length
      }. Configuración:`,
      this.#config
    );

    Category.#instance = this;
  }

  /**
   * Obtiene la instancia única de Category (Singleton).
   * Si no existe, crea una nueva.
   * @param {Object} [options={}] - Opciones de configuración para la primera inicialización.
   * @returns {Category} La instancia única de Category.
   */
  static getInstance(options = {}) {
    if (!Category.#instance) {
      Category.#instance = new Category(options);
    }
    return Category.#instance;
  }

  /**
   * @private
   * @param {string} level - El nivel de log a validar.
   * @returns {string} El nivel de log validado o el valor por defecto ('INFO').
   * @description Método para validar y normalizar el nivel de log, similar a AuditLog.
   */
  #validateLogLevel(level) {
    const sanitizedLevel = level.toUpperCase();
    if (!Category.#LOG_LEVELS.hasOwnProperty(sanitizedLevel)) {
      console.warn(
        `Category: Nivel de log '${level}' no reconocido. Usando 'INFO'.`
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
    const currentLevelValue = Category.#LOG_LEVELS[this.#config.logLevel];
    const messageLevelValue = Category.#LOG_LEVELS[level];

    if (messageLevelValue >= currentLevelValue) {
      const logPrefix = `[Category - ${level}]`;
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
   * Carga las categorías desde localStorage al array interno.
   * @private
   */
  #loadCategories() {
    try {
      const storedCategories = localStorage.getItem(Category.#STORAGE_KEY);
      if (storedCategories) {
        const parsedCategories = JSON.parse(storedCategories);
        if (Array.isArray(parsedCategories)) {
          this.#categories = parsedCategories; // Ya no se limita al cargar
        } else {
          this.#logToConsole(
            "WARN",
            "Category: Datos de categoría en localStorage no son un array. Reiniciando categorías."
          );
          this.#categories = [];
          localStorage.removeItem(Category.#STORAGE_KEY); // Limpiar datos corruptos
        }
      }
    } catch (error) {
      this.#logToConsole(
        "ERROR",
        "Error al cargar categorías desde localStorage:",
        error
      );
      this.#categories = []; // Resetear si hay un error al parsear
      localStorage.removeItem(Category.#STORAGE_KEY); // Limpiar datos potencialmente corruptos
    }
  }

  /**
   * Guarda el array interno de categorías en localStorage con debounce.
   * @private
   */
  #saveCategories() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      try {
        // Ya no se limita el número de categorías al guardar
        localStorage.setItem(
          Category.#STORAGE_KEY,
          JSON.stringify(this.#categories)
        );
        this.#logToConsole("DEBUG", "Categorías guardadas en localStorage.");
      } catch (error) {
        this.#logToConsole(
          "ERROR",
          "Error al guardar categorías en localStorage:",
          error
        );
        if (error.name === "QuotaExceededError") {
          this.#logToConsole(
            "WARN",
            "QuotaExceededError: El almacenamiento local está lleno. Considera purgar categorías manualmente."
          );
        }
      }
    }, this.#config.debounceDelay);
  }

  /**
   * Genera un objeto de entrada de categoría estandarizado.
   * @private
   * @param {string} name - Nombre de la categoría.
   * @param {string} [description=''] - Descripción de la categoría.
   * @returns {Object} La entrada de categoría formateada.
   */
  #createCategoryEntry(name, description) {
    const now = Date.now();
    return {
      _v: 1,
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description ? description.trim() : "",
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Añade una nueva categoría al registro.
   * @param {string} name - Nombre único de la categoría.
   * @param {string} [description=''] - Descripción de la categoría.
   * @returns {Object|null} La categoría añadida o null si falla.
   */
  addCategory(name, description = "") {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Category Manager está deshabilitado. No se añadió la categoría."
      );
      return null;
    }

    if (typeof name !== "string" || name.trim() === "") {
      this.#logToConsole(
        "ERROR",
        "Category: El nombre de la categoría debe ser una cadena de texto no vacía."
      );
      return null;
    }

    const normalizedName = name.trim().toLowerCase();
    if (
      this.#categories.some((cat) => cat.name.toLowerCase() === normalizedName)
    ) {
      this.#logToConsole(
        "WARN",
        `Category: La categoría con el nombre '${name}' ya existe.`
      );
      return null;
    }

    const newCategory = this.#createCategoryEntry(name, description);
    this.#categories.push(newCategory);
    this.#saveCategories();
    this.#logToConsole("INFO", "Nueva categoría añadida:", newCategory);
    return newCategory;
  }

  /**
   * Recupera categorías con opciones de filtrado y ordenamiento.
   * @param {Object} [options={}] - Opciones de filtrado y ordenamiento.
   * @param {string} [options.name] - Filtra por nombre de categoría (insensible a mayúsculas/minúsculas).
   * @param {string} [options.search] - Busca categorías cuyo nombre o descripción contenga el texto (insensible a mayúsculas/minúsculas).
   * @param {'asc'|'desc'} [options.sortByName='asc'] - Ordena por nombre (ascendente o descendente).
   * @param {'asc'|'desc'} [options.sortByCreatedAt] - Ordena por fecha de creación.
   * @param {'asc'|'desc'} [options.sortByUpdatedAt] - Ordena por fecha de última actualización.
   * @returns {Array<Object>} Un array de objetos, donde cada objeto es una categoría.
   */
  getCategories(options = {}) {
    let filteredCategories = [...this.#categories];

    // Aplicar filtros
    if (options.name) {
      const searchName = options.name.toLowerCase();
      filteredCategories = filteredCategories.filter(
        (cat) => cat.name.toLowerCase() === searchName
      );
    }
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      filteredCategories = filteredCategories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(searchTerm) ||
          (cat.description &&
            cat.description.toLowerCase().includes(searchTerm))
      );
    }

    // Aplicar ordenamiento
    if (options.sortByName) {
      filteredCategories.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return options.sortByName === "asc" ? -1 : 1;
        if (nameA > nameB) return options.sortByName === "asc" ? 1 : -1;
        return 0;
      });
    } else if (options.sortByCreatedAt) {
      filteredCategories.sort((a, b) => {
        return options.sortByCreatedAt === "asc"
          ? a.createdAt - b.createdAt
          : b.createdAt - a.createdAt;
      });
    } else if (options.sortByUpdatedAt) {
      filteredCategories.sort((a, b) => {
        return options.sortByUpdatedAt === "asc"
          ? a.updatedAt - b.updatedAt
          : b.updatedAt - a.updatedAt;
      });
    }

    return filteredCategories;
  }

  /**
   * Obtiene una categoría por su ID.
   * @param {string} categoryId - El ID único de la categoría.
   * @returns {Object|undefined} La categoría encontrada o undefined si no existe.
   */
  getCategoryById(categoryId) {
    return this.#categories.find((cat) => cat.id === categoryId);
  }

  /**
   * Actualiza una categoría existente por su ID.
   * @param {string} categoryId - El ID de la categoría a actualizar.
   * @param {Object} updates - Un objeto con las propiedades a actualizar (ej. { name: 'Nuevo Nombre', description: 'Nueva Descripción' }).
   * @returns {Object|null} La categoría actualizada o null si no se encontró o la actualización falla.
   */
  updateCategory(categoryId, updates) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Category Manager está deshabilitado. No se actualizó la categoría."
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
        "Category: Las actualizaciones deben ser un objeto no vacío."
      );
      return null;
    }

    const categoryIndex = this.#categories.findIndex(
      (cat) => cat.id === categoryId
    );
    if (categoryIndex === -1) {
      this.#logToConsole(
        "WARN",
        `Category: No se encontró la categoría con ID ${categoryId} para actualizar.`
      );
      return null;
    }

    const currentCategory = this.#categories[categoryIndex];
    let updated = false;

    if (Object.prototype.hasOwnProperty.call(updates, "name")) {
      if (typeof updates.name === "string" && updates.name.trim() !== "") {
        const newName = updates.name.trim();
        if (
          this.#categories.some(
            (cat, idx) =>
              idx !== categoryIndex &&
              cat.name.toLowerCase() === newName.toLowerCase()
          )
        ) {
          this.#logToConsole(
            "WARN",
            `Category: El nombre '${newName}' ya está en uso por otra categoría.`
          );
          return null;
        }
        if (currentCategory.name !== newName) {
          currentCategory.name = newName;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Category: El nombre de la categoría proporcionado para la actualización no es válido o está vacío."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "description")) {
      if (typeof updates.description === "string") {
        const newDescription = updates.description.trim();
        if (currentCategory.description !== newDescription) {
          currentCategory.description = newDescription;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Category: La descripción de la categoría proporcionada para la actualización no es válida."
        );
      }
    }

    if (updated) {
      currentCategory.updatedAt = Date.now();
      this.#saveCategories();
      this.#logToConsole(
        "INFO",
        `Categoría con ID ${categoryId} actualizada:`,
        currentCategory
      );
      return currentCategory;
    } else {
      this.#logToConsole(
        "INFO",
        `Categoría con ID ${categoryId} no requirió actualización (no hubo cambios o actualizaciones inválidas).`
      );
      return currentCategory;
    }
  }

  /**
   * Elimina una categoría específica por su ID.
   * @param {string} categoryId - El ID de la categoría a eliminar.
   * @returns {boolean} True si la categoría fue eliminada, false de lo contrario.
   */
  removeCategory(categoryId) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Category Manager está deshabilitado. No se eliminó la categoría."
      );
      return false;
    }
    const initialLength = this.#categories.length;
    this.#categories = this.#categories.filter((cat) => cat.id !== categoryId);
    if (this.#categories.length < initialLength) {
      this.#saveCategories();
      this.#logToConsole("INFO", `Categoría con ID ${categoryId} eliminada.`);
      return true;
    }
    this.#logToConsole(
      "WARN",
      `No se encontró la categoría con ID ${categoryId} para eliminar.`
    );
    return false;
  }

  /**
   * Limpia todas las entradas de categoría.
   * Esto eliminará las categorías tanto del array interno como de localStorage.
   */
  clearCategories() {
    this.#categories = [];
    this.#saveCategories();
    this.#logToConsole(
      "INFO",
      "Category: Todas las categorías han sido limpiadas."
    );
  }

  /**
   * Restablece la instancia de Category a su estado inicial, borrando categorías y reiniciando la configuración.
   * @param {Object} [newOptions={}] - Nuevas opciones de configuración para aplicar después del reinicio.
   */
  reset(newOptions = {}) {
    this.#logToConsole(
      "WARN",
      "Category: Reiniciando la instancia (borrando categorías y configuración)..."
    );
    this.clearCategories();
    this.#config = {
      isEnabled: true,
      debounceDelay: 300,
      logLevel: "INFO",
    };
    this.#config = { ...this.#config, ...newOptions };
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#logToConsole(
      "INFO",
      "Category reiniciado con la configuración:",
      this.#config
    );
  }

  /**
   * Actualiza la configuración de Category.
   * @param {Object} newConfig - Objeto con las propiedades de configuración a actualizar.
   */
  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    if (newConfig.logLevel) {
      this.#config.logLevel = this.#validateLogLevel(newConfig.logLevel);
    }
    this.#logToConsole(
      "INFO",
      "Category: Configuración actualizada:",
      this.#config
    );
  }

  /**
   * Obtiene la configuración actual de Category.
   * @returns {Object} La configuración actual.
   */
  getConfig() {
    return { ...this.#config };
  }
}

// Exportar la clase para su uso con módulos ES
export default Category;
