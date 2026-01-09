// services/validationService.js

/**
 * @file Servicio para la gestión de validaciones de negocio complejas.
 * @description Centraliza la lógica de validación reutilizable que va más allá de la validación
 * de esquemas de entrada básica, interactuando con la base de datos o aplicando reglas de negocio.
 * @module services/validationService
 */

const path = require("path");
const logger = require(path.join(__dirname, "..", "config", "logger.js")); // Importa tu logger
const { Errores } = require(path.join(__dirname, "..", "utils", "errores.js")); // Importa tus clases de errores personalizados

// Importa Sequelize y el operador Op si es necesario para validaciones de base de datos.
let sequelizeInstance;
let Op;

try {
  sequelizeInstance = require(path.join(
    __dirname,
    "..",
    "config",
    "database.js"
  )); // Asume que database.js exporta la instancia de Sequelize
  Op = sequelizeInstance.Op; // Obtener Op de la instancia de Sequelize
} catch (e) {
  logger.warn(
    "[ValidationService] No se pudo cargar Sequelize o el archivo de configuración de la base de datos. Las validaciones de unicidad de DB no funcionarán.",
    e.message
  );
  Op = {}; // Define un Op dummy para evitar errores de referencia.
}

// Importa los modelos que puedan necesitar validación de unicidad.
let UserModel;
try {
  UserModel = require(path.join(__dirname, "..", "models", "User.js"));
} catch (e) {
  logger.warn(
    "[ValidationService] No se pudo cargar el modelo User. Las validaciones de usuario no funcionarán.",
    e.message
  );
  UserModel = null;
}

/**
 * @class ValidationService
 * @description Clase que gestiona las operaciones de validación de datos y reglas de negocio.
 */
class ValidationService {
  constructor() {
    logger.info("[ValidationService] Servicio de validación inicializado.");
  }

  /**
   * Valida si un valor es único para un campo específico en un modelo dado.
   * Útil para verificar unicidad de emails, nombres de usuario, etc.
   *
   * @param {object} model - La instancia del modelo Sequelize (ej. `UserModel`).
   * @param {string} field - El nombre del campo a verificar (ej. 'email', 'username').
   * @param {any} value - El valor a comprobar si es único.
   * @param {string} [excludeId=null] - ID de un registro existente a excluir de la verificación (para actualizaciones).
   * @returns {Promise<boolean>} True si el valor es único, false en caso contrario.
   * @throws {Errores.BadRequestError} Si el modelo o campo son inválidos.
   * @throws {Errores.InternalServerError} Si ocurre un error de base de datos.
   */
  async isUnique(model, field, value, excludeId = null) {
    if (!model || typeof model.findOne !== "function") {
      logger.warn(
        "[ValidationService] Intento de validar unicidad con modelo inválido."
      );
      throw new Errores.BadRequestError(
        "Se requiere un modelo Sequelize válido para la validación de unicidad."
      );
    }
    if (!field || typeof field !== "string" || field.trim() === "") {
      logger.warn(
        `[ValidationService] Intento de validar unicidad con campo inválido: '${field}'.`
      );
      throw new Errores.BadRequestError(
        "El nombre del campo es requerido para la validación de unicidad."
      );
    }
    if (value === undefined || value === null) {
      logger.warn(
        `[ValidationService] Intento de validar unicidad con valor nulo/indefinido para campo '${field}'.`
      );
      return false;
    }

    try {
      const whereClause = { [field]: value };

      if (excludeId) {
        if (!Op || !Op.ne) {
          logger.warn(
            "[ValidationService] Operador Op.ne no disponible. La exclusión de ID para validación de unicidad no funcionará."
          );
        } else {
          whereClause[Op.and] = [
            { [field]: value },
            { id: { [Op.ne]: excludeId } },
          ];
        }
      }

      const existingRecord = await model.findOne({ where: whereClause });

      const isUnique = !existingRecord;
      logger.debug(
        `[ValidationService] Unicidad de '${value}' en '${field}' del modelo '${model.name}': ${isUnique}.`
      );
      return isUnique;
    } catch (error) {
      logger.error(
        `[ValidationService] Error al verificar unicidad de '${value}' en '${field}' del modelo '${model.name}':`,
        error
      );
      throw new Errores.InternalServerError(
        "Error al verificar la unicidad en la base de datos.",
        error
      );
    }
  }

  /**
   * Valida la fortaleza de una contraseña.
   *
   * @param {string} password - La contraseña a validar.
   * @param {object} [options={}] - Opciones de fortaleza.
   * @param {number} [options.minLength=8] - Longitud mínima requerida.
   * @param {boolean} [options.requireUppercase=true] - Requiere al menos una letra mayúscula.
   * @param {boolean} [options.requireLowercase=true] - Requiere al menos una letra minúscula.
   * @param {boolean} [options.requireDigit=true] - Requiere al menos un dígito.
   * @param {boolean} [options.requireSpecialChar=true] - Requiere al menos un carácter especial.
   * @returns {boolean} True si la contraseña cumple con los requisitos de fortaleza.
   * @throws {Errores.BadRequestError} Si la contraseña no cumple con los requisitos.
   */
  validatePasswordStrength(password, options = {}) {
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireDigit = true,
      requireSpecialChar = true,
    } = options;

    if (typeof password !== "string") {
      logger.warn(
        "[ValidationService] Intento de validar contraseña con tipo inválido."
      );
      throw new Errores.BadRequestError(
        "La contraseña debe ser una cadena de texto."
      );
    }

    const errors = [];

    if (password.length < minLength) {
      errors.push(`La contraseña debe tener al menos ${minLength} caracteres.`);
    }
    if (requireUppercase && !/[A-Z]/.test(password)) {
      errors.push("La contraseña debe contener al menos una letra mayúscula.");
    }
    if (requireLowercase && !/[a-z]/.test(password)) {
      errors.push("La contraseña debe contener al menos una letra minúscula.");
    }
    if (requireDigit && !/\d/.test(password)) {
      errors.push("La contraseña debe contener al menos un número.");
    }
    if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push(
        'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>).'
      );
    }

    if (errors.length > 0) {
      logger.warn(
        `[ValidationService] Contraseña no cumple requisitos: ${errors.join(" ")}`
      );
      throw new Errores.BadRequestError(
        `La contraseña no es lo suficientemente fuerte: ${errors.join(" ")}`
      );
    }

    logger.debug("[ValidationService] Contraseña validada con éxito.");
    return true;
  }

  /**
   * Valida el formato de una dirección de correo electrónico.
   * @param {string} email - La dirección de correo electrónico a validar.
   * @returns {boolean} True si el formato del email es válido.
   * @throws {Errores.BadRequestError} Si el formato del email es inválido.
   */
  validateEmailFormat(email) {
    if (typeof email !== "string" || email.trim() === "") {
      logger.warn(
        "[ValidationService] Intento de validar email vacío o inválido."
      );
      throw new Errores.BadRequestError(
        "El correo electrónico es requerido y debe ser una cadena válida."
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.warn(
        `[ValidationService] Formato de correo electrónico inválido: '${email}'.`
      );
      throw new Errores.BadRequestError(
        "Formato de correo electrónico inválido."
      );
    }
    logger.debug(
      `[ValidationService] Formato de correo electrónico '${email}' validado con éxito.`
    );
    return true;
  }

  /**
   * Valida que un valor sea un número entero positivo.
   * @param {any} value - El valor a validar.
   * @param {string} fieldName - Nombre del campo para mensajes de error.
   * @returns {boolean} True si es un entero positivo.
   * @throws {Errores.BadRequestError} Si no es un entero positivo.
   */
  validatePositiveInteger(value, fieldName) {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      logger.warn(
        `[ValidationService] El campo '${fieldName}' debe ser un entero positivo. Valor recibido: ${value}`
      );
      throw new Errores.BadRequestError(
        `El campo '${fieldName}' debe ser un entero positivo.`
      );
    }
    logger.debug(
      `[ValidationService] Campo '${fieldName}' validado como entero positivo: ${value}.`
    );
    return true;
  }
}

module.exports = new ValidationService();
    history.scrollTop = history.scrollHeight
  

  // Iniciar con el primer chat si existe
  if (chats.length > 0) {
    switchChat(chats[0].id);
  }

  // Manejar el envío de mensajes
  input.onsubmit = (e) => {
    e.preventDefault();
    const text = input.elements["message"].value.trim();
    if (text === "" || currentChatId === null) return;

    const chat = chats.find((c) => c.id === currentChatId);
    if (!chat) return;
    
    // Agregar mensaje del usuario
    const userMsg = { type: "u", text };
    chat.messages.push(userMsg);
    switchChat(currentChatId);

    // Simular respuesta del bot
    setTimeout(() => {
      const botResponses = textos[currentLang]?.responses || textos.es.responses;
      const botMsg = { type: "b", text: botResponses[Math.floor(Math.random() * botResponses.length)] };
      chat.messages.push(botMsg);
      switchChat(currentChatId);
    }, 1000);

    // Limpiar el input
    input.elements["message"].value = "";
    input.style.height = "auto"; // Reset de altura del textarea
  };

  function renderChats() {
    chatList.innerHTML = "";
    chats.forEach((chat) => {
      const chatItem = document.createElement("div");
      chatItem.className = "chat-item";
      if (chat.id === currentChatId) {
        chatItem.classList.add("active");
      }
      chatItem.textContent = chat.titles[currentLang] || chat.titles.es;
      chatItem.onclick = () => switchChat(chat.id);
      chatList.appendChild(chatItem);
    });
  }

  function switchChat(chatId) {
    currentChatId = chatId;
    renderChats();

    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    history.innerHTML = "";
    if (chat.messages.length === 0) {
      const welcomeMsg = document.createElement("div");
      welcomeMsg.className = "msg b";
      welcomeMsg.textContent = textos[currentLang]?.welcome || textos.es.welcome;
      history.appendChild(welcomeMsg);
    } else if (chat.messages.length === 1 && chat.messages[0].type === "b") {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.innerHTML = `<strong>Korbux:</strong><br>${chat.messages[0].text.replace(/\n/g, "<br>")}`;
      history.appendChild(msg);
    } else if (chat.messages.length === 0) {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.innerHTML = `<strong>Korbux:</strong><br>${textos[currentLang].welcome.replace(/\n/g, "<br>")}`;
      history.appendChild(msg); 
    } else if (chat.messages.length === 1 && chat.messages[0].type === "b") {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.innerHTML = `<strong>Korbux:</strong><br>${chat.messages[0].text.replace(/\n/g, "<br>")}`;
      history.appendChild(msg);
    } else if (chat.messages.length === 0) {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.innerHTML = `<strong>Korbux:</strong><br>${textos[currentLang].welcome.replace(/\n/g, "<br>")}`;
      history.appendChild(msg);
    } else if (chat.messages.length === 1 && chat.messages[0].type === "b") {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.innerHTML = `<strong>Korbux:</strong><br>${chat.messages[0].text.replace(/\n/g, "<br>")}`;
      history.appendChild(msg);
    } else if (chat.messages.length === 0) {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.innerHTML = `<strong>Korbux:</strong><br>${textos[currentLang].welcome.replace(/\n/g, "<br>")}`;
      history.appendChild(msg);
    } else if (chat.messages.length === 1 && chat.messages[0].type === "b") {
      const msg = document.createElement("div");
      msg.className = "msg b fade-in";
      msg.innerHTML = `<strong>Korbux:</strong><br>${chat.messages[0].text.replace(/\n/g, "<br>")}`;
      history.appendChild(msg);
    } else {
      chat.messages.forEach((m) => {
        const msg = document.createElement("div");
        msg.className = `msg ${m.type === "u" ? "u" : "b"} fade-in`;
        msg.innerHTML =
          m.type === "u"
            ? (m.text || "").replace(/\n/g, "<br>")
            : `<strong>Korbux:</strong><br>${m.text || ""}`;
        history.appendChild(msg);
      });
    }

    history.scrollTop = history.scrollHeight;
  } 