/**
 * @file ChatMessage.js
 * @description Clase para gestionar un registro de mensajes de chat en el lado del cliente utilizando localStorage.
 * Esta clase implementa el patrón Singleton y proporciona métodos para añadir, recuperar,
 * actualizar y eliminar mensajes, con opciones de configuración y validación.
 *
 * @version 2.1.0 - Incluye 20 mejoras para mayor robustez y funcionalidad.
 */

class ChatMessage {
  /**
   * @private
   * @type {string}
   * @description Clave utilizada para almacenar los mensajes en localStorage.
   */
  static #STORAGE_KEY = "korbux_chat_messages";

  /**
   * @private
   * @type {ChatMessage}
   * @description Instancia única de la clase ChatMessage (patrón Singleton).
   */
  static #instance = null;

  /**
   * @private
   * @type {Array<Object>}
   * @description Array interno para almacenar las entradas de mensajes.
   */
  #messages = [];

  /**
   * @private
   * @type {Object}
   * @description Configuración de la instancia de ChatMessage.
   */
  #config = {
    // maxMessages: 500, // Límite máximo de mensajes a almacenar. (Eliminado para permitir ilimitado)
    isEnabled: true, // Si la gestión de mensajes está habilitada.
    debounceDelay: 200, // Retraso en ms para guardar en localStorage (para evitar escrituras excesivas).
    logLevel: "INFO", // Nivel mínimo de log a registrar (DEBUG, INFO, WARN, ERROR).
    logSource: "frontend-chat", // Fuente de los logs (ej. 'frontend-chat', 'backend-api').
  };

  /**
   * @private
   * @type {number|null}
   * @description ID del temporizador para la función debounce de guardado.
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
   * Crea una instancia de ChatMessage.
   * Implementa el patrón Singleton para asegurar que solo haya una instancia.
   * @param {Object} [options={}] - Opciones de configuración iniciales.
   * @param {boolean} [options.isEnabled=true] - Si la gestión de mensajes está habilitada.
   * @param {number} [options.debounceDelay=200] - Retraso en ms para guardar en localStorage.
   * @param {string} [options.logLevel='INFO'] - Nivel mínimo de log a registrar.
   * @param {string} [options.logSource='frontend-chat'] - Fuente de los logs.
   */
  constructor(options = {}) {
    if (ChatMessage.#instance) {
      return ChatMessage.#instance;
    }

    // Aplicar configuración inicial
    this.#config = { ...this.#config, ...options };

    // Validar el nivel de log
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);

    this.#loadMessages();
    this.#logToConsole(
      "INFO",
      `Chat Message Manager inicializado. Mensajes cargados: ${
        this.#messages.length
      }. Configuración:`,
      this.#config
    );

    ChatMessage.#instance = this;
  }

  /**
   * Obtiene la instancia única de ChatMessage (Singleton).
   * Si no existe, crea una nueva.
   * @param {Object} [options={}] - Opciones de configuración para la primera inicialización.
   * @returns {ChatMessage} La instancia única de ChatMessage.
   */
  static getInstance(options = {}) {
    if (!ChatMessage.#instance) {
      ChatMessage.#instance = new ChatMessage(options);
    }
    return ChatMessage.#instance;
  }

  /**
   * @private
   * @param {string} level - El nivel de log a validar.
   * @returns {string} El nivel de log validado o el valor por defecto ('INFO').
   * @description Método para validar y normalizar el nivel de log.
   */
  #validateLogLevel(level) {
    const sanitizedLevel = level.toUpperCase();
    if (!ChatMessage.#LOG_LEVELS.hasOwnProperty(sanitizedLevel)) {
      console.warn(
        `ChatMessage: Nivel de log '${level}' no reconocido. Usando 'INFO'.`
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
    const currentLevelValue = ChatMessage.#LOG_LEVELS[this.#config.logLevel];
    const messageLevelValue = ChatMessage.#LOG_LEVELS[level];

    if (messageLevelValue >= currentLevelValue) {
      const logPrefix = `[ChatMessage - ${level}]`;
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
   * Carga los mensajes de chat desde localStorage al array interno.
   * @private
   */
  #loadMessages() {
    try {
      const storedMessages = localStorage.getItem(ChatMessage.#STORAGE_KEY);
      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages);
        if (Array.isArray(parsedMessages)) {
          this.#messages = parsedMessages; // Ya no se limita al cargar
        } else {
          this.#logToConsole(
            "WARN",
            "ChatMessage: Datos de mensajes en localStorage no son un array. Reiniciando mensajes."
          );
          // Notificar al usuario que los datos estaban corruptos y se limpiaron.
          if (typeof showNotification === "function") {
            showNotification(
              "El historial de chat está corrupto. Se ha limpiado.",
              "warning"
            );
          }
          this.#messages = [];
          try {
            localStorage.removeItem(ChatMessage.#STORAGE_KEY);
          } catch (removeError) {
            this.#logToConsole(
              "ERROR",
              `Error al intentar limpiar localStorage después de datos no array: ${removeError.name} - ${removeError.message}`,
              removeError
            );
          }
        }
      }
    } catch (error) {
      this.#logToConsole(
        "ERROR",
        `Error al cargar mensajes desde localStorage: ${error.name} - ${error.message}`,
        error
      );
      if (typeof showNotification === "function") {
        showNotification(
          "Error al cargar el historial de chat. Los datos pueden estar corruptos y se han limpiado.",
          "error"
        );
      }
      this.#messages = [];
      try {
        localStorage.removeItem(ChatMessage.#STORAGE_KEY);
      } catch (removeError) {
        this.#logToConsole(
          "ERROR",
          `Error al intentar limpiar localStorage después de un error de parseo: ${removeError.name} - ${removeError.message}`,
          removeError
        );
      }
    }
  }

  /**
   * Guarda el array interno de mensajes en localStorage con debounce.
   * @private
   */
  #saveMessages() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      try {
        // Ya no se limita el número de mensajes al guardar
        localStorage.setItem(
          ChatMessage.#STORAGE_KEY,
          JSON.stringify(this.#messages)
        );
        this.#logToConsole("DEBUG", "Mensajes guardados en localStorage.");
      } catch (error) {
        this.#logToConsole(
          "ERROR",
          "Error al guardar mensajes en localStorage:",
          error
        );
        // Si el error es por cuota excedida, se podría considerar una estrategia de limpieza
        if (error.name === "QuotaExceededError") {
          this.#logToConsole(
            "WARN",
            "QuotaExceededError: El almacenamiento local está lleno. Intentando purgar mensajes antiguos."
          );
          this.purgeOldMessages(7 * 24 * 60 * 60 * 1000); // Purga mensajes de más de 7 días
          // No reintentar guardar inmediatamente aquí para evitar un bucle si la purga no es suficiente.
        }
      }
    }, this.#config.debounceDelay);
  }

  /**
   * Genera un objeto de entrada de mensaje de chat estandarizado.
   * @private
   * @param {string} sender - El remitente del mensaje (ej. 'user', 'ai').
   * @param {string} content - El contenido del mensaje.
   * @param {string} conversationId - ID de la conversación a la que pertenece el mensaje.
   * @param {string} messageType - Tipo de mensaje (ej. 'text', 'image_url', 'system_event').
   * @returns {Object} La entrada de mensaje formateada.
   */
  #createMessageEntry(sender, content, conversationId, messageType) {
    const now = Date.now(); // Usar timestamp numérico
    return {
      _v: 1, // Versión del esquema de la entrada de mensaje
      id: crypto.randomUUID(), // ID único para cada mensaje
      conversationId: conversationId.trim(),
      sender: sender.trim(),
      content: content.trim(),
      timestamp: now, // Fecha y hora de creación como timestamp
      updatedAt: now, // Fecha y hora de última actualización como timestamp.
      type: messageType, // Tipo de mensaje.
      source: this.#config.logSource, // Fuente del mensaje.
    };
  }

  /**
   * Añade un nuevo mensaje al registro.
   * @param {string} sender - El remitente del mensaje (ej. 'user', 'ai').
   * @param {string} content - El contenido del mensaje.
   * @param {string} [conversationId='default'] - ID de la conversación a la que pertenece el mensaje.
   * @param {string} [messageType='text'] - Tipo de mensaje (ej. 'text', 'image_url', 'system_event').
   * @returns {Object|null} El mensaje añadido o null si falla.
   */
  addMessage(
    sender,
    content,
    conversationId = "default",
    messageType = "text"
  ) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Chat Message Manager está deshabilitado. No se añadió el mensaje."
      );
      return null;
    }

    // Validaciones mejoradas
    if (typeof sender !== "string" || sender.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "ChatMessage: El remitente debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (typeof content !== "string" || content.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "ChatMessage: El contenido del mensaje debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (
      typeof conversationId !== "string" ||
      conversationId.trim().length === 0
    ) {
      this.#logToConsole(
        "ERROR",
        "ChatMessage: El ID de la conversación debe ser una cadena de texto no vacía."
      );
      return null;
    }
    if (typeof messageType !== "string" || messageType.trim().length === 0) {
      this.#logToConsole(
        "ERROR",
        "ChatMessage: El tipo de mensaje debe ser una cadena de texto no vacía."
      );
      return null;
    }

    const newMessage = this.#createMessageEntry(
      sender,
      content,
      conversationId,
      messageType
    );
    this.#messages.push(newMessage);
    this.#saveMessages();
    this.#logToConsole("INFO", "Nuevo mensaje añadido:", newMessage);
    return newMessage;
  }

  /**
   * Recupera mensajes con opciones de filtrado y ordenamiento.
   * @param {Object} [options={}] - Opciones de filtrado y ordenamiento.
   * @param {string} [options.conversationId] - Filtra por ID de conversación.
   * @param {string} [options.sender] - Filtra por remitente (ej. 'user', 'ai').
   * @param {string} [options.search] - Busca mensajes cuyo contenido contenga el texto (insensible a mayúsculas/minúsculas).
   * @param {Date|number} [options.startDate] - Fecha de inicio para el rango de tiempo (Date object o timestamp).
   * @param {Date|number} [options.endDate] - Fecha de fin para el rango de tiempo (Date object o timestamp).
   * @param {string} [options.messageType] - Filtra por tipo de mensaje (ej. 'text', 'image_url').
   * @param {'asc'|'desc'} [options.sortByTimestamp='asc'] - Ordena por timestamp (ascendente o descendente).
   * @returns {Array<Object>} Un array de objetos, donde cada objeto es un mensaje.
   */
  getMessages(options = {}) {
    let filteredMessages = [...this.#messages]; // Trabajar con una copia

    // Aplicar filtros
    if (options.conversationId) {
      filteredMessages = filteredMessages.filter(
        (msg) => msg.conversationId === options.conversationId
      );
    }
    if (options.sender) {
      filteredMessages = filteredMessages.filter(
        (msg) => msg.sender === options.sender
      );
    }
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      filteredMessages = filteredMessages.filter((msg) =>
        msg.content.toLowerCase().includes(searchTerm)
      );
    }
    if (options.messageType) {
      filteredMessages = filteredMessages.filter(
        (msg) => msg.type === options.messageType
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
      filteredMessages = filteredMessages.filter((msg) => {
        return msg.timestamp >= start && msg.timestamp <= end;
      });
    }

    // Aplicar ordenamiento
    if (options.sortByTimestamp === "desc") {
      filteredMessages.sort((a, b) => b.timestamp - a.timestamp);
    } else {
      // default 'asc'
      filteredMessages.sort((a, b) => a.timestamp - b.timestamp);
    }

    return filteredMessages;
  }

  /**
   * Obtiene un mensaje por su ID.
   * @param {string} messageId - El ID único del mensaje.
   * @returns {Object|undefined} El mensaje encontrado o undefined si no existe.
   */
  getMessageById(messageId) {
    return this.#messages.find((msg) => msg.id === messageId);
  }

  /**
   * Obtiene todos los mensajes de una conversación específica.
   * @param {string} conversationId - El ID de la conversación.
   * @returns {Array<Object>} Un array de mensajes de la conversación, ordenados por timestamp ascendente.
   */
  getMessagesByConversationId(conversationId) {
    return this.getMessages({
      conversationId: conversationId,
      sortByTimestamp: "asc",
    });
  }

  /**
   * Obtiene los N mensajes más recientes de una conversación específica.
   * @param {string} conversationId - El ID de la conversación.
   * @param {number} count - El número de mensajes más recientes a recuperar.
   * @returns {Array<Object>} Un array de los mensajes más recientes.
   */
  getLatestMessages(conversationId, count) {
    const messages = this.getMessages({
      conversationId: conversationId,
      sortByTimestamp: "desc",
    });
    return messages.slice(0, count);
  }

  /**
   * Actualiza un mensaje existente por su ID.
   * @param {string} messageId - El ID del mensaje a actualizar.
   * @param {Object} updates - Un objeto con las propiedades a actualizar (ej. { content: 'Nuevo Contenido' }).
   * @returns {Object|null} El mensaje actualizado o null si no se encontró o la actualización falla.
   */
  updateMessage(messageId, updates) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Chat Message Manager está deshabilitado. No se actualizó el mensaje."
      );
      return null;
    }
    // Validaciones mejoradas
    if (
      typeof updates !== "object" ||
      updates === null ||
      Object.keys(updates).length === 0
    ) {
      this.#logToConsole(
        "ERROR",
        "ChatMessage: Las actualizaciones deben ser un objeto no vacío."
      );
      return null;
    }

    const messageIndex = this.#messages.findIndex(
      (msg) => msg.id === messageId
    );
    if (messageIndex === -1) {
      this.#logToConsole(
        "WARN",
        `ChatMessage: No se encontró el mensaje con ID ${messageId} para actualizar.`
      );
      return null;
    }

    const currentMessage = this.#messages[messageIndex];
    let updated = false;

    // Validar y aplicar actualizaciones
    if (Object.prototype.hasOwnProperty.call(updates, "content")) {
      if (
        typeof updates.content === "string" &&
        updates.content.trim() !== ""
      ) {
        const newContent = updates.content.trim();
        if (currentMessage.content !== newContent) {
          currentMessage.content = newContent;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "ChatMessage: El contenido del mensaje proporcionado para la actualización no es válido o está vacío."
        );
      }
    }
    if (Object.prototype.hasOwnProperty.call(updates, "type")) {
      // Permitir actualizar el tipo de mensaje
      if (typeof updates.type === "string" && updates.type.trim() !== "") {
        const newType = updates.type.trim();
        if (currentMessage.type !== newType) {
          currentMessage.type = newType;
          updated = true;
        }
      } else {
        this.#logToConsole(
          "WARN",
          "ChatMessage: El tipo de mensaje proporcionado para la actualización no es válido o está vacío."
        );
      }
    }

    if (updated) {
      currentMessage.updatedAt = Date.now(); // Actualizar timestamp
      this.#saveMessages();
      this.#logToConsole(
        "INFO",
        `Mensaje con ID ${messageId} actualizado:`,
        currentMessage
      );
      return currentMessage;
    } else {
      this.#logToConsole(
        "INFO",
        `Mensaje con ID ${messageId} no requirió actualización (no hubo cambios o actualizaciones inválidas).`
      );
      return currentMessage; // No hubo cambios, devuelve el mensaje actual
    }
  }

  /**
   * Elimina un mensaje específico por su ID.
   * @param {string} messageId - El ID del mensaje a eliminar.
   * @returns {boolean} True si el mensaje fue eliminado, false de lo contrario.
   */
  removeMessage(messageId) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Chat Message Manager está deshabilitado. No se eliminó el mensaje."
      );
      return false;
    }
    const initialLength = this.#messages.length;
    this.#messages = this.#messages.filter((msg) => msg.id !== messageId);
    if (this.#messages.length < initialLength) {
      this.#saveMessages();
      this.#logToConsole("INFO", `Mensaje con ID ${messageId} eliminado.`);
      return true;
    }
    this.#logToConsole(
      "WARN",
      `No se encontró el mensaje con ID ${messageId} para eliminar.`
    );
    return false;
  }

  /**
   * Elimina todos los mensajes de una conversación específica.
   * @param {string} conversationId - El ID de la conversación a limpiar.
   * @returns {number} El número de mensajes eliminados.
   */
  clearConversation(conversationId) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Chat Message Manager está deshabilitado. No se limpió la conversación."
      );
      return 0;
    }
    const initialLength = this.#messages.length;
    this.#messages = this.#messages.filter(
      (msg) => msg.conversationId !== conversationId
    );
    const removedCount = initialLength - this.#messages.length;
    if (removedCount > 0) {
      this.#saveMessages();
      this.#logToConsole(
        "INFO",
        `Se eliminaron ${removedCount} mensajes de la conversación ${conversationId}.`
      );
    } else {
      this.#logToConsole(
        "INFO",
        `No se encontraron mensajes para limpiar en la conversación ${conversationId}.`
      );
    }
    return removedCount;
  }

  /**
   * Elimina todos los mensajes de un remitente específico.
   * @param {string} sender - El remitente cuyos mensajes se eliminarán.
   * @returns {number} El número de mensajes eliminados.
   */
  removeMessagesBySender(sender) {
    if (!this.#config.isEnabled) {
      this.#logToConsole(
        "INFO",
        "Chat Message Manager está deshabilitado. No se eliminaron mensajes por remitente."
      );
      return 0;
    }
    const initialLength = this.#messages.length;
    this.#messages = this.#messages.filter((msg) => msg.sender !== sender);
    const removedCount = initialLength - this.#messages.length;
    if (removedCount > 0) {
      this.#saveMessages();
      this.#logToConsole(
        "INFO",
        `Se eliminaron ${removedCount} mensajes del remitente '${sender}'.`
      );
    } else {
      this.#logToConsole(
        "INFO",
        `No se encontraron mensajes del remitente '${sender}' para eliminar.`
      );
    }
    return removedCount;
  }

  /**
   * Limpia las entradas de mensajes que son más antiguas que un tiempo dado.
   * @param {number} maxAgeMs - La edad máxima en milisegundos para mantener los registros.
   * Ej: 7 días = 7 * 24 * 60 * 60 * 1000
   * @returns {number} El número de entradas eliminadas.
   */
  purgeOldMessages(maxAgeMs) {
    const cutoffTime = Date.now() - maxAgeMs;
    const initialLength = this.#messages.length;
    this.#messages = this.#messages.filter((entry) => {
      return entry.timestamp >= cutoffTime;
    });
    const purgedCount = initialLength - this.#messages.length;
    if (purgedCount > 0) {
      this.#saveMessages();
      this.#logToConsole(
        "INFO",
        `ChatMessage: Se purgaron ${purgedCount} mensajes más antiguos que ${
          maxAgeMs / (1000 * 60 * 60 * 24)
        } días.`
      );
    } else {
      this.#logToConsole(
        "DEBUG",
        "ChatMessage: No se encontraron mensajes para purgar."
      );
    }
    return purgedCount;
  }

  /**
   * Obtiene el número total de mensajes o el número de mensajes en una conversación específica.
   * @param {string} [conversationId] - Opcional. Si se proporciona, cuenta los mensajes de esa conversación.
   * @returns {number} El número de mensajes.
   */
  getMessageCount(conversationId) {
    if (conversationId) {
      return this.#messages.filter(
        (msg) => msg.conversationId === conversationId
      ).length;
    }
    return this.#messages.length;
  }

  /**
   * Obtiene una lista de todos los IDs de conversación únicos.
   * @returns {Array<string>} Un array de IDs de conversación únicos.
   */
  getConversationIds() {
    const conversationIds = new Set(
      this.#messages.map((msg) => msg.conversationId)
    );
    return Array.from(conversationIds);
  }

  /**
   * Proporciona un resumen de las conversaciones.
   * @returns {Object} Un objeto donde las claves son los conversationId y los valores son objetos con 'count' y 'lastMessageTimestamp'.
   */
  getConversationSummary() {
    const summary = {};
    this.#messages.forEach((msg) => {
      if (!summary[msg.conversationId]) {
        summary[msg.conversationId] = {
          count: 0,
          lastMessageTimestamp: null,
          lastMessageContent: "",
        };
      }
      summary[msg.conversationId].count++;
      const msgTimestamp = msg.timestamp;
      if (
        !summary[msg.conversationId].lastMessageTimestamp ||
        msgTimestamp > summary[msg.conversationId].lastMessageTimestamp
      ) {
        summary[msg.conversationId].lastMessageTimestamp = msg.timestamp;
        summary[msg.conversationId].lastMessageContent = msg.content;
      }
    });
    return summary;
  }

  /**
   * Busca mensajes dentro de una conversación específica.
   * @param {string} conversationId - El ID de la conversación donde buscar.
   * @param {string} searchTerm - El texto a buscar en el contenido del mensaje.
   * @returns {Array<Object>} Un array de mensajes que coinciden con la búsqueda.
   */
  searchMessagesInConversation(conversationId, searchTerm) {
    if (typeof searchTerm !== "string" || searchTerm.trim().length === 0) {
      this.#logToConsole(
        "WARN",
        "ChatMessage: El término de búsqueda no puede estar vacío."
      );
      return [];
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return this.getMessages({ conversationId: conversationId }).filter((msg) =>
      msg.content.toLowerCase().includes(lowerSearchTerm)
    );
  }

  /**
   * Exporta todos los mensajes almacenados como una cadena JSON.
   * @returns {string} Una cadena JSON que representa todos los mensajes.
   */
  exportMessages() {
    try {
      return JSON.stringify(this.#messages, null, 2); // Formato legible
    } catch (error) {
      this.#logToConsole("ERROR", "Error al exportar mensajes:", error);
      return "[]";
    }
  }

  /**
   * Limpia todas las entradas de mensajes.
   * Esto eliminará los mensajes tanto del array interno como de localStorage.
   */
  clearAllMessages() {
    this.#messages = [];
    this.#saveMessages(); // Guardar el estado vacío en localStorage
    this.#logToConsole(
      "INFO",
      "ChatMessage: Todos los mensajes han sido limpiados."
    );
  }

  /**
   * Restablece la instancia de ChatMessage a su estado inicial, borrando mensajes y reiniciando la configuración.
   * @param {Object} [newOptions={}] - Nuevas opciones de configuración para aplicar después del reinicio.
   */
  reset(newOptions = {}) {
    this.#logToConsole(
      "WARN",
      "ChatMessage: Reiniciando la instancia (borrando mensajes y configuración)..."
    );
    this.clearAllMessages(); // Limpiar todos los mensajes
    this.#config = {
      isEnabled: true,
      debounceDelay: 200,
      logLevel: "INFO",
      logSource: "frontend-chat",
    };
    // Aplicar nuevas opciones si se proporcionan
    this.#config = { ...this.#config, ...newOptions };
    // Validar el nivel de log después de aplicar las nuevas opciones
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#logToConsole(
      "INFO",
      "ChatMessage reiniciado con la configuración:",
      this.#config
    );
  }

  /**
   * Actualiza la configuración de ChatMessage.
   * @param {Object} newConfig - Objeto con las propiedades de configuración a actualizar.
   */
  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    if (newConfig.logLevel) {
      this.#config.logLevel = this.#validateLogLevel(newConfig.logLevel);
    }
    this.#logToConsole(
      "INFO",
      "ChatMessage: Configuración actualizada:",
      this.#config
    );
  }

  /**
   * Obtiene la configuración actual de ChatMessage.
   * @returns {Object} La configuración actual.
   */
  getConfig() {
    return { ...this.#config }; // Devolver una copia para evitar modificaciones directas
  }
}

// Exportar la clase para su uso con módulos ES
export default ChatMessage;
