
/**
 * @file ChatMessage.js
 * @description Clase para gestionar un registro de mensajes de chat en el lado del cliente utilizando localStorage.
 * Implementa el patrón Singleton y proporciona métodos para añadir, recuperar,
 * actualizar y eliminar mensajes, con opciones de configuración y validación.
 *
 * @version 1.2.0 - Correcciones y añadido registroInteraccion.
 */

class ChatMessage {
  static #STORAGE_KEY = "korbux_chat_messages";
  static #instance = null;

  #messages = [];
  #config = {
    isEnabled: true,
    debounceDelay: 200,
    logLevel: "INFO",
  };
  #saveTimer = null;

  static #LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  constructor(options = {}) {
    if (ChatMessage.#instance) {
      return ChatMessage.#instance;
    }
    this.#config = { ...this.#config, ...options };
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#loadMessages();
    this.#logToConsole(
      "INFO",
      `Chat Message Manager inicializado. Mensajes cargados: ${this.#messages.length}. Configuración:`,
      this.#config
    );
    ChatMessage.#instance = this;
  }

  static getInstance(options = {}) {
    if (!ChatMessage.#instance) {
      ChatMessage.#instance = new ChatMessage(options);
    }
    return ChatMessage.#instance;
  }

  #validateLogLevel(level) {
    const sanitizedLevel = String(level).toUpperCase();
    if (!ChatMessage.#LOG_LEVELS.hasOwnProperty(sanitizedLevel)) {
      console.warn(
        `ChatMessage: Nivel de log '${level}' no reconocido. Usando 'INFO'.`
      );
      return "INFO";
    }
    return sanitizedLevel;
  }

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

  #loadMessages() {
    try {
      const storedMessages = localStorage.getItem(ChatMessage.#STORAGE_KEY);
      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages);
        if (Array.isArray(parsedMessages)) {
          this.#messages = parsedMessages;
        } else {
          this.#logToConsole(
            "WARN",
            "ChatMessage: Datos corruptos en localStorage. Reiniciando."
          );
          this.#messages = [];
          localStorage.removeItem(ChatMessage.#STORAGE_KEY);
        }
      }
    } catch (error) {
      this.#logToConsole("ERROR", "Error al cargar mensajes:", error);
      this.#messages = [];
      localStorage.removeItem(ChatMessage.#STORAGE_KEY);
    }
  }

  #saveMessages() {
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          ChatMessage.#STORAGE_KEY,
          JSON.stringify(this.#messages)
        );
        this.#logToConsole("DEBUG", "Mensajes guardados en localStorage.");
      } catch (error) {
        this.#logToConsole("ERROR", "Error al guardar mensajes:", error);
        if (error.name === "QuotaExceededError") {
          this.#logToConsole(
            "WARN",
            "QuotaExceededError: El almacenamiento local está lleno."
          );
        }
      }
    }, this.#config.debounceDelay);
  }

  #createMessageEntry(sender, content, conversationId) {
    const now = Date.now();
    return {
      _v: 1,
      id: crypto.randomUUID(),
      conversationId: conversationId.trim(),
      sender: sender.trim(),
      content: content.trim(),
      timestamp: now,
    };
  }

  addMessage(sender, content, conversationId = "default") {
    if (!this.#config.isEnabled) {
      this.#logToConsole("INFO", "Gestión deshabilitada. No se añadió mensaje.");
      return null;
    }
    if (typeof sender !== "string" || !sender.trim()) {
      this.#logToConsole("ERROR", "Remitente inválido.");
      return null;
    }
    if (typeof content !== "string" || !content.trim()) {
      this.#logToConsole("ERROR", "Contenido inválido.");
      return null;
    }
    if (typeof conversationId !== "string" || !conversationId.trim()) {
      this.#logToConsole("ERROR", "ConversationId inválido.");
      return null;
    }

    const newMessage = this.#createMessageEntry(sender, content, conversationId);
    this.#messages.push(newMessage);
    this.#saveMessages();
    this.#logToConsole("INFO", "Nuevo mensaje añadido:", newMessage);
    return newMessage;
  }

  getMessages(options = {}) {
    let filtered = [...this.#messages];
    if (options.conversationId) {
      filtered = filtered.filter(m => m.conversationId === options.conversationId);
    }
    if (options.sender) {
      filtered = filtered.filter(m => m.sender === options.sender);
    }
    if (options.search) {
      const term = options.search.toLowerCase();
      filtered = filtered.filter(m => m.content.toLowerCase().includes(term));
    }
    if (options.startDate || options.endDate) {
      const start = options.startDate ? new Date(options.startDate).getTime() : -Infinity;
      const end = options.endDate ? new Date(options.endDate).getTime() : Infinity;
      filtered = filtered.filter(m => m.timestamp >= start && m.timestamp <= end);
    }
    filtered.sort((a, b) =>
      options.sortByTimestamp === "desc" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );
    return filtered;
  }

  getMessageById(messageId) {
    return this.#messages.find(m => m.id === messageId);
  }

  updateMessage(messageId, updates) {
    if (!this.#config.isEnabled) return null;
    if (!updates || typeof updates !== "object") return null;
    const idx = this.#messages.findIndex(m => m.id === messageId);
    if (idx === -1) return null;
    const msg = this.#messages[idx];
    let updated = false;
    if (updates.content && typeof updates.content === "string" && updates.content.trim()) {
      msg.content = updates.content.trim();
      updated = true;
    }
    if (updated) {
      this.#saveMessages();
      this.#logToConsole("INFO", `Mensaje ${messageId} actualizado.`, msg);
    }
    return msg;
  }

  removeMessage(messageId) {
    const initial = this.#messages.length;
    this.#messages = this.#messages.filter(m => m.id !== messageId);
    if (this.#messages.length < initial) {
      this.#saveMessages();
      this.#logToConsole("INFO", `Mensaje ${messageId} eliminado.`);
      return true;
    }
    return false;
  }

  clearConversation(conversationId) {
    const initial = this.#messages.length;
    this.#messages = this.#messages.filter(m => m.conversationId !== conversationId);
    const removed = initial - this.#messages.length;
    if (removed > 0) this.#saveMessages();
    return removed;
  }

  clearAllMessages() {
    this.#messages = [];
    this.#saveMessages();
    this.#logToConsole("INFO", "Todos los mensajes han sido limpiados.");
  }

  reset(newOptions = {}) {
    this.clearAllMessages();
    this.#config = { isEnabled: true, debounceDelay: 200, logLevel: "INFO", ...newOptions };
    this.#config.logLevel = this.#validateLogLevel(this.#config.logLevel);
    this.#logToConsole("INFO", "ChatMessage reiniciado.", this.#config);
  }

  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    if (newConfig.logLevel) {
      this.#config.logLevel = this.#validateLogLevel(newConfig.logLevel);
    }
    this.#logToConsole("INFO", "Configuración actualizada:", this.#config);
  }

  getConfig() {
    return { ...this.#config };
  }

  /**
   * Registra una interacción de usuario en el sistema.
   * @param {string} usuarioId - Identificador único del usuario.
   * @param {string} mensajeUsuario - Mensaje enviado por el usuario.
   * @param {string} [conversationId='default'] - ID de la conversación asociada.
   * @returns {Object|null} Objeto con la interacción registrada o null si falla.
   */
  registroInteraccion(usuarioId, mensajeUsuario, conversationId = "default") {
    if (!this.#config.isEnabled) {
      this.#logToConsole("INFO", "Gestión deshabilitada. No se registró interacción.");
      return null;
    }

    if (typeof usuarioId !== "string" || !usuarioId.trim()) {
      this.#logToConsole("ERROR", "registroInteraccion: usuarioId inválido.");
      return null;
    }
    if (typeof mensajeUsuario !== "string" || !mensajeUsuario.trim()) {
      this.#logToConsole("ERROR", "registroInteraccion: mensajeUsuario inválido.");
      return null;
    }

    const entry = {
      _v: 1,
      id: crypto.randomUUID(),
      usuarioId: usuarioId.trim(),
      mensajeUsuario: mensajeUsuario.trim(),
      conversationId: conversationId.trim(),
      timestamp: new Date().toISOString()
    };

    this.#messages.push(entry);
    this.#saveMessages();
    this.#logToConsole("INFO", "Interacción registrada:", entry);

    return entry;
  }
}

