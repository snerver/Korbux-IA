/**
 * @file Order.js
 * @description Clase para gestionar un registro de pedidos en el lado del cliente utilizando localStorage.
 * Esta clase implementa el patrón Singleton y proporciona métodos para añadir, recuperar,
 * actualizar y eliminar pedidos, con opciones de configuración y validación.
 *
 * @version 1.0.0
 */

class OrderManager {
  /**
   * @private
   * @type {string}
   * @description Clave utilizada para almacenar los pedidos en localStorage.
   */
  static #STORAGE_KEY = "korbux_orders";

  /**
   * @private
   * @type {OrderManager}
   * @description Instancia única de la clase OrderManager (patrón Singleton).
   */
  static #instance = null;

  /**
   * @private
   * @type {Array<Object>}
   * @description Array interno para almacenar las entradas de pedidos.
   */
  #orders = [];

  /**
   * @private
   * @type {Object}
   * @description Configuración de la instancia de OrderManager.
   */
  #config = {
    isEnabled: true, // Si la gestión de pedidos está habilitada.
    debounceDelay: 200, // Retraso en ms para guardar en localStorage (para evitar escrituras excesivas).
    logLevel: "INFO", // Nivel mínimo de log a registrar (DEBUG, INFO, WARN, ERROR).
    logSource: "frontend-order", // Fuente de los logs (ej. 'frontend-order', 'backend-api').
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
   * Crea una instancia de OrderManager.
   * Implementa el patrón Singleton para asegurar que solo haya una instancia.
   * @param {Object} [options={}] - Opciones de configuración iniciales.
   * @param {boolean} [options.isEnabled=true] - Si la gestión de pedidos está habilitada.
   * @param {number} [options.debounceDelay=200] - Retraso en ms para guardar en localStorage.
   * @param {string} [options.logLevel='INFO'] - Nivel mínimo de log a registrar.
   * @param {string} [options.logSource='frontend-order'] - Fuente de los logs.
   */
  constructor(options = {}) {
    if (OrderManager.#instance) {
      return OrderManager.#instance;
    }

    // Aplicar configuración inicial
    this.#config = { ...this.#config, ...options };

    // Validar el nivel de log
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);

    this.#loadOrders();
    this.#logToConsole(
      "INFO",
      `Gestor de Pedidos inicializado. Pedidos cargados: ${
        this.#orders.length
      }. Configuración:`,
      this.#config
    );

    OrderManager.#instance = this;
  }

  /**
   * Obtiene la instancia única de OrderManager (Singleton).
   * Si no existe, crea una nueva.
   * @param {Object} [options={}] - Opciones de configuración para la primera inicialización.
   * @returns {OrderManager} La instancia única de OrderManager.
   */
  static getInstance(options = {}) {
    if (!OrderManager.#instance) {
      OrderManager.#instance = new OrderManager(options);
    }
    return OrderManager.#instance;
  }

  /**
   * @private
   * @param {string} level - El nivel de log a validar.
   * @returns {string} El nivel de log validado o el valor por defecto ('INFO').
   * @description Método para validar y normalizar el nivel de log.
   */
  #validateLogLevel(level) {
    const sanitizedLevel = level.toUpperCase();
    if (!OrderManager.#LOG_LEVELS.hasOwnProperty(sanitizedLevel)) {
      console.warn(
        `OrderManager: Nivel de log '${level}' no reconocido. Usando 'INFO'.`
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
    const currentLevelValue = OrderManager.#LOG_LEVELS[this.#config.logLevel];
    const messageLevelValue = OrderManager.#LOG_LEVELS[level];

    if (messageLevelValue >= currentLevelValue) {
      const logPrefix = `[OrderManager - ${level}]`;
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
   * Carga los pedidos desde localStorage al array interno.
   * @private
   */
  #loadOrders() {
    try {
      const storedOrders = localStorage.getItem(OrderManager.#STORAGE_KEY);
      if (storedOrders) {
        const parsedOrders = JSON.parse(storedOrders);
        if (Array.isArray(parsedOrders)) {
          this.#orders = parsedOrders;
        } else {
          this.#logToConsole(
            "WARN",
            "OrderManager: Datos de pedidos en localStorage no son un array. Reiniciando pedidos."
          );
          this.#orders = [];
          localStorage.removeItem(OrderManager.#STORAGE_KEY);
        }
      }
    } catch (error) {
      this.#logToConsole(
        "ERROR",
        `Error al cargar pedidos desde localStorage: ${error.name} - ${error.message}`,
        error
      );
      this.#orders = [];
      localStorage.removeItem(OrderManager.#STORAGE_KEY);
    }
  }

  /**
   * Guarda el array interno de pedidos en localStorage con debounce.
   * @private
   */
  #saveOrders() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          OrderManager.#STORAGE_KEY,
          JSON.stringify(this.#orders)
        );
        this.#logToConsole("DEBUG", "Pedidos guardados en localStorage.");
      } catch (error) {
        this.#logToConsole(
          "ERROR",
          "Error al guardar pedidos en localStorage:",
          error
        );
        if (error.name === "QuotaExceededError") {
          this.#logToConsole(
            "WARN",
            "QuotaExceededError: El almacenamiento local está lleno. Considera purgar pedidos antiguos."
          );
          // Opcional: Intentar purgar automáticamente si la cuota está excedida
          // this.purgeOldOrders(30 * 24 * 60 * 60 * 1000); // Purga pedidos de más de 30 días
          // this.#saveOrders(); // Reintentar guardar después de purgar
        }
      }
    }, this.#config.debounceDelay);
  }

  /**
   * Genera un objeto de entrada de pedido estandarizado.
   * @private
   * @param {string} userId - ID del usuario que realiza el pedido.
   * @param {Array<Object>} items - Array de objetos que representan los artículos del pedido.
   * @param {number} total - El monto total del pedido.
   * @param {string} [status='pending'] - El estado actual del pedido (ej. 'pending', 'completed', 'cancelled').
   * @param {Object} [shippingAddress={}] - Dirección de envío del pedido.
   * @returns {Object} La entrada de pedido formateada.
   */
  #createOrderEntry(userId, items, total, status, shippingAddress) {
    const now = Date.now(); // Usar timestamp numérico
    return {
      _v: 1, // Versión del esquema de la entrada de pedido
      id: crypto.randomUUID(), // ID único para cada pedido
      userId: userId.trim(),
      items: items,
      total: total,
      status: status.trim(),
      shippingAddress: shippingAddress,
      createdAt: now, // Fecha y hora de creación
      updatedAt: now, // Fecha y hora de última actualización
      source: this.#config.logSource, // Fuente del pedido
    };
  }

  /**
   * Añade un nuevo pedido al registro.
   * @param {string} userId - ID del usuario que realiza el pedido.
   * @param {Array<Object>} items - Array de objetos que representan los artículos del pedido (ej. [{ productId: 'p1', quantity: 2, price: 10.50 }]).
   * @param {number} total - El monto total del pedido.
   * @param {string} [status='pending'] - El estado inicial del pedido (ej. 'pending', 'completed', 'cancelled').
   * @param {Object} [shippingAddress={}] - Dirección de envío del pedido.
   * @returns {Object|null} El pedido añadido o null si falla.
   */
  addOrder(userId, items, total, status = "pending", shippingAddress = {}) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Pedidos está deshabilitado. No se añadió el pedido."
      );
      return null;
    }

    // Validaciones
    if (typeof userId !== "string" || userId.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "OrderManager: El ID de usuario debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (!Array.isArray(items) || items.length === 0) {
      this.#logToConsole(
        "ERROR",
        "OrderManager: Los artículos del pedido deben ser un array no vacío."
      );
      return null;
    }
    if (typeof total !== "number" || total < 0) {
      this.#logToConsole(
        "ERROR",
        "OrderManager: El total del pedido debe ser un número positivo."
      );
      return null;
    }
    if (typeof status !== "string" || status.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "OrderManager: El estado del pedido debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (typeof shippingAddress !== "object" || shippingAddress === null) {
      this.#logToConsole(
        "WARN",
        "OrderManager: La dirección de envío debe ser un objeto válido. Se usará un objeto vacío."
      );
      shippingAddress = {};
    }

    const newOrder = this.#createOrderEntry(
      userId,
      items,
      total,
      status,
      shippingAddress
    );
    this.#orders.push(newOrder);
    this.#saveOrders();
    this.#logToConsole("INFO", "Nuevo pedido añadido:", newOrder);
    return newOrder;
  }

  /**
   * Recupera pedidos con opciones de filtrado y ordenamiento.
   * @param {Object} [options={}] - Opciones de filtrado y ordenamiento.
   * @param {string} [options.userId] - Filtra por ID de usuario.
   * @param {string} [options.status] - Filtra por estado del pedido (ej. 'pending', 'completed').
   * @param {Date|number} [options.startDate] - Fecha de inicio para el rango de tiempo (Date object o timestamp).
   * @param {Date|number} [options.endDate] - Fecha de fin para el rango de tiempo (Date object o timestamp).
   * @param {number} [options.minTotal] - Filtra por un monto total mínimo.
   * @param {number} [options.maxTotal] - Filtra por un monto total máximo.
   * @param {'asc'|'desc'} [options.sortByTimestamp='desc'] - Ordena por timestamp (ascendente o descendente).
   * @returns {Array<Object>} Un array de objetos, donde cada objeto es un pedido.
   */
  getOrders(options = {}) {
    let filteredOrders = [...this.#orders];

    if (options.userId) {
      filteredOrders = filteredOrders.filter(
        (order) => order.userId === options.userId
      );
    }
    if (options.status) {
      filteredOrders = filteredOrders.filter(
        (order) => order.status === options.status
      );
    }
    if (
      options.minTotal !== undefined &&
      typeof options.minTotal === "number"
    ) {
      filteredOrders = filteredOrders.filter(
        (order) => order.total >= options.minTotal
      );
    }
    if (
      options.maxTotal !== undefined &&
      typeof options.maxTotal === "number"
    ) {
      filteredOrders = filteredOrders.filter(
        (order) => order.total <= options.maxTotal
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
      filteredOrders = filteredOrders.filter((order) => {
        return order.createdAt >= start && order.createdAt <= end;
      });
    }

    // Aplicar ordenamiento
    if (options.sortByTimestamp === "asc") {
      filteredOrders.sort((a, b) => a.createdAt - b.createdAt);
    } else {
      // default 'desc'
      filteredOrders.sort((a, b) => b.createdAt - a.createdAt);
    }

    return filteredOrders;
  }

  /**
   * Obtiene un pedido por su ID.
   * @param {string} orderId - El ID único del pedido.
   * @returns {Object|undefined} El pedido encontrado o undefined si no existe.
   */
  getOrderById(orderId) {
    return this.#orders.find((order) => order.id === orderId);
  }

  /**
   * Actualiza un pedido existente por su ID.
   * @param {string} orderId - El ID del pedido a actualizar.
   * @param {Object} updates - Un objeto con las propiedades a actualizar (ej. { status: 'completed', total: 150.00 }).
   * @returns {Object|null} El pedido actualizado o null si no se encontró o la actualización falla.
   */
  updateOrder(orderId, updates) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Pedidos está deshabilitado. No se actualizó el pedido."
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
        "OrderManager: Las actualizaciones deben ser un objeto no vacío."
      );
      return null;
    }

    const orderIndex = this.#orders.findIndex((order) => order.id === orderId);
    if (orderIndex === -1) {
      this.#logToConsole(
        "WARN",
        `OrderManager: No se encontró el pedido con ID ${orderId} para actualizar.`
      );
      return null;
    }

    const currentOrder = this.#orders[orderIndex];
    let updated = false;

    // Aplica las actualizaciones con validación
    if (Object.prototype.hasOwnProperty.call(updates, "status")) {
      if (
        typeof updates.status === "string" &&
        updates.status.trim().length > 0
      ) {
        const newStatus = updates.status.trim();
        if (currentOrder.status !== newStatus) {
          currentOrder.status = newStatus;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'status' con un valor inválido."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "total")) {
      if (typeof updates.total === "number" && updates.total >= 0) {
        if (currentOrder.total !== updates.total) {
          currentOrder.total = updates.total;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'total' con un valor inválido."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "items")) {
      if (Array.isArray(updates.items) && updates.items.length > 0) {
        // Una actualización profunda de items podría ser más compleja, aquí se sobrescribe directamente.
        // Podrías implementar un merge o validación de estructura de items si es necesario.
        if (
          JSON.stringify(currentOrder.items) !== JSON.stringify(updates.items)
        ) {
          currentOrder.items = [...updates.items];
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'items' con un array inválido o vacío."
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "shippingAddress")) {
      if (
        typeof updates.shippingAddress === "object" &&
        updates.shippingAddress !== null
      ) {
        // Similar a items, aquí se sobrescribe directamente.
        if (
          JSON.stringify(currentOrder.shippingAddress) !==
          JSON.stringify(updates.shippingAddress)
        ) {
          currentOrder.shippingAddress = { ...updates.shippingAddress };
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "Intento de actualizar 'shippingAddress' con un valor inválido."
        );
      }
    }

    if (updated) {
      currentOrder.updatedAt = Date.now(); // Actualizar timestamp
      this.#saveOrders();
      this.#logToConsole(
        "INFO",
        `Pedido con ID ${orderId} actualizado:`,
        currentOrder
      );
      return currentOrder;
    } else {
      this.#logToConsole(
        "INFO",
        `Pedido con ID ${orderId} no requirió actualización (no hubo cambios o actualizaciones inválidas).`
      );
      return currentOrder;
    }
  }

  /**
   * Elimina un pedido específico por su ID.
   * @param {string} orderId - El ID del pedido a eliminar.
   * @returns {boolean} True si el pedido fue eliminado, false de lo contrario.
   */
  removeOrder(orderId) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Pedidos está deshabilitado. No se eliminó el pedido."
      );
      return false;
    }
    const initialLength = this.#orders.length;
    this.#orders = this.#orders.filter((order) => order.id !== orderId);
    if (this.#orders.length < initialLength) {
      this.#saveOrders();
      this.#logToConsole("INFO", `Pedido con ID ${orderId} eliminado.`);
      return true;
    }
    this.#logToConsole(
      "WARN",
      `No se encontró el pedido con ID ${orderId} para eliminar.`
    );
    return false;
  }

  /**
   * Limpia todos los pedidos (o los de un usuario/estado específico).
   * @param {Object} [options={}] - Opciones de limpieza.
   * @param {string} [options.userId] - Opcional. Si se proporciona, limpia solo los pedidos de ese usuario.
   * @param {string} [options.status] - Opcional. Si se proporciona, limpia solo los pedidos con ese estado.
   * @returns {number} El número de pedidos eliminados.
   */
  clearOrders(options = {}) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Gestor de Pedidos está deshabilitado. No se limpiaron los pedidos."
      );
      return 0;
    }
    const initialLength = this.#orders.length;
    let filteredForRemoval = [...this.#orders];

    if (options.userId) {
      filteredForRemoval = filteredForRemoval.filter(
        (order) => order.userId === options.userId
      );
    }
    if (options.status) {
      filteredForRemoval = filteredForRemoval.filter(
        (order) => order.status === options.status
      );
    }

    // Si no hay filtros, o los filtros resultan en todos los pedidos, limpiar todo.
    if (!options.userId && !options.status) {
      this.#orders = [];
    } else {
      // Eliminar los pedidos filtrados del array original
      const idsToRemove = new Set(filteredForRemoval.map((order) => order.id));
      this.#orders = this.#orders.filter((order) => !idsToRemove.has(order.id));
    }

    const removedCount = initialLength - this.#orders.length;

    if (removedCount > 0) {
      this.#saveOrders();
      this.#logToConsole(
        "INFO",
        `Se eliminaron ${removedCount} pedidos ${
          options.userId ? `para el usuario '${options.userId}'` : ""
        }${options.status ? ` con estado '${options.status}'` : ""}.`
      );
    } else {
      this.#logToConsole(
        "INFO",
        `No se encontraron pedidos para limpiar ${
          options.userId ? `para el usuario '${options.userId}'` : ""
        }${options.status ? ` con estado '${options.status}'` : ""}.`
      );
    }
    return removedCount;
  }

  /**
   * Limpia los pedidos que son más antiguos que un tiempo dado.
   * @param {number} maxAgeMs - La edad máxima en milisegundos para mantener los pedidos.
   * Ej: 30 días = 30 * 24 * 60 * 60 * 1000
   * @returns {number} El número de entradas eliminadas.
   */
  purgeOldOrders(maxAgeMs) {
    const cutoffTime = Date.now() - maxAgeMs;
    const initialLength = this.#orders.length;
    this.#orders = this.#orders.filter((order) => {
      return order.createdAt >= cutoffTime;
    });
    const purgedCount = initialLength - this.#orders.length;
    if (purgedCount > 0) {
      this.#saveOrders();
      this.#logToConsole(
        "INFO",
        `OrderManager: Se purgaron ${purgedCount} pedidos más antiguos que ${
          maxAgeMs / (1000 * 60 * 60 * 24)
        } días.`
      );
    } else {
      this.#logToConsole(
        "DEBUG",
        "OrderManager: No se encontraron pedidos para purgar."
      );
    }
    return purgedCount;
  }

  /**
   * Obtiene el número total de pedidos o el número de pedidos de un usuario/estado específico.
   * @param {Object} [options={}] - Opciones de conteo.
   * @param {string} [options.userId] - Opcional. Si se proporciona, cuenta los pedidos de ese usuario.
   * @param {string} [options.status] - Opcional. Si se proporciona, cuenta los pedidos con ese estado.
   * @returns {number} El número de pedidos.
   */
  getOrderCount(options = {}) {
    let count = this.#orders.length;
    if (options.userId) {
      count = this.#orders.filter(
        (order) => order.userId === options.userId
      ).length;
    }
    if (options.status) {
      count = this.#orders.filter(
        (order) => order.status === options.status
      ).length;
    }
    return count;
  }

  /**
   * Exporta todos los pedidos almacenados como una cadena JSON.
   * @returns {string} Una cadena JSON que representa todos los pedidos.
   * @throws {Error} Si los pedidos no pueden ser serializados.
   */
  exportOrders() {
    try {
      return JSON.stringify(this.#orders, null, 2); // Formato legible
    } catch (error) {
      this.#logToConsole("ERROR", "Error al exportar pedidos:", error);
      return "[]";
    }
  }

  /**
   * Restablece la instancia de OrderManager a su estado inicial, borrando pedidos y reiniciando la configuración.
   * @param {Object} [newOptions={}] - Nuevas opciones de configuración para aplicar después del reinicio.
   */
  reset(newOptions = {}) {
    this.#logToConsole(
      "WARN",
      "OrderManager: Reiniciando la instancia (borrando pedidos y configuración)..."
    );
    this.clearOrders(); // Limpiar todos los pedidos
    this.#config = {
      isEnabled: true,
      debounceDelay: 200,
      logLevel: "INFO",
      logSource: "frontend-order",
    };
    // Aplicar nuevas opciones si se proporcionan
    this.#config = { ...this.#config, ...newOptions };
    // Validar el nivel de log después de aplicar las nuevas opciones
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#logToConsole(
      "INFO",
      "OrderManager reiniciado con la configuración:",
      this.#config
    );
  }

  /**
   * Actualiza la configuración de OrderManager.
   * @param {Object} newConfig - Objeto con las propiedades de configuración a actualizar.
   */
  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    if (newConfig.logLevel) {
      this.#config.logLevel = this.#validateLogLevel(newConfig.logLevel);
    }
    this.#logToConsole(
      "INFO",
      "OrderManager: Configuración actualizada:",
      this.#config
    );
  }

  /**
   * Obtiene la configuración actual de OrderManager.
   * @returns {Object} La configuración actual.
   */
  getConfig() {
    return { ...this.#config }; // Devolver una copia para evitar modificaciones directas
  }
}

// Exportar la clase para su uso con módulos ES
export default OrderManager;
